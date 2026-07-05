import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getUmkmUser(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== "umkm" || !payload.umkm_id) return null;
    return payload;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const user = await getUmkmUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });
  const umkmId = user.umkm_id as string;

  // Get all event invitations for this UMKM (attended or rsvp_yes)
  const { data: invitations } = await s
    .from("event_invitations")
    .select("event_id, status, attended_at, events!inner(id, title, start_date, end_date, type)")
    .eq("umkm_id", umkmId)
    .order("sent_at", { ascending: false });

  if (!invitations) return NextResponse.json({ data: [] });

  // Get certificates for this UMKM
  const { data: certificates } = await s
    .from("certificates")
    .select("id, cert_number, event_id, pre_score, post_score, delta_score, status")
    .eq("umkm_id", umkmId)
    .eq("status", "issued");

  const certMap = new Map<string, any>();
  (certificates || []).forEach(c => certMap.set(c.event_id, c));

  // Get test scores per event
  const eventIds = invitations.map(i => i.event_id);
  const { data: eventTests } = await s
    .from("event_tests")
    .select("event_id, phase_id, test_phases!inner(phase)")
    .in("event_id", eventIds);

  const prePhaseIds: string[] = [];
  const postPhaseIds: string[] = [];

  (eventTests || []).forEach(et => {
    const phase = (et.test_phases as any).phase;
    if (phase === "pre") prePhaseIds.push(et.phase_id);
    else if (phase === "post") postPhaseIds.push(et.phase_id);
  });

  // Calculate scores per event
  const scoreMap = new Map<string, { pre: number | null; post: number | null }>();

  for (const eid of eventIds) {
    let pre: number | null = null;
    let post: number | null = null;

    // Get phases for this event
    const eventPhaseIds = (eventTests || [])
      .filter(et => et.event_id === eid)
      .map(et => ({ phaseId: et.phase_id, phase: (et.test_phases as any).phase }));

    for (const { phaseId, phase } of eventPhaseIds) {
      // Get questions for this phase
      const { data: questions } = await s
        .from("test_questions")
        .select("id, points, correct_answer, question_type")
        .eq("phase_id", phaseId).eq("is_active", true);

      if (!questions || questions.length === 0) continue;

      // Get UMKM's answers
      const { data: answers } = await s
        .from("test_answers")
        .select("question_id, answer_text")
        .eq("event_id", eid)
        .eq("umkm_id", umkmId)
        .in("question_id", questions.map(q => q.id));

      if (!answers || answers.length === 0) continue;

      let totalPoints = 0;
      let earnedPoints = 0;
      for (const q of questions) {
        totalPoints += q.points || 1;
        const ans = answers.find(a => a.question_id === q.id);
        if (ans && q.question_type === "multiple_choice" && ans.answer_text === q.correct_answer) {
          earnedPoints += q.points || 1;
        }
      }

      const pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      if (phase === "pre") pre = pct;
      else if (phase === "post") post = pct;
    }

    scoreMap.set(eid, { pre, post });
  }

  const items = invitations.map(inv => {
    const evt = (inv as any).events;
    const scores = scoreMap.get(inv.event_id) || { pre: null, post: null };
    const cert = certMap.get(inv.event_id);
    const delta = scores.pre !== null && scores.post !== null ? scores.post - scores.pre : null;

    return {
      event_id: inv.event_id,
      event_title: evt.title,
      event_start: evt.start_date ? new Date(evt.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-",
      event_end: evt.end_date ? new Date(evt.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-",
      event_type: evt.type || "offline",
      status: inv.status,
      attended: !!inv.attended_at,
      pre_score: scores.pre,
      post_score: scores.post,
      delta,
      cert_id: cert?.id || null,
      cert_number: cert?.cert_number || null,
    };
  });

  return NextResponse.json({ data: items });
}
