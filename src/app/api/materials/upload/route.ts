import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { createServerSupabase } from "@/lib/supabase/server";

// ── Extract text from a PPTX buffer ──
async function extractPptxText(buffer: ArrayBuffer): Promise<{ title: string; slides: { num: number; title: string; body: string }[] }> {
  const zip = await JSZip.loadAsync(buffer);
  
  // Find all slide files
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return na - nb;
    });

  const slides: { num: number; title: string; body: string }[] = [];
  let globalTitle = "";

  for (const file of slideFiles) {
    const xml = await zip.files[file].async("text");
    const texts: string[] = [];
    
    // Extract all <a:t> text elements
    const tRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let match;
    while ((match = tRegex.exec(xml)) !== null) {
      const txt = match[1].trim();
      if (txt) texts.push(txt);
    }

    const slideNum = parseInt(file.match(/slide(\d+)/)?.[1] || "0");
    const title = texts[0] || `Slide ${slideNum}`;
    const body = texts.slice(1).join("\n\n");
    
    // Use first slide title as global title if not set
    if (!globalTitle && slideNum === 1) {
      globalTitle = title;
    }

    if (body.trim()) {
      slides.push({ num: slideNum, title, body });
    }
  }

  return { title: globalTitle || "Materi Presentasi", slides };
}

// ── Extract text from a PDF buffer ──
async function extractPdfText(buffer: Buffer): Promise<{ title: string; slides: { num: number; title: string; body: string }[] }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const [info, textResult] = await Promise.all([parser.getInfo(), parser.getText()]);
  parser.destroy();

  const fullText = textResult.text || "";
  const lines = fullText.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);

  // Use per-page text if available, otherwise estimate by ~20-line chunks
  let slides: { num: number; title: string; body: string }[] = [];

  if (textResult.pages && textResult.pages.length > 0) {
    slides = textResult.pages.map((p: { num: number; text: string }) => {
      const pageLines = (p.text || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
      return {
        num: p.num,
        title: pageLines[0] || `Halaman ${p.num}`,
        body: pageLines.slice(1).join("\n") || p.text || "",
      };
    });
  } else {
    // Fallback: chunk by ~20 lines
    const PAGE_LINE_ESTIMATE = 20;
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    for (const line of lines) {
      currentChunk.push(line);
      if (currentChunk.length >= PAGE_LINE_ESTIMATE) {
        chunks.push(currentChunk.join("\n"));
        currentChunk = [];
      }
    }
    if (currentChunk.length) chunks.push(currentChunk.join("\n"));

    slides = chunks.map((chunk, i) => {
      const bodyLines = chunk.split("\n").filter(Boolean);
      return {
        num: i + 1,
        title: bodyLines[0] || `Halaman ${i + 1}`,
        body: bodyLines.slice(1).join("\n") || chunk,
      };
    });
  }

  const pdfTitle = info?.info?.Title || lines[0] || "Materi PDF";

  return {
    title: pdfTitle,
    slides: slides.length > 0 ? slides : [{ num: 1, title: lines[0] || "Materi", body: fullText.substring(0, 2000) }],
  };
}

