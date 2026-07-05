"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

interface BoundTest {
  id: string;
  event_id: string;
  phase_id: string;
  open_time: "before" | "during" | "after";
  is_open: boolean;
  test_phases: {
    id: string;
    phase: string;
    label: string;
    tests: { id: string; name: string; type: string; description: string | null };
  };
}

export default function EventQuestionsPage() {
  const { push } = useRouter();
  const eventId = useParams().id as string;
  const s = createClient();

  const [ev, setEv] = useState<any>(null);
  const [boundTests, setBoundTests] = useState<BoundTest[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<string, { done: number; total: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    const { data: event } = await s.from("events").select("*").eq("id", eventId).single();
    setEv(event);

    const { data: bts } = await s.from("event_tests")
      .select("*, test_phases!inner(id,phase,label,test_id,tests!inner(id,name,type,description))")
      .eq("event_id", eventId);
    setBoundTests(bts || []);

    // Get completion per phase
    const map: Record<string, { done: number; total: number }> = {};
    for (const bt of bts || []) {
      const { data: questions } = await s.from("test_questions").select("id").eq("phase_id", bt.phase_id);
      const qIds = (questions || []).map(q => q.id);

      // For test type: count unique umkm who answered
      if (bt.test_phases.tests.type === "test") {
        const { data: answers } = await s.from("test_answers")
          .select("umkm_id").in("question_id", qIds).eq("event_id", eventId)
          .not("umkm_id", "is", null);
        const unique = new Set((answers || []).map(a => a.umkm_id));
        const { count: totalInv } = await s.from("event_invitations")
          .select("id", { count: "exact", head: true }).eq("event_id", eventId);
        map[bt.phase_id] = { done: unique.size, total: totalInv || 0 };
      } else {
        // For kuesioner: count total answer submissions
        const { count } = await s.from("test_answers")
          .select("id", { count: "exact", head: true }).in("question_id", qIds).eq("event_id", eventId);
        map[bt.phase_id] = { done: count || 0, total: count || 0 };
      }
    }
    setCompletionMap(map);
    setLoading(false);
  }

  async function toggleOpen(etId: string, current: boolean) {
    const { error } = await s.from("event_tests").update({ is_open: !current }).eq("id", etId);
    if (error) toast.error("Gagal: " + error.message);
    else {
      setBoundTests(prev => prev.map(bt => bt.id === etId ? { ...bt, is_open: !current } : bt));
      toast.success(current ? "Test ditutup" : "Test dibuka");
    }
  }

  async function unbindTest(etId: string, testName: string) {
    if (!confirm(`Lepaskan "${testName}" dari event ini? Jawaban tetap tersimpan.`)) return;
    const { error } = await s.from("event_tests").delete().eq("id", etId);
    if (error) toast.error("Gagal: " + error.message);
    else { toast.success("Test dilepaskan"); loadData(); }
  }

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#64748B" }}>Memuat...</div>;
  if (!ev) return <div style={{ padding: 48, textAlign: "center", color: "#EF4444" }}>Event tidak ditemukan</div>;

  return (
    <div style={{ animation: "fade-in-up 0.5s ease-out both" }}>
      {/* Back */}
      <Link href={`/events/${eventId}`} style={{
        fontSize: 13, color: "#64748B", fontWeight: 600, textDecoration: "none",
        display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12,
      }} className="hover:text-[#1E293B]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Kembali ke event
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#2563EB", marginBottom: 4 }}>
          Test & Kuesioner Terikat
        </div>
        <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {ev.title}
        </h2>
        <p style={{ color: "#64748B", fontSize: 13.5, marginTop: 6 }}>
          {boundTests.length} test/kuesioner terikat ke event ini
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid var(--border)" }}>
        <Link href={`/events/${eventId}`} style={{
          padding: "10px 20px", fontSize: 13.5, fontWeight: 600, textDecoration: "none",
          color: "#64748B", borderBottom: "2px solid transparent", transition: "all 0.15s",
        }}>
          Detail & Undangan
        </Link>
        <span style={{ padding: "10px 20px", fontSize: 13.5, fontWeight: 700, color: "#2563EB", borderBottom: "2px solid #2563EB" }}>
          Test & Hasil
        </span>
      </div>

      {boundTests.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748B", background: "#fff", borderRadius: 18, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Belum ada test terikat</p>
          <p style={{ fontSize: 13 }}>
            Binding test ke event ini dari halaman{" "}
            <Link href={`/events/${eventId}`} style={{ color: "#2563EB", fontWeight: 700 }}>detail event</Link>.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {boundTests.map(bt => {
            const test = bt.test_phases.tests;
            const stats = completionMap[bt.phase_id] || { done: 0, total: 0 };
            const isTest = test.type === "test";
            const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

            return (
              <div key={bt.id} style={{
                background: "#fff", border: "1px solid var(--border)", borderRadius: 18,
                overflow: "hidden", boxShadow: "var(--shadow)",
              }}>
                {/* Header */}
                <div style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  background: "#F8FAFE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
                      padding: "2px 8px", borderRadius: 6,
                      background: isTest ? "#EFF6FF" : "#FBEFD6",
                      color: isTest ? "#2563EB" : "#B57A1E",
                    }}>
                      {isTest ? "Test" : "Kuesioner"}
                    </span>
                    <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 16, fontWeight: 700 }}>
                      {bt.test_phases.label}
                    </h3>
                    <span style={{ fontSize: 12, color: "#64748B" }}>{test.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                      background: bt.open_time === "before" ? "#E7EEFB" : bt.open_time === "during" ? "#EFF6FF" : "#F0F2EC",
                      color: bt.open_time === "before" ? "#3C68B5" : bt.open_time === "during" ? "#2563EB" : "#64748B",
                    }}>
                      {bt.open_time === "before" ? "Sebelum" : bt.open_time === "during" ? "Saat" : "Setelah"}
                    </span>
                    <button onClick={() => toggleOpen(bt.id, bt.is_open)}
                      style={{
                        padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                        border: "none", cursor: "pointer",
                        background: bt.is_open ? "#3B82F6" : "#E2E8F0",
                        color: bt.is_open ? "#fff" : "#64748B",
                      }}>
                      {bt.is_open ? "Dibuka" : "Ditutup"}
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                    {/* Stats */}
                    <div style={{
                      flex: 1, padding: "14px 16px", borderRadius: 12,
                      border: "1px solid var(--border-2)", background: "#FAFAF8",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748B", marginBottom: 8 }}>
                        Pengisian
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <span style={{ fontFamily: "var(--font-sora)", fontSize: 28, fontWeight: 800, color: "#2563EB" }}>
                          {stats.done}<span style={{ fontSize: 16, color: "#64748B" }}>/{stats.total}</span>
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                          background: pct >= 80 ? "#EFF6FF" : pct >= 50 ? "#FBEFD6" : "#F0F2EC",
                          color: pct >= 80 ? "#2563EB" : pct >= 50 ? "#B57A1E" : "#64748B",
                        }}>
                          {pct}%
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "#F0F2EC", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 999,
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, #3B82F6, #2563EB)",
                          transition: "width 0.5s ease",
                        }} />
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                      <Link href={`/tests/${test.id}`} style={{
                        padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--border)", background: "#fff", cursor: "pointer",
                        textDecoration: "none", color: "#1E293B", textAlign: "center",
                      }}>
                        Kelola Soal
                      </Link>
                      <Link href={`/events/${eventId}/tests/${bt.phase_id}/results`} style={{
                        padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                        border: "none", cursor: "pointer", textDecoration: "none", textAlign: "center",
                        background: "#1E3A5F", color: "#fff",
                      }}>
                        Lihat Hasil
                      </Link>
                      <button onClick={async () => {
                        const url = `${window.location.origin}/take/${eventId}/${bt.phase_id}`;
                        try {
                          await navigator.clipboard.writeText(url);
                          toast.success("Link peserta disalin!");
                        } catch {
                          toast.error("Gagal menyalin link");
                        }
                      }} style={{
                        padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--border)", background: "#fff", cursor: "pointer",
                        textDecoration: "none", color: "#2563EB", textAlign: "center",
                      }}>
                        Salin Link Peserta
                      </button>
                      <button onClick={() => unbindTest(bt.id, test.name)} style={{
                        padding: "6px 12px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                        border: "none", cursor: "pointer",
                        background: "none", color: "#EF4444",
                      }}>
                        Lepaskan
                      </button>
                    </div>
                  </div>

                  {/* Phase phases (show sibling phases from same test) */}
                  {isTest && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {boundTests
                        .filter(other => other.test_phases.tests.id === test.id && other.id !== bt.id)
                        .map(sibling => {
                          const sStats = completionMap[sibling.phase_id] || { done: 0, total: 0 };
                          return (
                            <div key={sibling.id} style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "8px 12px", borderRadius: 10,
                              border: "1px solid var(--border-2)", background: "#F8FAFE",
                              fontSize: 12,
                            }}>
                              <span style={{ fontWeight: 700, color: "#1E293B" }}>{sibling.test_phases.label}</span>
                              <span style={{ color: "#64748B" }}>{sStats.done}/{sStats.total}</span>
                              <div style={{
                                width: 50, height: 4, borderRadius: 999, background: "#E2E8F0", overflow: "hidden",
                              }}>
                                <div style={{
                                  height: "100%", borderRadius: 999,
                                  width: sStats.total > 0 ? `${(sStats.done / sStats.total) * 100}%` : "0%",
                                  background: sStats.total > 0 ? "#3B82F6" : "#E2E8F0",
                                }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info about test management */}
      <div style={{
        background: "#F8FAFE", border: "1px solid var(--border)", borderRadius: 14,
        padding: 16, marginTop: 20, fontSize: 13, color: "#475569",
      }}>
        <strong>Catatan:</strong> Soal dikelola di halaman{" "}
        <Link href="/tests" style={{ color: "#2563EB", fontWeight: 700 }}>Master Test</Link>.
        Binding test ke event dilakukan saat membuat event atau dari halaman{" "}
        <Link href={`/events/${eventId}`} style={{ color: "#2563EB", fontWeight: 700 }}>detail event</Link>.
      </div>
    </div>
  );
}
