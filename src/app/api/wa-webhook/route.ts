import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createHmac, timingSafeEqual } from "crypto";

// Tools yang tersedia untuk agentic query
const TOOLS = [
  {
    name: "get_umkm_profile",
    description: "Ambil data profil lengkap UMKM berdasarkan nomor WhatsApp",
    parameters: { whatsapp: "string" },
  },
  {
    name: "get_upcoming_events",
    description: "Lihat daftar event yang akan datang",
    parameters: { days_ahead: "number (default: 30)" },
  },
  {
    name: "register_for_event",
    description: "Daftarkan UMKM ke event",
    parameters: { whatsapp: "string", event_id: "string" },
  },
  {
    name: "escalate_to_human",
    description: "Eskalasi percakapan ke admin",
    parameters: { reason: "string" },
  },
];

// Rule-based intent classifier
function classifyIntent(message: string): {
  intent: string;
  confidence: number;
  response?: string;
} {
  const msg = message.toLowerCase().trim();

  // RSVP detection
  if (/^(hadir|ya|yes|ikut|mau|daftar|siap|oke|ok|sip|gas)$/.test(msg)) {
    return { intent: "rsvp_yes", confidence: 0.9, response: "Terima kasih! Kehadiran Anda sudah dicatat. Sampai jumpa di event nanti! 😊" };
  }
  if (/^(tidak|no|nggak|gak|maaf|sorry|batal)$/.test(msg)) {
    return { intent: "rsvp_no", confidence: 0.9, response: "Baik, tidak masalah. Semoga bisa bergabung di event berikutnya! 🙏" };
  }

  // FAQ
  if (/^(halo|hi|hai|assalam|pagi|siang|sore|malam)/.test(msg)) {
    return { intent: "faq", confidence: 0.95, response: "Halo! Saya Kak Tani, asisten virtual MWX. Ada yang bisa saya bantu?\n\nAnda bisa:\n- Cek event mendatang: ketik \"event\"\n- Cek profil UMKM: ketik \"profil [nama]\"\n- Daftar event: ketik \"daftar [nama event]\"\n- Bicara admin: ketik \"admin\"" };
  }
  if (msg.includes("event") || msg.includes("pelatihan") || msg.includes("acara") || msg.includes("jadwal")) {
    return { intent: "query_events", confidence: 0.85 };
  }
  if (msg.includes("profil") || msg.includes("data saya") || msg.includes("cek data")) {
    return { intent: "query_profile", confidence: 0.85 };
  }
  if (msg.includes("admin") || msg.includes("orang") || msg.includes("manusia") || msg.includes("cs")) {
    return { intent: "escalate", confidence: 0.95, response: "Baik, saya akan sambungkan Anda ke admin. Mohon tunggu sebentar, admin kami akan segera merespon. 🙏" };
  }
  if (msg.includes("terima kasih") || msg.includes("makasih") || msg.includes("thanks")) {
    return { intent: "faq", confidence: 0.9, response: "Sama-sama! Senang bisa membantu. Ada lagi yang bisa saya bantu? 😊" };
  }

  return { intent: "unknown", confidence: 0.3, response: "Maaf, saya belum mengerti maksud Anda. Bisa dijelaskan lebih detail?\n\nKetik \"admin\" jika Anda ingin berbicara dengan petugas kami." };
}

// Tool executors
async function executeTool(toolName: string, params: Record<string, unknown>, supabase: any) {
  switch (toolName) {
    case "get_umkm_profile": {
      const { data } = await supabase
        .from("umkm")
        .select("full_name, business_name, monthly_revenue_estimate, has_nib, training_frequency_last_year")
        .eq("whatsapp", params.whatsapp)
        .single();
      return data;
    }
    case "get_upcoming_events": {
      const days = (params.days_ahead as number) || 30;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const { data } = await supabase
        .from("events")
        .select("id, title, start_date, location, type")
        .gte("start_date", new Date().toISOString().split("T")[0])
        .lte("start_date", futureDate.toISOString().split("T")[0])
        .neq("status", "cancelled")
        .order("start_date");
      return data;
    }
    case "register_for_event": {
      const { data: umkm } = await supabase
        .from("umkm")
        .select("id")
        .eq("whatsapp", params.whatsapp)
        .single();
      if (!umkm) return { error: "UMKM tidak ditemukan" };
      const { error } = await supabase.from("event_invitations").upsert({
        event_id: params.event_id,
        umkm_id: umkm.id,
        status: "rsvp_yes",
      });
      return error ? { error: error.message } : { success: true };
    }
    case "escalate_to_human": {
      return { escalated: true, reason: params.reason };
    }
    default:
      return { error: "Tool tidak dikenal" };
  }
}

