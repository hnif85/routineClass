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
      draft: "#6B7280", published: "#1F9D5A", ongoing: "#E2A33A", completed: "#6B7280", cancelled: "#DC2626",
    };
    return map[s] || "#6B7280";
  }

  function getOpenTimeIcon(t: string) {
    const map: Record<string, string> = {
      before: "Sebelum Event", during: "Saat Event", after: "Setelah Event",
    };
    return map[t] || t;
  }

  function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F6F2" }}>
        <div style={{ color: "#73837A", fontSize: 14 }}>Memuat data...</div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6F2" }}>
      {/* ══ HEADER ══ */}
      <header style={{ background: "#0F3D2B", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={() => back()} style={{ border: "none", background: "rgba(255,255,255,0.12)", color: "#EAF4EF", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-sora)", fontSize: 14, fontWeight: 700, color: "#EAF4EF", lineHeight: 1.15 }}>
            Detail Event
          </div>
          <div style={{ fontSize: 10.5, color: "#86AD98", marginTop: 1 }}>
            {user?.email}
          </div>
        </div>
        <a href="/portal" style={{ border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#CFF3DF", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          Portal
        </a>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 80px" }}>
        {/* ══ EVENT INFO ══ */}
        <section style={{ background: "#fff", borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          {/* Cover */}
          {event.cover_image_url && (
            <img src={event.cover_image_url} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 16 }} />
          )}

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontFamily: "var(--font-sora)", fontSize: 20, fontWeight: 800, color: "#152019", margin: 0, lineHeight: 1.3 }}>
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
                    <button onClick={() => handleRsvp("rsvp_yes")} style={{ border: "none", background: "#2FB36B", color: "#fff", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Hadir
                    </button>
                    <button onClick={() => handleRsvp("rsvp_no")} style={{ border: "1px solid #DC2626", background: "#fff", color: "#DC2626", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      ✗ Tidak
                    </button>
                  </div>
                )}
                {rsvpLoading && <span style={{ fontSize: 12, color: "#73837A" }}>Memproses...</span>}
                {(invitation.status === "rsvp_yes" || invitation.status === "attended") && (
                  <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: "#DFF5E8", color: "#1F9D5A" }}>
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
              <div style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>TANGGAL</div>
              <div style={{ color: "#152019", fontWeight: 500 }}>{formatDate(event.start_date)}{event.end_date ? ` - ${formatDate(event.end_date)}` : ""}</div>
            </div>
            {event.start_time && (
              <div>
                <div style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>WAKTU</div>
                <div style={{ color: "#152019", fontWeight: 500 }}>{event.start_time?.slice(0,5)}{event.end_time ? ` - ${event.end_time.slice(0,5)}` : ""}</div>
              </div>
            )}
            {event.location && (
              <div>
                <div style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>LOKASI</div>
                <div style={{ color: "#152019", fontWeight: 500 }}>{event.location}</div>
              </div>
            )}
            <div>
              <div style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>TIPE</div>
              <div style={{ color: "#152019", fontWeight: 500 }}>{event.type === "online" ? "Online" : "Offline"}</div>
            </div>
            {event.speaker_name && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600, marginBottom: 2 }}>PEMBICARA</div>
                <div style={{ color: "#152019", fontWeight: 600 }}>{event.speaker_name}</div>
                {event.speaker_bio && <div style={{ color: "#3C4A42", fontSize: 12, marginTop: 2 }}>{event.speaker_bio}</div>}
              </div>
            )}
          </div>

          {event.description && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E7EAE2" }}>
              <div style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600, marginBottom: 4 }}>DESKRIPSI</div>
              <p style={{ fontSize: 13, color: "#3C4A42", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{event.description}</p>
            </div>
          )}
        </section>

        {/* ══ MATERIALS ══ */}
        <section style={{ background: "#fff", borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 15, fontWeight: 700, color: "#152019", margin: "0 0 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#2FB36B" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Materi Pelatihan
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#2FB36B", borderRadius: 10, padding: "1px 8px" }}>{materials.length}</span>
          </h2>

          {materials.length === 0 ? (
            <p style={{ fontSize: 13, color: "#73837A", margin: 0 }}>Belum ada materi untuk event ini.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {materials.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedMaterial(m); setSelectedDay(1); }}
                  style={{
                    width: "100%", border: "none", background: "#F5F6F2", cursor: "pointer", textAlign: "left",
                    borderRadius: 12, padding: "12px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#152019", marginBottom: 2 }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: "#73837A" }}>
                      {m.total_days} hari
                      {m.is_ai_generated && " · AI-generated"}
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#73837A" strokeWidth="2" style={{ width: 14, height: 14, flex: "0 0 auto" }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ══ TESTS / KUESIONER ══ */}
        <section style={{ background: "#fff", borderRadius: 18, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 15, fontWeight: 700, color: "#152019", margin: "0 0 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#2FB36B" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Tes & Kuesioner
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#2FB36B", borderRadius: 10, padding: "1px 8px" }}>{eventTests.length}</span>
          </h2>

          {eventTests.length === 0 ? (
            <p style={{ fontSize: 13, color: "#73837A", margin: 0 }}>Belum ada tes atau kuesioner untuk event ini.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {eventTests.map((et) => (
                <div key={et.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 14px", borderRadius: 12, background: et.is_taken ? "#F0FDF4" : "#F5F6F2", opacity: et.is_taken ? 0.7 : 1 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#152019", marginBottom: 2 }}>
                      {et.test.name || et.phase.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#73837A" }}>
                      {et.phase.phase && <span style={{ fontWeight: 600 }}>{et.phase.phase.toUpperCase()}</span>}
                      {et.phase.label && et.phase.phase && " · "}
                      {et.phase.label}
                      {et.questions_count > 0 && ` · ${et.questions_count} soal`}
                      {(et.taken_count > 0 && et.taken_count < et.questions_count) && ` · ${et.taken_count}/${et.questions_count} terjawab`}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#86AD98", marginTop: 2 }}>
                      {getOpenTimeIcon(et.open_time)}
                      {et.test.type && ` · ${et.test.type}`}
                    </div>
                  </div>
                  <div>
                    {et.is_taken ? (
                      <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#DFF5E8", color: "#1F9D5A" }}>
                        ✓ Selesai
                      </span>
                    ) : (
                      <button onClick={() => push(`/take/${eventId}/${et.phase.id}`)} style={{ border: "none", background: "#2FB36B", color: "#fff", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {et.taken_count > 0 ? "Lanjutkan" : "Isi Sekarang"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
            background: "#F5F6F2", borderRadius: 24, padding: "28px 24px",
            width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 17, fontWeight: 700, color: "#152019", margin: 0 }}>
                  {selectedMaterial.title}
                </h3>
                <div style={{ fontSize: 11, color: "#73837A", marginTop: 3 }}>
                  {selectedMaterial.total_days} hari
                  {selectedMaterial.is_ai_generated && " · AI-generated"}
                </div>
              </div>
              <button onClick={() => setSelectedMaterial(null)}
                style={{ border: "none", background: "#E7EAE2", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#3C4A42", flex: "0 0 auto" }}>
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
                        background: selectedDay === c.day ? "#0F3D2B" : "#E7EAE2",
                        color: selectedDay === c.day ? "#EAF4EF" : "#3C4A42",
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
                      <h4 style={{ fontFamily: "var(--font-sora)", fontSize: 14, fontWeight: 700, color: "#152019", margin: "0 0 10px 0" }}>
                        {dayContent.title}
                      </h4>
                      <div style={{
                        background: "#fff", borderRadius: 12, padding: "14px 16px",
                        fontSize: 13, color: "#3C4A42", lineHeight: 1.75, whiteSpace: "pre-wrap",
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
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#73837A", marginBottom: 8, letterSpacing: "0.04em" }}>SILABUS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selectedMaterial.syllabus.map((item: any, i: number) => (
                    <div key={i} style={{
                      display: "flex", gap: 10, padding: "8px 10px", borderRadius: 10,
                      background: "#fff", fontSize: 12.5, color: "#152019", alignItems: "flex-start",
                    }}>
                      <span style={{
                        background: "#2FB36B", color: "#fff", fontWeight: 700,
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
              <p style={{ fontSize: 12, color: "#73837A", margin: 0, fontStyle: "italic" }}>
                Tidak ada detail materi.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
