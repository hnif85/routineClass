import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { jwtVerify } from "jose";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify JWT — only admin / pemateri allowed
    const token = req.cookies.get("session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;
    if (!["super_admin", "admin", "event_admin", "trainer", "pemateri"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const s = await createServerSupabase();

    // 2. Parse body
    const body = await req.json();
    const {
      title, description, type, start_date, end_date, start_time, end_time,
      location, quota, registration_type, is_paid, price,
      trainerIds, externalNames,
      materialIds,
      kuesionerId,
      appIds,
    } = body;

    // Validate
    if (!title || !start_date) {
      return NextResponse.json({ error: "Judul dan tanggal mulai wajib diisi" }, { status: 400 });
    }
    if (!materialIds || materialIds.length === 0) {
      return NextResponse.json({ error: "Pilih minimal 1 materi untuk event ini" }, { status: 400 });
    }

    // 3. Fetch trainer names
    let allSpeakerNames = "";
    const trainerInserts: any[] = [];

    if (trainerIds && trainerIds.length > 0) {
      const { data: trainers } = await s
        .from("admin_users")
        .select("id, name, email")
        .in("id", trainerIds);
      if (trainers) {
        allSpeakerNames = trainers.map((t: any) => t.name).join(", ");
        trainerInserts.push(...trainers.map((t: any) => ({
          trainer_id: t.id,
          trainer_name: t.name,
          trainer_email: t.email,
          is_external: false,
        })));
      }
    }

    if (externalNames && externalNames.length > 0) {
      if (allSpeakerNames) allSpeakerNames += ", ";
      allSpeakerNames += externalNames.join(", ");
      trainerInserts.push(...externalNames.map((name: string) => ({
        trainer_name: name,
        is_external: true,
      })));
    }

    // 4. Create event
    const { data: event, error: evErr } = await s
      .from("events")
      .insert({
        title,
        description: description || null,
        type: type || "offline",
        start_date,
        end_date: end_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        location: location || null,
        quota: quota ? parseInt(quota) : null,
        registration_type: registration_type || "invitation",
        is_paid: is_paid !== false,
        price: is_paid !== false ? (parseInt(price) || 50000) : 0,
        speaker_name: allSpeakerNames || null,
        speaker_ids: trainerIds || [],
        status: "draft",
      })
      .select()
      .single();

    if (evErr || !event) {
      console.error("[events/create] insert error:", evErr);
      return NextResponse.json({ error: evErr?.message || "Gagal membuat event" }, { status: 500 });
    }

    const eventId = event.id;

    // 5. Save event_trainers
    if (trainerInserts.length > 0) {
      const { error: te } = await s.from("event_trainers").insert(
        trainerInserts.map((ti: any) => ({ ...ti, event_id: eventId }))
      );
      if (te) console.error("[events/create] trainer error:", te);
    }

    // 6. Save event_materials
    const { data: selectedMats } = await s
      .from("materials")
      .select("*")
      .in("id", materialIds);

    if (selectedMats && selectedMats.length > 0) {
      const { error: me } = await s.from("event_materials").insert(
        selectedMats.map((m: any, i: number) => ({
          event_id: eventId,
          material_id: m.id,
          sort_order: i,
        }))
      );
      if (me) console.error("[events/create] material error:", me);

      // 6b. Auto-compose test from material test_data
      await autoComposeTest(s, eventId, selectedMats);
    }

    // 7. Save event_apps
    if (appIds && appIds.length > 0) {
      const { error: ae } = await s.from("event_apps").insert(
        appIds.map((aid: string) => ({ event_id: eventId, app_id: aid }))
      );
      if (ae) console.error("[events/create] apps error:", ae);
    }

    // 8. Bind kuesioner if selected
    if (kuesionerId) {
      const { data: kues } = await s
        .from("tests")
        .select("*, test_phases(id,phase,label)")
        .eq("id", kuesionerId)
        .single();

      if (kues && kues.test_phases?.length > 0) {
        const { error: ke } = await s.from("event_tests").insert(
          kues.test_phases.map((p: any) => ({
            event_id: eventId,
            phase_id: p.id,
            open_time: "during",
          }))
        );
        if (ke) console.error("[events/create] kuesioner error:", ke);
      }
    }

    return NextResponse.json({ success: true, eventId });
  } catch (e: any) {
    console.error("[events/create] error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}

/* ─── Helper: auto-compose test from material test_data ─── */
async function autoComposeTest(
  s: Awaited<ReturnType<typeof createServerSupabase>>,
  eventId: string,
  materials: any[]
) {
  const allPre: any[] = [];
  const allPost: any[] = [];
  let sourceNames: string[] = [];

  for (const mat of materials) {
    if (!mat.test_data) continue;
    const td = mat.test_data;
    if (td.pre_test?.length > 0) {
      allPre.push(...td.pre_test.map((q: any) => ({ ...q, source: mat.title })));
    }
    if (td.post_test?.length > 0) {
      allPost.push(...td.post_test.map((q: any) => ({ ...q, source: mat.title })));
    }
    if (td.pre_test?.length > 0 || td.post_test?.length > 0) {
      sourceNames.push(mat.title);
    }
  }

  if (allPre.length === 0 && allPost.length === 0) return;

  const testName = sourceNames.length <= 2
    ? `Test: ${sourceNames.join(" + ")}`
    : `Test: ${sourceNames.length} materi`;

  const { data: test, error: testErr } = await s.from("tests").insert({
    name: testName,
    description: "Auto-composed pre/post test dari materi untuk event",
    type: "test",
  }).select().single();

  if (testErr || !test) {
    console.error("[events/create] auto test create error:", testErr);
    return;
  }

  const eventTestsToInsert: { event_id: string; phase_id: string; open_time: string }[] = [];

  // Pre phase
  if (allPre.length > 0) {
    const { data: prePhase } = await s.from("test_phases").insert({
      test_id: test.id, phase: "pre", label: "Pre-Test", sort_order: 0,
    }).select().single();

    if (prePhase) {
      await s.from("test_questions").insert(
        allPre.map((q: any, i: number) => ({
          phase_id: prePhase.id,
          question_text: q.question || q.question_text,
          question_type: q.question_type || (q.options ? "multiple_choice" : "essay"),
          options: q.options || null,
          correct_answer: q.correct_answer ?? q.correct ?? null,
          points: q.points || 1,
          sort_order: i,
        }))
      );
      eventTestsToInsert.push({ event_id: eventId, phase_id: prePhase.id, open_time: "before" });
    }
  }

  // Post phase
  if (allPost.length > 0) {
    const { data: postPhase } = await s.from("test_phases").insert({
      test_id: test.id, phase: "post", label: "Post-Test", sort_order: 1,
    }).select().single();

    if (postPhase) {
      await s.from("test_questions").insert(
        allPost.map((q: any, i: number) => ({
          phase_id: postPhase.id,
          question_text: q.question || q.question_text,
          question_type: q.question_type || (q.options ? "multiple_choice" : "essay"),
          options: q.options || null,
          correct_answer: q.correct_answer ?? q.correct ?? null,
          points: q.points || 1,
          sort_order: i,
        }))
      );
      eventTestsToInsert.push({ event_id: eventId, phase_id: postPhase.id, open_time: "during" });
    }
  }

  if (eventTestsToInsert.length > 0) {
    const { error: be } = await s.from("event_tests").insert(eventTestsToInsert);
    if (be) console.error("[events/create] bind test error:", be);
  }
}
