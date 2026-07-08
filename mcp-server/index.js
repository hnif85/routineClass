#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";

// ── Auto-load .env.local from project root ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ── Config ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCHEMA = process.env.SUPABASE_SCHEMA || "routine_class";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}

const s = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SCHEMA } });

// ── MCP Server ──
const server = new Server(
  { name: "routine-class", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool Definitions ──
const TOOLS = [
  {
    name: "list_events",
    description: "List all events dari Routine Class. Bisa filter status (draft/published/ongoing/completed/cancelled).",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "published", "ongoing", "completed", "cancelled"],
        },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "get_event",
    description: "Get detail event lengkap: info event, daftar peserta, materi, test, apps, dan summary statistik.",
    inputSchema: {
      type: "object",
      properties: { event_id: { type: "string" } },
      required: ["event_id"],
    },
  },
  {
    name: "create_event",
    description: "Buat event baru. Minimal isi title dan start_date.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        type: { type: "string", enum: ["offline", "online", "hybrid"], default: "offline" },
        start_date: { type: "string", description: "YYYY-MM-DD" },
        end_date: { type: "string", description: "YYYY-MM-DD" },
        start_time: { type: "string", description: "HH:MM" },
        end_time: { type: "string", description: "HH:MM" },
        location: { type: "string" },
        quota: { type: "number" },
        is_paid: { type: "boolean", default: true },
        price: { type: "number", default: 50000 },
        registration_type: { type: "string", enum: ["invitation", "open", "both"], default: "invitation" },
        speaker_name: { type: "string" },
      },
      required: ["title", "start_date"],
    },
  },
  {
    name: "update_event_status",
    description: "Ubah status event. Validasi state machine otomatis.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        status: { type: "string", enum: ["draft", "published", "ongoing", "completed", "cancelled"] },
      },
      required: ["event_id", "status"],
    },
  },
  {
    name: "get_event_report",
    description: "Laporan komprehensif event: total peserta, kehadiran, skor pre/post test, sertifikat.",
    inputSchema: {
      type: "object",
      properties: { event_id: { type: "string" } },
      required: ["event_id"],
    },
  },
  {
    name: "list_umkm",
    description: "Cari / list UMKM dengan filter: kota, kategori, omzet, NIB, frekuensi training.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Cari nama usaha / pemilik" },
        city: { type: "string" },
        category: { type: "string" },
        has_nib: { type: "boolean" },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "get_umkm",
    description: "Detail UMKM: profil, event history, skor test, sertifikat, kontak.",
    inputSchema: {
      type: "object",
      properties: { umkm_id: { type: "string" } },
      required: ["umkm_id"],
    },
  },
  {
    name: "get_test_results",
    description: "Hasil test untuk suatu event: skor per peserta (pre, post, delta).",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        phase_id: { type: "string", description: "opsional: filter phase spesifik" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "list_materials",
    description: "List materi pelatihan dengan filter & search.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        limit: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "generate_certificate",
    description: "Generate sertifikat untuk peserta event.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string" },
        umkm_id: { type: "string", description: "opsional: generate untuk 1 UMKM saja; kosongkan untuk semua" },
      },
      required: ["event_id"],
    },
  },
];

