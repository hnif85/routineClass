import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

const PROVIDER = (process.env.PAYMENT_PROVIDER || "mayar").toLowerCase();

const MAYAR_API = "https://api.mayar.id/hl/v1";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  try {
    const { invitationId } = await params;
    if (!invitationId || invitationId.length > 128) {
      return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data: inv } = await supabase
      .from("event_invitations")
      .select("*, event:events(*)")
      .eq("id", invitationId)
      .single();

    if (!inv || !inv.event) return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    if (inv.status === "confirmed" || inv.payment_status === "paid")
      return NextResponse.json({ error: "Sudah dikonfirmasi" }, { status: 400 });

    const ev = inv.event;
    const price = ev.is_paid !== false ? (ev.price || 50000) : 0;
    if (price <= 0) return NextResponse.json({ error: "Event ini gratis" }, { status: 400 });

    const name = (inv.full_name || inv.umkm?.full_name || "Peserta").replace(/[^a-zA-Z0-9\s\-.,]/g, "").slice(0, 255);
    const email = (inv.email || "").replace(/[^a-zA-Z0-9@.\-+_]/g, "").slice(0, 128);
    const wa = (inv.phone_number || inv.umkm?.whatsapp || "").replace(/[^0-9+]/g, "").slice(0, 16);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (PROVIDER === "doku") {
      const { createDokuPayment } = await import("@/lib/doku/client");
      const invoiceNumber = `RC-${Date.now()}-${randomUUID().slice(0, 8)}`.slice(0, 30);

      const payment = await createDokuPayment({
        amount: price,
        invoiceNumber,
        customerName: name,
        customerEmail: email,
        customerPhone: wa,
        items: [{ name: `Tiket: ${ev.title}`.slice(0, 255), price, quantity: 1 }],
        callbackUrl: `${baseUrl}/portal`,
      });

      await supabase.from("event_invitations").update({
        doku_invoice_number: invoiceNumber,
        payment_provider: "doku",
        payment_url: payment.paymentUrl,
        status: "pending",
      }).eq("id", inv.id);

      return NextResponse.json({ payLink: payment.paymentUrl, invoiceNumber });
    }

    // ── Mayar (default/fallback) ──
    const MAYAR_KEY = process.env.MAYAR_API_KEY || "";
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
      await supabase.from("event_invitations").update({
        mayar_invoice_id: mayarData.data.id,
        payment_provider: "mayar",
      }).eq("id", inv.id);
    }

    return NextResponse.json({ payLink });
  } catch (err: any) {
    console.error("[pay] Error:", err.message);
    return NextResponse.json({ error: "Gagal membuat link pembayaran" }, { status: 500 });
  }
}
