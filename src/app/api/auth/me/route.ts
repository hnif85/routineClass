import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    
    // Ambil is_first_login dari database
    const supabase = await createServerSupabase();
    const { data: dbUser } = await supabase.from("users").select("is_first_login").eq("id", payload.sub).maybeSingle();

    return NextResponse.json({
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        umkm_id: payload.umkm_id,
      },
      is_first_login: dbUser?.is_first_login ?? false,
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
