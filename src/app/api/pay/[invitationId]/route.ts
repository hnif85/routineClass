import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const MAYAR_API = "https://api.mayar.id/hl/v1";
const MAYAR_KEY = process.env.MAYAR_API_KEY || "";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  try {
    const { invitationId } = await params;
    const supabase = await createServerSupabase();

    // Ambil invitation
    const { data: inv } = await supabase.from("event_invitations").select("*, event:events(*)").eq("id", invitationId).single();
    if (!inv || !inv.event) return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    if (inv.status === "confirmed") return NextResponse.json({ error: "Sudah terkonfirmasi" }, { status: 400 });

    const ev = inv.event;
    const price = ev.is_paid !== false ? (ev.price || 50000) : 0;
    if (price === 0) return NextResponse.json({ error: "Event ini gratis" }, { status: 400 });

    const name = inv.full_name || "Peserta";
    const email = inv.email || "";
    const wa = inv.phone_number || "";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Buat Mayar invoice
    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const mayarBody = {
      name, email, mobile: wa,
      redirectUrl: `${baseUrl}/portal`,
      description: `Tiket Routine Class - ${ev.title}`,
      expiredAt,
      items: [{ quantity: 1, rate: price, description: ev.title }],
      extraData: { eventId: ev.id, invitationId: inv.id },
    };

    const mayarRes = await fetch(`${MAYAR_API}/invoice/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${MAYAR_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(mayarBody),
    });
    const mayarText = await mayarRes.text();

    if (!mayarRes.ok) {
      console.error("[pay] Mayar error:", mayarText);
      return NextResponse.json({ error: "Gagal membuat link pembayaran" }, { status: 500 });
    }

    const mayarData = JSON.parse(mayarText);
    const payLink = mayarData.data?.link;
    if (mayarData.data?.id) {
      await supabase.from("event_invitations").update({ mayar_invoice_id: mayarData.data.id }).eq("id", inv.id);
    }

    return NextResponse.json({ payLink });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}