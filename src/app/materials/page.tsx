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
  const [modalMode, setModalMode] = useState<"ai" | "preview" | "detail" | "upload-preview">("ai");
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

  // Upload / Copy-Paste form
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadDays, setUploadDays] = useState(1);
  const [uploadRaw, setUploadRaw] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadGenerating, setUploadGenerating] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadPptxResult, setUploadPptxResult] = useState<any>(null);
  const [uploadPptxLoading, setUploadPptxLoading] = useState(false);

  const [mode, setMode] = useState<"choose" | "ai" | "manual" | "upload">("choose");

  useEffect(() => { loadMaterials(); }, []);

  async function loadMaterials() {
    setLoading(true);
    const { data } = await s.from("materials").select("*").order("created_at", { ascending: false });
    setMaterials(data || []);
    setLoading(false);
  }

  async function deleteMaterial(id: string, title: string) {
    if (!confirm(`Hapus materi "${title}"?`)) return;
    try {
      const res = await fetch("/api/materials/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghapus");
      toast.success("Materi dihapus");
      loadMaterials();
    } catch (err: any) {
      toast.error(err.message);
    }
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
      const resMat = await fetch("/api/materials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const jsonMat = await resMat.json();
      if (!resMat.ok) throw new Error(jsonMat.error || "Gagal membuat materi");
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
      const resMat = await fetch("/api/materials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualTitle,
          description: manualDesc,
          content: [],
          total_days: manualDays,
          syllabus: [],
          is_ai_generated: false,
        }),
      });
      const jsonMat = await resMat.json();
      if (!resMat.ok) throw new Error(jsonMat.error || "Gagal membuat materi");
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

  // ── Upload / Copy-Paste handlers ──
  async function handleFileSelect(file: File) {
    setUploadFileName(file.name);
    // PPTX → auto-upload via API
    if (file.name.match(/\.pptx?$/i)) {
      setUploadPptxLoading(true);
      setUploadPptxResult(null);
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
        const json = await res.json();
        if (json.success) {
          setUploadPptxResult(json);
          setUploadTitle(json.material.title);
          toast.success(`PPTX diproses! ${json.material.slides} slide → ${json.test ? "Test siap" : "Tanpa test"}`);
          loadMaterials();
        } else {
          toast.error(json.error || "Gagal upload PPTX");
        }
      } catch (e: any) { toast.error("Error: " + e.message); }
      setUploadPptxLoading(false);
      return;
    }
    // Text file → read as text
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) setUploadRaw(text);
    };
    reader.readAsText(file);
  }

  async function analyzeUploadedContent() {
    if (!uploadTitle.trim()) { toast.error("Judul harus diisi"); return; }
    if (!uploadRaw.trim()) { toast.error("Konten harus diisi atau upload file"); return; }
    setUploadGenerating(true);
    setUploadResult(null);
    try {
      const res = await fetch("/api/analyze-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: uploadTitle,
          description: uploadDesc,
          raw_content: uploadRaw,
          days: uploadDays,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menganalisis");
      setUploadResult(json);
      setModalMode("upload-preview");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadGenerating(false);
    }
  }

  async function saveUploadedMaterial() {
    setSaving(true);
    try {
      const content = [{ day: 1, title: `Hari 1: ${uploadTitle}`, body: uploadRaw }];
      const payload = {
        title: uploadTitle,
        description: uploadDesc,
        content,
        total_days: uploadDays,
        syllabus: [{ day: 1, topic: uploadTitle, duration: `${uploadDays * 1.5} jam` }],
        is_ai_generated: false,
        test_data: { pre_test: uploadResult.pre_test || [], post_test: uploadResult.post_test || [] },
      };
      const resMat = await fetch("/api/materials/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const jsonMat = await resMat.json();
      if (!resMat.ok) throw new Error(jsonMat.error || "Gagal membuat materi");
      toast.success("Materi berhasil disimpan!");
      setShowModal(false);
      resetUploadState();
      loadMaterials();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function resetUploadState() {
    setUploadTitle("");
    setUploadDesc("");
    setUploadDays(1);
    setUploadRaw("");
    setUploadFileName("");
    setUploadResult(null);
    setUploadPptxResult(null);
    setUploadPptxLoading(false);
    setModalMode("ai");
    setMode("choose");
  }

  const filtered = materials.filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563EB' }}>
            Perpustakaan Materi
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>
            Materi
          </h2>
          <p style={{ color: '#64748B', fontSize: 13.5, marginTop: 6 }}>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
          <p style={{ color: '#64748B', fontSize: 14 }}>
            {search ? "Tidak ada materi yang cocok." : "Belum ada materi. Klik 'Buat Materi Baru' untuk mulai."}
          </p>
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {filtered.map(m => (
          <div key={m.id} style={{
            background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
            padding: '22px 22px 20px', boxShadow: 'var(--shadow)',
            transition: 'all 0.2s',
          }} className="card-hover">
            {/* Icon + badge */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M20 2v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20Z" />
                </svg>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: m.is_ai_generated ? '#E7EEFB' : '#F0F2EC',
                color: m.is_ai_generated ? '#3C68B5' : '#64748B',
              }}>
                {m.is_ai_generated ? 'AI' : 'Manual'}
              </span>
            </div>

            {/* Title + desc */}
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 6, lineHeight: 1.35 }}>
              {m.title}
            </h3>
            {m.description && (
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {m.description}
              </p>
            )}

            {/* Meta */}
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748B', marginBottom: 18 }}>
              <span>{m.total_days || 1} hari</span>
              <span>{Array.isArray(m.content) ? m.content.length : 0} sesi</span>
              <span>{new Date(m.created_at).toLocaleDateString("id-ID")}</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/materials/${m.id}`} className="btn" style={{
                padding: '8px 16px', fontSize: 12.5, textDecoration: 'none', display: 'inline-block',
              }}>
                Detail
              </Link>
              <button onClick={() => deleteMaterial(m.id, m.title)}
                style={{
                  padding: '8px 16px', fontSize: 12.5, borderRadius: 10,
                  border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626',
                  fontWeight: 600, cursor: 'pointer',
                }}>
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>

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
            background: '#F4F7FC', borderRadius: 20,
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
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B', fontSize: 20 }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              {/* ── Detail mode ── */}
              {modalMode === "detail" && aiResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{aiResult.title}</h3>
                    {aiResult.description && <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{aiResult.description}</p>}
                  </div>

                  {(aiResult.syllabus?.length > 0) && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE', fontWeight: 700, fontSize: 14 }}>
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
                              background: '#EFF6FF', color: '#2563EB',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>{s.day}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.topic}</span>
                            <span style={{ fontSize: 11.5, color: '#64748B' }}>{s.duration}</span>
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
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Buat dengan AI</h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10 }}>
                        AI akan meneliti topik dan menghasilkan materi lengkap + silabus + pre/post test.
                      </p>
                      <button onClick={() => setMode("ai")}
                        className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                        Lanjutkan →
                      </button>
                    </div>
                  </div>

                  {/* Upload / Copy-Paste → AI Test */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Upload / Copy-Paste</h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10 }}>
                        Upload file teks atau copy-paste konten materi Anda. AI akan memeriksa dan membuat pre/post test.
                      </p>
                      <button onClick={() => setMode("upload")}
                        className="btn" style={{ padding: '8px 16px', fontSize: 13 }}>
                        Lanjutkan →
                      </button>
                    </div>
                  </div>

                  {/* Manual */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Buat Manual</h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10 }}>
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
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Jumlah Hari</label>
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
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Tingkat</label>
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
                      border: 'none', background: 'none', cursor: 'pointer', color: '#64748B',
                    }}>
                    ← Kembali
                  </button>
                </div>
              )}

              {/* ── Upload / Copy-Paste mode ── */}
              {modalMode !== "detail" && mode === "upload" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Judul Materi</label>
                    <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
                      placeholder="Judul materi"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Deskripsi</label>
                    <textarea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)}
                      placeholder="Deskripsi materi..."
                      rows={2}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                        boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Jumlah Hari</label>
                    <input type="number" min={1} max={30} value={uploadDays}
                      onChange={e => setUploadDays(Number(e.target.value))}
                      style={{
                        width: 100, padding: '8px 12px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>
                      Upload File
                      <span style={{ fontWeight: 400, color: '#64748B' }}> (.pptx, .txt)</span>
                    </label>
                    <div style={{
                      border: '2px dashed var(--border)', borderRadius: 12, padding: 12,
                      background: '#fff', textAlign: 'center', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                      onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#3B82F6'; }}
                      onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; }}
                      onDrop={e => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.borderColor = '';
                        const file = e.dataTransfer.files[0];
                        if (file) handleFileSelect(file);
                      }}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.pptx,.txt';
                        input.onchange = (e: any) => {
                          const file = e.target?.files?.[0];
                          if (file) handleFileSelect(file);
                        };
                        input.click();
                      }}>
                      {uploadFileName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{uploadFileName}</span>
                          <button onClick={e => { e.stopPropagation(); setUploadFileName(""); }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, padding: 0 }}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span style={{ fontSize: 12.5, color: '#64748B' }}>Klik atau drag file .pptx / .txt di sini</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* PPTX upload result */}
                  {uploadPptxLoading && (
                    <div style={{ padding: 12, background: '#EFF6FF', borderRadius: 10, fontSize: 13, color: '#2563EB' }}>
                      ⏳ Memproses PPTX... (ekstrak teks + buat materi + generate test)
                    </div>
                  )}
                  {uploadPptxResult && (
                    <div style={{ padding: 14, background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', marginBottom: 8 }}>✅ PPTX Berhasil Diproses!</div>
                      <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.6 }}>
                        📄 <strong>{uploadPptxResult.material.title}</strong><br />
                        📊 {uploadPptxResult.material.slides} slide → {uploadPptxResult.material.slides} sesi<br />
                        {uploadPptxResult.test ? `📝 Pre & Post Test siap` : `⚠️ Test tidak dapat digenerate`}
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                        <a href={`/materials/${uploadPptxResult.material.id}`} target="_blank"
                          style={{ padding: '6px 12px', background: '#166534', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                          📖 Lihat Materi
                        </a>
                        {uploadPptxResult.test && (
                          <a href={`/tests/${uploadPptxResult.test.id}`} target="_blank"
                            style={{ padding: '6px 12px', background: '#2563EB', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                            📝 Lihat Test
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>
                      atau Copy-Paste Konten Materi
                    </label>
                    <textarea value={uploadRaw} onChange={e => setUploadRaw(e.target.value)}
                      placeholder="Tempel konten materi Anda di sini..."
                      rows={8}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 10,
                        border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                        boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                        lineHeight: 1.6,
                      }}
                    />
                  </div>
                  <button onClick={analyzeUploadedContent} disabled={uploadGenerating || (!uploadRaw.trim() && !uploadFileName)}
                    className="btn btn-primary" style={{
                      padding: '10px', fontSize: 13.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4,
                    }}>
                    {uploadGenerating ? (
                      <>
                        <span style={{
                          width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#fff', borderRadius: '50%',
                          animation: 'spin 0.6s linear infinite',
                          display: 'inline-block',
                        }} />
                        AI Sedang Menganalisis & Membuat Soal...
                      </>
                    ) : "Analisis & Generate Pre/Post Test"}
                  </button>
                  <button onClick={() => setMode("choose")}
                    style={{
                      padding: '8px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
                      border: 'none', background: 'none', cursor: 'pointer', color: '#64748B',
                    }}>
                    ← Kembali
                  </button>
                </div>
              )}

              {/* ── Upload Preview (AI-generated tests) ── */}
              {modalMode === "upload-preview" && uploadResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{uploadTitle}</h3>
                    {uploadDesc && <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{uploadDesc}</p>}
                  </div>

                  {/* Pre-Test */}
                  {uploadResult.pre_test?.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#E7EEFB', fontWeight: 700, fontSize: 14, color: '#3C68B5' }}>
                        PRE-TEST ({uploadResult.pre_test.length} soal)
                      </div>
                      <div style={{ padding: 12 }}>
                        {uploadResult.pre_test.map((q: any, i: number) => (
                          <div key={i} style={{
                            padding: '10px 12px', borderRadius: 10,
                            borderBottom: i < uploadResult.pre_test.length - 1 ? '1px solid var(--border-2)' : 'none',
                            marginBottom: i < uploadResult.pre_test.length - 1 ? 6 : 0,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                              {i + 1}. {q.question}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {(q.options || []).map((opt: string, oi: number) => (
                                <div key={oi} style={{
                                  fontSize: 12, color: '#475569', padding: '3px 8px',
                                  borderRadius: 6, background: oi === q.correct ? '#EFF6FF' : '#FAFAF8',
                                }}>
                                  {opt} {oi === q.correct && <span style={{ color: '#2563EB', fontWeight: 700 }}>✓</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post-Test */}
                  {uploadResult.post_test?.length > 0 && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#FBEFD6', fontWeight: 700, fontSize: 14, color: '#B57A1E' }}>
                        POST-TEST ({uploadResult.post_test.length} soal)
                      </div>
                      <div style={{ padding: 12 }}>
                        {uploadResult.post_test.map((q: any, i: number) => (
                          <div key={i} style={{
                            padding: '10px 12px', borderRadius: 10,
                            borderBottom: i < uploadResult.post_test.length - 1 ? '1px solid var(--border-2)' : 'none',
                            marginBottom: i < uploadResult.post_test.length - 1 ? 6 : 0,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                              {i + 1}. {q.question}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {(q.options || []).map((opt: string, oi: number) => (
                                <div key={oi} style={{
                                  fontSize: 12, color: '#475569', padding: '3px 8px',
                                  borderRadius: 6, background: oi === q.correct ? '#EFF6FF' : '#FAFAF8',
                                }}>
                                  {opt} {oi === q.correct && <span style={{ color: '#2563EB', fontWeight: 700 }}>✓</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setModalMode("ai"); setMode("upload"); setUploadResult(null); }} style={{
                      padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                    }}>
                      Regenerate
                    </button>
                    <button onClick={saveUploadedMaterial} disabled={saving}
                      className="btn btn-primary" style={{
                        padding: '10px 24px', fontSize: 13, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      {saving ? "Menyimpan..." : "Simpan Materi"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Preview (AI result) ── */}
              {modalMode === "preview" && aiResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{aiResult.title}</h3>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{aiResult.description}</p>
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: '#64748B' }}>
                      <span><strong>{aiDays}</strong> hari</span>
                      <span><strong>{aiResult.syllabus?.length || 0}</strong> sesi</span>
                      <span>Tingkat: {aiLevel}</span>
                    </div>
                  </div>

                  {(aiResult.syllabus?.length > 0) && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE', fontWeight: 700, fontSize: 14 }}>
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
                              background: '#EFF6FF', color: '#2563EB',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>{s.day}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.topic}</span>
                            <span style={{ fontSize: 11.5, color: '#64748B' }}>{s.duration}</span>
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
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Judul Materi</label>
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
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Deskripsi</label>
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
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Jumlah Hari</label>
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
    </>
  );

  function closeModal() {
    setShowModal(false);
    setModalMode("ai");
    setMode("choose");
    setAiResult(null);
    setAiTopic("");
    setEditId(null);
    resetUploadState();
  }
}
