import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { SignJWT } from "jose";
import { pbkdf2Sync, randomBytes } from "crypto";

const MAYAR_API = "https://api.mayar.id/hl/v1";
const MAYAR_KEY = process.env.MAYAR_API_KEY || "";

function generatePassword(): string {
  return randomBytes(12).toString("base64url"); // ~16 chars random
}

function hashPassword(password: string, salt: string, iterations: number = 600_000): string {
  return pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
}

async function generateToken(user: any): Promise<[string, string]> {
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
  return [token, "session"];
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 registrations per IP per hour
  const { checkRateLimit, getClientIp, LIMITS } = await import("@/lib/rate-limit");
  const ip = getClientIp(req);
  const rl = checkRateLimit({ ...LIMITS.register, identifier: `register:${ip}` });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Terlalu banyak pendaftaran. Coba lagi nanti." }, { status: 429 });
  }

  try {
    const { eventId, email, full_name, phone, business_name, province, city } = await req.json();
    if (!eventId || !email) {
      return NextResponse.json({ error: "eventId dan email diperlukan" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }

    const supabase = await createServerSupabase();

    // 1. Ambil event
    const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (!ev) return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
    if (ev.status !== "published" && ev.status !== "ongoing") {
      return NextResponse.json({ error: "Pendaftaran belum dibuka" }, { status: 400 });
    }

    // 2. Cek cms_customers
    const { data: customer } = await supabase
      .from("cms_customers")
      .select("guid, full_name, email, phone_number, city")
      .eq("email", normalizedEmail)
      .eq("is_active", "true")
      .maybeSingle();

    // 2b. Cek routine_class.umkm (sudah terdaftar sebelumnya?)
    const { data: existingUmkmData } = await supabase
      .from("umkm")
      .select("id, full_name, email, whatsapp, business_name, city, province")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // 2c. Cek routine_class.users (sudah punya akun?)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email, name, role, umkm_id, is_first_login")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // 2d. Cek invitation yang sudah ada untuk event ini
    const { data: existingInv } = await supabase
      .from("event_invitations")
      .select("id, status, payment_status")
      .eq("event_id", eventId)
      .eq("email", normalizedEmail)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();

    const name = full_name || existingUmkmData?.full_name || customer?.full_name || "";
    const wa = phone || existingUmkmData?.whatsapp || customer?.phone_number || "";
    const biz = business_name || existingUmkmData?.business_name || "";
    const loc = city || existingUmkmData?.city || customer?.city || "";
    const prov = province || existingUmkmData?.province || "";

    // 3. Step: check only (email-only request)
    const isCheck = !full_name && !phone;
    if (isCheck) {
      // Sudah punya akun + data lengkap + sudah terdaftar di event → auto-login + redirect
      if (existingUser && existingUmkmData && existingInv) {
        const tokenPayload = {
          sub: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          role: "umkm",
          umkm_id: existingUmkmData.id,
        };
        const [token] = await generateToken(tokenPayload);

        const msg = (existingInv.status === "confirmed" || existingInv.payment_status === "paid")
          ? "Sudah terdaftar"
          : "Sudah terdaftar, menunggu pembayaran";

        const res = NextResponse.json({ redirect: "/portal", message: msg });
        res.cookies.set("session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
        return res;
      }

      // Sudah punya akun + data lengkap tapi belum daftar event ini → auto-register
      if (existingUser && existingUmkmData && name && wa && !existingInv) {
        return NextResponse.json({
          autoRegister: true,
          customer: { full_name: name, phone: wa, business_name: biz, city: loc, province: prov },
          needFields: { full_name: false, phone: false, business_name: false, city: false },
        });
      }

      // Cek cms_customers
      const needFields = {
        full_name: !name,
        phone: !wa,
        business_name: !biz,
        city: !loc,
        province: !prov,
      };
      const allFilled = !needFields.full_name && !needFields.phone && !needFields.city;

      return NextResponse.json({
        found: !!customer || !!existingUmkmData,
        customer: existingUmkmData
          ? { full_name: existingUmkmData.full_name, phone: existingUmkmData.whatsapp, city: existingUmkmData.city, province: existingUmkmData.province, business_name: existingUmkmData.business_name }
          : customer ? { full_name: customer.full_name, phone: customer.phone_number, city: customer.city, province: "", business_name: "" }
          : null,
        hasAccount: !!existingUser,
        alreadyRegistered: !!existingInv,
        needFields,
        allFilled,
      });
    }

    // 4. Validasi register
    if (!name) return NextResponse.json({ error: "Nama lengkap harus diisi" }, { status: 400 });
    if (!wa) return NextResponse.json({ error: "Nomor WhatsApp harus diisi" }, { status: 400 });
    if (!/^08\d{8,11}$/.test(wa)) return NextResponse.json({ error: "Nomor WA harus diawali 08 dan 10-13 digit" }, { status: 400 });

    // ═══ 5. BIKIN / UPDATE AKUN ═══
    // 5a. UMKM record (pakai data dari step 2b)
    let umkmId: string | null = existingUmkmData?.id || null;
    if (existingUmkmData) {
      console.log("[daftar] umkm found:", normalizedEmail, "id:", existingUmkmData.id);
      await supabase.from("umkm").update({
        full_name: name, business_name: biz, city: loc,
        province: prov, updated_at: new Date().toISOString(),
      }).eq("id", umkmId);
    } else {
      const { data: newUmkm, error: umkmErr } = await supabase.from("umkm").insert({
        full_name: name,
        email: normalizedEmail,
        whatsapp: wa,
        business_name: biz,
        city: loc,
        province: province || "",
        source: "rc_registration",
        is_active: true,
      }).select("id").single();
      console.log("[daftar] umkm insert result:", newUmkm?.id, umkmErr ? "err:" + JSON.stringify(umkmErr) : "ok");
      if (umkmErr) console.error("[daftar] umkm insert error:", JSON.stringify(umkmErr));
      umkmId = newUmkm?.id || null;
    }

    // 5b. Users record (pakai data dari step 2c)
    let userId: string | null = existingUser?.id || null;
    if (existingUser) {
      console.log("[daftar] user found:", normalizedEmail, "id:", existingUser.id);
      await supabase.from("users").update({
        name, umkm_id: umkmId,
        last_login: new Date().toISOString(),
      }).eq("id", userId);
    } else {
      const salt = randomBytes(16).toString("hex");
      const password = generatePassword();
      const pwHash = `${salt}:${hashPassword(password, salt)}`;
      console.log("[daftar] generated password for:", normalizedEmail, "len:", password.length);
      const { data: newUser } = await supabase.from("users").insert({
        email: normalizedEmail,
        password_hash: pwHash,
        name,
        role: "umkm",
        umkm_id: umkmId,
        is_active: true,
        is_first_login: true,
        last_login: new Date().toISOString(),
      }).select("id, email, name, role, umkm_id").single();
      userId = newUser?.id || null;
    }

    // ═══ 6. Cek / simpan invitation ═══
    const { data: existing } = await supabase.from("event_invitations")
      .select("id, status").eq("event_id", eventId).eq("email", normalizedEmail)
      .in("status", ["pending", "confirmed"]).maybeSingle();

    let inv: any;
    if (existing) {
      if (existing.status === "confirmed") {
        // Already paid — just login
        const user = { id: userId, email: normalizedEmail, name, role: "umkm", umkm_id: umkmId };
        const [token] = await generateToken(user);
        const res = NextResponse.json({ success: true, user, redirect: "/portal" });
        res.cookies.set("session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
        return res;
      }
      const { data: updated } = await supabase.from("event_invitations").update({
        full_name: name, phone_number: wa, business_name: biz,
        province: province || "", city: loc, umkm_id: umkmId,
        registered_at: new Date().toISOString(),
      }).eq("id", existing.id).select().single();
      inv = updated;
    } else {
      const { data: newInv } = await supabase.from("event_invitations").insert({
        event_id: eventId, email: normalizedEmail,
        full_name: name, phone_number: wa, business_name: biz,
        province: province || "", city: loc, umkm_id: umkmId,
        status: "pending", registered_at: new Date().toISOString(), payment_status: "pending",
      }).select().single();
      inv = newInv;
    }
    if (!inv) throw new Error("Gagal simpan pendaftaran");

    // ═══ 7. Mayar invoice ═══
    const price = ev.is_paid !== false ? (ev.price || 50000) : 0;
    let payLink = null;

    if (price > 0) {
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const mayarBody = {
        name, email: normalizedEmail, mobile: wa,
        redirectUrl: `${baseUrl}/portal`,
        description: `Tiket Routine Class - ${ev.title}`,
        expiredAt,
        items: [{ quantity: 1, rate: price, description: ev.title }],
        extraData: { eventId, invitationId: inv.id },
      };

      const mayarRes = await fetch(`${MAYAR_API}/invoice/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${MAYAR_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(mayarBody),
      });
      const mayarText = await mayarRes.text();
      if (mayarRes.ok) {
        const mayarData = JSON.parse(mayarText);
        payLink = mayarData.data?.link;
        if (mayarData.data?.id) {
          await supabase.from("event_invitations").update({ mayar_invoice_id: mayarData.data.id }).eq("id", inv.id);
        }
      }
    } else {
      await supabase.from("event_invitations").update({
        status: "confirmed", payment_status: "paid", rsvp_at: new Date().toISOString(),
      }).eq("id", inv.id);
    }

    // ═══ 8. Auto-login ═══
    const user = { id: userId, email: normalizedEmail, name, role: "umkm", umkm_id: umkmId };
    const [token] = await generateToken(user);

    const response = NextResponse.json({
      success: true, user,
      payLink, isFree: price === 0,
      redirect: "/portal",
    });

    response.cookies.set("session", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800,
    });

    return response;
  } catch (err: any) {
    console.error("[daftar] Error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan" }, { status: 500 });
  }
}