// ── Generate tests using DeepSeek ──
async function generateTests(materialTitle: string, content: string): Promise<{ pre: any[]; post: any[] } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const prompt = `Buat soal pre-test dan post-test dalam Bahasa Indonesia berdasarkan materi berikut.

Judul: ${materialTitle}
Materi:
${content.substring(0, 4000)}

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

Buat 3 soal multiple_choice + 2 essay untuk pre-test, dan 3 multiple_choice + 2 essay untuk post-test.
Pertanyaan harus spesifik dari materi, bukan pertanyaan umum.
HANYA return JSON, tidak ada teks lain.`;

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    // Extract JSON block
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (e) {
    console.error("[generate-tests] DeepSeek error:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) return NextResponse.json({ error: "File diperlukan" }, { status: 400 });
    if (!file.name.match(/\.(pptx?|pdf)$/i)) return NextResponse.json({ error: "Hanya file PPTX atau PDF yang didukung" }, { status: 400 });

    const supabase = await createServerSupabase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const isPdf = file.name.match(/\.pdf$/i);

    // ── 1. Extract text ──
    let title: string, slides: { num: number; title: string; body: string }[];

    if (isPdf) {
      const result = await extractPdfText(buffer);
      title = result.title;
      slides = result.slides;
    } else {
      const result = await extractPptxText(arrayBuffer);
      title = result.title;
      slides = result.slides;
    }

    if (slides.length === 0) {
      return NextResponse.json({ error: `Tidak ada teks ditemukan di file ${isPdf ? "PDF" : "PPTX"}` }, { status: 400 });
    }

    const fileTypeLabel = isPdf ? "PDF" : "PPTX";
    const fileType = isPdf ? "pdf" : "pptx";

    // ── 2. Build material content ──
    const content = slides.map((s, i) => ({
      day: i + 1,
      title: s.title,
      body: s.body,
    }));

    const syllabus = slides.map((s, i) => ({
      day: i + 1,
      topic: s.title,
      duration: "45 menit",
    }));

    // ── 3. Upload original file to Supabase Storage ──
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadErr } = await supabase.storage
      .from("umkmConnect")
      .upload(`materials/${fileName}`, buffer, { contentType: file.type, upsert: true });

    const fileUrl = uploadErr 
      ? null 
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/umkmConnect/materials/${fileName}`;

    // ── 4. Create material record ──
    const MAX_CONTENT_LENGTH = 32_000;
    const contentJsonString = JSON.stringify(content);
    const trimmedContent = contentJsonString.length > MAX_CONTENT_LENGTH
      ? JSON.parse(contentJsonString.substring(0, MAX_CONTENT_LENGTH))
      : content;

    const { data: material, error: matErr } = await supabase
      .from("materials")
      .insert({
        title,
        description: `Materi dari ${fileTypeLabel}: ${slides.length} halaman`,
        content: trimmedContent,
        syllabus,
        is_ai_generated: true,
        file_url: fileUrl,
        file_type: fileType,
      })
      .select()
      .single();

    if (matErr || !material) {
      return NextResponse.json({ error: "Gagal menyimpan materi: " + matErr?.message }, { status: 500 });
    }

    // ── 5. Generate Pre & Post Test ──
    const allBody = slides.map(s => s.body).join("\n\n").substring(0, 8000);
    const testData = await generateTests(title, allBody);

    let testId = null;
    if (testData) {
      // Create test record
      const testName = `Test: ${title}`;
      const { data: test } = await supabase.from("tests").insert({
        name: testName,
        description: `Pre & Post test untuk materi "${title}"`,
        type: "test",
        is_active: true,
      }).select().single();

      if (test) {
        testId = test.id;
        // Create pre phase
        const { data: prePhase } = await supabase.from("test_phases").insert({
          test_id: test.id, phase: "pre", label: "Pre-Test", sort_order: 0,
        }).select().single();

        // Create post phase
        const { data: postPhase } = await supabase.from("test_phases").insert({
          test_id: test.id, phase: "post", label: "Post-Test", sort_order: 1,
        }).select().single();

        // Insert questions
        if (prePhase) {
          for (let i = 0; i < testData.pre.length; i++) {
            const q = testData.pre[i];
            await supabase.from("test_questions").insert({
              phase_id: prePhase.id,
              question_text: q.question,
              question_type: q.type || "multiple_choice",
              options: q.options || null,
              correct_answer: q.answer || null,
              points: 1,
              sort_order: i,
            });
          }
        }
        if (postPhase) {
          for (let i = 0; i < testData.post.length; i++) {
            const q = testData.post[i];
            await supabase.from("test_questions").insert({
              phase_id: postPhase.id,
              question_text: q.question,
              question_type: q.type || "multiple_choice",
              options: q.options || null,
              correct_answer: q.answer || null,
              points: 1,
              sort_order: i,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      file_type: fileType,
      material: { id: material.id, title, slides: slides.length },
      test: testId ? { id: testId, name: `Test: ${title}` } : null,
      file_url: fileUrl,
    });

  } catch (err: any) {
    console.error("[upload-file] Error:", err);
    return NextResponse.json({ error: err.message || "Gagal upload" }, { status: 500 });
  }
}
