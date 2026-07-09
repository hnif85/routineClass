import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { validateNotificationSignature, generateRequestTimestamp } from "@/lib/doku/signature";

const NOTIFICATION_TARGET = "/api/pay/doku/notif";

export async function POST(req: NextRequest) {
  try {
    const clientId = req.headers.get("Client-Id");
    const requestId = req.headers.get("Request-Id");
    const requestTimestamp = req.headers.get("Request-Timestamp");
    const receivedSignature = req.headers.get("Signature");

    if (!clientId || !requestId || !requestTimestamp || !receivedSignature) {
      return NextResponse.json({ error: "Missing auth headers" }, { status: 401 });
    }

    if (clientId !== process.env.DOKU_CLIENT_ID) {
      return NextResponse.json({ error: "Invalid Client-Id" }, { status: 401 });
    }

    if (requestTimestamp.length > 30) {
      return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
    }

    const rawBody = await req.text();

    if (!rawBody || rawBody.length > 65536) {
      return NextResponse.json({ error: "Body too large" }, { status: 400 });
    }

    const valid = validateNotificationSignature(
      rawBody,
      clientId,
      requestId,
      requestTimestamp,
      NOTIFICATION_TARGET,
      receivedSignature
    );

    if (!valid) {
      console.error("[doku/notif] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const transactionStatus = body?.transaction_status || "";
    const invoiceNumber = body?.order?.invoice_number || "";
    const amount = body?.order?.amount ? Number(body.order.amount) : 0;

    if (!invoiceNumber) {
      return NextResponse.json({ error: "Missing invoice number" }, { status: 400 });
    }

    const rl = checkRateLimit(`doku-notif:${invoiceNumber}`);
    if (!rl.allowed) {
      return NextResponse.json({ status: "OK" }, { status: 200 });
    }

    const supabase = await createServerSupabase();

    const { data: inv } = await supabase
      .from("event_invitations")
      .select("*, event:events(*)")
      .eq("doku_invoice_number", invoiceNumber)
      .single();

    if (!inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const expectedAmount = inv.event?.is_paid !== false ? (inv.event?.price || 50000) : 0;
    if (amount !== expectedAmount) {
      console.error(`[doku/notif] Amount mismatch: got ${amount}, expected ${expectedAmount}`);
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const statusMapping: Record<string, string> = {
      SUCCESS: "confirmed",
      PAID: "confirmed",
      EXPIRED: "cancelled",
      FAILED: "cancelled",
    };

    const newStatus = statusMapping[transactionStatus];
    if (newStatus) {
      await supabase.from("event_invitations").update({
        status: newStatus,
        paid_at: newStatus === "confirmed" ? new Date().toISOString() : null,
        payment_status: transactionStatus,
      }).eq("id", inv.id);
    }

    return NextResponse.json({ status: "OK" }, { status: 200 });
  } catch (err: any) {
    console.error("[doku/notif] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): { allowed: boolean } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > 10) return { allowed: false };
  return { allowed: true };
}
