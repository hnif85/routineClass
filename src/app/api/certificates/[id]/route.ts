import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb as pdfRgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { jwtVerify } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Helper: hex (#1E3A5F) → pdf-lib Color ──
function hexToColor(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return pdfRgb(r, g, b);
}

// ── Helper: download image → Uint8Array ──
async function fetchImageData(url: string, origin: string): Promise<Uint8Array | null> {
  // Handle relative URLs (starting with /)
  const fullUrl = url.startsWith("/") ? `${origin}${url}` : url;
  try {
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[cert-image] fetch failed (${res.status}): ${fullUrl.substring(0, 80)}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err) {
    console.warn(`[cert-image] fetch error: ${fullUrl.substring(0, 80)}`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Variable resolver ──
const VARIABLES: Record<string, (d: any) => string> = {
  nama_usaha: (d) => d.umkm.business_name || "-",
  nama_pemilik: (d) => d.umkm.full_name || "-",
  nama_event: (d) => d.event.title || "-",
  tanggal_mulai: (d) => d.event.start_date ? new Date(d.event.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-",
  tanggal_selesai: (d) => d.event.end_date ? new Date(d.event.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-",
  skor_pre: (d) => d.cert.pre_score !== null ? String(d.cert.pre_score) : "-",
  skor_post: (d) => d.cert.post_score !== null ? String(d.cert.post_score) : "-",
  delta: (d) => d.cert.delta_score !== null ? String(d.cert.delta_score) : "0",
  nomor_sertifikat: (d) => d.cert.cert_number || "-",
  tanggal_terbit: (d) => d.cert.issued_at ? new Date(d.cert.issued_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-",
  kota: (d) => d.umkm.city || "Jakarta",
};

function resolveText(text: string, data: any): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const fn = VARIABLES[key];
    return fn ? fn(data) : `{${key}}`;
  });
}

// ── Normalize image to standard PNG using sharp ──
// Handles PNG, JPEG, WebP, SVG, and anything else sharp supports.
// pdf-lib's embedPng can be picky about uncommon PNG color types/bit depths,
// so re-encoding ensures a standard RGBA 8-bit PNG every time.
async function normalizeToPng(buffer: Uint8Array): Promise<Uint8Array | null> {
  try {
    const pngBuf = await sharp(Buffer.from(buffer)).png().toBuffer();
    return new Uint8Array(pngBuf);
  } catch (e) {
    console.warn(`[cert-image] Normalize PNG failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── GET /api/certificates/[id] — download PDF ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Auth check: only logged-in users can download certificates
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let payload: any;
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });

    // Cert owner or admin/pemateri only
    const isAdmin = payload.role === "admin" || payload.role === "perusahaan" || payload.role === "pemateri";

    const { data: cert, error } = await s.from("certificates").select("*").eq("id", id).single();
    if (error || !cert) return NextResponse.json({ error: "Sertifikat tidak ditemukan" }, { status: 404 });

    // Check ownership: either admin/pemateri or the umkm who owns the cert
    if (!isAdmin && cert.umkm_id !== payload.umkm_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: umkm } = await s.from("umkm").select("*").eq("id", cert.umkm_id).single();
    if (!umkm) return NextResponse.json({ error: "UMKM tidak ditemukan" }, { status: 404 });

    const { data: event } = await s.from("events").select("*").eq("id", cert.event_id).single();
    if (!event) return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });

    // Get template
    let template = null;
    if (cert.template_id) {
      const { data: t } = await s.from("certificate_templates").select("*").eq("id", cert.template_id).single();
      template = t;
    }
    if (!template) {
      const { data: t } = await s.from("certificate_templates").select("*").eq("is_default", true).maybeSingle();
      template = t;
    }

    const config = template?.config || { page: { width: 1100, height: 780, bgColor: "#FFFFFF" } };
    const elements = (config.elements || []) as any[];
    const pageCfg = config.page;
    const data = { cert, umkm, event };

    // Determine origin for resolving relative image URLs
    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // ── Create PDF ──
    const doc = await PDFDocument.create();
    const page = doc.addPage([pageCfg.width, pageCfg.height]);

    // Embed fonts
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Background color
    if (pageCfg.bgColor && pageCfg.bgColor !== "#FFFFFF" && pageCfg.bgColor !== "transparent") {
      const bg = hexToColor(pageCfg.bgColor);
      page.drawRectangle({
        x: 0, y: 0, width: pageCfg.width, height: pageCfg.height,
        color: bg,
      });
    }

    // Process elements sorted by z-index (rect first, then text/images on top)
    const sorted = [...elements].sort((a, b) => {
      const order = { rect: 0, line: 1, image: 2, text: 3 };
      return (order[a.type as keyof typeof order] || 0) - (order[b.type as keyof typeof order] || 0);
    });

    // Cache embedded images
    const imageCache = new Map<string, any>();

    for (const el of sorted) {
      const x = el.x;
      const y = pageCfg.height - el.y - el.h; // pdf-lib y-axis is bottom-up

      switch (el.type) {
        case "rect": {
          const bg = el.props?.bgColor;
          const bw = el.props?.borderWidth || 0;
          const bc = el.props?.borderColor;

          if (bg && bg !== "transparent") {
            const c = hexToColor(bg);
            page.drawRectangle({ x, y, width: el.w, height: el.h, color: c });
          }
          if (bw > 0 && bc) {
            const c = hexToColor(bc);
            page.drawRectangle({
              x, y, width: el.w, height: el.h,
              borderColor: c, borderWidth: bw,
            });
          }
          break;
        }

        case "line": {
          const lc = el.props?.color || "#000";
          const lt = el.props?.thickness || 2;
          const c = hexToColor(lc);
          const midY = y + el.h / 2;
          page.drawLine({
            start: { x, y: midY },
            end: { x: x + el.w, y: midY },
            color: c, thickness: lt,
          });
          break;
        }

        case "image": {
          const src = el.props?.src;
          if (!src) break;

          // Skip dead image URLs with warning
          if (src.includes("mwxmarket.ai") || src.includes("logodasar")) {
            console.warn(`[cert-image] Dead URL, skipping: ${src.substring(0, 60)}`);
            break;
          }

          // Check cache
          let img = imageCache.get(src);
          if (img) {
            page.drawImage(img, { x, y, width: el.w, height: el.h });
            break;
          }

          // Fetch and embed
          const imgData = await fetchImageData(src, origin);
          if (!imgData) {
            console.warn(`[cert-image] Cannot fetch: ${src.substring(0, 80)}`);
            break;
          }

          // Normalize ALL images through sharp → standard PNG
          // (handles WebP, quirky PNG depths, CMYK JPG, SVG, etc.)
          const pngData = await normalizeToPng(imgData);
          if (!pngData) {
            console.warn(`[cert-image] Normalize failed, skipping: ${src.substring(0, 80)}`);
            break;
          }

          try {
            img = await doc.embedPng(pngData);
          } catch (e) {
            console.warn(`[cert-image] embedPng failed:`, e instanceof Error ? e.message : e);
            break;
          }

          if (typeof img !== "object" || img === null) {
            console.warn(`[cert-image] embedPng returned unexpected type: ${typeof img}`, img);
            break;
          }

          imageCache.set(src, img);
          page.drawImage(img, { x, y, width: el.w, height: el.h });
          break;
        }

        case "text": {
          const content = resolveText(el.props?.content || "", data);
          if (!content) break;

          const fs = el.props?.fontSize || 14;
          const isBold = el.props?.bold || false;
          const colorHex = el.props?.color || "#000000";
          const align = el.props?.align || "left";
          const c = hexToColor(colorHex);
          const font = isBold ? fontBold : fontRegular;

          // Calculate text width for alignment
          const textWidth = font.widthOfTextAtSize(content, fs);

          let drawX = x;
          if (align === "center") {
            drawX = x + (el.w - textWidth) / 2;
          } else if (align === "right") {
            drawX = x + el.w - textWidth;
          }

          // Vertical center
          const textHeight = font.heightAtSize(fs);
          const drawY = y + (el.h - textHeight) / 2;

          page.drawText(content, {
            x: drawX,
            y: drawY,
            size: fs,
            font,
            color: c,
            maxWidth: el.w,
          });
          break;
        }
      }
    }

    const pdfBytes = await doc.save();
    const filename = `Sertifikat_${umkm.business_name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (err: any) {
    console.error("[cert-download] Error:", err);
    return NextResponse.json({ error: err.message || "Gagal generate PDF" }, { status: 500 });
  }
}
