"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/* ───── Types ───── */
interface Phase {
  id: string;
  phase: "pre" | "post" | "only";
  label: string;
  sort_order: number;
  questions: Question[];
}

interface Question {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "essay";
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  sort_order: number;
  is_active: boolean;
}

export default function TestDetailPage() {
  const { push } = useRouter();
  const testId = useParams().id as string;
  const s = createClient();

  const [test, setTest] = useState<any>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state per phase
  const [activeForm, setActiveForm] = useState<{ phaseId: string; editId: string | null } | null>(null);
  const [form, setForm] = useState<{
    question_text: string; question_type: "multiple_choice" | "essay";
    options: string[]; correct_answer: string; points: number;
  }>({ question_text: "", question_type: "multiple_choice", options: ["", ""], correct_answer: "", points: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [testId]);

  async function load() {
    const { data: t } = await s.from("tests").select("*").eq("id", testId).single();
    setTest(t);
    const { data: ps } = await s.from("test_phases").select("*, test_questions(*)").eq("test_id", testId).order("sort_order");
    // Supabase returns the nested relationship as "test_questions"; map to "questions"
    const mapped = (ps || []).map((p: any) => ({ ...p, questions: p.test_questions || [] }));
    setPhases(mapped);
    setLoading(false);
  }

  async function saveQuestion(phaseId: string) {
    if (!form.question_text.trim()) { toast.error("Soal tidak boleh kosong"); return; }
    let opts: string[] | null = null;
    if (form.question_type === "multiple_choice") {
      opts = form.options.filter(o => o.trim());
      if (opts.length < 2) { toast.error("Minimal 2 pilihan jawaban"); return; }
      if (!form.correct_answer) { toast.error("Pilih jawaban benar"); return; }
    }

    setSaving(true);
    const payload = {
      phase_id: phaseId,
      question_text: form.question_text.trim(),
      question_type: form.question_type,
      options: form.question_type === "multiple_choice" ? opts : null,
      correct_answer: form.question_type === "multiple_choice" ? form.correct_answer : null,
      points: form.points,
      sort_order: phases.find(p => p.id === phaseId)?.questions.length ?? 0,
    };

    let error: any;
    if (activeForm?.editId) {
      ({ error } = await s.from("test_questions").update(payload).eq("id", activeForm.editId));
    } else {
      ({ error } = await s.from("test_questions").insert(payload));
    }
    if (error) toast.error("Gagal: " + error.message);
    else toast.success(activeForm?.editId ? "Soal diupdate!" : "Soal ditambahkan!");

    setSaving(false);
    resetForm();
    load();
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Hapus soal ini?")) return;
    await s.from("test_questions").delete().eq("id", id);
    toast.success("Soal dihapus");
    load();
  }

  function editQuestion(q: Question) {
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      options: (q.options as string[]) || ["", ""],
      correct_answer: q.correct_answer || "",
      points: q.points,
    });
    setActiveForm({ phaseId: q.id /* will be overwritten */, editId: q.id });
  }

  function resetForm() {
    setForm({ question_text: "", question_type: "multiple_choice", options: ["", ""], correct_answer: "", points: 1 });
    setActiveForm(null);
  }

  function startAdd(phaseId: string) {
    resetForm();
    setActiveForm({ phaseId, editId: null });
  }

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#64748B" }}>Memuat...</div>;
  if (!test) return <div style={{ padding: 48, textAlign: "center", color: "#EF4444" }}>Test tidak ditemukan</div>;

  return (
    <div style={{ animation: "fade-in-up 0.5s ease-out both" }}>
      {/* Back */}
      <button onClick={() => push("/tests")} className="hover:text-[var(--ink)]" style={{
        fontSize: 13, color: "#64748B", fontWeight: 600, cursor: "pointer",
        border: "none", background: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12, padding: 0,
        transition: "color 0.12s",
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Kembali ke daftar test
      </button>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#2563EB", marginBottom: 4 }}>
          <span style={{
            padding: "2px 8px", borderRadius: 6, fontSize: 10.5,
            background: test.type === "test" ? "#EFF6FF" : "#FBEFD6",
            color: test.type === "test" ? "#2563EB" : "#B57A1E",
            marginRight: 8,
          }}>
            {test.type === "test" ? "Test" : "Kuesioner"}
          </span>
          {test.type === "test" ? "Pre-Test & Post-Test" : "Kuesioner"}
        </div>
        <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>{test.name}</h2>
        {test.description && <p style={{ color: "#64748B", fontSize: 13.5, marginTop: 6 }}>{test.description}</p>}
      </div>

      {/* Phases */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {phases.map(phase => {
          const isFormOpen = activeForm?.phaseId === phase.id && !activeForm?.editId;
          const isEditing = activeForm?.editId && phases.some(p => p.questions.some(q => q.id === activeForm.editId));
          const showForm = activeForm?.phaseId === phase.id;

          return (
            <div key={phase.id} style={{
              background: "#fff", border: "1px solid var(--border)", borderRadius: 18,
              overflow: "hidden", boxShadow: "var(--shadow)",
            }}>
              {/* Phase header */}
              <div style={{
                padding: "14px 20px", borderBottom: "1px solid var(--border)",
                background: "#F8FAFE", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 16, fontWeight: 700 }}>{phase.label}</h3>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: "#64748B",
                    background: "#F0F2EC", padding: "2px 8px", borderRadius: 999,
                  }}>
                    {phase.questions.length} soal
                  </span>
                </div>
                <button onClick={() => startAdd(phase.id)} style={{
                  padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                  border: "1px solid var(--border)", background: "#fff", cursor: "pointer",
                  color: "#2563EB",
                }}>+ Tambah Soal</button>
              </div>

              {/* Questions */}
              <div style={{ padding: "12px 20px" }}>
                {phase.questions.length === 0 && !showForm && (
                  <p style={{ color: "#64748B", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                    Belum ada soal.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {phase.questions.filter(q => showForm && activeForm?.editId ? q.id !== activeForm.editId : true).map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      q={q}
                      idx={idx}
                      onEdit={() => {
                        setForm({
                          question_text: q.question_text,
                          question_type: q.question_type,
                          options: (q.options as string[]) || ["", ""],
                          correct_answer: q.correct_answer || "",
                          points: q.points,
                        });
                        setActiveForm({ phaseId: phase.id, editId: q.id });
                      }}
                      onDelete={() => deleteQuestion(q.id)}
                    />
                  ))}
                </div>

                {/* Form */}
                {showForm && (
                  <div style={{
                    background: "#F8FAFE", border: "1px solid var(--border-2)", borderRadius: 14,
                    padding: 20, marginTop: 12,
                  }}>
                    <h4 style={{ fontFamily: "var(--font-sora)", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                      {activeForm?.editId ? "Edit Soal" : "Tambah Soal Baru"}
                    </h4>
                    <div style={{ marginBottom: 14 }}>
                      <Label>Soal *</Label>
                      <textarea value={form.question_text} onChange={e => setForm({ ...form, question_text: e.target.value })}
                        placeholder="Tulis pertanyaan..." rows={2} className={inputClass} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 14 }}>
                      <div>
                        <Label>Tipe</Label>
                        <select value={form.question_type} onChange={e => setForm({ ...form, question_type: e.target.value as any, options: ["", ""], correct_answer: "" })} className={inputClass}>
                          <option value="multiple_choice">Pilihan Ganda</option>
                          <option value="essay">Esai</option>
                        </select>
                      </div>
                      <div>
                        <Label>Poin</Label>
                        <input type="number" min={1} value={form.points} onChange={e => setForm({ ...form, points: parseInt(e.target.value) || 1 })} className={inputClass} />
                      </div>
                    </div>
                    {form.question_type === "multiple_choice" && (
                      <div style={{ marginBottom: 14 }}>
                        <Label>Pilihan Jawaban</Label>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {form.options.map((opt, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input type="radio" name={`correct-${phase.id}`} checked={form.correct_answer === opt}
                                onChange={() => setForm({ ...form, correct_answer: opt })}
                                style={{ accentColor: "#1E3A5F" }} />
                              <input value={opt} onChange={e => {
                                const opts = [...form.options]; opts[i] = e.target.value;
                                setForm({ ...form, options: opts, correct_answer: form.correct_answer === form.options[i] ? e.target.value : form.correct_answer });
                              }} placeholder={`Opsi ${i + 1}`} className={inputClass} style={{ flex: 1 }} />
                              {form.options.length > 2 && (
                                <button onClick={() => {
                                  const opts = form.options.filter((_, idx) => idx !== i);
                                  setForm({ ...form, options: opts.length ? opts : [""], correct_answer: form.correct_answer === form.options[i] ? "" : form.correct_answer });
                                }} style={iconBtnStyle} title="Hapus">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button onClick={() => setForm({ ...form, options: [...form.options, ""] })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#2563EB", fontWeight: 600, fontSize: 12.5, marginTop: 8 }}>
                          + Tambah opsi
                        </button>
                        <p style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>Tandai jawaban benar dengan radio button.</p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={() => saveQuestion(phase.id)} disabled={saving} className="btn btn-primary" style={{ padding: "9px 18px", fontSize: 13 }}>
                        {saving ? "Menyimpan..." : activeForm?.editId ? "Update Soal" : "Simpan Soal"}
                      </button>
                      <button onClick={resetForm} className="btn" style={{ padding: "9px 18px", fontSize: 13 }}>Batal</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── QuestionCard ─── */
function QuestionCard({ q, idx, onEdit, onDelete }: { q: Question; idx: number; onEdit: () => void; onDelete: () => void }) {
  const isMc = q.question_type === "multiple_choice";
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--border-2)", borderRadius: 12,
      padding: "12px 14px", transition: "box-shadow 0.15s",
    }} className="hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 8, background: "#EFF6FF", color: "#2563EB",
              display: "grid", placeItems: "center", fontFamily: "var(--font-sora)", fontSize: 11, fontWeight: 700,
            }}>{idx + 1}</span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: 6,
              background: isMc ? "#FBEFD6" : "#E7EEFB", color: isMc ? "#B57A1E" : "#3C68B5",
            }}>{isMc ? "Pilihan Ganda" : "Esai"}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{q.points} poin</span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", marginBottom: isMc ? 8 : 0 }}>{q.question_text}</p>
          {isMc && q.options && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(q.options as string[]).map((opt, i) => {
                const isCorrect = opt === q.correct_answer;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", flex: "0 0 auto",
                      border: `2px solid ${isCorrect ? "#3B82F6" : "#D1D5DB"}`,
                      display: "grid", placeItems: "center",
                      background: isCorrect ? "#3B82F6" : "transparent",
                    }}>
                      {isCorrect && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}><path d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    <span style={{ fontWeight: isCorrect ? 700 : 400, color: isCorrect ? "#2563EB" : "#475569" }}>{opt}{isCorrect && " ✓"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flex: "0 0 auto" }}>
          <button onClick={onEdit} style={smallBtn} title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <button onClick={onDelete} style={smallBtn} title="Hapus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass = "w-full bg-white border border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: 6, display: "block" }}>{children}</label>;
}
const iconBtnStyle: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4, borderRadius: 6, display: "grid", placeItems: "center" };
const smallBtn: React.CSSProperties = { ...iconBtnStyle, width: 32, height: 32, background: "#F8FAFE", border: "1px solid var(--border-2)" };
