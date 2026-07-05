import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

/**
 * Split content text into slides based on headings (# ## ### etc).
 * Each heading starts a new slide. Content between headings stays together.
 */
function splitIntoSlides(bodyText: string, dayTitle: string, dayNum: number) {
  if (!bodyText || !bodyText.trim()) return [];

  const slides: { title: string; body: string }[] = [];
  const lines = bodyText.split("\n");
  
  let currentTitle = dayTitle || `Hari ${dayNum}`;
  let currentBody: string[] = [];
  let isFirstSection = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for heading markers
    const h1Match = trimmed.match(/^#\s+(.+)/);
    const h2Match = trimmed.match(/^##\s+(.+)/);
    const h3Match = trimmed.match(/^###\s+(.+)/);
    
    if (h1Match || h2Match || h3Match) {
      const headingText = (h1Match || h2Match || h3Match)![1];
      
      // Save previous slide body
      if (currentBody.length > 0 || isFirstSection) {
        slides.push({
          title: isFirstSection ? currentTitle : currentTitle,
          body: currentBody.join("\n").trim(),
        });
        isFirstSection = false;
      }
      
      // Start new slide
      currentTitle = headingText;
      currentBody = [];
    } else {
      currentBody.push(trimmed);
    }
  }

  // Don't forget the last section
  if (currentBody.length > 0) {
    slides.push({ title: currentTitle, body: currentBody.join("\n").trim() });
  }

  return slides;
}

/**
 * Estimate if text will fit on a slide (rough char count).
 * If too long, split further into sub-slides at sentence boundaries.
 */
function ensureFits(slides: { title: string; body: string }[], maxChars: number = 1100) {
  const result: { title: string; body: string }[] = [];
  
  for (const slide of slides) {
    if (slide.body.length <= maxChars) {
      result.push(slide);
      continue;
    }

    const paragraphs = slide.body.split("\n").filter(p => p.trim());
    let chunk: string[] = [];
    let chunkLen = 0;

    for (const para of paragraphs) {
      // Extra-long single paragraph → split by sentences
      if (para.length > maxChars) {
        if (chunk.length > 0) { result.push({ title: slide.title, body: chunk.join("\n\n") }); chunk = []; chunkLen = 0; }
        const sents = para.split(/(?<=[.!?])\s+/);
        let sChunk: string[] = []; let sLen = 0; let part = 0;
        for (const s of sents) {
          if (sLen + s.length > maxChars && sChunk.length > 0) {
            result.push({ title: slide.title + (part > 0 ? ` (lanjutan ${part})` : ""), body: sChunk.join(" ") });
            sChunk = [s]; sLen = s.length; part++;
          } else { sChunk.push(s); sLen += s.length; }
        }
        if (sChunk.length > 0) result.push({ title: slide.title + (part > 0 ? ` (lanjutan ${part})` : ""), body: sChunk.join(" ") });
        continue;
      }

      if (chunkLen + para.length > maxChars && chunk.length > 0) {
        result.push({ title: slide.title, body: chunk.join("\n\n") });
        chunk = [para]; chunkLen = para.length;
      } else { chunk.push(para); chunkLen += para.length; }
    }
    if (chunk.length > 0) result.push({ title: slide.title, body: chunk.join("\n\n") });
  }

  return result.length > 0 ? result : slides;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, syllabus, content } = body;

    if (!title) {
      return NextResponse.json({ error: "Judul diperlukan" }, { status: 400 });
    }

    // ── Colors (MWX Blue) ──
    const PRIMARY = "2563EB";
    const SECONDARY = "3B82F6";
    const ACCENT = "60A5FA";
    const DARK = "1E293B";
    const WHITE = "FFFFFF";
    const BG_LIGHT = "F4F7FC";
    const MUTED = "64748B";

    const pres = new PptxGenJS();
    pres.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pres.layout = "WIDE";

    // ═══════════ SLIDE 1: COVER ═══════════
    const cover = pres.addSlide();
    cover.background = { color: PRIMARY };
    cover.addText(title, {
      x: 0.8, y: 2.8, w: 11, h: 1.8,
      fontSize: 34, fontFace: "Arial", color: WHITE, bold: true,
      valign: "top", align: "left",
    });
    if (description) {
      cover.addText(description, {
        x: 0.8, y: 4.4, w: 10, h: 1.2,
        fontSize: 15, fontFace: "Arial", color: "BFDBFE",
        valign: "top", align: "left",
      });
    }
    cover.addText("Routine Class MWX", {
      x: 0.8, y: 0.6, w: 6, h: 0.5,
      fontSize: 12, fontFace: "Arial", color: ACCENT,
      valign: "middle",
    });

    // ═══════════ SLIDE 2: SILABUS ═══════════
    if (syllabus?.length > 0) {
      const sSlide = pres.addSlide();
      sSlide.background = { color: WHITE };
      sSlide.addText("Silabus Pelatihan", {
        x: 0.8, y: 0.5, w: 11, h: 0.7,
        fontSize: 24, fontFace: "Arial", color: DARK, bold: true,
      });

      const rows = syllabus.map((s: any) => [
        { text: `Hari ${s.day}`, options: { fontSize: 12, bold: true, color: DARK, align: "center" } },
        { text: s.topic || "", options: { fontSize: 12, color: DARK } },
        { text: s.duration || "", options: { fontSize: 11, color: MUTED, align: "center" } },
      ]);

      sSlide.addTable(
        [
          [
            { text: "Hari", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: PRIMARY }, align: "center" } },
            { text: "Topik", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: PRIMARY } } },
            { text: "Durasi", options: { fontSize: 11, bold: true, color: WHITE, fill: { color: PRIMARY }, align: "center" } },
          ],
          ...rows,
        ],
        {
          x: 0.8, y: 1.4, w: 11.5,
          fontSize: 12, color: DARK,
          border: { type: "solid", pt: 0.5, color: "E2E8F0" },
          colW: [1.5, 8, 2],
          rowH: [0.5, ...rows.map(() => 0.5)],
        }
      );
    }

    // ═══════════ CONTENT SLIDES: ANALYZE → SPLIT ═══════════
    const days = content || [];
    let slideNum = syllabus?.length > 0 ? 2 : 1;

    for (const day of days) {
      const bodyText = typeof day.body === "string" ? day.body : "";
      if (!bodyText || !bodyText.trim()) continue;

      const dayTitle = day.title || `Hari ${day.day}`;

      // 1. ANALYZE: Split content by headings (#, ##, ###)
      let slides = splitIntoSlides(bodyText, dayTitle, day.day);

      // 2. ENSURE FIT: Split oversized slides
      slides = ensureFits(slides, 1600);

      // 3. GENERATE: One slide per chunk
      for (const s of slides) {
        slideNum++;
        const slide = pres.addSlide();
        slide.background = { color: WHITE };

        // Top accent bar
        slide.addShape(pres.ShapeType.rect, {
          x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: PRIMARY },
        });

        // Title area with light bg
        slide.addShape(pres.ShapeType.rect, {
          x: 0, y: 0.06, w: 13.33, h: 1.3, fill: { color: BG_LIGHT },
        });
        slide.addText(dayTitle.toUpperCase(), {
          x: 0.8, y: 0.15, w: 9, h: 0.3,
          fontSize: 9, fontFace: "Arial", color: MUTED, bold: true,
          valign: "middle",
        });
        slide.addText(s.title, {
          x: 0.8, y: 0.55, w: 11.5, h: 0.6,
          fontSize: 16, fontFace: "Arial", color: DARK, bold: true,
          valign: "middle",
        });

        // Body content
        slide.addText(s.body, {
          x: 0.8, y: 1.6, w: 11.5, h: 5.3,
          fontSize: 11.5, fontFace: "Arial", color: DARK, valign: "top", align: "left", lineSpacingMultiple: 1.2,
          autoFit: true,
        });

        // Page number
        slide.addText(`${slideNum}`, {
          x: 11.5, y: 7.0, w: 1, h: 0.4,
          fontSize: 10, color: MUTED, align: "right",
        });
      }
    }

    // ═══════════ THANK YOU SLIDE ═══════════
    const last = pres.addSlide();
    last.background = { color: PRIMARY };
    last.addText("Terima Kasih", {
      x: 0.8, y: 3.0, w: 11.5, h: 1.2,
      fontSize: 36, fontFace: "Arial", color: WHITE, bold: true,
      align: "center",
    });
    last.addText("Routine Class MWX — Belajar AI untuk UMKM", {
      x: 0.8, y: 4.2, w: 11.5, h: 0.6,
      fontSize: 14, fontFace: "Arial", color: "BFDBFE",
      align: "center",
    });

    // Generate buffer
    const buffer = await pres.write({ outputType: "nodebuffer" }) as Buffer;
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.pptx"`,
      },
    });
  } catch (err: any) {
    console.error("[generate-pptx] Error:", err);
    return NextResponse.json({ error: err.message || "Gagal generate PPTX" }, { status: 500 });
  }
}
