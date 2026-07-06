import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { id, title, description, content, syllabus } = await req.json();
    if (!id || !title) {
      return NextResponse.json({ error: "ID dan title harus diisi" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("materials")
      .update({
        title,
        description: description || "",
        content: content || [],
        syllabus: syllabus || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[materials/update] Error:", error);
      return NextResponse.json({ error: "Gagal update: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[materials/update] Error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
