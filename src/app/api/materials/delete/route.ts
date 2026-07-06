import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as any).role as string;
    if (!["admin", "super_admin", "perusahaan", "pemateri"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID harus diisi" }, { status: 400 });
    }

    const supabase = await createServerSupabase();

    const { data: material } = await supabase
      .from("materials")
      .select("title")
      .eq("id", id)
      .single();

    if (material?.title) {
      const testName = `Test: ${material.title}`;
      const { data: test } = await supabase
        .from("tests")
        .select("id")
        .eq("name", testName)
        .maybeSingle();

      if (test) {
        const { data: phases } = await supabase
          .from("test_phases")
          .select("id")
          .eq("test_id", test.id);

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
          await supabase.from("test_phases").delete().eq("test_id", test.id);
        }

        await supabase.from("tests").delete().eq("id", test.id);
      }
    }

    const { error: emErr } = await supabase
      .from("event_materials")
      .delete()
      .eq("material_id", id);
    if (emErr) {
      return NextResponse.json({ error: "Gagal menghapus relasi event: " + emErr.message }, { status: 500 });
    }

    const { error } = await supabase
      .from("materials")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[materials/delete] Error:", error);
      return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[materials/delete] Error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}