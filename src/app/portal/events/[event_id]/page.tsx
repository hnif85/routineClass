"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  umkm_id: string;
}

interface EventData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  quota: number | null;
  speaker_name: string | null;
  speaker_bio: string | null;
  cover_image_url: string | null;
  status: string;
  registration_type: string;
}

interface Invitation {
  id: string;
  status: string;
  rsvp_at: string | null;
  attended_at: string | null;
}

interface Material {
  id: string;
  title: string;
  description: string | null;
  total_days: number;
  syllabus: any[];
  is_ai_generated: boolean;
  content: { day: number; title: string; body: string }[];
  file_url: string | null;
  file_type: string | null;
}

interface EventTest {
  id: string;
  open_time: string;
  phase: { id: string; phase: string; label: string };
  test: { id: string; name: string; type: string };
  questions_count: number;
  taken_count: number;
  is_taken: boolean;
}

export default function PortalEventDetailPage() {
  const params = useParams();
  const { push, back } = useRouter();
  const eventId = params.event_id as string;
  const supabase = createClient();

  const [user, setUser] = useState<UserInfo | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [eventTests, setEventTests] = useState<EventTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [eventApps, setEventApps] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (d) => {
        if (!d.user || d.user.role !== "umkm") {
          push("/login");
          return;
        }
        setUser(d.user);
        await loadData(d.user);
      })
      .catch(() => push("/login"));
  }, [eventId]);

  async function loadData(u: UserInfo) {
    if (!u.umkm_id) return;

    // Load event
    const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).single();
    if (!ev) {
      push("/portal");
      return;
    }
    setEvent(ev);

    // Load event apps
    supabase.from("event_apps").select("app:master_apps(*)").eq("event_id", eventId).then(({ data }) => {
      setEventApps((data || []).map((ea: any) => ea.app).filter(Boolean));
    });

    // Load UMKM's invitation for this event
    const { data: inv } = await supabase
      .from("event_invitations")
      .select("*")
      .eq("event_id", eventId)
      .eq("umkm_id", u.umkm_id)
      .single();
    setInvitation(inv);

    // Load materials for this event
    const { data: em } = await supabase
      .from("event_materials")
      .select("material:materials(*)")
      .eq("event_id", eventId)
      .order("sort_order");
    setMaterials((em || []).map((e: any) => e.material).filter(Boolean));

    // Load tests for this event
    const { data: et } = await supabase
      .from("event_tests")
      .select("id, phase_id, open_time")
      .eq("event_id", eventId);

    // Get question counts per phase
    const phaseIds = (et || []).map((t) => t.phase_id);
    const { data: allQuestions } = phaseIds.length > 0
      ? await supabase.from("test_questions").select("id, phase_id").in("phase_id", phaseIds)
      : { data: [] };

    const questionsByPhase = new Map<string, string[]>();
    (allQuestions || []).forEach((q) => {
      const arr = questionsByPhase.get(q.phase_id) || [];
      arr.push(q.id);
      questionsByPhase.set(q.phase_id, arr);
    });

    // Get taken answers for this UMKM on this event
    const { data: takenAnswers } = await supabase
      .from("test_answers")
      .select("question_id")
      .eq("umkm_id", u.umkm_id)
      .eq("event_id", eventId);

    const takenSet = new Set((takenAnswers || []).map((a) => a.question_id));

    // Get test names
    const { data: phases } = phaseIds.length > 0
      ? await supabase.from("test_phases").select("*, test:tests(name, type)").in("id", phaseIds)
      : { data: [] };
    const phaseMap = new Map((phases || []).map((p) => [p.id, p]));

    const testList: EventTest[] = (et || []).map((t) => {
      const ph = phaseMap.get(t.phase_id);
      const qIds = questionsByPhase.get(t.phase_id) || [];
      const takenCount = qIds.filter((id) => takenSet.has(id)).length;
      return {
        id: t.id,
        open_time: t.open_time,
        phase: ph || { id: t.phase_id, phase: "", label: "" },
        test: (ph as any)?.test || { id: "", name: "", type: "" },
        questions_count: qIds.length,
        taken_count: takenCount,
        is_taken: qIds.length > 0 && takenCount >= qIds.length,
      };
    });

    setEventTests(testList);
    setLoading(false);
  }

  async function handleRsvp(status: "rsvp_yes" | "rsvp_no") {
    if (!invitation) return;
    setRsvpLoading(true);
    try {
      const { error } = await supabase
        .from("event_invitations")
        .update({ status, rsvp_at: new Date().toISOString() })
        .eq("id", invitation.id);
      if (error) throw error;
      setInvitation((prev) => prev ? { ...prev, status, rsvp_at: new Date().toISOString() } : prev);
      toast.success(status === "rsvp_yes" ? "Konfirmasi kehadiran berhasil!" : "Baik, terima kasih已将 konfirmasi");
    } catch (e: any) {
      toast.error(e.message || "Gagal mengonfirmasi");
    } finally {
      setRsvpLoading(false);
    }
  }

  function getStatusColor(s: string) {
    const map: Record<string, string> = {
      draft: "#6B7280", published: "#2563EB", ongoing: "#E2A33A", completed: "#6B7280", cancelled: "#DC2626",
    };
    return map[s] || "#6B7280";
  }

  function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ color: "#94A3B8", fontSize: 14 }}>Memuat data...</div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* ══ HEADER ══ */}
      <header style={{ background: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid #F1F5F9" }}>
        <button onClick={() => back()} style={{ border: "1px solid #E2E8F0", background: "#fff", color: "#475569", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", letterSpacing: "0.03em" }}>
            PORTAL MONITORING UMKM.MWX
          </div>
        </div>
        <a href="/portal" style={{ border: "1px solid #E2E8F0", background: "#fff", color: "#475569", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          Portal
        </a>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 80px" }}>
        {/* ══ EVENT INFO ══ */}
        <section style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #F1F5F9" }}>
          {/* Cover */}
          {event.cover_image_url && (
            <img src={event.cover_image_url} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} />
          )}

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontFamily: "var(--font-sora)", fontSize: 20, fontWeight: 800, color: "#1E293B", margin: 0, lineHeight: 1.3 }}>
                {event.title}
              </h1>
              <span style={{ display: "inline-block", marginTop: 8, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: getStatusColor(event.status) + "18", color: getStatusColor(event.status) }}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
            </div>
            {invitation && (
              <div style={{ flex: "0 0 auto" }}>
                {invitation.status === "sent" && !rsvpLoading && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleRsvp("rsvp_yes")} style={{ border: "none", background: "#3B82F6", color: "#fff", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Hadir
                    </button>
                    <button onClick={() => handleRsvp("rsvp_no")} style={{ border: "1px solid #DC2626", background: "#fff", color: "#DC2626", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      ✗ Tidak
                    </button>
                  </div>
                )}
                {rsvpLoading && <span style={{ fontSize: 12, color: "#64748B" }}>Memproses...</span>}
                {(invitation.status === "rsvp_yes" || invitation.status === "attended") && (
                  <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#EFF6FF", color: "#2563EB" }}>
                    ✓ Konfirmasi Hadir
                  </span>
                )}
                {invitation.status === "rsvp_no" && (
                  <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#FEE2E2", color: "#991B1B" }}>
                    ✗ Tidak Hadir
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Event details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", fontSize: 13, marginTop: 4 }}>
            <div>
              <div style={{ color: "#64748B", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>TANGGAL</div>
              <div style={{ color: "#1E293B", fontWeight: 500 }}>{formatDate(event.start_date)}{event.end_date ? ` - ${formatDate(event.end_date)}` : ""}</div>
            </div>
            {event.start_time && (
              <div>
                <div style={{ color: "#64748B", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>WAKTU</div>
                <div style={{ color: "#1E293B", fontWeight: 500 }}>{event.start_time?.slice(0,5)}{event.end_time ? ` - ${event.end_time.slice(0,5)}` : ""}</div>
              </div>
            )}
            {event.location && (
              <div>
                <div style={{ color: "#64748B", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>LOKASI</div>
                <div style={{ color: "#1E293B", fontWeight: 500 }}>{event.location}</div>
              </div>
            )}
            <div>
              <div style={{ color: "#64748B", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>TIPE</div>
              <div style={{ color: "#1E293B", fontWeight: 500 }}>{event.type === "online" ? "Online" : "Offline"}</div>
            </div>
            {event.speaker_name && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#64748B", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>PEMBICARA</div>
                <div style={{ color: "#1E293B", fontWeight: 600 }}>{event.speaker_name}</div>
                {event.speaker_bio && <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{event.speaker_bio}</div>}
              </div>
            )}
            {/* Apps */}
            {eventApps.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#64748B", fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>APLIKASI YANG DIAJARKAN</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {eventApps.map((app: any) => (
                    <span key={app.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: 8,
                      border: `1.5px solid ${app.color}44`,
                      background: `${app.color}10`,
                      color: app.color,
                      fontSize: 12, fontWeight: 700,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: app.color, display: "inline-block" }} />
                      {app.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {event.description && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E2E8F0" }}>
              <div style={{ color: "#64748B", fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>DESKRIPSI</div>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{event.description}</p>
            </div>
          )}
        </section>

        {/* ══ MATERIALS ══ */}
        <section style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: "#2563EB" }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", margin: 0 }}>
              Materi Pelatihan
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#2563EB", borderRadius: 10, padding: "1px 8px", marginLeft: 8 }}>{materials.length}</span>
            </h2>
          </div>

          {materials.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Belum ada materi untuk event ini.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {materials.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedMaterial(m); setSelectedDay(1); }}
                  style={{
                    width: "100%", border: "none", background: "#F4F7FC", cursor: "pointer", textAlign: "left",
                    borderRadius: 12, padding: "12px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  }}
                >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {m.total_days} hari
                        {m.is_ai_generated && " · AI-generated"}
                        {m.file_url && " · 📎 Slide tersedia"}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                      {m.file_url && (
                        <a href={m.file_url} target="_blank" rel="noopener"
                          onClick={e => e.stopPropagation()}
                          title="Download slide presentasi"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', background: '#2563EB', color: '#fff',
                            borderRadius: 8, fontSize: 11, fontWeight: 600, textDecoration: 'none',
                          }}>
                          📥 Slide
                        </a>
                      )}
                      <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" style={{ width: 14, height: 14, flex: "0 0 auto", alignSelf: 'center' }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ══ TESTS / KUESIONER ══ */}
        <section style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: "#2563EB" }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", margin: 0 }}>
              Tes & Kuesioner
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#2563EB", borderRadius: 10, padding: "1px 8px", marginLeft: 8 }}>{eventTests.length}</span>
            </h2>
          </div>

          {(() => {
            // ── Smart 1-link grouping: gabung pre + post test jadi 1 entri ──
            const testPhases = eventTests.filter(et => et.test.type === "test");
            const kuesPhases = eventTests.filter(et => et.test.type === "kuesioner");

            const prePhase = testPhases.find(et => et.phase.phase === "pre");
            const postPhase = testPhases.find(et => et.phase.phase === "post");

            const preTaken = prePhase?.is_taken ?? true;
            const postTaken = postPhase?.is_taken ?? true;
            const preCount = prePhase?.questions_count ?? 0;
            const postCount = postPhase?.questions_count ?? 0;

            // Determine next action and test name
            let testNextPhaseId: string | null = null;
            let testBtnLabel = "Isi Sekarang";
            let testStatusLabel: { text: string; bg: string; fg: string } | null = null;

            if (prePhase && !preTaken) {
              // Pre-test belum dikerjakan → arahkan ke pre
              testNextPhaseId = prePhase.phase.id;
              testBtnLabel = "Isi Pre-Test";
            } else if (postPhase && !postTaken) {
              // Pre-test sudah, post belum → arahkan ke post
              testNextPhaseId = postPhase.phase.id;
              testBtnLabel = "Isi Post-Test";
            } else if (preTaken && postTaken && (preCount > 0 || postCount > 0)) {
              // Semua selesai
              testStatusLabel = { text: "✓ Semua Selesai", bg: "#EFF6FF", fg: "#2563EB" };
            } else {
              // Tidak ada test atau menunggu
              testStatusLabel = { text: "Menunggu", bg: "#F0F2EC", fg: "#64748B" };
            }

            const totalTestSoal = preCount + postCount;
            const totalTestTerjawab = (prePhase?.taken_count ?? 0) + (postPhase?.taken_count ?? 0);

            if (eventTests.length === 0) {
              return <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Belum ada tes atau kuesioner untuk event ini.</p>;
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* ── Combined Pre/Post Test (1 link) ── */}
                {(prePhase || postPhase) && (
                  <div style={{
                    display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                    gap: 8, padding: "12px 14px", borderRadius: 12,
                    background: testStatusLabel ? "#F0FDF4" : "#F4F7FC",
                    opacity: testStatusLabel ? 0.7 : 1,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>
                        Pre / Post Test
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {totalTestSoal > 0 && `${totalTestSoal} soal`}
                        {totalTestTerjawab > 0 && ` · ${totalTestTerjawab} terjawab`}
                        {testNextPhaseId && (prePhase?.is_taken ? " (Post-Test)" : " (Pre-Test)")}
                      </div>
                    </div>
                    <div>
                      {testStatusLabel ? (
                        <span style={{
                          display: "inline-block", padding: "4px 12px", borderRadius: 8,
                          fontSize: 11, fontWeight: 700,
                          background: testStatusLabel.bg, color: testStatusLabel.fg,
                        }}>
                          {testStatusLabel.text}
                        </span>
                      ) : testNextPhaseId ? (
                        <button onClick={() => push(`/take/${eventId}/${testNextPhaseId}`)} style={{
                          border: "none", background: "#3B82F6", color: "#fff",
                          padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}>
                          {testBtnLabel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* ── Kuesioner (standalone) ── */}
                {kuesPhases.map((et) => (
                  <div key={et.id} style={{
                    display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                    gap: 8, padding: "12px 14px", borderRadius: 12,
                    background: et.is_taken ? "#F0FDF4" : "#F4F7FC",
                    opacity: et.is_taken ? 0.7 : 1,
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 2 }}>
                        {et.test.name || et.phase.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        {et.questions_count > 0 && `${et.questions_count} soal`}
                        {(et.taken_count > 0 && et.taken_count < et.questions_count) && ` · ${et.taken_count}/${et.questions_count} terjawab`}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#86AD98", marginTop: 2 }}>
                        Kuesioner
                      </div>
                    </div>
                    <div>
                      {et.is_taken ? (
                        <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#2563EB" }}>
                          ✓ Selesai
                        </span>
                      ) : (
                        <button onClick={() => push(`/take/${eventId}/${et.phase.id}`)} style={{ border: "none", background: "#3B82F6", color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {et.taken_count > 0 ? "Lanjutkan" : "Isi Sekarang"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      </main>

      {/* ══ MATERIAL MODAL ══ */}
      {selectedMaterial && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 999999,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedMaterial(null); }}
        >
          <div style={{
            background: "#fff", borderRadius: 20, padding: "28px 24px",
            width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 17, fontWeight: 700, color: "#1E293B", margin: 0 }}>
                  {selectedMaterial.title}
                </h3>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
                  {selectedMaterial.total_days} hari
                  {selectedMaterial.is_ai_generated && " · AI-generated"}
                </div>
              </div>
              <button onClick={() => setSelectedMaterial(null)}
                style={{ border: "none", background: "#F1F5F9", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#64748B", flex: "0 0 auto" }}>
                ✕
              </button>
            </div>

            {/* Day tabs */}
            {(selectedMaterial.content || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {selectedMaterial.content.map((c) => (
                    <button
                      key={c.day}
                      onClick={() => setSelectedDay(c.day)}
                      style={{
                        border: "none", cursor: "pointer", borderRadius: 8,
                        padding: "7px 14px", fontSize: 11, fontWeight: 700,
                        background: selectedDay === c.day ? "#2563EB" : "#F1F5F9",
                        color: selectedDay === c.day ? "#fff" : "#475569",
                        transition: "all 0.15s",
                      }}
                    >
                      Hari {c.day}
                    </button>
                  ))}
                </div>

                {/* Selected day content */}
                {(() => {
                  const dayContent = selectedMaterial.content.find((c) => c.day === selectedDay);
                  if (!dayContent) return null;
                  return (
                    <div>
                      <h4 style={{ fontFamily: "var(--font-sora)", fontSize: 14, fontWeight: 700, color: "#1E293B", margin: "0 0 10px 0" }}>
                        {dayContent.title}
                      </h4>
                      <div style={{
                        background: "#fff", borderRadius: 12, padding: "14px 16px",
                        fontSize: 13, color: "#475569", lineHeight: 1.75, whiteSpace: "pre-wrap",
                      }}>
                        {dayContent.body}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Fallback: syllabus if no content */}
            {(!selectedMaterial.content || selectedMaterial.content.length === 0) && (selectedMaterial.syllabus || []).length > 0 && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748B", marginBottom: 8, letterSpacing: "0.04em" }}>SILABUS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedMaterial.syllabus.map((item: any, i: number) => (
                    <div key={i} style={{
                      display: "flex", gap: 10, padding: "8px 10px", borderRadius: 10,
                      background: "#fff", fontSize: 12.5, color: "#1E293B", alignItems: "flex-start",
                    }}>
                      <span style={{
                        background: "#3B82F6", color: "#fff", fontWeight: 700,
                        width: 22, height: 22, borderRadius: 6, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 10, flex: "0 0 auto", marginTop: 1,
                      }}>
                        {item.day || i + 1}
                      </span>
                      <span style={{ lineHeight: 1.5 }}>{item.topic || item.title || ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!selectedMaterial.content || selectedMaterial.content.length === 0) && (!selectedMaterial.syllabus || selectedMaterial.syllabus.length === 0) && (
              <p style={{ fontSize: 12, color: "#64748B", margin: 0, fontStyle: "italic" }}>
                Tidak ada detail materi.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
