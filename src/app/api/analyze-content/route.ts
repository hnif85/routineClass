import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

async function callDeepSeek(system: string, user: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.warn("[analyze-content] No DEEPSEEK_API_KEY — returning mock");
    return null;
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

export async function POST(req: NextRequest) {
  const { checkRateLimit, getClientIp, LIMITS } = await import("@/lib/rate-limit");
  const ip = getClientIp(req);
  const rl = checkRateLimit({ ...LIMITS.ai, identifier: `ai:${ip}` });
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  try {
    const body = await req.json();
    const { title, description, raw_content: rawContent, days = 1 } = body;

    if (!title || title.trim().length < 1) {
      return NextResponse.json({ error: "Judul harus diisi" }, { status: 400 });
    }
    if (!rawContent || rawContent.trim().length < 10) {
      return NextResponse.json({ error: "Konten minimal 10 karakter" }, { status: 400 });
    }

    const truncatedContent = rawContent.substring(0, 8000);

    const prompt = `Berikut adalah konten materi pelatihan untuk UMKM di Indonesia:

JUDUL: ${title}
DESKRIPSI: ${description || "(tidak ada deskripsi)"}
JUMLAH HARI PELATIHAN: ${days}

KONTEN MATERI:
${truncatedContent}

Berdasarkan konten materi di atas, buatlah:
1. **5 soal PRE-TEST** — pilihan ganda, untuk mengukur pengetahuan dasar peserta SEBELUM mempelajari materi.
2. **5 soal POST-TEST** — pilihan ganda, untuk mengukur pemahaman peserta SETELAH mempelajari materi.

Setiap soal harus memiliki 4 opsi jawaban (A, B, C, D) dan satu jawaban yang benar.
Soal harus relevan dengan konten materi yang diberikan.

Format output JSON (jangan pakai markdown, langsung JSON):
{
  "pre_test": [
    { "question": "Teks soal?", "options": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"], "correct": 0, "points": 2 }
  ],
  "post_test": [
    { "question": "Teks soal?", "options": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"], "correct": 2, "points": 2 }
  ]
}

Gunakan nomor index (0-based) untuk correct. Soal pre-test lebih mudah, post-test lebih mendalam.`;

    let testRaw = await callDeepSeek(
      "Anda adalah asisten pembuat soal pelatihan UMKM Indonesia. Buat soal yang relevan, jelas, dan sesuai dengan konten materi yang diberikan.",
      prompt
    );

    let tests: { pre_test: any[]; post_test: any[] } = { pre_test: [], post_test: [] };

    if (testRaw) {
      const cleaned = testRaw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
      try {
        tests = JSON.parse(cleaned);
      } catch {
        console.warn("[analyze-content] Failed to parse AI response, using mock");
      }
    }

    // Mock fallback
    if (!testRaw || tests.pre_test.length === 0) {
      tests = getMockTests(title);
    }

    return NextResponse.json(tests);
  } catch (err: any) {
    console.error("[analyze-content] Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal menganalisis konten" },
      { status: 500 }
    );
  }
}

function getMockTests(title: string) {
  return {
    pre_test: [
      { question: `Apa topik utama dari materi "${title}"?`, options: ["A. Manajemen bisnis", "B. Pemasaran digital", "C. Keuangan UMKM", "D. Sesuai judul materi"], correct: 3, points: 2 },
      { question: `Siapa target utama dari materi ini?`, options: ["A. Pelaku UMKM", "B. Karyawan kantor", "C. Mahasiswa", "D. Semua orang"], correct: 0, points: 2 },
      { question: `Apa manfaat mempelajari materi ini?`, options: ["A. Hiburan", "B. Pengembangan usaha", "C. Tidak ada manfaat", "D. Hanya formalitas"], correct: 1, points: 2 },
      { question: `Kapan waktu yang tepat menerapkan ilmu dari materi ini?`, options: ["A. Nanti", "B. Setelah usaha besar", "C. Segera mungkin", "D. Tidak perlu"], correct: 2, points: 2 },
      { question: `Apa langkah pertama yang harus dilakukan?`, options: ["A. Membaca seluruh materi", "B. Langsung praktek", "C. Diskusi dengan teman", "D. Menyerah"], correct: 0, points: 2 },
    ],
    post_test: [
      { question: `Berdasarkan materi "${title}", sebutkan satu konsep kunci yang dipelajari?`, options: ["A. Konsep A", "B. Konsep B", "C. Tergantung materi", "D. Tidak ada konsep"], correct: 2, points: 2 },
      { question: `Bagaimana cara mengukur keberhasilan penerapan materi ini?`, options: ["A. Dari omzet", "B. Dari feedback pelanggan", "C. Keduanya", "D. Tidak perlu"], correct: 2, points: 2 },
      { question: `Apa kendala umum yang dihadapi saat menerapkan materi ini?`, options: ["A. Biaya", "B. Kurang pengetahuan", "C. Tidak ada dukungan", "D. Semua di atas"], correct: 3, points: 2 },
      { question: `Apa indikator utama keberhasilan dari materi ini?`, options: ["A. Peningkatan efisiensi", "B. Banyak pujian", "C. Ikut tren", "D. Ramai di media sosial"], correct: 0, points: 2 },
      { question: `Lanjutan yang tepat: Setelah memahami materi ini, langkah selanjutnya adalah...`, options: ["A. Evaluasi & iterasi", "B. Berhenti belajar", "C. Ganti usaha", "D. Abaikan"], correct: 0, points: 2 },
    ],
  };
}
