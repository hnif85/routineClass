import { randomUUID } from "crypto";
import { getDokuApiBase, dokuHeaders, generateRequestTimestamp } from "./signature";

interface CreatePaymentParams {
  amount: number;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: { name: string; price: number; quantity: number }[];
  callbackUrl: string;
  paymentDueDate?: number;
}

interface PaymentResponse {
  paymentUrl: string;
  invoiceNumber: string;
  sessionId: string;
  tokenId: string;
  expiredDate: string;
}

export async function createDokuPayment(params: CreatePaymentParams): Promise<PaymentResponse> {
  const apiBase = getDokuApiBase();
  const requestTarget = "/checkout/v1/payment";
  const requestId = randomUUID();
  const requestTimestamp = generateRequestTimestamp();

  const totalAmount = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  if (totalAmount !== params.amount) {
    throw new Error("Amount mismatch: item total does not match");
  }

  const body = {
    order: {
      amount: params.amount,
      invoice_number: params.invoiceNumber,
      currency: "IDR",
      callback_url: params.callbackUrl,
      auto_redirect: true,
      line_items: params.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    },
    payment: {
      payment_due_date: params.paymentDueDate || 60,
    },
    customer: {
      name: params.customerName,
      email: params.customerEmail || "",
      phone: params.customerPhone || "",
      country: "ID",
    },
  };

  const jsonBody = JSON.stringify(body);

  const res = await fetch(`${apiBase}${requestTarget}`, {
    method: "POST",
    headers: dokuHeaders(requestId, requestTimestamp, requestTarget, jsonBody),
    body: jsonBody,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[doku] API error:", res.status, errText);
    throw new Error(`Doku API error: ${res.status}`);
  }

  const data = await res.json();
  const messages = data.message || [];
  if (!messages.includes("SUCCESS")) {
    throw new Error(`Doku error: ${messages.join(", ") || "Unknown"}`);
  }

  const resp = data.response;

  return {
    paymentUrl: resp.payment.url,
    invoiceNumber: params.invoiceNumber,
    sessionId: resp.order.session_id,
    tokenId: resp.payment.token_id,
    expiredDate: resp.payment.expired_date,
  };
}
