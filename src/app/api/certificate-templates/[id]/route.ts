import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function verifyAdmin(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    if (payload.role === "admin" || payload.role === "perusahaan") return payload;
    return null;
  } catch { return null; }
}

// GET /api/certificate-templates/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });
  const { data, error } = await s.from("certificate_templates").select("*").eq("id", id).single();
  if (error) return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data });
}

// PUT /api/certificate-templates/[id] — update template
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.config !== undefined) updates.config = body.config;
  if (body.is_default !== undefined) updates.is_default = body.is_default;

  const { data, error } = await s.from("certificate_templates").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/certificate-templates/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });
  const { error } = await s.from("certificate_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
