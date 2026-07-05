import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SCHEMA } from "@/lib/supabase/schema";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, whatsapp, email, city, business_name, year_established, monthly_revenue_estimate, employee_count, business_category } = body;

    // ── Validation ──
    const errors: string[] = [];
    if (!full_name?.trim()) errors.push("Nama lengkap harus diisi");
    if (!whatsapp?.trim()) errors.push("Nomor WhatsApp harus diisi");
    if (!business_name?.trim()) errors.push("Nama usaha harus diisi");
    if (whatsapp && !/^62\d{8,15}$/.test(whatsapp.replace(/[\s\-]/g, ""))) {
      errors.push("Format WhatsApp: 62xxxxxxxxxx (diawali 62, tanpa +/0)");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Format email tidak valid");
    }
    if (year_established && (isNaN(year_established) || year_established < 1900 || year_established > 2030)) {
      errors.push("Tahun berdiri tidak valid");
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: SCHEMA } });

    // ── Check duplicate WhatsApp ──
    const { data: existing } = await s
      .from("umkm")
      .select("id, business_name")
      .eq("whatsapp", whatsapp.replace(/[\s\-]/g, ""))
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: `Nomor WhatsApp sudah terdaftar atas nama "${existing.business_name}". Gunakan nomor lain atau hubungi admin.`,
      }, { status: 409 });
    }

    // ── Insert ──
    const payload: Record<string, any> = {
      full_name: full_name.trim(),
      whatsapp: whatsapp.replace(/[\s\-]/g, ""),
      email: email?.trim() || "",
      city: city?.trim() || "Jakarta",
      business_name: business_name.trim(),
      year_established: year_established ? parseInt(year_established) : null,
      monthly_revenue_estimate: monthly_revenue_estimate || null,
      employee_count: employee_count ? parseInt(employee_count) : null,
      business_category: business_category || [],
      source: "link_daftar",
      is_active: true,
    };

    const { data, error } = await s.from("umkm").insert(payload).select("id, business_name").single();

    if (error) {
      console.error("[register-umkm] Insert error:", error);
      return NextResponse.json({ error: "Gagal mendaftarkan UMKM: " + error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      business_name: data.business_name,
      message: `Pendaftaran berhasil! "${data.business_name}" telah terdaftar.`,
    });

  } catch (err: any) {
    console.error("[register-umkm] Error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan" }, { status: 500 });
  }
}
