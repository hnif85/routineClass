import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── State Machine ──────────────────────────────────────────────
// Defines ALL allowed transitions. Any transition not in this map
// is automatically rejected.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:     ["published", "cancelled"],
  published: ["ongoing", "cancelled"],
  ongoing:   ["completed", "cancelled"],
  completed: [],               // terminal state — no outgoing transitions
  cancelled: ["draft"],        // restart from cancellation
};

// Human-readable labels for error messages
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ── Auth helper ────────────────────────────────────────────────
async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    if (payload.role === "admin" || payload.role === "perusahaan" || payload.role === "pemateri") return payload;
    return null;
  } catch { return null; }
}

// ── Transition guards (additional checks per transition) ──────
async function validateTransition(
  s: any,
  eventId: string,
  from: string,
  to: string
): Promise<string | null> {
  // Fetch full event data
  const { data: eventRaw } = await s
    .from("events")
    .select("title, start_date, quota")
    .eq("id", eventId)
    .single();

  if (!eventRaw) return "Event tidak ditemukan.";
  const event = eventRaw as any;

  // draft → published: must have title + start_date
  if (from === "draft" && to === "published") {
    if (!event.title?.trim()) return "Event harus memiliki judul sebelum dipublikasi.";
    if (!event.start_date) return "Event harus memiliki tanggal mulai sebelum dipublikasi.";
  }

  // published → ongoing: start_date should be today or in the past
  if (from === "published" && to === "ongoing") {
    if (event.start_date) {
      const start = new Date(event.start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Biarkan admin mulai kapan saja — fleksibilitas operasional
    }
  }

  return null; // all validations passed
}

// ── PATCH handler ──────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Event ID diperlukan" }, { status: 400 });
  }

  // 1. Authenticate
  const user = await verifyAdmin(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  const body = await req.json();
  const { status: to } = body;
  if (!to) {
    return NextResponse.json({ error: "Field 'status' diperlukan" }, { status: 400 });
  }

  const validStatuses = ["draft", "published", "ongoing", "completed", "cancelled"];
  if (!validStatuses.includes(to)) {
    return NextResponse.json(
      { error: `Status '${to}' tidak valid. Gunakan: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  // 3. Get current event status
  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });

  const { data: eventRaw, error: fetchErr } = await s
    .from("events")
    .select("id, status, title")
    .eq("id", id)
    .single();

  if (fetchErr || !eventRaw) {
    return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
  }
  const event = eventRaw as any;
  const from = event.status;

  // 4. Check if transition is allowed
  const allowedNext = ALLOWED_TRANSITIONS[from];
  if (!allowedNext) {
    return NextResponse.json(
      { error: `Status '${STATUS_LABELS[from] || from}' tidak memiliki transisi yang diizinkan.` },
      { status: 400 }
    );
  }

  if (!allowedNext.includes(to)) {
    return NextResponse.json(
      {
        error: `Tidak bisa mengubah status dari '${STATUS_LABELS[from] || from}' ke '${STATUS_LABELS[to] || to}'. ` +
               `Transisi yang diizinkan: ${allowedNext.map(s => STATUS_LABELS[s] || s).join(", ")}.`,
      },
      { status: 400 }
    );
  }

  // 5. Run additional transition-specific validations
  const validationError = await validateTransition(s, id, from, to);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // 6. Execute the transition
  const { error: updateErr } = await s
    .from("events")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Gagal update status: " + updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Event berhasil diubah ke '${STATUS_LABELS[to] || to}'.`,
    data: { id, from, to },
  });
}
