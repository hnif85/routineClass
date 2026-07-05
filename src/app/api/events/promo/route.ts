import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { eventId } = await req.json();
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const supabase = await createServerSupabase();
    const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const title = ev.title || "";
    const date = ev.start_date ? new Date(ev.start_date).toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : "[TANGGAL]";
    const location = ev.location || "Online";
    const venueType = (ev.location || "").toLowerCase().includes("smesco") ? "SMESCO" : (ev.location || "").toLowerCase().includes("kantor") ? "Kantor MWX" : "Online";
    const isPaid = ev.is_paid !== false;
    const price = ev.price || 50000;
    const priceText = isPaid ? `Rp${price.toLocaleString("id-ID")}` : "GRATIS";
    const time = ev.start_time ? `${ev.start_time?.substring(0, 5)} - ${ev.end_time?.substring(0, 5) || "selesai"} WIB` : "[JAM]";
    const quota = ev.quota || 30;
    const speaker = ev.speaker_name || "Tim MWX";
    const slug = ev.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30) || "event";
    const onlineType = ev.type === "online";
    const daftarLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/daftar/${ev.id}`;

    // ── 1. KV Prompt ──
    const kvPrompt = `Create a professional Indonesian UMKM workshop event poster (Kartu Undangan / KV) in modern 3D corporate tech style.

