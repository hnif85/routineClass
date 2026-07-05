"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#FBEFD6', fg: '#92400e' },
  published: { bg: '#EFF6FF', fg: '#2563EB' },
  ongoing: { bg: '#EFF6FF', fg: '#2563EB' },
  completed: { bg: '#F0F2EC', fg: '#64748B' },
  cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
};

const INV_STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  saved: { bg: '#F0F2EC', fg: '#64748B', label: 'Disimpan' },
  sent: { bg: '#E7EEFB', fg: '#3C68B5', label: 'Terkirim' },
  delivered: { bg: '#EFF6FF', fg: '#2563EB', label: 'Tersampaikan' },
  read: { bg: '#EFF6FF', fg: '#2563EB', label: 'Dibaca' },
  rsvp_yes: { bg: '#EFF6FF', fg: '#2563EB', label: 'Hadir' },
  rsvp_no: { bg: '#FEE2E2', fg: '#991B1B', label: 'Tidak Hadir' },
  attended: { bg: '#EFF6FF', fg: '#2563EB', label: 'Hadir' },
  pending: { bg: '#FBEFD6', fg: '#92400E', label: 'Belum Bayar' },
  confirmed: { bg: '#EFF6FF', fg: '#2563EB', label: 'Terkonfirmasi' },
  cancelled: { bg: '#FEE2E2', fg: '#991B1B', label: 'Dibatalkan' },
};