// ── Handlers ──
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      // ════════════════════ EVENTS ════════════════════
      case "list_events": {
        let q = s.from("events").select("*", { count: "exact" }).order("start_date", { ascending: false });
        if (args?.status) q = q.eq("status", args.status);
        if (args?.limit) q = q.limit(args.limit);
        const { data, count, error } = await q;
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        return { content: [{ type: "text", text: JSON.stringify({ count, events: data }, null, 2) }] };
      }

      case "get_event": {
        const { data: ev, error } = await s.from("events").select("*").eq("id", args.event_id).single();
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

        const [{ data: inv }, { data: mats }, { data: ets }, { data: apps }] = await Promise.all([
          s.from("event_invitations").select("*, umkm(id,business_name,full_name,whatsapp)").eq("event_id", args.event_id),
          s.from("event_materials").select("*, materials(*)").eq("event_id", args.event_id),
          s.from("event_tests").select("*, test_phases(*, tests(*))").eq("event_id", args.event_id),
          s.from("event_apps").select("*, master_apps(*)").eq("event_id", args.event_id),
        ]);

        return { content: [{ type: "text", text: JSON.stringify({
          event: ev,
          participants: { total: inv?.length || 0, list: inv },
          materials: mats || [],
          tests: ets || [],
          apps: apps || [],
        }, null, 2) }] };
      }

      case "create_event": {
        const payload = {
          title: args.title,
          description: args.description || null,
          type: args.type || "offline",
          start_date: args.start_date,
          end_date: args.end_date || null,
          start_time: args.start_time || null,
          end_time: args.end_time || null,
          location: args.location || null,
          quota: args.quota || null,
          is_paid: args.is_paid !== false,
          price: args.is_paid !== false ? (args.price || 50000) : 0,
          registration_type: args.registration_type || "invitation",
          speaker_name: args.speaker_name || null,
          status: "draft",
        };
        const { data, error } = await s.from("events").insert(payload).select().single();
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        return { content: [{ type: "text", text: JSON.stringify({ success: true, event: data }, null, 2) }] };
      }

      case "update_event_status": {
        const validTransitions = {
          draft: ["published", "cancelled"],
          published: ["ongoing", "cancelled"],
          ongoing: ["completed", "cancelled"],
          completed: [],
          cancelled: ["draft"],
        };
        const { data: ev } = await s.from("events").select("status").eq("id", args.event_id).single();
        if (!ev) return { content: [{ type: "text", text: "Event not found" }] };
        const allowed = validTransitions[ev.status] || [];
        if (!allowed.includes(args.status)) {
          return { content: [{ type: "text", text: `Invalid transition: ${ev.status} → ${args.status}. Allowed: ${allowed.join(", ") || "none"}` }] };
        }
        const { error } = await s.from("events").update({ status: args.status }).eq("id", args.event_id);
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        return { content: [{ type: "text", text: JSON.stringify({ success: true, status: args.status }) }] };
      }

      // ════════════════════ REPORT ════════════════════
      case "get_event_report": {
        const { data: ev } = await s.from("events").select("*").eq("id", args.event_id).single();
        if (!ev) return { content: [{ type: "text", text: "Event not found" }] };

        const { data: inv, count: totalInv } = await s.from("event_invitations")
          .select("*, umkm(business_name,full_name,whatsapp)", { count: "exact" })
          .eq("event_id", args.event_id);

        const { data: certs } = await s.from("certificates")
          .select("*").eq("event_id", args.event_id).eq("status", "issued");

        const { data: ets } = await s.from("event_tests")
          .select("*, test_phases(*, tests(*))").eq("event_id", args.event_id);

        const statusCounts = {};
        (inv || []).forEach(i => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });

        const report = {
          event: { id: ev.id, title: ev.title, date: ev.start_date, location: ev.location, status: ev.status, type: ev.type },
          participants: {
            total: totalInv || 0,
            by_status: statusCounts,
          },
          certificates: { issued: certs?.length || 0 },
          tests: (ets || []).map(t => ({
            phase: t.test_phases?.phase,
            label: t.test_phases?.label,
            type: t.test_phases?.tests?.type,
            open_time: t.open_time,
          })),
        };
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      }

      // ════════════════════ UMKM ════════════════════
      case "list_umkm": {
        let q = s.from("umkm").select("*", { count: "exact" }).eq("is_active", true).order("business_name");
        if (args?.search) q = q.or(`business_name.ilike.%${args.search}%,full_name.ilike.%${args.search}%,whatsapp.ilike.%${args.search}%`);
        if (args?.city) q = q.ilike("city", `%${args.city}%`);
        if (args?.category) q = q.contains("business_category", [args.category]);
        if (args?.has_nib !== undefined) q = q.eq("has_nib", args.has_nib);
        if (args?.limit) q = q.limit(args.limit);
        const { data, count, error } = await q;
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        return { content: [{ type: "text", text: JSON.stringify({ count, umkm: data }, null, 2) }] };
      }

      case "get_umkm": {
        const { data: umkm, error } = await s.from("umkm").select("*").eq("id", args.umkm_id).single();
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

        const [{ data: events }, { data: certs }] = await Promise.all([
          s.from("event_invitations").select("*, event:events(title,start_date,location,status)")
            .eq("umkm_id", args.umkm_id).order("created_at", { ascending: false }),
          s.from("certificates").select("*, event:events(title,start_date)")
            .eq("umkm_id", args.umkm_id).eq("status", "issued"),
        ]);

        return { content: [{ type: "text", text: JSON.stringify({
          profile: umkm,
          event_history: events || [],
          certificates: certs || [],
        }, null, 2) }] };
      }

      // ════════════════════ TESTS ════════════════════
      case "get_test_results": {
        let q = s.from("test_answers")
          .select("*, umkm(business_name,full_name), question:test_questions(phase_id,phase:test_phases(phase,label,tests(name)))")
          .eq("event_id", args.event_id);
        if (args?.phase_id) q = q.eq("test_questions.phase_id", args.phase_id);

        const { data, error } = await q;
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };

        const grouped = {};
        (data || []).forEach(a => {
          const key = a.umkm_id;
          if (!grouped[key]) grouped[key] = { umkm: a.umkm, phase: a.question?.phase?.label, answers: [], total_score: 0 };
          grouped[key].answers.push({ q: a.question_text, a: a.answer_text, score: a.score });
          grouped[key].total_score += a.score || 0;
        });

        return { content: [{ type: "text", text: JSON.stringify(Object.values(grouped), null, 2) }] };
      }

      // ════════════════════ MATERIALS ════════════════════
      case "list_materials": {
        let q = s.from("materials").select("*", { count: "exact" }).order("created_at", { ascending: false });
        if (args?.search) q = q.ilike("title", `%${args.search}%`);
        if (args?.limit) q = q.limit(args.limit);
        const { data, count, error } = await q;
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        return { content: [{ type: "text", text: JSON.stringify({ count, materials: data }, null, 2) }] };
      }

      // ════════════════════ CERTIFICATES ════════════════════
      case "generate_certificate": {
        const { data: ev } = await s.from("events").select("title").eq("id", args.event_id).single();
        if (!ev) return { content: [{ type: "text", text: "Event not found" }] };

        const { data: template } = await s.from("certificate_templates").select("*").eq("is_default", true).maybeSingle();

        if (args?.umkm_id) {
          const { data: existing } = await s.from("certificates")
            .select("id").eq("event_id", args.event_id).eq("umkm_id", args.umkm_id).eq("status", "issued").maybeSingle();
          if (existing) return { content: [{ type: "text", text: "Certificate already exists for this participant" }] };

          const { data: cert, error } = await s.from("certificates").insert({
            event_id: args.event_id,
            umkm_id: args.umkm_id,
            template_id: template?.id || null,
            status: "issued",
            cert_number: `RC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
          }).select().single();
          if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
          return { content: [{ type: "text", text: JSON.stringify({ success: true, certificate: cert }, null, 2) }] };
        }

        // Generate all
        const { data: inv } = await s.from("event_invitations").select("umkm_id").eq("event_id", args.event_id).not("umkm_id", "is", null);
        const umkmIds = [...new Set((inv || []).map(i => i.umkm_id))];
        const { data: existingCerts } = await s.from("certificates").select("umkm_id").eq("event_id", args.event_id).eq("status", "issued");
        const existingIds = new Set((existingCerts || []).map(c => c.umkm_id));
        const toCreate = umkmIds.filter(id => !existingIds.has(id));

        if (toCreate.length === 0) return { content: [{ type: "text", text: "All participants already have certificates" }] };

        const { error } = await s.from("certificates").insert(
          toCreate.map(uid => ({
            event_id: args.event_id,
            umkm_id: uid,
            template_id: template?.id || null,
            status: "issued",
            cert_number: `RC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
          }))
        );
        if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        return { content: [{ type: "text", text: JSON.stringify({ success: true, generated: toCreate.length, total: umkmIds.length }) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }] };
  }
});

// ── Start ──
const transport = new StdioServerTransport();
await server.connect(transport);
