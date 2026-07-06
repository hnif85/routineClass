import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const RESET_TOKEN = "rc-reset-prod-2026-07-06";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.token !== RESET_TOKEN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabase();
    const results: string[] = [];

    const tables = [
      "test_answers", "wa_conversations", "event_tests",
      "event_materials", "event_trainers", "event_apps",
      "event_invitations", "certificates",
      "test_questions", "test_phases",
    ];

    for (const tbl of tables) {
      const { error } = await supabase.from(tbl).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      results.push(`${tbl}: ${error ? error.message : "OK"}`);
    }

    const parents = ["events", "materials", "tests", "umkm", "cms_customers"];
    for (const tbl of parents) {
      const { error } = await supabase.from(tbl).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      results.push(`${tbl}: ${error ? error.message : "OK"}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
