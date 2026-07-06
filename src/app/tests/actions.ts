"use server";

import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createServerSupabase } from "@/lib/supabase/server";

export async function deleteTest(id: string) {
  if (!id) return { error: "ID harus diisi" };

  const token = (await cookies()).get("session")?.value;
  if (!token) return { error: "Unauthorized" };

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  const role = (payload as any).role as string;
  const allowed = ["admin", "super_admin", "perusahaan", "pemateri"];
  if (!allowed.includes(role)) return { error: "Forbidden" };

  const supabase = await createServerSupabase();

  const { data: phases } = await supabase
    .from("test_phases")
    .select("id")
    .eq("test_id", id);

  if (phases?.length) {
    const phaseIds = phases.map(p => p.id);

    const { data: questions } = await supabase
      .from("test_questions")
      .select("id")
      .in("phase_id", phaseIds);

    if (questions?.length) {
      const questionIds = questions.map(q => q.id);
      await supabase.from("test_answers").delete().in("question_id", questionIds);
      await supabase.from("test_questions").delete().in("phase_id", phaseIds);
    }

    await supabase.from("event_tests").delete().in("phase_id", phaseIds);
    await supabase.from("test_phases").delete().eq("test_id", id);
  }

  const { error } = await supabase.from("tests").delete().eq("id", id);

  if (error) return { error: "Gagal menghapus: " + error.message };

  return { success: true };
}