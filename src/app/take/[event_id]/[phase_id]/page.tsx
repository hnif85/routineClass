"use client";
import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "essay";
  options: string[] | null;
  correct_answer: string | null;
  points: number;
  sort_order: number;
};

type PhaseInfo = {
  id: string;
  label: string;
  phase: string;
  test: { id: string; name: string; description: string; type: string };
};

type EventInfo = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
};

type EventTest = {
  open_time: "before" | "during" | "after";
  is_open: boolean;
};

type Step = "loading" | "gate" | "quiz" | "submitted" | "closed" | "error";

export default function TakeTestPage({ params }: { params: Promise<{ event_id: string; phase_id: string }> }) {
  const { event_id, phase_id } = use(params);
  const s = createClient();

  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [phase, setPhase] = useState<PhaseInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [email, setEmail] = useState("");
  const [umkmId, setUmkmId] = useState<string | null>(null);
  const [umkmName, setUmkmName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      // 1. Fetch event
      const { data: ev, error: evErr } = await s.from("events").select("id, title, start_date, end_date").eq("id", event_id).single();
      if (evErr || !ev) { setStep("error"); setErrorMsg("Event tidak ditemukan."); return; }
      setEvent(ev);

      // 2. Fetch phase + test
      const { data: ph, error: phErr } = await s.from("test_phases").select("id, label, phase, test:test_id(id, name, description, type)").eq("id", phase_id).single();
      if (phErr || !ph) { setStep("error"); setErrorMsg("Test tidak ditemukan."); return; }
      setPhase(ph as unknown as PhaseInfo);

      // 3. Fetch event_tests binding + check open_time
      const { data: et } = await s.from("event_tests").select("open_time, is_open").eq("event_id", event_id).eq("phase_id", phase_id).single();
      if (!et) { setStep("error"); setErrorMsg("Test ini tidak terikat ke event."); return; }
      const binding = et as EventTest;

      // 4. Check is_open
      if (!binding.is_open) { setStep("closed"); setErrorMsg("Test ini sedang ditutup oleh admin."); return; }

      // 5. Check phase type (pre/post)
      const { data: phaseInfo } = await s.from("test_phases").select("phase").eq("id", phase_id).single();
      const isPostPhase = phaseInfo?.phase === "post";

      // 6. Check open_time criteria
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = ev.start_date ? new Date(ev.start_date) : null;
      const end = ev.end_date ? new Date(ev.end_date) : null;

      // H+2 auto-close: post-test ditutup 2 hari setelah event selesai
      if (isPostPhase && end) {
        const closeDate = new Date(end);
        closeDate.setDate(closeDate.getDate() + 2);
        if (today > closeDate) {
          setStep("closed");
          setErrorMsg("Post-Test sudah ditutup (H+2 setelah event selesai).");
          return;
        }
      }

      if (binding.open_time === "before" && start && today >= start) {
        setStep("closed");
        setErrorMsg("Test Pre sudah tidak bisa diisi karena event sudah dimulai.");
        return;
      }
      if (binding.open_time === "during" && start && today < start) {
        setStep("closed");
        setErrorMsg("Test ini hanya bisa diisi saat event berlangsung. Event belum dimulai.");
        return;
      }
      if (binding.open_time === "after" && end && today <= end) {
        setStep("closed");
        setErrorMsg("Test Post hanya bisa diisi setelah event selesai.");
        return;
      }

      // 6. Fetch questions
      const { data: qs } = await s.from("test_questions")
        .select("id, question_text, question_type, options, correct_answer, points, sort_order")
        .eq("phase_id", phase_id)
        .order("sort_order", { ascending: true });
      setQuestions((qs || []) as Question[]);
      if (!qs || qs.length === 0) { setStep("error"); setErrorMsg("Belum ada soal untuk test ini."); return; }

      // 7. Show email gate
      setStep("gate");
    } catch (err: any) {
      setStep("error");
      setErrorMsg(err?.message || "Terjadi kesalahan.");
    }
  }

  async function verifyEmail() {
    if (!email.trim()) { setErrorMsg("Masukkan email Anda."); return; }

    // Look up email in umkm table
    const { data: umkm, error: uErr } = await s.from("umkm")
      .select("id, business_name, full_name")
      .ilike("email", email.trim())
      .single();
    if (uErr || !umkm) {
      setErrorMsg("Email tidak terdaftar sebagai peserta. Pastikan Anda menggunakan email yang didaftarkan saat pendaftaran UMKM.");
      return;
    }

    // Check if this UMKM is invited to this event
    const { data: inv } = await s.from("event_invitations")
      .select("status")
      .eq("event_id", event_id)
      .eq("umkm_id", umkm.id)
      .single();

    if (!inv) {
      setErrorMsg("Anda tidak terdaftar sebagai peserta untuk event ini.");
      return;
    }

    // Check if already submitted answers for this event+phase
    const qIds = questions.map(q => q.id);
    const { count: existingCount } = await s.from("test_answers")
      .select("id", { count: "exact", head: true })
      .in("question_id", qIds)
      .eq("event_id", event_id)
      .eq("umkm_id", umkm.id);
    if (existingCount && existingCount > 0) {
      setAlreadySubmitted(true);
      setUmkmName(umkm.business_name || umkm.full_name || "");
      setStep("submitted");
      return;
    }

    setUmkmId(umkm.id);
    setUmkmName(umkm.business_name || umkm.full_name || "");
    setStep("quiz");
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  async function submitAnswers() {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg("");

    // Validate all questions answered
    const unanswered = questions.filter(q => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      setErrorMsg(`Masih ada ${unanswered.length} soal yang belum dijawab.`);
      setSubmitting(false);
      return;
    }

    try {
      // Double-check: cek apakah sudah ada jawaban sebelumnya (jaga-jaga)
      const qIds = questions.map(q => q.id);
      const { count: existingCount } = await s.from("test_answers")
        .select("id", { count: "exact", head: true })
        .in("question_id", qIds)
        .eq("event_id", event_id)
        .eq("umkm_id", umkmId);
      if (existingCount && existingCount > 0) {
        setErrorMsg("Anda sudah mengirim jawaban untuk test ini. Halaman ini akan di-refresh.");
        setSubmitting(false);
        setTimeout(() => window.location.reload(), 2500);
        return;
      }

      const inserts = questions.map(q => ({
        question_id: q.id,
        event_id,
        umkm_id: umkmId,
        answer_text: answers[q.id],
        score: null, // admin grades manually
        submitted_at: new Date().toISOString(),
      }));

      const { error } = await s.from("test_answers").insert(inserts);
      if (error) { throw error; }

      setStep("submitted");
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal menyimpan jawaban.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Styles ──
  const pageStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "#F4F7FC", overflowY: "auto",
    fontFamily: "var(--font-jakarta)",
  };
  const cardStyle: React.CSSProperties = {
    margin: "0 auto", padding: "32px 20px 48px",
  };
  const boxStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 18, padding: 28,
    border: "1px solid #E2E8F0", boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
    marginBottom: 20,
  };
  const btnStyle: React.CSSProperties = {
    padding: "12px 32px", fontSize: 15, fontWeight: 700,
    background: "#1E3A5F", color: "#fff", border: "none",
    borderRadius: 12, cursor: "pointer",
    boxShadow: "0 8px 20px -8px rgba(15,61,43,0.5)",
    transition: "all 0.15s", width: "100%",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", fontSize: 15,
    border: "1.5px solid #E2E8F0", borderRadius: 12,
    outline: "none", boxSizing: "border-box",
    background: "#FAFAF8", fontFamily: "var(--font-jakarta)",
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block" }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6 }}>
            UMKM Connect
          </div>
        </div>

        {step === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 14, color: "#64748B" }}>Memuat...</div>
          </div>
        )}

        {step === "error" && (
          <div style={boxStyle}>
            <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>
              Terjadi Kesalahan
            </h2>
            <p style={{ color: "#E74C3C", fontSize: 14, margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        {step === "closed" && (
          <div style={boxStyle}>
            <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>
              Test Belum Tersedia
            </h2>
            <p style={{ color: "#475569", fontSize: 14, margin: 0, lineHeight: 1.6 }}>{errorMsg}</p>
          </div>
        )}

        {step === "gate" && event && phase && (
          <div style={boxStyle}>
            <div style={{
              display: "inline-block", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              padding: "2px 8px", borderRadius: 5, marginBottom: 12,
              background: phase.test.type === "test" ? "#EFF6FF" : "#FBEFD6",
              color: phase.test.type === "test" ? "#2563EB" : "#B57A1E",
            }}>
              {phase.test.type === "test" ? "PRE / POST TEST" : "KUESIONER"}
            </div>
            <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
              {phase.label}
            </h2>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 4px" }}>
              {event.title}
            </p>
            {phase.test.description && (
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 20px", lineHeight: 1.5 }}>
                {phase.test.description}
              </p>
            )}
            <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 16px" }}>
              {questions.length} soal • {questions.filter(q => q.question_type === "multiple_choice").length} pilihan ganda • {questions.filter(q => q.question_type === "essay").length} esai
            </p>

            <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
              Email Peserta *
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrorMsg(""); }}
              placeholder="contoh@email.com"
              style={inputStyle}
              onKeyDown={e => { if (e.key === "Enter") verifyEmail(); }}
            />
            {errorMsg && <p style={{ fontSize: 12, color: "#E74C3C", margin: "8px 0 0" }}>{errorMsg}</p>}

            <button onClick={verifyEmail} style={{ ...btnStyle, marginTop: 18 }}>
              Verifikasi & Mulai
            </button>
          </div>
        )}

        {step === "quiz" && (
          <>
            <div style={boxStyle}>
              <div style={{
                display: "inline-block", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                padding: "2px 8px", borderRadius: 5, marginBottom: 8,
                background: "#EFF6FF", color: "#2563EB",
              }}>
                {phase?.test.type === "test" ? "Pre/Post Test" : "Kuesioner"}
              </div>
              <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>
                {phase?.label}
              </h2>
              <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                Selamat mengerjakan, {umkmName}!
              </p>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} style={boxStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    minWidth: 26, height: 26, borderRadius: "50%",
                    background: "#1E3A5F", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 2,
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14.5, fontWeight: 600, margin: "0 0 4px", lineHeight: 1.5, color: "#1E293B" }}>
                      {q.question_text}
                    </p>
                    {q.points > 1 && (
                      <span style={{ fontSize: 11, color: "#64748B" }}>{q.points} poin</span>
                    )}
                  </div>
                </div>

                {q.question_type === "multiple_choice" && q.options && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.options.map((opt, oi) => (
                      <label key={oi} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", borderRadius: 10,
                        border: `1.5px solid ${answers[q.id] === opt ? "#3B82F6" : "#E2E8F0"}`,
                        background: answers[q.id] === opt ? "#F6FEF8" : "#fff",
                        cursor: "pointer", transition: "all 0.12s",
                        fontSize: 14, color: "#1E293B",
                      }}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswer(q.id, opt)}
                          style={{ accentColor: "#3B82F6", margin: 0 }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}

                {q.question_type === "essay" && (
                  <textarea
                    value={answers[q.id] || ""}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    placeholder="Tulis jawaban Anda..."
                    rows={3}
                    style={{
                      ...inputStyle, marginTop: 14, resize: "vertical",
                      minHeight: 80,
                    }}
                  />
                )}
              </div>
            ))}

            {errorMsg && (
              <p style={{ fontSize: 12, color: "#E74C3C", margin: "0 0 12px", textAlign: "center" }}>{errorMsg}</p>
            )}

            <button
              onClick={submitAnswers}
              disabled={submitting}
              style={{
                ...btnStyle,
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Menyimpan..." : `Kirim ${questions.length} Jawaban`}
            </button>
          </>
        )}

        {step === "submitted" && !alreadySubmitted && (
          <div style={{ ...boxStyle, textAlign: "center", padding: "48px 28px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#EFF6FF", display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
              Jawaban Tersimpan
            </h2>
            <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.6 }}>
              Terima kasih, {umkmName}!<br />
              Jawaban Anda untuk <strong>{phase?.label}</strong> sudah tercatat.
            </p>
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 16 }}>
              Anda bisa tutup halaman ini.
            </p>
          </div>
        )}

        {step === "submitted" && alreadySubmitted && (
          <div style={{ ...boxStyle, textAlign: "center", padding: "48px 28px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#FBEFD6", display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B57A1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
              Sudah Pernah Diisi
            </h2>
            <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.6 }}>
              Halo, {umkmName}!<br />
              Jawaban Anda untuk <strong>{phase?.label}</strong> sudah tercatat sebelumnya. Tidak bisa mengisi ulang.
            </p>
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 16 }}>
              Silakan tutup halaman ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
