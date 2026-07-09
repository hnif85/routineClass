import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { jwtVerify } from "jose";

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

    const { fileName } = await req.json();
    if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 });

    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = `materials/${safeName}`;

    const supabase = await createServerSupabase();
    const { data, error } = await supabase.storage
      .from("umkmConnect")
      .createSignedUploadUrl(filePath);

    if (error) return NextResponse.json({ error: "Gagal generate upload URL: " + error.message }, { status: 500 });

    return NextResponse.json({
      signedUrl: data.signedUrl,
      filePath,
      token: data.token,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