BACKGROUND:
Dark navy-blue gradient (#0A1628 to #0D2137) with subtle tech grid lines or circuit pattern overlay. Deep, premium, futuristic feel. No flat colors — smooth cinematic gradient.

LAYOUT (top to bottom):
1. TOP LEFT — Small blue rounded-pill badge with white text "WORKSHOP" in uppercase.
2. TOP RIGHT — Small circular logo placeholder area (leave space for logo overlay).
3. MAIN TITLE — Very large, bold, white sans-serif text: "${title}"
   Below title in lighter blue/cyan (#60A5FA): "${onlineType ? "Online via Zoom" : venueType} — ${date.split(",")[0] || date}"
4. DESCRIPTION — Small paragraph text in soft gray (#94A3B8), 2-3 lines, describing the event benefits for UMKM.
5. CENTER — 3D realistic smartphone mockup showing a dashboard/analytics screen with charts, numbers, and business metrics. The phone should be slightly tilted/perspective view, glowing edges.
6. AROUND THE PHONE — Floating 3D colorful icons: Instagram logo, WhatsApp logo, bar chart, line graph with upward arrow, shopping bag, money bag, lock/security icon, pie chart. Each icon should be glossy, 3D rendered, scattered dynamically around the phone with soft glow and depth.
7. LEFT SIDE INFO CARDS — Stacked vertically with small icons:
   📍 ${location}
   📅 ${date}
   ⏰ ${time}
   👥 ${priceText}${isPaid ? ` (${quota} orang)` : ""}
   Each card: small rounded pill with icon + text in white.
8. CTA BUTTON — Large rounded blue button (#2563EB) at bottom center with white bold text: "${isPaid ? "Rp" + price.toLocaleString("id-ID") + " — Daftar Sekarang" : "GRATIS — Daftar Sekarang"}" with a small arrow icon.
9. BOTTOM BAR — Thin horizontal strip at very bottom with 4 small benefit icons in a row: "Komunikasi Lebih Efektif", "Leadership & Mindset", "Produktivitas Meningkat", "Bisnis Berkembang" — each with a small icon above and text below, in soft blue tones.

STYLE REQUIREMENTS:
- Ultra-modern, premium corporate tech aesthetic like a SaaS product launch
- 3D rendered elements with depth, shadows, and subtle glow
- Color palette: navy blue (#0A1628), royal blue (#2563EB), cyan (#60A5FA), white (#FFFFFF), soft gray (#94A3B8)
- NO human faces, NO photos of people
- Sharp, clean typography — bold headlines, light body text
- Aspect ratio: 1:1 (square, perfect for Instagram feed)
- Resolution: high quality, print-ready feel
- Indonesian language for all text
- Subtle depth-of-field effect on floating icons for realism`;

    // ── 2. Surat Permohonan ──
    const needSurat = venueType === "SMESCO";
    const surat = needSurat ? `──────────────────────────────────────────────────────────
                   MWX INDONESIA
──────────────────────────────────────────────────────────

Nomor    : [ISI]/MWX-RC/VII/2026
Lampiran : 1 (satu) berkas
Perihal  : Permohonan Izin Penggunaan SMESCO LABO Lt. 3

Kepada Yth.
Kepala/PIC SMESCO Indonesia
 di Tempat

Dengan hormat,

Sehubungan dengan program Routine Class MWX, bersama ini kami
mengajukan permohonan izin penggunaan venue SMESCO LABO Lt. 3:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Hari / Tanggal  : ${date}
⏰ Waktu            : ${time}
📍 Venue            : ${location}
👥 Peserta          : ${quota} orang (UMKM)
🎯 Tema             : ${title}
💰 Tiket             : ${priceText}${isPaid ? ' via Mayar' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MWX akan menyediakan seluruh personil trainer, materi, dan
perlengkapan secara independen.

Sebagai mitra venue, MWX menawarkan kerja sama:
  • Logo SMESCO di seluruh materi promosi
  • Tagline "SMESCO — Rumahnya UMKM Naik Kelas"
  • Bagi hasil ${isPaid ? '50% dari revenue tiket' : 'kontribusi sukarela'}
  • Laporan data agregat UMKM terdigitalisasi per bulan

Demikian permohonan ini kami sampaikan.

Hormat kami,
MWX Indonesia

[_______________________]
[Nama Penanggung Jawab]` : null;

    // ── 3. Copy WA Blast ──
    const waBlast = {
      h5: `📢 ROUTINE CLASS MWX — ${priceText}!

Mau belajar "${title}" bareng kami?

📅 ${date}
⏰ ${time}
📍 ${location}

Yang kamu dapet:
✅ Langsung praktik, bukan teori
✅ Free trial aplikasi Whiz (14 hari)
✅ Pulang bawa hasil${isPaid ? "\n✅ Konsumsi (snack + kopi)" : ""}

${isPaid ? `💰 ${priceText} — terbatas ${quota} orang!` : `🆓 GRATIS — terbatas ${quota} orang!`}
📲 Daftar sekarang: ${daftarLink}

— Tim MWX`,
      h1: `⏰ BESOK! ${title}

Halo! Besok kita ketemu ya:
📅 ${date}
⏰ ${time}
📍 ${location}

Jangan lupa bawa HP + charger ya!
Sampai jumpa! 🚀

— ${speaker}`,
      h1_after: `👋 Gimana kabarnya setelah ikut "${title}"?

Semoga ilmunya bermanfaat! Jangan lupa coba lagi tools-nya ya.
Ada pertanyaan? Reply aja — kami siap bantu.

Khusus peserta, ada DISKON 30% subscribe minggu ini — kode: RC30

— Tim MWX`,
    };

    // ── 4. Copy Instagram ──
    const ig = {
      caption: `🚀 ROUTINE CLASS MWX — ${priceText}!

"${title}"

📅 ${date}
⏰ ${time}
📍 ${location}

Buat kamu yang:
• Mau belajar langsung praktik
• Pengen upgrade skill digital
• Ingin networking dengan sesama UMKM

Yang kamu dapat:
✅ Langsung praktik, bukan teori
✅ Free trial Whiz (14 hari)
✅ Pulang bawa hasil${isPaid ? "\n✅ Konsumsi (snack + kopi)" : ""}

${isPaid ? `💰 ${priceText} — Terbatas ${quota} Orang` : `🆓 GRATIS — Terbatas ${quota} Orang`}

👇 DAFTAR SEKARANG
Link di bio!

#MWXIndonesia #RoutineClass #BelajarAI #UMKMNaikKelas${venueType === "SMESCO" ? " #SMESCO #RumahnyaUMKMNaikKelas" : ""}`,
      hashtags: `#MWXIndonesia #RoutineClass #BelajarAI #UMKMNaikKelas #${ev.type === "online" ? "Webinar" : "Workshop"}${venueType === "SMESCO" ? " #SMESCO" : ""}`,
    };

    // ── 5. Checklist & Rundown ──
    const checklist = [
      { phase: "H-14", task: "Kirim surat permohonan ke venue" + (venueType === "SMESCO" ? " (SMESCO)" : ""), pic: "Admin" },
      { phase: "H-7", task: "Buat flyer + posting IG Feed", pic: "Marketing" },
      { phase: "H-7", task: "Buka link pendaftaran (bit.ly)", pic: "Marketing" },
      { phase: "H-5", task: "WA Blast #1 ke database CRM", pic: "Marketing" },
      { phase: "H-3", task: "WA Blast #2 reminder + IG Story", pic: "Marketing" },
      { phase: "H-3", task: "Buat akun free trial (koordinasi IT)", pic: "Trainer" },
      { phase: "H-1", task: "Final slide + cetak materi", pic: speaker },
      { phase: "H-1", task: "WA reminder ke semua pendaftar", pic: "Marketing" },
      { phase: "H-1", task: "Briefing tim", pic: speaker },
      { phase: "H-Hari", task: `Set up venue — ${location} pukul ${ev.start_time?.substring(0, 5) || "TBD"}`, pic: "Tim" },
      { phase: "H-Hari", task: "Registrasi + QR check-in", pic: "Co-Trainer" },
      { phase: "H-Hari", task: `Deliver kelas — ${title}`, pic: speaker },
      { phase: "H+0", task: "Isi data CRM (maks 2 jam)", pic: speaker },
      { phase: "H+1", task: "WA Blast follow-up", pic: "CRM" },
      { phase: "H+7", task: "Offer subscribe + diskon", pic: "CRM" },
      { phase: "H+30", task: "Final follow-up / evaluasi", pic: "CRM" },
    ];

    const rundown = ev.type === "online" ? [
      { time: "0:00-0:05", durasi: "5'", aktivitas: "Pembukaan + perkenalan", pic: speaker },
      { time: "0:05-0:20", durasi: "15'", aktivitas: "Materi: Problem + Solusi", pic: speaker },
      { time: "0:20-0:40", durasi: "20'", aktivitas: "Demo Tools — dari 0 ke output", pic: speaker },
      { time: "0:40-0:50", durasi: "10'", aktivitas: "Q&A", pic: speaker },
      { time: "0:50-1:15", durasi: "25'", aktivitas: "Praktik Mandiri", pic: speaker },
      { time: "1:15-1:25", durasi: "10'", aktivitas: "Showcase hasil", pic: speaker },
      { time: "1:25-1:30", durasi: "5'", aktivitas: "Penutup + CTA", pic: speaker },
    ] : [
      { time: "30' sblm", durasi: "30'", aktivitas: "Registrasi + Check-in QR", pic: "Co-Trainer" },
      { time: "0:00-0:15", durasi: "15'", aktivitas: "Pembukaan + AI Overview", pic: speaker },
      { time: "0:15-0:30", durasi: "15'", aktivitas: "Ice Breaking", pic: "Semua" },
      { time: "0:30-1:15", durasi: "45'", aktivitas: "Materi Inti + Demo", pic: speaker },
      { time: "1:15-1:30", durasi: "15'", aktivitas: "Break + Photo Booth", pic: "—" },
      { time: "1:30-2:15", durasi: "45'", aktivitas: "Praktik Langsung", pic: speaker },
      { time: "2:15-2:45", durasi: "30'", aktivitas: "Showcase + Feedback", pic: speaker },
      { time: "2:45-3:00", durasi: "15'", aktivitas: "Info Lanjutan + Foto", pic: speaker },
    ];

    return NextResponse.json({
      event: { id: ev.id, title, date, location, venueType, priceText, isPaid, price, time, quota, speaker, type: ev.type },
      kvPrompt,
      surat,
      waBlast,
      ig,
      checklist,
      rundown,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
