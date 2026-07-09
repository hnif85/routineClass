import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkDokuStatus } from "@/lib/doku/client";

export async function GET(req: NextRequest) {
  try {
    const invoice = req.nextUrl.searchParams.get("invoice");
    if (!invoice || invoice.length > 64) {
      return NextResponse.json({ error: "Invalid invoice" }, { status: 400 });
    }

    const status = await checkDokuStatus(invoice);
    if (!status) {
      return NextResponse.json({ error: "Gagal cek status" }, { status: 502 });
    }

    if (status.transactionStatus === "SUCCESS") {
      const supabase = await createServerSupabase();
      const { data: inv } = await supabase
        .from("event_invitations")
        .select("id, status")
        .eq("doku_invoice_number", invoice)
        .single();

      if (inv && inv.status !== "confirmed") {
        await supabase.from("event_invitations").update({
          status: "confirmed",
          payment_status: "paid",
          paid_at: new Date().toISOString(),
        }).eq("id", inv.id);
      }
    }

    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
