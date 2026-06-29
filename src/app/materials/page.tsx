"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { toast } from "sonner";

export default function MaterialsPage() {
  const s = createClient();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ── Create / Edit modal ──
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"ai" | "preview" | "detail">("ai");
  const [editId, setEditId] = useState<string | null>(null);

  // AI form
  const [aiTopic, setAiTopic] = useState("");
  const [aiDays, setAiDays] = useState(1);
  const [aiLevel, setAiLevel] = useState<"pemula" | "menengah" | "lanjutan">("pemula");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Manual form
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualDays, setManualDays] = useState(1);
  const [mode, setMode] = useState<"choose" | "ai" | "manual">("choose");

  useEffect(() => { loadMaterials(); }, []);

  async function loadMaterials() {
    setLoading(true);
    const { data } = await s.from("materials").select("*").order("created_at", { ascending: false });
    setMaterials(data || []);
    setLoading(false);
  }

  async function deleteMaterial(id: string, title: string) {
    if (!confirm(`Hapus materi "${title}"?`)) return;
    await s.from("materials").delete().eq("id", id);
    toast.success("Materi dihapus");
    loadMaterials();
  }

  async function generateMaterial() {
    if (aiTopic.trim().length < 3) { toast.error("Topik minimal 3 karakter"); return; }
    setAiGenerating(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/generate-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic, days: aiDays, level: aiLevel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal generate");
      setAiResult(json);
      setModalMode("preview");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAiGenerating(false);
    }
  }

  async function saveMaterial() {
    setSaving(true);
    try {
      const payload = {
        title: aiResult.title,
        description: aiResult.description,
        content: aiResult.content,
        total_days: aiDays,
        syllabus: aiResult.syllabus,
        is_ai_generated: true,
        test_data: { pre_test: aiResult.pre_test || [], post_test: aiResult.post_test || [] },
      };
      const { error } = await s.from("materials").insert(payload);
      if (error) throw error;
      toast.success("Materi berhasil disimpan!");
      setShowModal(false);
      setAiTopic("");
      setAiResult(null);
      setModalMode("ai");
      loadMaterials();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveManual() {
    if (!manualTitle.trim()) { toast.error("Judul harus diisi"); return; }
    setSaving(true);
    try {
      const { error } = await s.from("materials").insert({
        title: manualTitle,
        description: manualDesc,
        content: [],
        total_days: manualDays,
        syllabus: [],
        is_ai_generated: false,
      });
      if (error) throw error;
      toast.success("Materi berhasil disimpan!");
      setShowModal(false);
      setManualTitle("");
      setManualDesc("");
      setModalMode("ai");
      setMode("choose");
      loadMaterials();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = materials.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1F9D5A' }}>
            Perpustakaan Materi
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>
            Materi
          </h2>
          <p style={{ color: '#73837A', fontSize: 13.5, marginTop: 6 }}>
            {loading ? "Memuat..." : `${materials.length} materi tersimpan`}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', marginTop: 4 }}>
          <button onClick={() => { setMode("choose"); setShowModal(true); }}
            className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Buat Materi Baru
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#73837A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 15, height: 15, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari materi..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
              border: '1px solid var(--border)', fontSize: 13, background: '#fff',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
          padding: 48, textAlign: 'center', boxShadow: 'var(--shadow)',
        }}>
          <p style={{ color: '#73837A', fontSize: 14 }}>
            {search ? "Tidak ada materi yang cocok." : "Belum ada materi. Klik 'Buat Materi Baru' untuk mulai."}
          </p>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {filtered.map(m => (
          <div key={m.id} style={{
            background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
            padding: 18, boxShadow: 'var(--shadow)',
            transition: 'all 0.2s',
          }} className="card-hover">
            {/* Icon + badge */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#DFF5E8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#1F9D5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M20 2v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20Z" />
                </svg>
              </div>
              <span style={{
                fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                background: m.is_ai_generated ? '#E7EEFB' : '#F0F2EC',
                color: m.is_ai_generated ? '#3C68B5' : '#73837A',
              }}>
                {m.is_ai_generated ? 'AI' : 'Manual'}
              </span>
            </div>

            {/* Title + desc */}
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, color: '#152019', marginBottom: 4, lineHeight: 1.3 }}>
              {m.title}
            </h3>
            {m.description && (
              <p style={{ fontSize: 12.5, color: '#3C4A42', marginBottom: 10, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {m.description}
              </p>
            )}

            {/* Meta */}
            <div style={{ display: 'flex', gap: 10, fontSize: 11.5, color: '#73837A', marginBottom: 14 }}>
              <span>{m.total_days || 1} hari</span>
              <span>{Array.isArray(m.content) ? m.content.length : 0} sesi</span>
              <span>{new Date(m.created_at).toLocaleDateString("id-ID")}</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              <Link href={`/materials/${m.id}`} className="btn" style={{
                padding: '6px 12px', fontSize: 12, textDecoration: 'none', display: 'inline-block',
              }}>
                Detail
              </Link>
              <button onClick={() => deleteMaterial(m.id, m.title)}
                style={{
                  padding: '6px 12px', fontSize: 12, borderRadius: 10,
                  border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626',
                  fontWeight: 600, cursor: 'pointer',
                }}>
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ MODAL: Create / Detail ═══ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 20px',
        }} onClick={e => { if (e.target === e.currentTarget) { closeModal(); } }}>
          <div style={{
            background: '#F5F6F2', borderRadius: 20,
            width: '100%', maxWidth: modalMode === "detail" ? 800 : 640,
            maxHeight: '85vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            marginTop: 'auto', marginBottom: 'auto',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--border)',
              background: '#fff', borderRadius: '20px 20px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 18, fontWeight: 700, margin: 0 }}>
                {modalMode === "detail" ? "Detail Materi" : mode === "choose" ? "Buat Materi Baru" : mode === "ai" ? "Buat dengan AI" : "Manual"}
              </h3>
              <button onClick={closeModal}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#73837A', fontSize: 20 }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              {/* ── Detail mode ── */}
              {modalMode === "detail" && aiResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{aiResult.title}</h3>
                    {aiResult.description && <p style={{ fontSize: 13, color: '#3C4A42', lineHeight: 1.5 }}>{aiResult.description}</p>}
                  </div>

                  {(aiResult.syllabus?.length > 0) && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#F8F9F5', fontWeight: 700, fontSize: 14 }}>
                        Silabus
                      </div>
                      <div style={{ padding: 12 }}>
                        {(aiResult.syllabus || []).map((s: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '8px 12px', borderRadius: 10,
                            borderBottom: i < (aiResult.syllabus?.length || 0) - 1 ? '1px solid var(--border-2)' : 'none',
                          }}>
                            <span style={{
                              width: 24, height: 24, borderRadius: 999,
                              background: '#DFF5E8', color: '#1F9D5A',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>{s.day}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.topic}</span>
                            <span style={{ fontSize: 11.5, color: '#73837A' }}>{s.duration}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(aiResult.content?.length > 0) && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Konten Materi</h4>
                      {aiResult.content.map((c: any, i: number) => (
                        <details key={i} style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: '6px 0' }}>
                            Hari {c.day}: {c.title}
                          </summary>
                          <div style={{
                            padding: '10px 12px', marginTop: 6,
                            background: '#FAFAF8', borderRadius: 10,
                            fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                          }}>
                            {typeof c.body === 'string' ? c.body : JSON.stringify(c.body)}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Choose mode ── */}
              {modalMode !== "detail" && mode === "choose" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* AI */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8F9F5' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Buat dengan AI (DeepSeek)</h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 12.5, color: '#73837A', marginBottom: 10 }}>
                        AI akan meneliti topik dan menghasilkan materi lengkap + silabus.
                      </p>
                      <button onClick={() => setMode("ai")}
                        className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                        Lanjutkan →
                      </button>
                    </div>
                  </div>

                  {/* Manual */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8F9F5' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Buat Manual</h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 12.5, color: '#73837A', marginBottom: 10 }}>
                        Isi judul dan deskripsi materi secara manual.
                      </p>
                      <button onClick={() => setMode("manual")}
                        className="btn" style={{ padding: '8px 16px', fontSize: 13 }}>
                        Lanjutkan →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── AI mode ── */}
              {modalMode !== "detail" && mode === "ai" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                    placeholder="Contoh: Strategi Pemasaran Digital untuk UMKM"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#73837A', marginBottom: 4, display: 'block' }}>Jumlah Hari</label>
                      <input type="number" min={1} max={30} value={aiDays}
                        onChange={e => setAiDays(Number(e.target.value))}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 10,
                          border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#73837A', marginBottom: 4, display: 'block' }}>Tingkat</label>
                      <select value={aiLevel} onChange={e => setAiLevel(e.target.value as any)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 10,
                          border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                          boxSizing: 'border-box', background: '#fff',
                        }}>
                        <option value="pemula">Pemula</option>
                        <option value="menengah">Menengah</option>
                        <option value="lanjutan">Lanjutan</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={generateMaterial} disabled={aiGenerating}
                    className="btn btn-primary" style={{
                      padding: '10px', fontSize: 13.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                    {aiGenerating ? (
                      <>
                        <span style={{
                          width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff', borderRadius: '50%',
                          animation: 'spin 0.6s linear infinite',
                          display: 'inline-block',
                        }} />
                        AI Sedang Meneliti & Membuat Materi...
                      </>
                    ) : "Generate Materi dengan AI"}
                  </button>
                  <button onClick={() => setMode("choose")}
                    style={{
                      padding: '8px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                      border: 'none', background: 'none', cursor: 'pointer', color: '#73837A',
                    }}>
                    ← Kembali
                  </button>
                </div>
              )}

              {/* ── Preview (AI result) ── */}
              {modalMode === "preview" && aiResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{aiResult.title}</h3>
                    <p style={{ fontSize: 13, color: '#3C4A42', lineHeight: 1.5 }}>{aiResult.description}</p>
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: '#73837A' }}>
                      <span><strong>{aiDays}</strong> hari</span>
                      <span><strong>{aiResult.syllabus?.length || 0}</strong> sesi</span>
                      <span>Tingkat: {aiLevel}</span>
                    </div>
                  </div>

                  {(aiResult.syllabus?.length > 0) && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#F8F9F5', fontWeight: 700, fontSize: 14 }}>
                        Silabus
                      </div>
                      <div style={{ padding: 12 }}>
                        {(aiResult.syllabus || []).map((s: any, i: number) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '8px 12px', borderRadius: 10,
                            borderBottom: i < (aiResult.syllabus?.length || 0) - 1 ? '1px solid var(--border-2)' : 'none',
                          }}>
                            <span style={{
                              width: 24, height: 24, borderRadius: 999,
                              background: '#DFF5E8', color: '#1F9D5A',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>{s.day}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.topic}</span>
                            <span style={{ fontSize: 11.5, color: '#73837A' }}>{s.duration}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setModalMode("ai")} style={{
                      padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                    }}>
                      Regenerate
                    </button>
                    <button onClick={saveMaterial} disabled={saving}
                      className="btn btn-primary" style={{
                        padding: '10px 24px', fontSize: 13, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      {saving ? "Menyimpan..." : "Simpan Materi"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Manual mode ── */}
              {modalMode !== "detail" && mode === "manual" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#73837A', marginBottom: 4, display: 'block' }}>Judul Materi</label>
                    <input value={manualTitle} onChange={e => setManualTitle(e.target.value)}
                      placeholder="Judul materi"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#73837A', marginBottom: 4, display: 'block' }}>Deskripsi</label>
                    <textarea value={manualDesc} onChange={e => setManualDesc(e.target.value)}
                      placeholder="Deskripsi materi..."
                      rows={3}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                        boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#73837A', marginBottom: 4, display: 'block' }}>Jumlah Hari</label>
                    <input type="number" min={1} max={30} value={manualDays}
                      onChange={e => setManualDays(Number(e.target.value))}
                      style={{
                        width: 100, padding: '8px 12px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button onClick={() => setMode("choose")} style={{
                      padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                    }}>
                      ← Kembali
                    </button>
                    <button onClick={saveManual} disabled={saving}
                      className="btn btn-primary" style={{
                        padding: '10px 24px', fontSize: 13, fontWeight: 700,
                      }}>
                      {saving ? "Menyimpan..." : "Simpan Materi"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function closeModal() {
    setShowModal(false);
    setModalMode("ai");
    setMode("choose");
    setAiResult(null);
    setAiTopic("");
    setEditId(null);
  }
}
