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

  // ── Modal state ──
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"choose" | "ai" | "upload">("choose");

  // AI form
  const [aiTopic, setAiTopic] = useState("");
  const [aiDays, setAiDays] = useState(1);
  const [aiLevel, setAiLevel] = useState<"pemula" | "menengah" | "lanjutan">("pemula");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

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

  // ── AI Generate ──

  async function generateMaterial() {
    if (aiTopic.trim().length < 3) { toast.error("Topik minimal 3 karakter"); return; }
    setAiGenerating(true);
    setAiResult(null);
    setShowPreview(false);
    try {
      const res = await fetch("/api/generate-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic, days: aiDays, level: aiLevel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal generate");
      setAiResult(json);
      setShowPreview(true);
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
      closeModal();
      loadMaterials();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Upload PDF ──

  async function handleUploadPdf() {
    if (!uploadFile) { toast.error("Pilih file PDF"); return; }
    setUploadProgress(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const res = await fetch("/api/materials/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (json.success) {
        setUploadResult(json);
        toast.success(`PDF diproses!`);
        loadMaterials();
      } else {
        toast.error(json.error || "Gagal upload");
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setUploadProgress(false);
    }
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
          <button onClick={() => { setShowModal(true); setMode("choose"); setShowPreview(false); setAiResult(null); setUploadResult(null); setUploadFile(null); }}
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: m.file_url ? '#F0FDF4' : '#EFF6FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {m.file_url ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M20 2v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20Z" />
                  </svg>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: m.file_url ? '#F0FDF4' : '#E7EEFB',
                color: m.file_url ? '#16A34A' : '#3C68B5',
              }}>
                {m.file_url ? 'PDF' : 'AI'}
              </span>
            </div>

            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 6, lineHeight: 1.35 }}>
              {m.title}
            </h3>
            {m.description && (
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {m.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748B', marginBottom: 18 }}>
              <span>{m.total_days || 1} hari</span>
              <span>{new Date(m.created_at).toLocaleDateString("id-ID")}</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Link href={`/materials/${m.id}`} className="btn" style={{
                padding: '8px 16px', fontSize: 12.5, textDecoration: 'none', display: 'inline-block',
              }}>
                Detail
              </Link>
              {m.file_url && (
                <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px', fontSize: 12.5, borderRadius: 10,
                    border: '1px solid var(--border)', background: '#fff',
                    fontWeight: 600, cursor: 'pointer', textDecoration: 'none', color: '#1E293B',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  PDF
                </a>
              )}
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

      {/* ═══ MODAL ═══ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px 20px',
        }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{
            background: '#F4F7FC', borderRadius: 20,
            width: '100%', maxWidth: showPreview || uploadResult ? 800 : 640,
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
                {showPreview || uploadResult ? "Preview Materi" : "Buat Materi Baru"}
              </h3>
              <button onClick={closeModal}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B', fontSize: 20 }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              {/* ── Choose mode ── */}
              {mode === "choose" && !showPreview && !uploadResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Generate dengan AI</h4>
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

                  <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Upload PDF</h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10 }}>
                        Upload file PDF materi. Sistem akan membaca isi dan membuat pre/post test.
                      </p>
                      <button onClick={() => setMode("upload")}
                        className="btn" style={{ padding: '8px 16px', fontSize: 13 }}>
                        Lanjutkan →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── AI form ── */}
              {mode === "ai" && !showPreview && (
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

              {/* ── Upload PDF form ── */}
              {mode === "upload" && !uploadResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{
                    border: '2px dashed var(--border)', borderRadius: 12, padding: 32,
                    background: '#fff', textAlign: 'center', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                    onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#3B82F6'; }}
                    onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; }}
                    onDrop={e => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).style.borderColor = '';
                      const file = e.dataTransfer.files[0];
                      if (file && file.type === "application/pdf") setUploadFile(file);
                      else toast.error("Hanya file PDF");
                    }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.pdf';
                      input.onchange = (e: any) => {
                        const file = e.target?.files?.[0];
                        if (file) setUploadFile(file);
                      };
                      input.click();
                    }}>
                    {uploadFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{uploadFile.name}</span>
                        <span style={{ fontSize: 11, color: '#64748B' }}>({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                        <button onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, padding: 0 }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28, marginBottom: 8 }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Klik atau drag file PDF di sini</p>
                      </div>
                    )}
                  </div>

                  <button onClick={handleUploadPdf} disabled={!uploadFile || uploadProgress}
                    className="btn btn-primary" style={{
                      padding: '10px', fontSize: 13.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                    {uploadProgress ? "Memproses PDF..." : "Upload & Proses PDF"}
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

              {/* ── Upload success ── */}
              {uploadResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    background: '#F0FDF4', borderRadius: 14, border: '1px solid #BBF7D0',
                    padding: 20, textAlign: 'center',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, marginBottom: 8 }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 18, fontWeight: 700, color: '#166534', margin: '0 0 4px' }}>
                      PDF Berhasil Diproses!
                    </h3>
                    <p style={{ fontSize: 13, color: '#166534', margin: 0 }}>
                      {uploadResult.material.title}
                    </p>
                    {uploadResult.test && (
                      <p style={{ fontSize: 12, color: '#16A34A', marginTop: 4 }}>Pre & Post Test siap</p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <a href={`/materials/${uploadResult.material.id}`} target="_blank"
                      style={{
                        padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                        background: '#166534', color: '#fff', textDecoration: 'none',
                      }}>
                      Lihat Materi
                    </a>
                    {uploadResult.test && (
                      <a href={`/tests/${uploadResult.test.id}`} target="_blank"
                        style={{
                          padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          background: '#2563EB', color: '#fff', textDecoration: 'none',
                        }}>
                        Lihat Test
                      </a>
                    )}
                    <button onClick={closeModal}
                      style={{
                        padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                      }}>
                      Selesai
                    </button>
                  </div>
                </div>
              )}

              {/* ── AI Preview ── */}
              {showPreview && aiResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{aiResult.title}</h3>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{aiResult.description}</p>
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: '#64748B' }}>
                      <span><strong>{aiDays}</strong> hari</span>
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
                    <button onClick={() => setShowPreview(false)} style={{
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
            </div>
          </div>
        </div>
      )}
    </>
  );

  function closeModal() {
    setShowModal(false);
    setMode("choose");
    setAiTopic("");
    setAiResult(null);
    setShowPreview(false);
    setUploadFile(null);
    setUploadResult(null);
  }
}