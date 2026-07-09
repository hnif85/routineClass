import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { jwtVerify } from "jose";

async function extractPdfText(buffer: Buffer): Promise<{ title: string; fullText: string } | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = undefined;

    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      enableXfa: false,
    } as any).promise;

    const totalPages = doc.numPages;
    let pdfTitle = "Materi PDF";
    const texts: string[] = [];

    try {
      const metadata = await doc.getMetadata();
      const info = metadata?.info as Record<string, any> | undefined;
      if (info?.Title) pdfTitle = info.Title;
    } catch {}

    for (let i = 1; i <= totalPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str || "").join(" ");
      if (text.trim()) texts.push(text.trim());
    }

    await doc.destroy();
    return { title: pdfTitle, fullText: texts.join("\n\n") };
  } catch (err: any) {
    console.error("[process-upload] PDF extraction failed:", err.message);
    return null;
  }
}

async function generateTests(materialTitle: string, content: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const prompt = `Buat soal pre-test dan post-test dalam Bahasa Indonesia berdasarkan materi berikut.

Judul: ${materialTitle}
Materi:
${content.substring(0, 5000)}

Format JSON:
{
  "pre": [
    { "question": "teks pertanyaan", "type": "multiple_choice", "options": ["A", "B", "C", "D"], "answer": "A" },
    { "question": "teks pertanyaan", "type": "essay" }
  ],
  "post": [
    { "question": "teks pertanyaan", "type": "multiple_choice", "options": ["A", "B", "C", "D"], "answer": "A" },
    { "question": "teks pertanyaan", "type": "essay" }
  ]
}

Buat 3 multiple_choice + 2 essay untuk pre-test, dan 3 multiple_choice + 2 essay untuk post-test.
Pertanyaan harus spesifik dari materi, bukan pertanyaan umum.
HANYA return JSON, tidak ada teks lain.`;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("[materials/process] DeepSeek error:", res.status, txt);
    return null;
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { return null; }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as any).role as string;
    if (!["admin", "super_admin", "perusahaan", "pemateri"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { file_path, original_name } = await req.json();
    if (!file_path) return NextResponse.json({ error: "file_path diperlukan" }, { status: 400 });

    const supabase = await createServerSupabase();

    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("umkmConnect")
      .download(file_path);

    if (downloadErr || !fileData) {
      return NextResponse.json({ error: "Gagal download file: " + downloadErr?.message }, { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await extractPdfText(buffer);

    const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/umkmConnect/${file_path}`;
    const title = result
      ? (result.title !== "Materi PDF" ? result.title : (original_name || file_path.split("/").pop() || "").replace(/\.pdf$/i, ""))
      : (original_name || file_path.split("/").pop() || "").replace(/\.pdf$/i, "");

    const syllabus = [{ day: 1, topic: title, duration: "1 sesi" }];

    const { data: material, error: matErr } = await supabase
      .from("materials")
      .insert({
        title,
        description: `File PDF — ${original_name || file_path}`,
        content: [],
        syllabus,
        total_days: 1,
        is_ai_generated: false,
        file_url: fileUrl,
        file_type: "pdf",
      })
      .select()
      .single();

    if (matErr || !material) {
      return NextResponse.json({ error: "Gagal menyimpan materi: " + matErr?.message }, { status: 500 });
    }

    const testData = result?.fullText ? await generateTests(title, result.fullText) : null;

    let testId = null;
    if (testData) {
      const { data: test } = await supabase.from("tests").insert({
        name: `Test: ${title}`,
        description: `Pre & Post test untuk materi "${title}"`,
        type: "test",
        is_active: true,
      }).select().single();

      if (test) {
        testId = test.id;
        const { data: prePhase } = await supabase.from("test_phases").insert({
          test_id: test.id, phase: "pre", label: "Pre-Test", sort_order: 0,
        }).select().single();
        const { data: postPhase } = await supabase.from("test_phases").insert({
          test_id: test.id, phase: "post", label: "Post-Test", sort_order: 1,
        }).select().single();

        if (prePhase) {
          for (let i = 0; i < testData.pre.length; i++) {
            const q = testData.pre[i];
            await supabase.from("test_questions").insert({
              phase_id: prePhase.id, question_text: q.question,
              question_type: q.type || "multiple_choice",
              options: q.options || null, correct_answer: q.answer || null,
              points: 1, sort_order: i,
            });
          }
        }
        if (postPhase) {
          for (let i = 0; i < testData.post.length; i++) {
            const q = testData.post[i];
            await supabase.from("test_questions").insert({
              phase_id: postPhase.id, question_text: q.question,
              question_type: q.type || "multiple_choice",
              options: q.options || null, correct_answer: q.answer || null,
              points: 1, sort_order: i,
            });
          }
        }
      }
    }

    if (testId) {
      await supabase.from("materials").update({
        test_data: {
          pre_test: (testData?.pre || []).map((q: any) => ({
            question: q.question, type: q.type, options: q.options, answer: q.answer,
          })),
          post_test: (testData?.post || []).map((q: any) => ({
            question: q.question, type: q.type, options: q.options, answer: q.answer,
          })),
        },
      }).eq("id", material.id);
    }

    return NextResponse.json({
      success: true,
      material: { id: material.id, title, file_url: fileUrl },
      test: testId ? { id: testId, name: `Test: ${title}` } : null,
    });
  } catch (err: any) {
    console.error("[materials/process-upload] Error:", err);
    return NextResponse.json({ error: err.message || "Terjadi kesalahan" }, { status: 500 });
  }
}
