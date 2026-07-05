import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";
import { SCHEMA } from "@/lib/supabase/schema";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    if (payload.role === "admin" || payload.role === "perusahaan") return payload;
    return null;
  } catch { return null; }
}

// POST /api/certificates/generate — generate certificate for UMKM + event
export async function POST(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { umkm_id, event_id } = body;
  if (!umkm_id || !event_id) {
    return NextResponse.json({ error: "umkm_id dan event_id diperlukan" }, { status: 400 });
  }

  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: SCHEMA } });

  // ── Check existing certificate ──
  const { data: existing } = await s.from("certificates")
    .select("id, cert_number, status, issued_at")
    .eq("umkm_id", umkm_id).eq("event_id", event_id).maybeSingle();
  if (existing && existing.status === "issued") {
    return NextResponse.json({ data: existing, message: "Sertifikat sudah ada" });
  }

  // ── Get UMKM + Event data ──
  const { data: umkm } = await s.from("umkm").select("*").eq("id", umkm_id).single();
  const { data: event } = await s.from("events").select("*").eq("id", event_id).single();
  if (!umkm || !event) {
    return NextResponse.json({ error: "UMKM atau Event tidak ditemukan" }, { status: 404 });
  }

  // ── Event status gate: sertifikat hanya bisa diterbitkan untuk event yang sudah selesai ──
  if (event.status !== "completed") {
    return NextResponse.json({
      error: `Sertifikat hanya bisa diterbitkan untuk event yang sudah selesai (completed). Status saat ini: '${event.status}'.`,
    }, { status: 400 });
  }

  // ── Get test scores (pre + post phases bound to this event) ──
  const { data: eventPhases } = await s.from("event_tests")
    .select("phase_id, test_phases!inner(phase, test_id)")
    .eq("event_id", event_id);

  let preScore: number | null = null;
  let postScore: number | null = null;

  if (eventPhases && eventPhases.length > 0) {
    for (const ep of eventPhases) {
      const phase = (ep.test_phases as any).phase;
      const phaseId = ep.phase_id;

      // Get all questions for this phase
      const { data: questions } = await s.from("test_questions")
        .select("id, points, correct_answer, question_type")
        .eq("phase_id", phaseId).eq("is_active", true);

      if (!questions || questions.length === 0) continue;

      // Get this UMKM's answers
      const { data: answers } = await s.from("test_answers")
        .select("question_id, answer_text")
        .eq("event_id", event_id)
        .eq("umkm_id", umkm_id)
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
        // Essay: score not set automatically, skip for calculation
      }

      const pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

      if (phase === "pre") preScore = pct;
      else if (phase === "post") postScore = pct;
    }
  }

  const delta = (preScore !== null && postScore !== null) ? postScore - preScore : null;

  // ── Get default template ──
  const { data: template } = await s.from("certificate_templates")
    .select("id").eq("is_default", true).maybeSingle();

  // ── Generate cert number ──
  const { data: certNumResult } = await s.rpc("generate_cert_number");
  const certNumber = certNumResult as string || `MWX/RC/${new Date().getFullYear()}/MANUAL`;

  // ── Create certificate ──
  const title = `Sertifikat ${event.title}`;
  const { data: cert, error } = await s.from("certificates").insert({
    umkm_id,
    event_id,
    template_id: template?.id || null,
    cert_number: certNumber,
    title,
    pre_score: preScore,
    post_score: postScore,
    delta_score: delta,
    status: "issued",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: cert, message: "Sertifikat berhasil diterbitkan" }, { status: 201 });
}
