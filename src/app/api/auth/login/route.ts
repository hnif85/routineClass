import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { SignJWT } from "jose";
import { pbkdf2Sync, randomBytes } from "crypto";

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 600_000, 64, "sha512").toString("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  return hashPassword(password, salt) === key;
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 login attempts per IP per 15 minutes
  const { checkRateLimit, getClientIp, LIMITS } = await import("@/lib/rate-limit");
  const ip = getClientIp(req);
  const rl = checkRateLimit({ ...LIMITS.login, identifier: `login:${ip}` });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password harus diisi" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data: user } = await supabase.from("users").select("*").eq("email", email.toLowerCase()).single();

    if (!user || !user.is_active) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    // Update last_login
    await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", user.id);

    // Create JWT
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      umkm_id: user.umkm_id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, umkm_id: user.umkm_id },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("[login] Error:", err);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
