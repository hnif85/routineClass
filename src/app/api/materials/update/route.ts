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
