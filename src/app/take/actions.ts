"use server";

import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createServerSupabase } from "@/lib/supabase/server";

export async function submitTestAnswers(
  event_id: string,
  umkm_id: string,
  answers: { question_id: string; answer_text: string }[]
) {
  if (!event_id || !umkm_id || !Array.isArray(answers) || answers.length === 0) {
    return { error: "Data tidak lengkap" };
  }

  const supabase = await createServerSupabase();

  // ── Auth: verify umkm_id from JWT session if user is logged in ──
  const sessionCookie = (await cookies()).get("session")?.value;
  if (sessionCookie) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const { payload } = await jwtVerify(sessionCookie, secret);
      const sessionUmkmId = (payload as any).umkm_id;
      if (sessionUmkmId) {
        if (sessionUmkmId !== umkm_id) {
          return { error: "Forbidden" };
        }
      }
    } catch {
      // invalid/expired session, fall through to external user flow
    }
  }

  const questionIds = answers.map(a => a.question_id);

  const { count: existingCount } = await supabase
    .from("test_answers")
    .select("id", { count: "exact", head: true })
    .in("question_id", questionIds)
    .eq("event_id", event_id)
    .eq("umkm_id", umkm_id);

  if (existingCount && existingCount > 0) {
    return { error: "Anda sudah mengirim jawaban untuk test ini", conflict: true };
  }

  const inserts = answers.map(a => ({
    question_id: a.question_id,
    event_id,
    umkm_id,
    answer_text: a.answer_text,
    score: null,
    submitted_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("test_answers").insert(inserts);

  if (error) {
    return { error: "Gagal menyimpan jawaban: " + error.message };
  }

  return { success: true };
}