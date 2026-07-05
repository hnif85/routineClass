import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { pbkdf2Sync, randomBytes } from "crypto";

function hashPassword(password: string, salt: string, iterations: number = 600_000): string {
  return pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Decode JWT for user id (simplified — trust the proxy middleware)
    const { jwtVerify } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    const { password } = await req.json();
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const salt = randomBytes(16).toString("hex");
    const pwHash = `${salt}:${hashPassword(password, salt)}`;

    await supabase.from("users").update({
      password_hash: pwHash,
      is_first_login: false,
    }).eq("id", payload.sub);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}