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

    const body = await req.json();
    if (!body.title) {
      return NextResponse.json({ error: "Title harus diisi" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("materials")
      .insert({
        title: body.title,
        description: body.description || "",
        content: body.content || [],
        total_days: body.total_days || 1,
        syllabus: body.syllabus || [],
        is_ai_generated: body.is_ai_generated || false,
        test_data: body.test_data || null,
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
