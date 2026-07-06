"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function MaterialDetailPage() {
  const s = createClient();
  const { push } = useRouter();
  const params = useParams();
  const currentId = params.id as string;

  // ── Data ──
  const [allMats, setAllMats] = useState<any[]>([]);
  const [mat, setMat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // ── Event Usage & Test Stats ──
  const [eventStats, setEventStats] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [eventExpanded, setEventExpanded] = useState(false);
  const [descOpen, setDescOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editContent, setEditContent] = useState<any[]>([]);
  const [editSyllabus, setEditSyllabus] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (currentId) loadEventStats();
  }, [currentId]);

  useEffect(() => {
    if (allMats.length > 0) {
      const found = allMats.find(m => m.id === currentId);
      setMat(found || null);
      setLoading(false);
      if (found) {
        setEditTitle(found.title);
        setEditDesc(found.description || "");
        setEditContent(found.content || []);
        setEditSyllabus(found.syllabus || []);
        // Auto-select first day
        const days = found.content || [];
        if (days.length > 0 && selectedIdx === null) {
          setSelectedIdx(0);
        }
      }
    }
  }, [currentId, allMats]);

  async function loadAll() {
    const { data } = await s.from("materials").select("*").order("created_at", { ascending: false });
    setAllMats(data || []);
  }

  async function loadEventStats() {
    setStatsLoading(true);
    const { data: matData } = await s.from("materials").select("title").eq("id", currentId).single();
    const matTitle = matData?.title || "";
    const { data: events } = await s.from("event_materials")
      .select("event_id, events!inner(id,title,status,start_date)")
      .eq("material_id", currentId);
    const list: any[] = [];
    const searchTerm = matTitle.substring(0, 30);

    for (const em of events || []) {
      const ev = (em as any).events;

      // Helper: get avg score for a phase
      async function getPhaseAvg(phase: string) {
        const { data: et } = await s.from("event_tests")
          .select("phase_id, test_phases!inner(id, phase, label, test_id, tests!inner(id, name))")
          .eq("event_id", em.event_id).eq("test_phases.phase", phase)
          .ilike("test_phases.tests.name", `%${searchTerm}%`);
        if (!et?.[0]) return { avg: null, count: 0 };
        const pid = (et[0] as any).phase_id;
        const { data: qs } = await s.from("test_questions").select("id").eq("phase_id", pid);
        const qIds = (qs || []).map((q: any) => q.id);
        if (qIds.length === 0) return { avg: null, count: 0 };
        const { data: ans } = await s.from("test_answers")
          .select("score").eq("event_id", em.event_id)
          .in("question_id", qIds).not("score", "is", null);
        const vals = (ans || []).map((a: any) => Number(a.score)).filter((v: number) => !isNaN(v));
        if (vals.length === 0) return { avg: null, count: 0 };
        return { avg: Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10, count: vals.length };
      }

      const pre = await getPhaseAvg("pre");
      const post = await getPhaseAvg("post");
      const delta = pre.avg !== null && post.avg !== null ? Math.round((post.avg - pre.avg) * 10) / 10 : null;

      list.push({
        event_id: em.event_id, title: ev.title, status: ev.status, start_date: ev.start_date,
        preAvg: pre.avg, postAvg: post.avg, delta, preCount: pre.count, postCount: post.count,
      });
    }
    setEventStats(list);
    setStatsLoading(false);
  }

  function toggleEdit() {
    if (editing) {
      // Cancel: revert
      if (mat) {
        setEditTitle(mat.title);
        setEditDesc(mat.description || "");
        setEditContent(mat.content || []);
        setEditSyllabus(mat.syllabus || []);
      }
    }
    setEditing(!editing);
  }

  async function saveChanges() {
    if (!editTitle.trim()) { toast.error("Judul harus diisi"); return; }
    if (!mat) return;
    setSaving(true);
    const res = await fetch("/api/materials/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: mat.id,
        title: editTitle,
        description: editDesc,
        content: editContent,
        syllabus: editSyllabus,
      }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error || "Gagal update"); setSaving(false); return; }
    toast.success("Materi diperbarui!");
    setMat((prev: any) => ({ ...prev, title: editTitle, description: editDesc, content: editContent, syllabus: editSyllabus }));
    setEditing(false);
    setSaving(false);
    // Refresh all list
    loadAll();
  }

  async function exportPptx() {
    if (!mat) return;
    setExporting(true);
    try {
      const res = await fetch("/api/generate-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mat.title,
          description: mat.description,
          syllabus: mat.syllabus,
          content: mat.content,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal export");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mat.title}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PPTX berhasil didownload!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  // ── Edit helpers ──
  function updateContentDay(idx: number, field: string, val: string) {
    const copy = [...editContent];
    copy[idx] = { ...copy[idx], [field]: val };
    setEditContent(copy);
  }

  function addContentDay() {
    const day = editContent.length + 1;
    setEditContent([...editContent, { day, title: `Hari ${day}`, body: "" }]);
    setEditSyllabus([...editSyllabus, { day, topic: `Hari ${day}`, duration: "1.5 jam" }]);
  }

  function removeContentDay(idx: number) {
    const c = editContent.filter((_, i) => i !== idx);
    const s = editSyllabus.filter((_, i) => i !== idx);
    setEditContent(c.map((d, i) => ({ ...d, day: i + 1 })));
    setEditSyllabus(s.map((d, i) => ({ ...d, day: i + 1 })));
  }

  // Content days for sidebar nav
  const contentDays = mat ? (mat.content || []) : [];

  function selectSession(idx: number) {
    setSelectedIdx(idx);
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 100px)', animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* ═══ Left: Daftar Sesi ═══ */}
      <div style={{
        width: 280, flex: '0 0 auto',
        background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: 'var(--shadow)',
      }}>
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          background: '#F8FAFE',
        }}>
          <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 12, fontWeight: 700, marginBottom: 2, color: '#64748B' }}>
            DAFTAR SESI
          </h3>
          {mat && (
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', margin: 0, lineHeight: 1.3 }}>
              {mat.title}
            </p>
          )}
          {mat && mat.description && !editing && (
            <div>
              <div onClick={() => setDescOpen(!descOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                  fontSize: 10.5, fontWeight: 700, color: '#64748B', marginTop: 10, marginBottom: 4,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ width: 11, height: 11, transition: 'transform 0.2s', transform: descOpen ? 'rotate(90deg)' : '' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Deskripsi
              </div>
              {descOpen && (
                <p style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.5, margin: '0 0 4px 0' }}>
                  {mat.description}
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
          {!mat ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#64748B' }}>
              Pilih materi dari daftar
            </div>
          ) : contentDays.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#64748B' }}>
              Belum ada sesi
            </div>
          ) : (
            contentDays.map((c: any, i: number) => (
              <div key={`day-${i}`}
                onClick={() => selectSession(i)}
                style={{
                  padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                  marginBottom: 3, transition: 'all 0.12s',
                  background: selectedIdx === i ? '#EFF6FF' : 'transparent',
                  border: selectedIdx === i ? '1px solid #A8DFC1' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: '#EFF6FF', color: '#2563EB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, flex: '0 0 auto',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B', lineHeight: 1.3 }}>
                    {c.title || `Sesi ${i + 1}`}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: '#F8FAFE' }}>
          <button onClick={() => push('/materials')}
            style={{
              width: '100%', padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', color: '#1E293B',
            }}>
            ← Ke Library
          </button>
        </div>
      </div>

      {/* ═══ Right: Detail ═══ */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: 16, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748B', fontSize: 14 }}>Memuat...</div>
        ) : !mat ? (
          <div style={{
            background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
            padding: 48, textAlign: 'center', boxShadow: 'var(--shadow)',
          }}>
            <p style={{ color: '#64748B', fontSize: 14 }}>Materi tidak ditemukan.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* ── Title + Actions ── */}
            <div style={{
              background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
              padding: '14px 18px', boxShadow: 'var(--shadow)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              {editing ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 18,
                    border: '1px solid var(--border)', outline: 'none',
                    fontFamily: 'var(--font-sora)', fontWeight: 700, boxSizing: 'border-box',
                  }}
                />
              ) : (
                <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 22, fontWeight: 800, margin: 0, flex: 1, minWidth: 0 }}>
                  {mat.title}
                </h2>
              )}
              <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
                {!editing && mat.file_url && (
                  <button onClick={async () => {
                    try {
                      const res = await fetch(mat.file_url);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${mat.title}.pptx`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      toast.success("Download PPTX dimulai");
                    } catch { toast.error("Gagal download file"); }
                  }}
                    title="Download file PPTX asli"
                    style={{
                      padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5, color: '#2563EB',
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    PPTX
                  </button>
                )}
                {!editing && (
                  <button onClick={async () => {
                    if (!confirm(`Hapus materi "${mat?.title}"? Tindakan ini tidak bisa dibatalkan.`)) return;
                    try {
                      const res = await fetch("/api/materials/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: mat?.id }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "Gagal menghapus");
                      toast.success("Materi berhasil dihapus");
                      push('/materials');
                    } catch (err: any) {
                      toast.error("Gagal menghapus: " + err.message);
                    }
                  }}
                    title="Hapus materi"
                    style={{
                      padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: '1px solid #FCA5A5', background: '#fff', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5, color: '#DC2626',
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    Hapus
                  </button>
                )}
                {!editing && (
                  <button onClick={exportPptx} disabled={exporting}
                    title="Simpan sebagai PPTX"
                    style={{
                      padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5, color: '#1E293B',
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <polyline points="9 15 12 18 15 15" />
                    </svg>
                    {exporting ? "..." : "PPTX"}
                  </button>
                )}
                <button onClick={toggleEdit}
                  style={{
                    padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: 'none', cursor: 'pointer', color: '#fff',
                    background: editing ? '#DC2626' : '#1E3A5F',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    {editing
                      ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                      : <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>
                    }
                  </svg>
                  {editing ? "Batal" : "Edit"}
                </button>
                {editing && (
                  <button onClick={saveChanges} disabled={saving}
                    className="btn btn-primary" style={{ padding: '7px 12px', fontSize: 12 }}>
                    {saving ? "..." : "Simpan"}
                  </button>
                )}
              </div>
            </div>

            {editing && (
              <div style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
                padding: 14, boxShadow: 'var(--shadow)',
              }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deskripsi</h4>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                  style={{
                    width: '100%', height: '100%', minHeight: 80, maxHeight: 500,
                    padding: '10px 14px', borderRadius: 10, fontSize: 13,
                    border: '1px solid var(--border)', outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* ── Event Usage (compact) ── */}
            {!editing && (
              <div style={{
                background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
                padding: '14px 18px', boxShadow: 'var(--shadow)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: eventStats.length > 0 ? 'pointer' : 'default',
              }} onClick={() => { if (eventStats.length > 0) setEventExpanded(!eventExpanded); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: eventStats.length > 0 ? '#EFF6FF' : '#F0F2EC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: eventStats.length > 0 ? '#2563EB' : '#64748B',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                      <rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>
                      {statsLoading ? "Memuat..." : `${eventStats.length} Event`}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                      {statsLoading ? "" : eventStats.length === 0 ? "Belum digunakan" : `Klik untuk lihat detail`}
                    </div>
                  </div>
                </div>
                {eventStats.length > 0 && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ width: 16, height: 16, transition: 'transform 0.2s', transform: eventExpanded ? 'rotate(180deg)' : '' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
            )}

            {/* ── Expanded event detail list ── */}
            {!editing && eventExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {eventStats.map((es) => (
                  <div key={es.event_id} style={{
                    border: '1px solid var(--border-2)', borderRadius: 12,
                    background: '#FAFAF8', overflow: 'hidden',
                  }}>
                    <Link href={`/events/${es.event_id}`} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', textDecoration: 'none',
                      borderBottom: '1px solid var(--border-2)', background: '#F8FAFE',
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, flex: '0 0 auto' }}>
                        <rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" />
                      </svg>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1E293B', flex: 1 }}>{es.title}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                        background: es.status === 'ongoing' ? '#EFF6FF' : es.status === 'completed' ? '#F0F2EC' : '#FBEFD6',
                        color: es.status === 'ongoing' ? '#2563EB' : es.status === 'completed' ? '#64748B' : '#92400e',
                      }}>{es.status}</span>
                    </Link>
                    <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 10, background: '#E7EEFB' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#3C68B5', marginBottom: 4 }}>PRE-TEST</div>
                        <div style={{ fontFamily: 'var(--font-sora)', fontSize: 22, fontWeight: 800, color: '#3C68B5', lineHeight: 1 }}>
                          {es.preAvg !== null ? es.preAvg : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: '#3C68B5', marginTop: 2 }}>{es.preCount} jwb</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 10, background: es.delta !== null && es.delta > 0 ? '#EFF6FF' : '#F0F2EC' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: es.delta !== null && es.delta > 0 ? '#2563EB' : '#64748B', marginBottom: 4 }}>DELTA</div>
                        <div style={{ fontFamily: 'var(--font-sora)', fontSize: 22, fontWeight: 800, color: es.delta !== null && es.delta > 0 ? '#2563EB' : '#64748B', lineHeight: 1 }}>
                          {es.delta !== null ? (es.delta > 0 ? `+${es.delta}` : es.delta) : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                          {es.delta !== null ? (es.delta > 0 ? 'Naik' : es.delta < 0 ? 'Turun' : 'Stabil') : '—'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 10, background: '#FBEFD6' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#B57A1E', marginBottom: 4 }}>POST-TEST</div>
                        <div style={{ fontFamily: 'var(--font-sora)', fontSize: 22, fontWeight: 800, color: '#B57A1E', lineHeight: 1 }}>
                          {es.postAvg !== null ? es.postAvg : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: '#B57A1E', marginTop: 2 }}>{es.postCount} jwb</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Content per Day ── */}
            <div style={{
              background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
              padding: 18, boxShadow: 'var(--shadow)',
              flex: editing ? 1 : '0 0 auto',
              display: 'flex', flexDirection: 'column',
              minHeight: editing ? 0 : 'auto',
              overflow: editing ? 'hidden' : 'visible',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flex: '0 0 auto' }}>
                <h3 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                  {editing ? "Konten Materi" : selectedIdx !== null && contentDays[selectedIdx] ? `Sesi ${selectedIdx + 1}: ${contentDays[selectedIdx]?.title || ""}` : "Konten Materi"}
                </h3>
                {editing && (
                  <button onClick={addContentDay} style={{
                    border: 'none', background: '#1E3A5F', color: '#fff',
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    + Tambah Hari
                  </button>
                )}
              </div>
              {(editing ? editContent : contentDays).length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13 }}>Belum ada konten.</p>
              ) : editing ? (
                // ── Edit mode: scroll within card ──
                <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {editContent.map((c: any, i: number) => (
                  <details key={i} style={{ marginBottom: 8 }} open={true}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Hari {c.day}:</span>
                      <input value={c.title || ""}
                        onChange={e => updateContentDay(i, "title", e.target.value)}
                        style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: 13,
                          border: '1px solid var(--border)', outline: 'none', width: '50%',
                        }}
                      />
                      <button onClick={(e) => { e.preventDefault(); if (confirm(`Hapus sesi "${c.title || `Hari ${c.day}`}"?`)) removeContentDay(i); }}
                        style={{
                          marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer',
                          color: '#DC2626', fontSize: 11, fontWeight: 600, padding: '2px 6px',
                          borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Hapus
                      </button>
                    </summary>
                    <div style={{
                      padding: '10px 12px', marginTop: 6,
                      background: '#FAFAF8', borderRadius: 10,
                      fontSize: 13, lineHeight: 1.6,
                    }}>
                      <textarea value={c.body || ""}
                        onChange={e => updateContentDay(i, "body", e.target.value)}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: 400,
                          maxHeight: 500,
                          padding: '10px', borderRadius: 8, fontSize: 13,
                          border: '1px solid var(--border)', outline: 'none', resize: 'vertical',
                          fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </details>
                ))}</div>
              ) : selectedIdx !== null ? (
                // ── View mode: show only selected day ──
                (() => {
                  const day = contentDays[selectedIdx];
                  if (!day) return <p style={{ color: '#64748B', fontSize: 13 }}>Pilih sesi dari sidebar.</p>;
                  return (
                    <div style={{
                      padding: '16px 20px', borderRadius: 14,
                      background: '#FAFAF8', border: '1px solid var(--border-2)',
                      fontSize: 14, lineHeight: 1.7,
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                      }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 999,
                          background: '#1E3A5F', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                        }}>{day.day}</span>
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#1E293B' }}>
                          {day.title || `Hari ${day.day}`}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#475569' }}>
                        {typeof day.body === 'string' ? day.body : JSON.stringify(day.body)}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p style={{ color: '#64748B', fontSize: 13 }}>Pilih sesi dari sidebar.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
