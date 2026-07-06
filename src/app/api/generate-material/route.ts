import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

async function callDeepSeek(system: string, user: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.warn("[generate-material] No DEEPSEEK_API_KEY — returning mock");
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
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

interface GenerateRequest {
  topic: string;
  days: number;
  level?: "pemula" | "menengah" | "lanjutan";
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  const role = (payload as any).role as string;
  if (!["admin", "super_admin", "perusahaan", "pemateri"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { checkRateLimit, getClientIp, LIMITS } = await import("@/lib/rate-limit");
  const ip = getClientIp(req);
  const rl = checkRateLimit({ ...LIMITS.ai, identifier: `ai:${ip}` });
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  try {
    const body: GenerateRequest = await req.json();
    const { topic, days = 1, level = "pemula" } = body;

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ error: "Topik harus diisi minimal 3 karakter" }, { status: 400 });
    }

    const planPrompt = `Anda adalah perancang kurikulum pelatihan UMKM Indonesia. Buatlah RENCANA PELATIHAN (bukan materi lengkap) berdasarkan topik berikut.

Topik: "${topic}"
Tingkat: ${level}
Jumlah sesi: ${days}

Buat silabus/outline yang mencakup:
- Judul pelatihan yang profesional
- Deskripsi singkat (2-3 kalimat)
- Silabus per sesi: topik dan durasi

Format JSON WAJIB (HANYA JSON, tanpa markdown):
{
  "title": "Judul pelatihan",
  "description": "Deskripsi singkat",
  "syllabus": [
    { "day": 1, "topic": "Topik sesi 1", "duration": "durasi (misal: 2 jam)" }
  ]
}

Jangan buat konten/handbook lengkap — cukup rencana pelatihan saja.`;

    let planRaw = await callDeepSeek("Anda adalah perancang kurikulum pelatihan UMKM Indonesia.", planPrompt);

    if (!planRaw) {
      planRaw = JSON.stringify(getMockPlan(topic, days, level));
    }

    const cleaned = planRaw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
    const plan = JSON.parse(cleaned);

    const testPrompt = `Berdasarkan topik pelatihan "${topic}" tingkat ${level}, buatlah soal pre-test dan post-test.

INSTRUKSI KETAT:
1. Pre-test: 5 soal pilihan ganda yang mengukur PENGETAHUAN DASAR sebelum pelatihan.
2. Post-test: 5 soal pilihan ganda yang mengukur PEMAHAMAN SETELAH BELAJAR.
3. Setiap soal memiliki 4 opsi jawaban (A, B, C, D) dan SATU jawaban benar.
4. Soal harus SPESIFIK, bukan pertanyaan umum/cliche.

Format JSON WAJIB (HANYA JSON, tanpa teks lain):
{
  "pre_test": [
    { "question": "Teks pertanyaan?", "options": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"], "correct": 0, "points": 1 }
  ],
  "post_test": [
    { "question": "Teks pertanyaan?", "options": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"], "correct": 2, "points": 2 }
  ]
}

Gunakan nomor index (0-based) untuk correct. Pre-test points=1, Post-test points=2.`;

    let testRaw = await callDeepSeek("Anda adalah ahli pembuat soal pelatihan.", testPrompt);

    let tests: { pre_test: any[]; post_test: any[] } = { pre_test: [], post_test: [] };
    if (testRaw) {
      const testCleaned = testRaw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
      try { tests = JSON.parse(testCleaned); } catch { /* keep defaults */ }
    } else {
      tests = getMockTests(topic);
    }

    return NextResponse.json({
      ...plan,
      pre_test: tests.pre_test,
      post_test: tests.post_test,
    });
  } catch (err: any) {
    console.error("[generate-material] Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal generate rencana" },
      { status: 500 }
    );
  }
}

function getMockPlan(topic: string, days: number, level: string) {
  const syllabus = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    topic: `${topic} — Sesi ${i + 1}`,
    duration: `${1.5 + (i * 0.5)} jam`,
  }));

  return {
    title: `${topic} untuk UMKM`,
    description: `Rencana pelatihan ${topic} tingkat ${level} untuk pelaku UMKM Indonesia. ${days} sesi pembelajaran.`,
    syllabus,
  };
}

function getMockTests(topic: string) {
  return {
    pre_test: [
      { question: `Apa yang dimaksud dengan ${topic}?`, options: ["A. Sebuah konsep", "B. Strategi bisnis", "C. Alat pemasaran", "D. Teknologi baru"], correct: 0, points: 1 },
      { question: `Mengapa ${topic} penting untuk UMKM?`, options: ["A. Tidak penting", "B. Meningkatkan penjualan", "C. Mengurangi biaya", "D. Semua benar"], correct: 3, points: 1 },
      { question: `Siapa yang perlu memahami ${topic}?`, options: ["A. Pemilik UMKM", "B. Karyawan", "C. Konsumen", "D. Pemerintah"], correct: 0, points: 1 },
      { question: `Kapan waktu yang tepat untuk menerapkan ${topic}?`, options: ["A. Nanti", "B. Setelah untung besar", "C. Segera mungkin", "D. Tidak perlu"], correct: 2, points: 1 },
      { question: `Apa manfaat utama ${topic}?`, options: ["A. Hiburan", "B. Efisiensi & pertumbuhan", "C. Mengikuti tren", "D. Menghabiskan uang"], correct: 1, points: 1 },
    ],
    post_test: [
      { question: `Setelah mempelajari ${topic}, langkah pertama yang harus dilakukan?`, options: ["A. Evaluasi kondisi saat ini", "B. Langsung beli alat", "C. Tanya teman", "D. Abaikan"], correct: 0, points: 2 },
      { question: `Bagaimana cara mengukur keberhasilan penerapan ${topic}?`, options: ["A. Dari omzet", "B. Dari feedback pelanggan", "C. Keduanya", "D. Tidak perlu diukur"], correct: 2, points: 2 },
      { question: `Apa kendala umum dalam menerapkan ${topic}?`, options: ["A. Biaya", "B. Kurang pengetahuan", "C. Tidak ada dukungan", "D. Semua di atas"], correct: 3, points: 2 },
      { question: `Sebutkan satu tools yang mendukung ${topic}`, options: ["A. Spreadsheet", "B. Aplikasi khusus", "C. Buku catatan", "D. Media sosial"], correct: 1, points: 2 },
      { question: `Apa indikator utama keberhasilan ${topic}?`, options: ["A. Peningkatan efisiensi", "B. Banyak pujian", "C. Ikut tren", "D. Ramai di media sosial"], correct: 0, points: 2 },
    ],
  };
}