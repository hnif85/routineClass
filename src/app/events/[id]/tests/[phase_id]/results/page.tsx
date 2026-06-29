"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Question {
  id: string; question_text: string; question_type: string;
  options: string[] | null; correct_answer: string | null; points: number;
}

interface Answer {
  id: string; question_id: string; umkm_id: string | null;
  answer_text: string; score: number | null;
  umkm: { business_name: string; full_name: string } | null;
}

export default function PhaseResultsPage() {
  const eventId = useParams().id as string;
  const phaseId = useParams().phase_id as string;
  const s = createClient();

  const [ev, setEv] = useState<any>(null);
  const [phase, setPhase] = useState<any>(null);
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [eventId, phaseId]);

  async function loadData() {
    const { data: event } = await s.from("events").select("*").eq("id", eventId).single();
    setEv(event);

    const { data: ph } = await s.from("test_phases").select("*, tests!inner(*)").eq("id", phaseId).single();
    setPhase(ph);
    setTest(ph?.tests);

    const { data: qs } = await s.from("test_questions").select("*").eq("phase_id", phaseId).order("sort_order");
    setQuestions(qs || []);

    if (qs && qs.length > 0) {
      const qIds = qs.map(q => q.id);
      const { data: ans } = await s.from("test_answers")
        .select("*, umkm(business_name, full_name)")
        .in("question_id", qIds).eq("event_id", eventId)
        .order("submitted_at");
      setAnswers(ans || []);
    }

    setLoading(false);
  }

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#73837A" }}>Memuat...</div>;
  if (!ev || !phase) return <div style={{ padding: 48, textAlign: "center", color: "#EF4444" }}>Data tidak ditemukan</div>;

  const isTest = test?.type === "test";
  const isKues = test?.type === "kuesioner";

  // Group answers by question
  const answersByQuestion: Record<string, Answer[]> = {};
  questions.forEach(q => {
    answersByQuestion[q.id] = answers.filter(a => a.question_id === q.id);
  });

  // Per-UMKM scores (test only)
  const umkmScores: Record<string, { umkm: { business_name: string; full_name: string } | null; total: number; max: number; answers: Answer[] }> = {};
  if (isTest) {
    answers.forEach(a => {
      if (!a.umkm_id) return;
      if (!umkmScores[a.umkm_id]) {
        const umkmData = a.umkm ? { business_name: a.umkm.business_name, full_name: a.umkm.full_name } : null;
        umkmScores[a.umkm_id] = { umkm: umkmData, total: 0, max: 0, answers: [] };
      }
      umkmScores[a.umkm_id].answers.push(a);
      umkmScores[a.umkm_id].total += (a.score || 0);
    });
    // Calculate max per question
    questions.forEach(q => {
      Object.values(umkmScores).forEach(u => {
        u.max += q.points;
      });
    });
  }

  // Aggregate stats per question (for kuesioner)
  function getMcDistribution(q: Question): Record<string, number> {
    const opts = (q.options || []) as string[];
    const dist: Record<string, number> = {};
    opts.forEach(o => dist[o] = 0);
    (answersByQuestion[q.id] || []).forEach(a => {
      if (a.answer_text && dist[a.answer_text] !== undefined) dist[a.answer_text]++;
    });
    return dist;
  }

  return (
    <div style={{ animation: "fade-in-up 0.5s ease-out both" }}>
      {/* Back */}
      <Link href={`/events/${eventId}/questions`} style={{
        fontSize: 13, color: "#73837A", fontWeight: 600, textDecoration: "none",
        display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12,
      }} className="hover:text-[#152019]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Kembali
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#1F9D5A", marginBottom: 4 }}>
          Hasil {isTest ? "Test" : "Kuesioner"}
        </div>
        <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {phase.label}
        </h2>
        <p style={{ color: "#73837A", fontSize: 13.5, marginTop: 4 }}>
          {test?.name} · {ev.title}
        </p>
      </div>

      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
        <StatBox label="Total Responden" value={isKues ? answers.length : Object.keys(umkmScores).length} color="#1F9D5A" />
        {isTest && (
          <>
            <StatBox label="Rata-rata Skor" value={
              Object.keys(umkmScores).length > 0
                ? (Object.values(umkmScores).reduce((s, u) => s + u.total, 0) / Object.keys(umkmScores).length).toFixed(1)
                : "-"
            } color="#3C68B5" />
            <StatBox label="Tertinggi" value={
              Object.keys(umkmScores).length > 0
                ? Math.max(...Object.values(umkmScores).map(u => u.total)).toFixed(1)
                : "-"
            } color="#B57A1E" />
          </>
        )}
        {isKues && (
          <>
            <StatBox label="Total Jawaban" value={answers.length} color="#3C68B5" />
            <StatBox label="Soal" value={questions.length} color="#B57A1E" />
          </>
        )}
      </div>

      {/* Per-user table (test only) */}
      {isTest && Object.keys(umkmScores).length > 0 && (
        <div style={{
          background: "#fff", border: "1px solid var(--border)", borderRadius: 18,
          overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: 24,
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "#F8F9F5" }}>
            <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 16, fontWeight: 700 }}>Skor Per Peserta</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8F9F5", borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>#</th>
                  <th style={th}>Usaha</th>
                  <th style={th}>Pemilik</th>
                  {questions.map((q, i) => (
                    <th key={q.id} style={{ ...th, textAlign: "center", minWidth: 50 }}>S{i + 1}</th>
                  ))}
                  <th style={{ ...th, textAlign: "center", color: "#1F9D5A" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(umkmScores)
                  .sort((a, b) => b.total - a.total)
                  .map((u, idx) => {
                    const answerMap: Record<string, Answer> = {};
                    u.answers.forEach(a => { answerMap[a.question_id] = a; });
                    return (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border-2)" }}>
                        <td style={td}>{idx + 1}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{u.umkm?.business_name || "-"}</td>
                        <td style={td}>{u.umkm?.full_name || "-"}</td>
                        {questions.map(q => {
                          const ans = answerMap[q.id];
                          const score = ans?.score;
                          const isCorrect = ans && q.correct_answer && ans.answer_text === q.correct_answer;
                          return (
                            <td key={q.id} style={{ ...td, textAlign: "center" }}>
                              {score !== undefined && score !== null ? (
                                <span style={{
                                  fontWeight: 700,
                                  color: isCorrect ? "#1F9D5A" : "#EF4444",
                                }}>
                                  {score}
                                </span>
                              ) : (
                                <span style={{ color: "#D1D5DB" }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ ...td, textAlign: "center", fontWeight: 800, color: "#1F9D5A", fontFamily: "var(--font-sora)" }}>
                          {u.total}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-question detail */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 16, fontWeight: 700 }}>
          Detail Jawaban Per Soal
        </h3>
        {questions.map((q, idx) => {
          const qAnswers = answersByQuestion[q.id] || [];
          const isMc = q.question_type === "multiple_choice";
          const dist = isMc ? getMcDistribution(q) : {};

          return (
            <div key={q.id} style={{
              background: "#fff", border: "1px solid var(--border)", borderRadius: 18,
              overflow: "hidden", boxShadow: "var(--shadow)",
            }}>
              <div style={{
                padding: "14px 20px", borderBottom: "1px solid var(--border)",
                background: "#F8F9F5",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, background: "#DFF5E8", color: "#1F9D5A",
                  display: "grid", placeItems: "center",
                  fontFamily: "var(--font-sora)", fontSize: 12, fontWeight: 700,
                }}>{idx + 1}</span>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: 6,
                  background: isMc ? "#FBEFD6" : "#E7EEFB", color: isMc ? "#B57A1E" : "#3C68B5",
                }}>{isMc ? "PGC" : "Esai"}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#152019" }}>{q.question_text}</span>
                {isMc && q.correct_answer && (
                  <span style={{ fontSize: 11, color: "#1F9D5A", fontStyle: "italic" }}>
                    (Jawaban: {q.correct_answer})
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#73837A" }}>
                  {qAnswers.length} jawaban · {q.points} poin
                </span>
              </div>

              <div style={{ padding: 16 }}>
                {qAnswers.length === 0 ? (
                  <p style={{ color: "#73837A", fontSize: 13, textAlign: "center", padding: 12 }}>
                    Belum ada jawaban
                  </p>
                ) : isMc ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(q.options as string[] || []).map(opt => {
                      const count = dist[opt] || 0;
                      const pct = qAnswers.length > 0 ? Math.round((count / qAnswers.length) * 100) : 0;
                      const isCorrect = opt === q.correct_answer;
                      return (
                        <div key={opt} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            width: 16, height: 16, borderRadius: "50%", flex: "0 0 auto",
                            background: isCorrect ? "#2FB36B" : "#E7EAE2",
                            display: "grid", placeItems: "center",
                          }}>
                            {isCorrect && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span style={{ flex: "0 0 auto", width: 180, fontWeight: isCorrect ? 700 : 400, fontSize: 13 }}>{opt}</span>
                          <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#F0F2EC", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 999, width: `${pct}%`,
                              background: isCorrect ? "linear-gradient(90deg, #2FB36B, #1F9D5A)" : "#D1D5DB",
                              transition: "width 0.5s",
                            }} />
                          </div>
                          <span style={{ flex: "0 0 50px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#3C4A42" }}>
                            {count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {qAnswers.map(a => (
                      <div key={a.id} style={{
                        padding: "10px 14px", borderRadius: 10,
                        border: "1px solid var(--border-2)", background: "#FAFAF8",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#152019" }}>
                            {a.umkm?.business_name || (isKues ? "Anonim" : "-")} · {a.umkm?.full_name || ""}
                          </span>
                          {a.score !== null && (
                            <span style={{
                              fontSize: 12, fontWeight: 700,
                              color: a.score >= q.points / 2 ? "#1F9D5A" : "#EF4444",
                            }}>
                              {a.score}/{q.points}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: "#3C4A42", whiteSpace: "pre-wrap" }}>{a.answer_text}</p>
                      </div>
                    ))}
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

/* ─── Helpers ─── */
function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--border)", borderRadius: 14,
      padding: "16px 20px", boxShadow: "var(--shadow)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#73837A", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-sora)", fontSize: 26, fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 11,
  fontWeight: 700, textTransform: "uppercase", color: "#73837A",
};
const td: React.CSSProperties = {
  padding: "8px 10px", fontSize: 13, color: "#3C4A42",
};
