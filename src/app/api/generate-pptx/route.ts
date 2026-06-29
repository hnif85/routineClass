import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, syllabus, content } = body;

    if (!title) {
      return NextResponse.json({ error: "Judul diperlukan" }, { status: 400 });
    }

    const pres = new PptxGenJS();
    pres.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pres.layout = "WIDE";

    // Colors
    const PRIMARY = "0F3D2B";
    const SECONDARY = "2FB36B";
    const ACCENT = "E2A33A";
    const DARK = "152019";
    const WHITE = "FFFFFF";
    const BG_LIGHT = "F5F6F2";
    const MUTED = "73837A";

    // ── Slide 1: Cover ──
    const cover = pres.addSlide();
    cover.background = { color: PRIMARY };
    cover.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: PRIMARY },
    });
    // Decorative line
    cover.addShape(pres.ShapeType.rect, {
      x: 0.8, y: 2.8, w: 2.5, h: 0.06, fill: { color: SECONDARY },
    });
    cover.addText(title, {
      x: 0.8, y: 3.0, w: 11, h: 1.5,
      fontSize: 36, fontFace: "Arial", color: WHITE, bold: true,
      valign: "top", align: "left",
    });
    if (description) {
      cover.addText(description, {
        x: 0.8, y: 4.4, w: 10, h: 1.0,
        fontSize: 16, fontFace: "Arial", color: "B8D4C5",
        valign: "top", align: "left",
      });
    }
    cover.addText("Materi Pelatihan UMKM", {
      x: 0.8, y: 0.6, w: 6, h: 0.5,
      fontSize: 12, fontFace: "Arial", color: SECONDARY,
      valign: "middle",
    });

    // ── Slide 2: Silabus ──
    if (syllabus?.length > 0) {
      const sSlide = pres.addSlide();
      sSlide.background = { color: WHITE };
      sSlide.addText("Silabus Pelatihan", {
        x: 0.8, y: 0.5, w: 11, h: 0.7,
        fontSize: 24, fontFace: "Arial", color: DARK, bold: true,
      });
      sSlide.addShape(pres.ShapeType.rect, {
        x: 0.8, y: 1.15, w: 2, h: 0.04, fill: { color: SECONDARY },
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
          x: 0.8, y: 1.5, w: 11.5,
          fontSize: 12, color: DARK,
          border: { type: "solid", pt: 0.5, color: "E7EAE2" },
          colW: [1.5, 8, 2],
          rowH: [0.5, ...rows.map(() => 0.5)],
          autoPage: false,
        }
      );
    }

    // ── Content slides (per day) ──
    const days = content || [];
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const slide = pres.addSlide();
      slide.background = { color: WHITE };

      // Header bar
      slide.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: PRIMARY },
      });
      slide.addText(`Hari ${day.day}`, {
        x: 0.8, y: 0.15, w: 3, h: 0.35,
        fontSize: 11, fontFace: "Arial", color: SECONDARY, bold: true,
      });
      slide.addText(day.title || "", {
        x: 0.8, y: 0.45, w: 11, h: 0.5,
        fontSize: 20, fontFace: "Arial", color: WHITE, bold: true,
      });

      // Body content
      const bodyText = typeof day.body === "string" ? day.body : "";
      // Clean markdown and truncate
      const cleanText = bodyText
        .replace(/##/g, "")
        .replace(/\*\*/g, "")
        .replace(/#/g, "")
        .trim();

      slide.addText(cleanText, {
        x: 0.8, y: 1.4, w: 11.5, h: 5.5,
        fontSize: 14, fontFace: "Arial", color: DARK,
        valign: "top", align: "left",
        lineSpacingMultiple: 1.4,
        autoFit: true,
      });

      // Page number
      slide.addText(`${i + 2}`, {
        x: 11.5, y: 7.0, w: 1, h: 0.4,
        fontSize: 10, color: MUTED, align: "right",
      });
    }

    // ── Thank you slide ──
    const last = pres.addSlide();
    last.background = { color: PRIMARY };
    last.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: PRIMARY },
    });
    last.addShape(pres.ShapeType.rect, {
      x: 5.5, y: 3.2, w: 2.5, h: 0.06, fill: { color: SECONDARY },
    });
    last.addText("Terima Kasih", {
      x: 0.8, y: 3.5, w: 11.5, h: 1.0,
      fontSize: 36, fontFace: "Arial", color: WHITE, bold: true,
      align: "center",
    });
    last.addText("Semoga materi ini bermanfaat untuk pengembangan UMKM", {
      x: 0.8, y: 4.4, w: 11.5, h: 0.6,
      fontSize: 14, fontFace: "Arial", color: "B8D4C5",
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
