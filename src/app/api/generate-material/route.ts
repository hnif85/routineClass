import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

async function callDeepSeek(system: string, user: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    // Return mock data so the UI is testable without a key
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
      max_tokens: 8192,
    }),
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
  try {
    const body: GenerateRequest = await req.json();
    const { topic, days = 1, level = "pemula" } = body;

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ error: "Topik harus diisi minimal 3 karakter" }, { status: 400 });
    }

    // ── Step 1: Generate material content ──
    const materialPrompt = `Anda adalah asisten pembuat materi pelatihan UMKM di Indonesia. 
Buatlah materi pelatihan yang lengkap, praktis, dan mudah dipahami oleh pelaku UMKM.

Topik: "${topic}"
Tingkat: ${level}
Jumlah hari pelatihan: ${days}

Format output JSON (jangan pakai markdown, langsung JSON):
{
  "title": "Judul materi yang menarik",
  "description": "Deskripsi singkat materi (2-3 kalimat)",
  "syllabus": [
    { "day": 1, "topic": "Judul sesi hari 1", "duration": "durasi dalam jam" }
  ],
  "content": [
    {
      "day": 1,
      "title": "Judul sesi hari 1",
      "body": "Penjelasan lengkap dalam paragraf, dengan poin-poin penting, contoh praktis untuk UMKM Indonesia, dan tips aplikasi. Tulis dalam Bahasa Indonesia yang baik dan benar. Minimal 500 kata per hari."
    }
  ]
}

Pastikan:
- Materi relevan dengan konteks UMKM Indonesia
- Bahasa Indonesia yang jelas dan praktis
- Ada contoh nyata yang relevan
- Setiap hari memiliki sub-topik yang terstruktur
- Total hari sesuai dengan jumlah yang diminta`;

    let materialRaw = await callDeepSeek("Anda adalah ahli pembuatan materi pelatihan UMKM.", materialPrompt);

    // Mock fallback if no API key
    if (!materialRaw) {
      materialRaw = JSON.stringify(getMockMaterial(topic, days, level));
    }

    // Parse JSON from response (handle markdown wrapping)
    const cleaned = materialRaw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
    const material = JSON.parse(cleaned);

    // ── Step 2: Generate pre/post test questions ──
    const testPrompt = `Berdasarkan materi pelatihan berikut, buatlah soal pre-test dan post-test.

Topik: "${topic}"
Tingkat: ${level}

Buat 5 soal pilihan ganda untuk PRE-TEST (sebelum materi) dan 5 soal pilihan ganda untuk POST-TEST (setelah materi).
Setiap soal memiliki 4 opsi jawaban (A, B, C, D) dan satu jawaban benar.

Format JSON:
{
  "pre_test": [
    { "question": "Teks soal?", "options": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"], "correct": 0, "points": 1 }
  ],
  "post_test": [ ... ]
}

Jawaban pre-test mengukur pengetahuan dasar, jawaban post-test mengukur pemahaman setelah belajar.
Gunakan nomor index (0-based) untuk correct.`;

    let testRaw = await callDeepSeek("Anda adalah ahli pembuat soal pelatihan.", testPrompt);

    let tests: { pre_test: any[]; post_test: any[] } = { pre_test: [], post_test: [] };
    if (testRaw) {
      const testCleaned = testRaw.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
      try { tests = JSON.parse(testCleaned); } catch { /* keep defaults */ }
    } else {
      tests = getMockTests(topic);
    }

    return NextResponse.json({
      ...material,
      pre_test: tests.pre_test,
      post_test: tests.post_test,
    });
  } catch (err: any) {
    console.error("[generate-material] Error:", err);
    return NextResponse.json(
      { error: err.message || "Gagal generate materi" },
      { status: 500 }
    );
  }
}

// ── Mock fallback (when no API key) ──

function getMockMaterial(topic: string, days: number, level: string) {
  const content = Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    title: `Hari ${i + 1}: ${topic} — Sesi ${i + 1}`,
    body: `## ${topic} — Hari ${i + 1}\n\nPada sesi ini, peserta akan mempelajari aspek penting dari ${topic} yang relevan dengan usaha mereka.\n\n### Poin-Poin Penting:\n- Pengenalan konsep dasar ${topic}\n- Penerapan praktis untuk UMKM\n- Studi kasus dan contoh nyata\n- Tips dan trik implementasi\n\n### Latihan Praktis:\nPeserta diminta untuk menerapkan satu konsep ${topic} ke dalam usaha mereka dan mencatat hasilnya.\n\n### Kesimpulan:\n${topic} adalah keterampilan penting yang dapat membantu UMKM berkembang. Dengan latihan rutin, peserta akan semakin mahir.`,
  }));

  const syllabus = content.map(c => ({
    day: c.day,
    topic: c.title,
    duration: `${1.5 + (c.day * 0.5)} jam`,
  }));

  return {
    title: `${topic} untuk UMKM`,
    description: `Materi pelatihan ${topic} tingkat ${level} yang dirancang khusus untuk pelaku UMKM Indonesia. Mencakup ${days} hari pembelajaran dengan pendekatan praktis.`,
    syllabus,
    content,
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
