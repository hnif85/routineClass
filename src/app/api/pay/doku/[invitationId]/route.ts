import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { createDokuPayment } from "@/lib/doku/client";

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

    if (!inv || !inv.event) {
      return NextResponse.json({ error: "Pendaftaran tidak ditemukan" }, { status: 404 });
    }

    if (inv.status === "confirmed" || inv.status === "rsvp_yes") {
      return NextResponse.json({ error: "Sudah dikonfirmasi" }, { status: 400 });
    }

    const ev = inv.event;
    const price = ev.is_paid !== false ? (ev.price || 50000) : 0;
    if (price <= 0) {
      return NextResponse.json({ error: "Event ini gratis" }, { status: 400 });
    }

    const name = (inv.full_name || inv.umkm?.full_name || "Peserta").slice(0, 255);
    const email = (inv.email || "").slice(0, 128);
    const wa = (inv.phone_number || inv.umkm?.whatsapp || "").replace(/[^0-9+]/g, "").slice(0, 16);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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

    return NextResponse.json({ paymentUrl: payment.paymentUrl, invoiceNumber });
  } catch (err: any) {
    console.error("[pay/doku] Error:", err.message);
    return NextResponse.json({ error: "Gagal membuat pembayaran" }, { status: 500 });
  }
}