export default function EventDetailPage() {
  const { push } = useRouter();
  const eventId = useParams().id as string;
  const s = createClient();

  const [ev, setEv] = useState<any>(null);
  const [inv, setInv] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Summary stats
  const [completedTestCount, setCompletedTestCount] = useState(0);
  const [avgPreScore, setAvgPreScore] = useState<number | null>(null);
  const [avgPostScore, setAvgPostScore] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"peserta" | "test" | "materi" | "promo">("peserta");

  // Certificates
  const [certificates, setCertificates] = useState<Record<string, any>>({});
  const [generatingCerts, setGeneratingCerts] = useState<Set<string>>(new Set());

  // Bound tests + completion
  const [boundTests, setBoundTests] = useState<any[]>([]);
  const [promoData, setPromoData] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [kvUploading, setKvUploading] = useState(false);

  async function generatePromo() {
    setPromoLoading(true);
    try {
      const res = await fetch("/api/events/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId }) });
      const data = await res.json();
      console.log("[promo] response:", data);
      if (data.error) { toast.error(data.error); setPromoLoading(false); return; }
      setPromoData(data);
    } catch (e: any) { toast.error("Gagal generate: " + e.message); console.error(e); }
    setPromoLoading(false);
  }

  async function uploadKV(file: File) {
    setKvUploading(true);
    const fileName = `kv-${eventId}-${Date.now()}.png`;
    const { error } = await s.storage.from("umkmConnect").upload(`kv/${fileName}`, file, { contentType: file.type, upsert: true });
    if (error) { toast.error("Upload gagal: " + error.message); setKvUploading(false); return; }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/umkmConnect/kv/${fileName}`;
    await s.from("events").update({ kv_image_url: url }).eq("id", eventId);
    toast.success("KV uploaded!");
    setKvUploading(false);
  }

  const [completionMap, setCompletionMap] = useState<Record<string, Set<string>>>({});

  // ── Event Materials ──
  const [eventMaterials, setEventMaterials] = useState<any[]>([]);
  const [showMateriModal, setShowMateriModal] = useState(false);
  const [materiStep, setMateriStep] = useState<"choose" | "ai" | "preview">("choose");
  const [existingMats, setExistingMats] = useState<any[]>([]);
  const [matSearch, setMatSearch] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiDays, setAiDays] = useState(1);
  const [aiLevel, setAiLevel] = useState<"pemula" | "menengah" | "lanjutan">("pemula");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [savingMateri, setSavingMateri] = useState(false);

  // ── Modal add peserta ──
  const [showModal, setShowModal] = useState(false);
  const [sr, setSr] = useState<any[]>([]);
  const [fc, setFc] = useState(0);
  const [cities, setCities] = useState<string[]>([]);
  const [fCat, setFCat] = useState("all");
  const [fCity, setFCity] = useState("all");
  const [fRev, setFRev] = useState("all");
  const [fNib, setFNib] = useState("all");
  const [fTr, setFTr] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    s.from("events").select("*").eq("id", eventId).single().then(({ data }) => setEv(data));
    loadInv();
    loadBoundTests();
    loadEventMaterials();
    loadCertificates();
    s.from("umkm").select("city").eq("is_active", true).then(({ data }) => setCities([...new Set((data || []).map((d: any) => d.city))]));
  }, [eventId]);

  async function loadCertificates() {
    const { data } = await s.from("certificates")
      .select("id, umkm_id, cert_number, status, issued_at, pre_score, post_score, delta_score")
      .eq("event_id", eventId)
      .eq("status", "issued");
    const map: Record<string, any> = {};
    (data || []).forEach(c => { map[c.umkm_id] = c; });
    setCertificates(map);
  }

  async function generateCertificate(umkmId: string) {
    setGeneratingCerts(prev => new Set(prev).add(umkmId));
    try {
      const res = await fetch("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ umkm_id: umkmId, event_id: eventId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      toast.success(json.message || "Sertifikat berhasil diterbitkan!");
      await loadCertificates();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGeneratingCerts(prev => { const n = new Set(prev); n.delete(umkmId); return n; });
    }
  }

  async function generateAllCertificates() {
    const umkmIds = inv.map(i => i.umkm_id).filter(Boolean);
    const withoutCert = umkmIds.filter(id => !certificates[id]);
    if (withoutCert.length === 0) { toast.info("Semua peserta sudah punya sertifikat"); return; }
    if (!confirm(`Terbitkan sertifikat untuk ${withoutCert.length} peserta yang belum punya?`)) return;
    for (const id of withoutCert) {
      await generateCertificate(id);
    }
    toast.success("Selesai!");
  }

  // Recompute summary stats when inv or boundTests change
  useEffect(() => {
    if (boundTests.length > 0 && inv.length > 0) computeSummaryStats();
  }, [boundTests, inv]);

  async function computeSummaryStats() {
    // Count UMKM who answered ALL questions across all bound test phases
    let completeSet = new Set<string>();
    let first = true;
    for (const bt of boundTests) {
      if (bt.test_phases?.tests?.type !== 'test') continue;
      const { data: qs } = await s.from("test_questions").select("id").eq("phase_id", bt.phase_id);
      const qIds = (qs || []).map(q => q.id);
      if (qIds.length === 0) continue;
      const { data: ans } = await s.from("test_answers").select("umkm_id")
        .in("question_id", qIds).eq("event_id", eventId).not("umkm_id", "is", null);
      const answered = new Set((ans || []).map(a => a.umkm_id));
      // For each phase, count distinct umkm who answered ALL questions in that phase
      // Actually simpler: count distinct umkm who answered at least one question per phase
      if (first) { completeSet = new Set(answered); first = false; }
      else { completeSet = new Set([...completeSet].filter(x => answered.has(x))); }
    }
    if (first) setCompletedTestCount(0);
    else setCompletedTestCount(completeSet.size);

    // Average scores for pre (before) and post (after) phases
    for (const ot of ['before', 'after'] as const) {
      const phases = boundTests.filter(bt => bt.open_time === ot && bt.test_phases?.tests?.type === 'test');
      if (phases.length === 0) continue;
      let totalScore = 0;
      let scoredCount = 0;
      for (const bt of phases) {
        const { data: qs } = await s.from("test_questions").select("id").eq("phase_id", bt.phase_id);
        const qIds = (qs || []).map(q => q.id);
        if (qIds.length === 0) continue;
        const { data: ans } = await s.from("test_answers").select("score")
          .in("question_id", qIds).eq("event_id", eventId).not("score", "is", null);
        for (const a of ans || []) { totalScore += (a.score || 0); scoredCount++; }
      }
      const avg = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : null;
      if (ot === 'before') setAvgPreScore(avg);
      else setAvgPostScore(avg);
    }
  }

  async function loadBoundTests() {
    const { data: phases } = await s.from("event_tests")
      .select("id,open_time,is_open,phase_id,test_phases!inner(id,phase,label,test_id,tests!inner(id,name,type))")
      .eq("event_id", eventId);
    setBoundTests(phases || []);

    const map: Record<string, Set<string>> = {};
    for (const bt of phases || []) {
      const { data: phaseQuestions } = await s.from("test_questions").select("id").eq("phase_id", bt.phase_id);
      const qIds = (phaseQuestions || []).map(q => q.id);
      if (qIds.length > 0) {
        const { data: ans } = await s.from("test_answers").select("umkm_id")
          .in("question_id", qIds).eq("event_id", eventId).not("umkm_id", "is", null);
        map[bt.phase_id] = new Set((ans || []).map(a => a.umkm_id));
      } else {
        map[bt.phase_id] = new Set();
      }
    }
    setCompletionMap(map);
  }

  async function loadEventMaterials() {
    const { data } = await s.from("event_materials")
      .select("id, sort_order, materials(*)")
      .eq("event_id", eventId)
      .order("sort_order");
    setEventMaterials(data || []);
  }

  async function addMaterialToEvent(materialId: string) {
    const { error } = await s.from("event_materials").insert({
      event_id: eventId,
      material_id: materialId,
      sort_order: eventMaterials.length,
    });
    if (error) { toast.error("Gagal: " + error.message); return; }
    toast.success("Materi ditambahkan ke event!");

    // Auto-create pre/post test if material has test_data
    const { data: mat } = await s.from("materials").select("title, test_data").eq("id", materialId).single();
    if (mat && (mat.test_data?.pre_test?.length > 0 || mat.test_data?.post_test?.length > 0)) {
      const td = mat.test_data;
      const { data: test, error: testErr } = await s.from("tests").insert({
        name: `Test: ${mat.title}`,
        description: `Pre/Post test untuk materi "${mat.title}"`,
        type: "test",
      }).select().single();
      if (!testErr && test) {
        // Pre phase
        if (td.pre_test?.length > 0) {
          const { data: prePhase } = await s.from("test_phases").insert({
            test_id: test.id, phase: "pre", label: `Pre-Test: ${mat.title}`, sort_order: 0,
          }).select().single();
          if (prePhase) {
            await s.from("test_questions").insert(
              td.pre_test.map((q: any, i: number) => ({
                phase_id: prePhase.id, question_text: q.question,
                question_type: "multiple_choice", options: q.options,
                correct_answer: typeof q.correct === 'number' ? String.fromCharCode(65 + q.correct) : q.correct,
                points: q.points || 1, sort_order: i,
              }))
            );
            await s.from("event_tests").insert({
              event_id: eventId, phase_id: prePhase.id, open_time: "before",
            });
          }
        }
        // Post phase
        if (td.post_test?.length > 0) {
          const { data: postPhase } = await s.from("test_phases").insert({
            test_id: test.id, phase: "post", label: `Post-Test: ${mat.title}`, sort_order: 1,
          }).select().single();
          if (postPhase) {
            await s.from("test_questions").insert(
              td.post_test.map((q: any, i: number) => ({
                phase_id: postPhase.id, question_text: q.question,
                question_type: "multiple_choice", options: q.options,
                correct_answer: typeof q.correct === 'number' ? String.fromCharCode(65 + q.correct) : q.correct,
                points: q.points || 1, sort_order: i,
              }))
            );
            await s.from("event_tests").insert({
              event_id: eventId, phase_id: postPhase.id, open_time: "after",
            });
          }
        }
        toast.success("Pre/Post test otomatis dibuat!");
        loadBoundTests();
      }
    }

    setShowMateriModal(false);
    loadEventMaterials();
  }

  async function removeMaterial(emId: string, title: string) {
    if (!confirm(`Hapus materi "${title}" dari event ini?`)) return;
    await s.from("event_materials").delete().eq("id", emId);
    toast.success("Materi dihapus");
    loadEventMaterials();
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
      setMateriStep("preview");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAiGenerating(false);
    }
  }

  async function saveGeneratedMaterial() {
    if (!aiResult) return;
    setSavingMateri(true);
    try {
      // Save material
      const { data: mat, error: matErr } = await s.from("materials").insert({
        title: aiResult.title,
        description: aiResult.description,
        content: aiResult.content,
        total_days: aiDays,
        syllabus: aiResult.syllabus,
        is_ai_generated: true,
        test_data: { pre_test: aiResult.pre_test || [], post_test: aiResult.post_test || [] },
      }).select().single();
      if (matErr) throw matErr;

      // Bind to event
      await addMaterialToEvent(mat.id);

      // Auto-create pre/post test
      if (aiResult.pre_test?.length > 0 || aiResult.post_test?.length > 0) {
        // Create test
        const { data: test, error: testErr } = await s.from("tests").insert({
          name: `Test: ${aiResult.title}`,
          description: `Pre/Post test untuk materi "${aiResult.title}"`,
          type: "test",
        }).select().single();
        if (!testErr && test) {
          // Create pre phase
          const { data: prePhase } = await s.from("test_phases").insert({
            test_id: test.id, phase: "pre", label: `Pre-Test: ${aiResult.title}`, sort_order: 0,
          }).select().single();
          // Create pre questions
          if (prePhase && aiResult.pre_test?.length > 0) {
            await s.from("test_questions").insert(
              aiResult.pre_test.map((q: any, i: number) => ({
                phase_id: prePhase.id,
                question_text: q.question,
                question_type: "multiple_choice",
                options: q.options,
                correct_answer: String.fromCharCode(65 + (q.correct || 0)),
                points: q.points || 1,
                sort_order: i,
              }))
            );
            await s.from("event_tests").insert({
              event_id: eventId, phase_id: prePhase.id, open_time: "before",
            });
          }

          // Create post phase
          const { data: postPhase } = await s.from("test_phases").insert({
            test_id: test.id, phase: "post", label: `Post-Test: ${aiResult.title}`, sort_order: 1,
          }).select().single();
          if (postPhase && aiResult.post_test?.length > 0) {
            await s.from("test_questions").insert(
              aiResult.post_test.map((q: any, i: number) => ({
                phase_id: postPhase.id,
                question_text: q.question,
                question_type: "multiple_choice",
                options: q.options,
                correct_answer: String.fromCharCode(65 + (q.correct || 0)),
                points: q.points || 1,
                sort_order: i,
              }))
            );
            await s.from("event_tests").insert({
              event_id: eventId, phase_id: postPhase.id, open_time: "after",
            });
          }
          loadBoundTests();
        }
      }

      toast.success("Materi & test berhasil dibuat!");
      setShowMateriModal(false);
      setMateriStep("choose");
      setAiTopic("");
      setAiResult(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingMateri(false);
    }
  }

  async function loadInv() {
    const { data } = await s.from("event_invitations")
      .select("*, umkm(id,business_name, full_name, whatsapp)")
      .eq("event_id", eventId);
    setInv(data || []);
    setLoading(false);
  }

  async function changeStatus(to: "draft" | "published" | "ongoing" | "completed" | "cancelled") {
    const msg: Record<string, string> = {
      draft: "dikembalikan ke draft", published: "dipublikasikan", ongoing: "dimulai",
      completed: "diselesaikan", cancelled: "dibatalkan",
    };
    const confirmText: Record<string, string> = {
      draft: "Kembalikan event ke status draft?",
      published: "Publikasikan event ini sekarang?",
      ongoing: "Mulai event ini sekarang?",
      completed: "Tandai event sebagai selesai?",
      cancelled: "Batalkan event ini? Semua undangan & test akan tertutup.",
    };
    if (!confirm(confirmText[to] || `Ubah status?`)) return;

    const res = await fetch(`/api/events/${eventId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Gagal mengubah status event");
      return;
    }

    toast.success(`Event ${msg[to]}!`);
    setEv((prev: any) => ({ ...prev, status: to }));
  }

  // ── Modal search ──
  async function searchUMKM() {
    setModalLoading(true);
    let q = s.from("umkm").select("id,business_name,full_name,whatsapp,business_category,city,monthly_revenue_estimate,has_nib", { count: "exact" })
      .eq("is_active", true);
    if (fCat !== "all") q = q.contains("business_category", [fCat]);
    if (fCity !== "all") q = q.ilike("city", `%${fCity}%`);
    if (fRev !== "all") q = q.eq("monthly_revenue_estimate", fRev);
    if (fNib === "no") q = q.eq("has_nib", false);
    else if (fNib === "yes") q = q.eq("has_nib", true);
    if (fTr === "never") q = q.eq("training_frequency_last_year", "belum_pernah");
    if (searchQ.trim()) q = q.or(`business_name.ilike.%${searchQ.trim()}%,full_name.ilike.%${searchQ.trim()}%,whatsapp.ilike.%${searchQ.trim()}%`);
    const { data, count } = await q.limit(200);
    setSr(data || []);
    setFc(count || 0);
    setSelectedIds(new Set());
    setSelectAll(false);
    setModalLoading(false);
  }

  // Auto-search when modal opens
  useEffect(() => {
    if (showModal) searchUMKM();
  }, [showModal]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectAll) {
      setSelectedIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedIds(new Set(sr.map(u => u.id)));
      setSelectAll(true);
    }
  }

  async function saveParticipants() {
    if (selectedIds.size === 0) { toast.error("Pilih minimal 1 peserta"); return; }
    const existing = new Set(inv.map(i => i.umkm_id));
    const toAdd = [...selectedIds].filter(id => !existing.has(id));
    if (toAdd.length === 0) { toast.info("Semua sudah terdaftar sebagai peserta"); return; }
    const { error } = await s.from("event_invitations").insert(
      toAdd.map(id => ({ event_id: eventId, umkm_id: id, status: "saved" }))
    );
    if (error) toast.error("Gagal: " + error.message);
    else { toast.success(`${toAdd.length} peserta ditambahkan!`); setShowModal(false); loadInv(); }
  }

  async function sendInvitation(umkmId?: string) {
    const targets = umkmId ? inv.filter(i => i.umkm_id === umkmId) : inv;
    if (targets.length === 0) { toast.error("Tidak ada peserta"); return; }
    setSending(true);
    let success = 0;
    for (const t of targets) {
      const { error } = await s.from("event_invitations").update({
        status: "sent", sent_at: new Date().toISOString(),
      }).eq("id", t.id);
      if (!error) success++;
    }
    if (success > 0) toast.success(`${success} undangan dikirim!`);
    if (success < targets.length) toast.error(`${targets.length - success} gagal`);
    loadInv();
    setSending(false);
  }

  async function removeParticipant(invId: string, name: string) {
    if (!confirm(`Hapus ${name} dari daftar peserta?`)) return;
    await s.from("event_invitations").delete().eq("id", invId);
    toast.success("Peserta dihapus");
    loadInv();
  }

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>Memuat...</div>;
  if (!ev) return <div style={{ padding: 48, textAlign: 'center', color: '#EF4444' }}>Event tidak ditemukan</div>;

  const st = STATUS_STYLES[ev.status] || STATUS_STYLES.draft;
  const sel = "w-full bg-white border border-[var(--border)] rounded-[12px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";
  const d = new Date(ev.start_date);

  const notSent = inv.filter(i => i.status === "saved" || i.status === "draft");

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Back */}
      <Link href="/events" className="hover:text-[var(--ink)]" style={{
        fontSize: 13, color: '#64748B', fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center',
        gap: 4, marginBottom: 12, textDecoration: 'none',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Kembali
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563EB', marginBottom: 4 }}>
            Event Detail
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {ev.title}
          </h2>
          <p style={{ color: '#64748B', fontSize: 13.5, marginTop: 6 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
              <rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
            {d.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {ev.start_time && ` ${ev.start_time}`}
            {ev.end_date && ` — ${new Date(ev.end_date).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
          </p>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: st.bg, color: st.fg }}>
          {ev.status}
        </span>
      </div>

      {/* Meta chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <span style={chipStyle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.4" />
          </svg>
          {ev.location || "Online"}
        </span>
        <span style={chipStyle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {ev.quota ? `${ev.quota} peserta` : "Tak terbatas"}
        </span>
        <span style={chipStyle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          {ev.speaker_name ? (
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {ev.speaker_name.split(", ").map((name: string, i: number) => (
                <span key={i} style={{ 
                  background: name.match(/@/) ? '#DBEAFE' : '#FFF7ED',
                  color: name.match(/@/) ? '#1E40AF' : '#9A3412',
                  padding: '1px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600
                }}>{name}</span>
              ))}
            </span>
          ) : "-"}
        </span>
        <span style={{ ...chipStyle, background: '#F0F2EC', fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {ev.type || "offline"}
        </span>
        <span style={{ ...chipStyle, background: ev.registration_type === "invitation" ? '#EFF6FF' : '#FBEFD6' }}>
          {ev.registration_type === "invitation" ? "Undangan" : ev.registration_type === "open" ? "Terbuka" : "Keduanya"}
        </span>
      </div>

      {/* ─── Tab Bar ─── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid var(--border)" }}>
        <TabButton active={activeTab === "peserta"} onClick={() => setActiveTab("peserta")}>
          Peserta ({inv.length})
        </TabButton>
        {boundTests.length > 0 && (
          <TabButton active={activeTab === "test"} onClick={() => setActiveTab("test")}>
            Test ({boundTests.length})
          </TabButton>
        )}
        <TabButton active={activeTab === "materi"} onClick={() => setActiveTab("materi")}>
          Materi ({eventMaterials.length})
        </TabButton>
        <TabButton active={activeTab === "promo"} onClick={() => { setActiveTab("promo"); if (!promoData) generatePromo(); }}>
          🚀 Admin + Promo
        </TabButton>
      </div>

      {/* ════════════════════════════ Status Actions (always visible) ════════════════ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {ev.status === "draft" && (
          <button onClick={() => changeStatus("published")} style={{
            padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M5 12l5 5L20 7" />
            </svg>
            Publikasikan
          </button>
        )}
        {ev.status === "published" && (
          <>
            <button onClick={() => changeStatus("ongoing")} style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: '#E2A33A', color: '#fff',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Mulai Event
            </button>
            <button onClick={() => changeStatus("cancelled")} style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: '1px solid #FCA5A5', cursor: 'pointer',
              background: '#fff', color: '#DC2626',
            }}>
              Batalkan
            </button>
          </>
        )}
        {ev.status === "ongoing" && (
          <>
            <button onClick={() => changeStatus("completed")} style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              background: '#1E3A5F', color: '#fff',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                <path d="M5 12l5 5L20 7" />
              </svg>
              Selesaikan Event
            </button>
            <button onClick={() => changeStatus("cancelled")} style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: '1px solid #FCA5A5', cursor: 'pointer',
              background: '#fff', color: '#DC2626',
            }}>
              Batalkan
            </button>
          </>
        )}
        {ev.status === "completed" && (
          <span style={{
            fontSize: 12.5, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 8, background: '#F0F2EC',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
            </svg>
            Event sudah selesai. Tidak ada aksi yang tersedia.
          </span>
        )}
        {ev.status === "cancelled" && (
          <button onClick={() => changeStatus("draft")} style={{
            padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: '1px solid var(--border)', cursor: 'pointer',
            background: '#fff', color: '#1E293B',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M3 12h4l3-9 4 18 3-9h4" />
            </svg>
            Aktifkan Kembali (Draft)
          </button>
        )}
      </div>

      {/* ════════════════════════════ TAB: Peserta ════════════════════════════ */}
      {activeTab === "peserta" && (
        <div>
          {/* ── Summary Cards ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12, marginBottom: 20,
          }}>
            {[
              { label: 'Total Diundang', value: inv.length, color: '#3B82F6', icon: 'M17 20v-9a4 4 0 00-4-4H5a4 4 0 00-4 4v9m8-4v4m8-9v9m-4-4v4' },
              { label: 'Hadir', value: inv.filter(i => i.status === 'attended').length, color: '#2563EB', icon: 'M5 12l5 5L20 7' },
              { label: 'Isi Test Lengkap', value: completedTestCount, color: '#E2A33A', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            ].map((card, i) => (
              <div key={i} style={{
                background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
                padding: '16px 18px', boxShadow: 'var(--shadow)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={card.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ width: 18, height: 18, flex: '0 0 auto' }}>
                    <path d={card.icon} />
                  </svg>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                    {card.label}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 28, fontWeight: 700, color: '#1E293B', lineHeight: 1 }}>
                  {card.value}
                </span>
              </div>
            ))}
            {/* Pre-test avg score */}
            {avgPreScore !== null && (
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
                padding: '16px 18px', boxShadow: 'var(--shadow)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3C68B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ width: 18, height: 18, flex: '0 0 auto' }}>
                    <path d="M12 20V10M18 20V4M6 20v-4" />
                  </svg>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                    Rata² Pre-Test
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 28, fontWeight: 700, color: '#1E293B', lineHeight: 1 }}>
                  {avgPreScore}
                </span>
              </div>
            )}
            {/* Post-test avg score */}
            {avgPostScore !== null && (
              <div style={{
                background: '#fff', borderRadius: 14, border: '1px solid var(--border)',
                padding: '16px 18px', boxShadow: 'var(--shadow)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#B57A1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ width: 18, height: 18, flex: '0 0 auto' }}>
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                    Rata² Post-Test
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-sora)', fontSize: 28, fontWeight: 700, color: '#1E293B', lineHeight: 1 }}>
                  {avgPostScore}
                </span>
              </div>
            )}
          </div>

          {/* ── Participant Table ── */}
          <div style={{
            background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
            overflow: 'hidden', boxShadow: 'var(--shadow)',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border)', background: '#F8FAFE',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700 }}>
                Daftar Peserta
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Tambah Peserta
                </button>
                <button onClick={() => { const link = `${window.location.origin}/daftar/${eventId}`; navigator.clipboard.writeText(link); toast.success("Link pendaftaran disalin!"); }} className="btn" style={{
                  padding: '8px 16px', fontSize: 13, color: '#2563EB',
                  border: '1px solid #3B82F6', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  📋 Copy Link Daftar
                </button>
                {(ev.status === "published" || ev.status === "ongoing") && notSent.length > 0 && (
                  <button onClick={() => sendInvitation()} disabled={sending} className="btn" style={{
                    padding: '8px 16px', fontSize: 13, color: '#2563EB',
                    border: '1px solid #3B82F6',
                  }}>
                    {sending ? "Mengirim..." : `Kirim Undangan (${notSent.length})`}
                  </button>
                )}
                {ev.status === "completed" && (
                  <button onClick={generateAllCertificates} className="btn" style={{
                    padding: '8px 16px', fontSize: 13, color: '#1E3A5F',
                    border: '1px solid #1E3A5F',
                  }}>
                    🏆 Terbitkan Semua Sertifikat
                  </button>
                )}
              </div>
            </div>

            {inv.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: '#64748B' }}>
                Belum ada peserta. Klik "Tambah Peserta" untuk mulai.
              </div>
            ) : (
              <div>
                {/* Header row */}
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '8px 20px',
                  background: '#F8FAFE', borderBottom: '1px solid var(--border-2)',
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', gap: 10,
                }}>
                  <span style={{ flex: '2 0 0' }}>Usaha</span>
                  <span style={{ width: 120 }}>Pemilik</span>
                  <span style={{ width: 130 }}>WA</span>
                  <span style={{ width: 90, textAlign: 'center' }}>Status</span>
                  <span style={{ width: 100, textAlign: 'center' }}>Sertifikat</span>
                  <span style={{ width: 80, textAlign: 'center' }}>Aksi</span>
                </div>

                {inv.map((i, idx) => {
                  const st = INV_STATUS_STYLES[i.status] || { bg: '#F0F2EC', fg: '#64748B', label: i.status };
                  return (
                    <div key={i.id} style={{
                      display: 'flex', alignItems: 'center', padding: '10px 20px',
                      borderBottom: idx < inv.length - 1 ? '1px solid var(--border-2)' : 'none',
                      fontSize: 13, gap: 10,
                    }} className="hover:bg-[#F8FAFE]">
                      <span style={{ flex: '2 0 0', fontSize: 13.5 }}>
                        {i.umkm_id ? (
                          <Link href={`/umkm/${i.umkm_id}?returnTo=/events/${eventId}`} style={{
                            fontWeight: 700, color: '#1E293B', textDecoration: 'none',
                          }} className="hover:underline">
                            {i.umkm?.business_name || i.business_name || '-'}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 700, color: '#1E293B' }}>
                            {i.business_name || i.full_name || '-'}
                          </span>
                        )}
                      </span>
                      <span style={{ color: '#475569', width: 120 }}>{i.umkm?.full_name || i.full_name || '-'}</span>
                      <span style={{ color: '#64748B', fontSize: 12, fontFamily: 'monospace', width: 130 }}>
                        {i.umkm?.whatsapp || i.phone_number || '-'}
                      </span>
                      <span style={{ width: 90, textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: st.bg, color: st.fg, whiteSpace: 'nowrap',
                        }}>
                          {st.label}
                        </span>
                      </span>
                      {/* Certificate cell */}
                      <span style={{ width: 100, textAlign: 'center' }}>
                        {certificates[i.umkm_id] ? (
                          <a href={`/api/certificates/${certificates[i.umkm_id].id}`}
                            style={{
                              fontSize: 11, fontWeight: 600, color: '#2563EB', textDecoration: 'none',
                              background: '#EFF6FF', padding: '2px 8px', borderRadius: 999,
                              whiteSpace: 'nowrap', display: 'inline-block',
                            }}>
                            ✅ {certificates[i.umkm_id].cert_number?.split('/').pop() || 'Ada'}
                          </a>
                        ) : ev.status === "completed" ? (
                          <button
                            onClick={() => generateCertificate(i.umkm_id)}
                            disabled={generatingCerts.has(i.umkm_id)}
                            title="Terbitkan sertifikat"
                            style={{
                              border: '1px dashed #3B82F6', background: 'transparent', color: '#3B82F6',
                              padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                              cursor: generatingCerts.has(i.umkm_id) ? 'wait' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}>
                            {generatingCerts.has(i.umkm_id) ? '...' : '+ Terbitkan'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#64748B' }}>—</span>
                        )}
                      </span>
                      <span style={{ width: 80, textAlign: 'center' }}>
                        {i.status === 'saved' || i.status === 'draft' ? (
                          <button onClick={() => sendInvitation(i.umkm_id)} disabled={sending}
                            title="Kirim undangan"
                            style={{
                              border: 'none', background: '#E7EEFB', color: '#3C68B5',
                              padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              cursor: 'pointer',
                            }}>
                            Kirim
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748B' }}>—</span>
                        )}
                        <button onClick={() => removeParticipant(i.id, i.umkm?.business_name || '')}
                          title="Hapus"
                          style={{
                            border: 'none', background: 'none', color: '#DC2626',
                            padding: '4px 6px', cursor: 'pointer', fontSize: 13, marginLeft: 4,
                          }}>
                          ✕
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════ TAB: Test ════════════════════════════ */}
      {activeTab === "test" && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
          overflow: 'hidden', boxShadow: 'var(--shadow)',
        }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700 }}>
              Pre/Post Test & Kuesioner
            </h3>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {boundTests.map(bt => {
              const phase = bt.test_phases;
              const test = phase?.tests;
              const answered = completionMap[bt.phase_id] || new Set();
              const total = inv.length;
              const done = answered.size;

              return (
                <div key={bt.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12,
                  border: '1px solid var(--border-2)', background: '#FAFAF8',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                        padding: '2px 6px', borderRadius: 5,
                        background: test?.type === 'test' ? '#EFF6FF' : '#FBEFD6',
                        color: test?.type === 'test' ? '#2563EB' : '#B57A1E',
                      }}>
                        {test?.type === 'test' ? 'Test' : 'Kuesioner'}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{phase?.label}</span>
                      {test?.name && <span style={{ fontSize: 12, color: '#64748B' }}>({test.name})</span>}
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                        background: bt.open_time === 'before' ? '#E7EEFB' : bt.open_time === 'during' ? '#EFF6FF' : '#F0F2EC',
                        color: bt.open_time === 'before' ? '#3C68B5' : bt.open_time === 'during' ? '#2563EB' : '#64748B',
                      }}>
                        {bt.open_time === 'before' ? 'Sebelum' : bt.open_time === 'during' ? 'Saat' : 'Setelah'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 8, borderRadius: 999, background: '#F0F2EC', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 999,
                          width: total > 0 ? `${(done / total) * 100}%` : '0%',
                          background: 'linear-gradient(90deg, #3B82F6, #2563EB)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                        {done}/{total} diisi
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginLeft: 16, flex: '0 0 auto' }}>
                    <Link href={`/events/${eventId}/questions`} style={{
                      padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                      textDecoration: 'none', color: '#1E293B',
                    }}>
                      Detail Hasil
                    </Link>
                    <Link href={`/events/${eventId}/tests/${bt.phase_id}/results`} style={{
                      padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      border: 'none', cursor: 'pointer', textDecoration: 'none',
                      background: '#1E3A5F', color: '#fff',
                    }}>
                      Lihat Hasil
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════ TAB: Materi ════════════════════════════ */}
      {activeTab === "materi" && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
          overflow: 'hidden', boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)', background: '#F8FAFE',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700 }}>
              Materi Pelatihan
            </h3>
            <button onClick={() => { setMateriStep("choose"); setShowMateriModal(true); setExistingMats([]); }} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Tambah Materi
            </button>
          </div>

          {eventMaterials.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', fontSize: 13, color: '#64748B' }}>
              Belum ada materi. Klik "Tambah Materi" untuk menambahkan materi pelatihan.
            </div>
          ) : (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {eventMaterials.map((em: any, idx) => {
                const m = em.materials;
                return (
                  <div key={em.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '14px 16px', borderRadius: 14,
                    border: '1px solid var(--border-2)', background: '#FAFAF8',
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flex: '0 0 auto',
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M20 2v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20Z" />
                        {m.is_ai_generated && <path d="M12 2v4m-3 2 3 3 3-3" />}
                      </svg>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B', marginBottom: 4 }}>
                        {m.title}
                        {m.is_ai_generated && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, marginLeft: 8, padding: '2px 5px',
                            borderRadius: 5, background: '#E7EEFB', color: '#3C68B5', verticalAlign: 'middle',
                          }}>
                            AI
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p style={{ fontSize: 12.5, color: '#475569', marginBottom: 6, lineHeight: 1.4 }}>{m.description}</p>
                      )}
                      <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: '#64748B' }}>
                        <span>{m.total_days || 1} hari</span>
                        <span>{Array.isArray(m.syllabus) ? m.syllabus.length : 0} sesi</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
                      <button onClick={() => removeMaterial(em.id, m.title)}
                        style={{
                          border: 'none', background: 'none', color: '#DC2626',
                          padding: '4px 8px', cursor: 'pointer', fontSize: 13,
                        }} title="Hapus dari event">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════ MODAL: Tambah Materi ════════════════════════════ */}
      {showMateriModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) { setShowMateriModal(false); setMateriStep("choose"); setAiResult(null); } }}>
          <div style={{
            background: '#F4F7FC', borderRadius: 20,
            width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--border)',
              background: '#fff', borderRadius: '20px 20px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 18, fontWeight: 700, margin: 0 }}>
                {materiStep === "choose" ? "Tambah Materi" : materiStep === "ai" ? "Buat Materi dengan AI" : "Preview Materi"}
              </h3>
              <button onClick={() => { setShowMateriModal(false); setMateriStep("choose"); setAiResult(null); }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B', fontSize: 20 }}>
                ✕
              </button>
            </div>

            <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
              {/* Step: Choose */}
              {materiStep === "choose" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Option 1: Existing library */}
                  <div style={{
                    border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                        Pilih dari Library
                      </h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <input value={matSearch} onChange={e => setMatSearch(e.target.value)}
                        placeholder="Cari materi yang sudah ada..."
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 10,
                          border: '1px solid var(--border)', fontSize: 12.5, outline: 'none',
                          marginBottom: 10, boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflow: 'auto' }}>
                        {(existingMats.length === 0 && matSearch.length < 2) ? (
                          // Load existing materials when user starts typing or clicks
                          <div style={{ textAlign: 'center', padding: 16 }}>
                            <button onClick={async () => {
                              const { data } = await s.from("materials").select("*").order("created_at", { ascending: false });
                              setExistingMats(data || []);
                              if (!data?.length) toast("Belum ada materi");
                            }} style={{
                              border: '1px solid var(--border)', background: '#fff', padding: '8px 16px',
                              borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#3C68B5',
                            }}>
                              Muat Library Materi
                            </button>
                          </div>
                        ) : (
                          existingMats
                            .filter(m => !matSearch || m.title.toLowerCase().includes(matSearch.toLowerCase()))
                            .map(m => (
                              <div key={m.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-2)',
                                cursor: 'pointer',
                              }} className="hover:bg-[#F8FAFE]"
                                onClick={() => addMaterialToEvent(m.id)}>
                                <div>
                                  <span style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</span>
                                  <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8 }}>
                                    {m.total_days} hari • {m.is_ai_generated ? 'AI' : 'Manual'}
                                  </span>
                                </div>
                                <button style={{
                                  border: 'none', background: '#1E3A5F', color: '#fff',
                                  padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                                }}>
                                  Pilih
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Create with AI */}
                  <div style={{
                    border: '1px solid var(--border)', borderRadius: 14, background: '#fff', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F8FAFE' }}>
                      <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                        Buat Baru dengan AI (DeepSeek)
                      </h4>
                    </div>
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 12.5, color: '#64748B', marginBottom: 12 }}>
                        Masukkan topik yang ingin diajarkan. AI akan melakukan riset dan membuat materi lengkap
                        berikut pre-test dan post-test.
                      </p>
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
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step: Preview */}
              {materiStep === "preview" && aiResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Title + Desc */}
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                    <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{aiResult.title}</h3>
                    <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{aiResult.description}</p>
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: '#64748B' }}>
                      <span><strong>{aiDays}</strong> hari</span>
                      <span><strong>{aiResult.syllabus?.length || 0}</strong> sesi</span>
                      <span>Tingkat: {aiLevel}</span>
                    </div>
                  </div>

                  {/* Syllabus */}
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
                            fontSize: 11, fontWeight: 700, flex: '0 0 auto',
                          }}>{s.day}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{s.topic}</span>
                          <span style={{ fontSize: 11.5, color: '#64748B' }}>{s.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tests preview */}
                  {(aiResult.pre_test?.length > 0 || aiResult.post_test?.length > 0) && (
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                        ⚡ Akan dibuatkan Pre-Test ({aiResult.pre_test?.length || 0} soal) & Post-Test ({aiResult.post_test?.length || 0} soal)
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setMateriStep("ai")} style={{
                      padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                    }}>
                      Regenerate
                    </button>
                    <button onClick={saveGeneratedMaterial} disabled={savingMateri}
                      className="btn btn-primary" style={{
                        padding: '10px 24px', fontSize: 13, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      {savingMateri ? "Menyimpan..." : "Simpan & Tambahkan ke Event"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════ PROMO ADMIN TAB ════════════════════════════ */}
      {activeTab === "promo" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {promoLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>⏳ Generate materi promo...</div>
          ) : promoData ? (
            <>
              {/* Section 1: KV Prompt */}
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>🎨 KV Prompt</h3>
                <p style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>Copy prompt ini ke AI Image Generator atau Canva</p>
                <pre style={{ background: '#F4F7FC', padding: 14, borderRadius: 12, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)' }}>{promoData.kvPrompt}</pre>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => { navigator.clipboard.writeText(promoData.kvPrompt); toast.success("Prompt disalin!"); }}
                    style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>📋 Copy Prompt</button>
                  <span style={{ fontSize: 12, color: '#64748B' }}>atau upload KV:</span>
                  <label style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#2563EB', color: '#fff', cursor: 'pointer' }}>
                    {kvUploading ? 'Uploading...' : '📤 Upload KV'}
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadKV(f); }} style={{ display: 'none' }} />
                  </label>
                  {ev.kv_image_url && <a href={ev.kv_image_url} target="_blank" style={{ fontSize: 12, color: '#2563EB' }}>Lihat KV</a>}
                </div>
              </div>

              {/* Section 2: Surat Permohonan */}
              {promoData.surat && (
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>📄 Surat Permohonan SMESCO</h3>
                  <pre style={{ background: '#FAFAF8', padding: 14, borderRadius: 12, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', fontFamily: 'monospace' }}>{promoData.surat}</pre>
                  <button onClick={() => { navigator.clipboard.writeText(promoData.surat); toast.success("Surat disalin!"); }}
                    style={{ marginTop: 10, padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>📋 Copy Surat</button>
                </div>
              )}

              {/* Section 3: WA Blast */}
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>💬 Copy WA Blast</h3>
                {[
                  { label: 'H-5 — Pendaftaran', text: promoData.waBlast.h5 },
                  { label: 'H-1 — Reminder', text: promoData.waBlast.h1 },
                  { label: 'H+1 — Follow-up', text: promoData.waBlast.h1_after },
                ].map((w, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>{w.label}</span>
                      <button onClick={() => { navigator.clipboard.writeText(w.text); toast.success(`${w.label} disalin!`); }}
                        style={{ fontSize: 10, border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Copy</button>
                    </div>
                    <pre style={{ background: '#F4F7FC', padding: 10, borderRadius: 10, fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto', border: '1px solid var(--border)' }}>{w.text}</pre>
                  </div>
                ))}
              </div>

              {/* Section 4: Instagram */}
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>📸 Copy Instagram</h3>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>Caption Feed</span>
                    <button onClick={() => { navigator.clipboard.writeText(promoData.ig.caption); toast.success("Caption disalin!"); }}
                      style={{ fontSize: 10, border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Copy</button>
                  </div>
                  <pre style={{ background: '#F4F7FC', padding: 10, borderRadius: 10, fontSize: 11.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto', border: '1px solid var(--border)' }}>{promoData.ig.caption}</pre>
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>Hashtag</span>
                  <pre style={{ background: '#F4F7FC', padding: 8, borderRadius: 10, fontSize: 11, marginTop: 4, border: '1px solid var(--border)' }}>{promoData.ig.hashtags}</pre>
                </div>
              </div>

              {/* Section 5: Checklist & Rundown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>✅ Checklist Pra-Event</h3>
                  {promoData.checklist.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < promoData.checklist.length - 1 ? '1px solid var(--border-2)' : 'none', fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#2563EB', minWidth: 42 }}>{c.phase}</span>
                      <span style={{ flex: 1, color: '#1E293B' }}>{c.task}</span>
                      <span style={{ color: '#64748B', fontSize: 11 }}>{c.pic}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: 20 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>⏱ Rundown Hari H</h3>
                  {promoData.rundown.map((r: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < promoData.rundown.length - 1 ? '1px solid var(--border-2)' : 'none', fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: '#2563EB', minWidth: 64 }}>{r.time}</span>
                      <span style={{ flex: 1, color: '#1E293B' }}>{r.aktivitas}</span>
                      <span style={{ color: '#64748B', fontSize: 11 }}>{r.pic}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <button onClick={generatePromo} style={{ padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: '#2563EB', color: '#fff', border: 'none', cursor: 'pointer' }}>
                🚀 Generate Materi Promo
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════ MODAL Tambah Peserta ════════════════════════════ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{
            background: '#F4F7FC', borderRadius: 20,
            width: '100%', maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--border)',
              background: '#fff', borderRadius: '20px 20px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 18, fontWeight: 700, margin: 0 }}>
                Pilih Peserta
              </h3>
              <button onClick={() => setShowModal(false)} style={{
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 20, color: '#64748B', padding: '0 4px',
              }}>
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
              {/* Search */}
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchUMKM(); }}
                placeholder="🔍  Cari nama usaha / pemilik / WA..."
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 14,
                  border: '1.5px solid var(--border)', borderRadius: 12,
                  outline: 'none', boxSizing: 'border-box',
                  background: '#fff', marginBottom: 14,
                }}
              />

              {/* Filters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  {
                    l: "Kategori", v: fCat, s: setFCat,
                    o: [{ v: "all", l: "Semua" }, { v: "makanan_minuman", l: "Makanan" }, { v: "fashion_apparel", l: "Fashion" }, { v: "kecantikan_perawatan", l: "Kecantikan" }, { v: "jasa", l: "Jasa" }, { v: "kerajinan_handmade", l: "Kerajinan" }, { v: "agribisnis", l: "Agribisnis" }],
                  },
                  { l: "Kota", v: fCity, s: setFCity, o: [{ v: "all", l: "Semua" }, ...cities.map(c => ({ v: c, l: c }))] },
                  { l: "Omzet", v: fRev, s: setFRev, o: [{ v: "all", l: "Semua" }, { v: "<5jt", l: "<5jt" }, { v: "5-15jt", l: "5-15jt" }, { v: "15-50jt", l: "15-50jt" }, { v: ">50jt", l: ">50jt" }] },
                  { l: "NIB", v: fNib, s: setFNib, o: [{ v: "all", l: "Semua" }, { v: "no", l: "Belum" }, { v: "yes", l: "Punya" }] },
                  { l: "Pelatihan", v: fTr, s: setFTr, o: [{ v: "all", l: "Semua" }, { v: "never", l: "Belum Pernah" }] },
                ].map(f => (
                  <div key={f.l}>
                    <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 4, display: 'block' }}>
                      {f.l}
                    </label>
                    <select value={f.v} onChange={e => { f.s(e.target.value); setTimeout(searchUMKM, 0); }} className={sel}>
                      {f.o.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Search button + results count */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={searchUMKM} className="btn" style={{ padding: '7px 14px', fontSize: 12.5 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
                  </svg>
                  Cari
                </button>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {fc} ditemukan
                </span>
              </div>

              {/* Results */}
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748B', fontSize: 13 }}>Mencari...</div>
              ) : sr.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#64748B', fontSize: 13 }}>Tidak ada UMKM ditemukan</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Select all */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                    background: '#F8FAFE', borderBottom: '1px solid var(--border)',
                    fontSize: 12.5, fontWeight: 600, color: '#475569', cursor: 'pointer',
                  }} onClick={toggleSelectAll}>
                    <input type="checkbox" checked={selectAll} readOnly
                      style={{ accentColor: '#3B82F6', margin: 0, cursor: 'pointer' }} />
                    Pilih Semua ({sr.length})
                  </div>

                  {sr.map(u => {
                    const invited = inv.some(i => i.umkm_id === u.id);
                    const checked = selectedIds.has(u.id);
                    return (
                      <div key={u.id} onClick={() => { if (!invited) toggleSelect(u.id); }} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                        borderBottom: '1px solid var(--border-2)',
                        background: invited ? '#F0F2EC' : checked ? '#F6FEF8' : 'transparent',
                        cursor: invited ? 'default' : 'pointer',
                        fontSize: 13,
                      }} className="hover:bg-[#FAFAF8]">
                        <input
                          type="checkbox"
                          checked={checked || invited}
                          disabled={invited}
                          readOnly
                          style={{ accentColor: '#3B82F6', margin: 0, cursor: invited ? 'default' : 'pointer' }}
                        />
                        <span style={{ flex: '2 0 0', fontWeight: 700, color: '#1E293B' }}>{u.business_name}</span>
                        <span style={{ width: 120, color: '#475569' }}>{u.full_name}</span>
                        <span style={{ width: 110, color: '#64748B', fontSize: 12, fontFamily: 'monospace' }}>{u.whatsapp}</span>
                        <span style={{ width: 80, color: '#64748B', fontSize: 12 }}>{u.city}</span>
                        {invited && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: '#E2E8F0', color: '#64748B' }}>
                            Sudah
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{
              padding: '12px 22px', borderTop: '1px solid var(--border)',
              background: '#fff', borderRadius: '0 0 20px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12.5, color: '#64748B' }}>
                {selectedIds.size} dipilih{selectedIds.size > 0 && ` (${[...selectedIds].filter(id => !inv.some(i => i.umkm_id === id)).length} baru)`}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowModal(false)} className="btn" style={{ padding: '8px 16px', fontSize: 13 }}>
                  Batal
                </button>
                <button onClick={saveParticipants} disabled={selectedIds.size === 0} className="btn btn-primary" style={{
                  padding: '8px 16px', fontSize: 13,
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                }}>
                  Simpan {selectedIds.size} Peserta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 20px", fontSize: 13.5, fontWeight: active ? 700 : 600,
      border: "none", background: "none", cursor: "pointer",
      color: active ? "#2563EB" : "#64748B",
      borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
      transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12.5,
  color: '#475569',
  background: '#F4F6F0',
  border: '1px solid var(--border-2)',
  borderRadius: 9,
  padding: '5px 10px',
};
