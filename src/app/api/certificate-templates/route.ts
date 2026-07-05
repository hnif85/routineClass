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
    if (payload.role === "admin" || payload.role === "perusahaan" || payload.role === "pemateri") return payload;
    return null;
  } catch { return null; }
}

// GET /api/certificate-templates — list all templates
export async function GET(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });
  const { data, error } = await s.from("certificate_templates").select("*").order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/certificate-templates — create new template
export async function POST(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, config } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nama template harus diisi" }, { status: 400 });

  const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: "routine_class" } });
  const { data, error } = await s.from("certificate_templates").insert({
    name: name.trim(),
    description: description || "",
    config: config || { page: { width: 1100, height: 780, bgColor: "#FFFFFF", padding: 40 }, elements: [] },
    is_default: false,
    created_by: user.email as string,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