export async function GET(req: NextRequest) {
  // Meta webhook verification
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  // Verify WhatsApp webhook signature — REQUIRED in production
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("[wa-webhook] WHATSAPP_APP_SECRET is required. Webhook rejected.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const signature = req.headers.get("x-hub-signature-256");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 401 });

  const rawBody = await req.text();
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  req = new NextRequest(req.url, { method: "POST", body: rawBody, headers: req.headers });

  const supabase = await createServerSupabase();

  try {
    const body = await req.json();

    // Meta mengirim array entries
    const entries = body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const messages = change?.value?.messages || [];
        for (const msg of messages) {
          const fromNumber = msg.from; // Nomor WA pengirim
          const messageText = msg.text?.body || "";
          const messageId = msg.id;

          // Cari UMKM berdasarkan nomor WA
          const { data: umkm } = await supabase
            .from("umkm")
            .select("id, whatsapp, full_name, business_name")
            .eq("whatsapp", fromNumber)
            .single();

          // Klasifikasi intent
          const classification = classifyIntent(messageText);

          // Simpan pesan inbound
          const { data: savedMsg } = await supabase
            .from("wa_conversations")
            .insert({
              umkm_id: umkm?.id || null,
              direction: "inbound",
              message_type: "text",
              content: messageText,
              meta_message_id: messageId,
              intent: classification.intent,
              confidence: classification.confidence,
              handled_by: classification.intent === "escalate" ? "human" : "bot",
              escalated: classification.intent === "escalate",
              escalation_reason:
                classification.intent === "escalate" ? "User requested admin" : null,
            })
            .select()
            .single();

          // Jika ada response langsung dari rule-based classifier
          if (classification.response) {
            await sendWhatsAppMessage(fromNumber, classification.response);
            // Simpan response
            await supabase.from("wa_conversations").insert({
              umkm_id: umkm?.id || null,
              direction: "outbound",
              message_type: "text",
              content: classification.response,
              intent: classification.intent,
              confidence: classification.confidence,
              handled_by: "bot",
            });
          }

          // Query events — reply dengan daftar event
          if (classification.intent === "query_events") {
            const events = await executeTool("get_upcoming_events", { days_ahead: 30 }, supabase);
            let reply = "📅 *Event Mendatang:*\n\n";
            if (Array.isArray(events) && events.length > 0) {
              for (const ev of events as any[]) {
                reply += `• *${ev.title}*\n  📍 ${ev.location || "Online"} | 📆 ${ev.start_date}\n  Daftar: ketik \"daftar ${ev.title}\"\n\n`;
              }
            } else {
              reply = "Belum ada event yang dijadwalkan dalam 30 hari ke depan. Nantikan info selanjutnya! 😊";
            }
            await sendWhatsAppMessage(fromNumber, reply);
            await supabase.from("wa_conversations").insert({
              umkm_id: umkm?.id || null,
              direction: "outbound",
              message_type: "text",
              content: reply,
              intent: "query_events",
              handled_by: "bot",
            });
          }

          // Query profile
          if (classification.intent === "query_profile" && umkm) {
            const reply = `📋 *Profil ${umkm.business_name}*\n\n👤 Pemilik: ${umkm.full_name}\n📱 WA: ${umkm.whatsapp}\n\nUntuk update data, ketik \"update [field] [nilai]\"`;
            await sendWhatsAppMessage(fromNumber, reply);
            await supabase.from("wa_conversations").insert({
              umkm_id: umkm.id,
              direction: "outbound",
              message_type: "text",
              content: reply,
              intent: "query_profile",
              handled_by: "bot",
            });
          }

          // Unknown — eskalasi
          if (classification.intent === "unknown" && classification.response) {
            await sendWhatsAppMessage(fromNumber, classification.response);
            await supabase.from("wa_conversations").insert({
              umkm_id: umkm?.id || null,
              direction: "outbound",
              message_type: "text",
              content: classification.response,
              intent: "unknown",
              handled_by: "bot",
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error: any) {
    console.error("WA Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.log("[WA Mock] Send to", to, ":", text.substring(0, 100));
    return;
  }

  await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );
}
