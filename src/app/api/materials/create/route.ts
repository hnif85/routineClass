import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload.title) {
      return NextResponse.json({ error: "Title harus diisi" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("materials")
      .insert({
        title: payload.title,
        description: payload.description || "",
        content: payload.content || [],
        total_days: payload.total_days || 1,
        syllabus: payload.syllabus || [],
        is_ai_generated: payload.is_ai_generated || false,
        test_data: payload.test_data || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[materials/create] Error:", error);
      return NextResponse.json({ error: "Gagal membuat materi: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[materials/create] Error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
