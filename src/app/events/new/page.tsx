"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface AvailableTest { id: string; name: string; type: string; phases: { id: string; phase: string; label: string }[]; }

export default function NewEventPage() {
  const router = useRouter();
  const s = createClient();
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<AvailableTest[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [selectedKuesionerId, setSelectedKuesionerId] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");

  // Multi-select trainers
  const [trainers, setTrainers] = useState<any[]>([]);
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<Set<string>>(new Set());
  const [externalNames, setExternalNames] = useState<string[]>([]);
  const [newExternal, setNewExternal] = useState("");

  const [f, setF] = useState({
    title: "", description: "", type: "offline", start_date: "", end_date: "",
    start_time: "", end_time: "", location: "", quota: "", speaker_name: "",
    registration_type: "invitation",
    is_paid: true, price: "50000",
  });

  useEffect(() => {
    s.from("tests").select("*, test_phases(id,phase,label)").then(({ data }) => {
      const mapped = (data || []).map((t: any) => ({ ...t, phases: t.test_phases || [] }));
      setTests(mapped);
    });
    s.from("materials").select("id, title, description, total_days, test_data, is_ai_generated, created_at")
      .order("created_at", { ascending: false }).then(({ data }) => {
      setMaterials(data || []);
    });
    // Fetch trainers
    s.from("admin_users").select("*").in("role", ["trainer", "admin", "event_admin"]).order("name").then(({ data }) => {
      setTrainers(data || []);
    });
  }, []);

  const ic = "w-full bg-white border border-[var(--border)] rounded-[12px] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";

  function toggleMaterial(id: string) {
    setSelectedMaterialIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function autoComposeTest(eventId: string, selectedMats: any[]) {
    // Collect all pre_test and post_test questions from materials that have test_data
    const allPre: any[] = [];
    const allPost: any[] = [];
    let sourceNames: string[] = [];

    for (const mat of selectedMats) {
      if (!mat.test_data) continue;
      const td = mat.test_data;
      if (td.pre_test?.length > 0) {
        allPre.push(...td.pre_test.map((q: any) => ({ ...q, source: mat.title })));
      }
      if (td.post_test?.length > 0) {
        allPost.push(...td.post_test.map((q: any) => ({ ...q, source: mat.title })));
      }
      if (td.pre_test?.length > 0 || td.post_test?.length > 0) {
        sourceNames.push(mat.title);
      }
    }

    if (allPre.length === 0 && allPost.length === 0) return; // no test data

    // Create test record
    const testName = `Test: ${sourceNames.length <= 2 ? sourceNames.join(" + ") : sourceNames.length + " materi"}`;
    const { data: test, error: testErr } = await s.from("tests").insert({
      name: testName,
      description: `Auto-composed pre/post test dari materi untuk event`,
      type: "test",
    }).select().single();

    if (testErr || !test) {
      toast.error("Gagal membuat test: " + (testErr?.message || "unknown"));
      return;
    }

    const eventTestsToInsert: { event_id: string; phase_id: string; open_time: string }[] = [];

    // Pre phase
    if (allPre.length > 0) {
      const { data: prePhase } = await s.from("test_phases").insert({
        test_id: test.id, phase: "pre", label: "Pre-Test", sort_order: 0,
      }).select().single();

      if (prePhase) {
        await s.from("test_questions").insert(
          allPre.map((q: any, i: number) => ({
            phase_id: prePhase.id,
            question_text: q.question || q.question_text,
            question_type: q.question_type || (q.options ? "multiple_choice" : "essay"),
            options: q.options || null,
            correct_answer: q.correct_answer ?? q.correct ?? null,
            points: q.points || 1,
            sort_order: i,
          }))
        );
        eventTestsToInsert.push({ event_id: eventId, phase_id: prePhase.id, open_time: "before" });
      }
    }

    // Post phase — open_time = "during" (auto-buka saat event berlangsung)
    if (allPost.length > 0) {
      const { data: postPhase } = await s.from("test_phases").insert({
        test_id: test.id, phase: "post", label: "Post-Test", sort_order: 1,
      }).select().single();

      if (postPhase) {
        await s.from("test_questions").insert(
          allPost.map((q: any, i: number) => ({
            phase_id: postPhase.id,
            question_text: q.question || q.question_text,
            question_type: q.question_type || (q.options ? "multiple_choice" : "essay"),
            options: q.options || null,
            correct_answer: q.correct_answer ?? q.correct ?? null,
            points: q.points || 1,
            sort_order: i,
          }))
        );
        eventTestsToInsert.push({ event_id: eventId, phase_id: postPhase.id, open_time: "during" });
      }
    }

    // Bind to event
    if (eventTestsToInsert.length > 0) {
      const { error: be } = await s.from("event_tests").insert(eventTestsToInsert);
      if (be) toast.error("Binding test gagal: " + be.message);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate: at least 1 material
    if (selectedMaterialIds.size === 0) {
      toast.error("Pilih minimal 1 materi untuk event ini");
      setLoading(false);
      return;
    }

    // 1. Create event — merge all trainer names
    const internalNames = trainers.filter(t => selectedTrainerIds.has(t.id)).map(t => t.name);
    const allSpeakerNames = [...internalNames, ...externalNames].join(", ");
    const speakerIdsArr = Array.from(selectedTrainerIds);

    const { data: event, error } = await s.from("events")
      .insert({
        ...f,
        status: "draft",
        price: f.is_paid ? (parseInt(f.price) || 50000) : 0,
        quota: f.quota ? parseInt(f.quota) : null,
        end_date: f.end_date || null,
        start_time: f.start_time || null,
        end_time: f.end_time || null,
        speaker_name: allSpeakerNames || null,
        speaker_ids: speakerIdsArr,
      })
      .select().single();
    if (error) { toast.error("Gagal: " + error.message); setLoading(false); return; }

    // 1b. Save event_trainers
    const trainerInserts = [
      ...internalNames.map((name, i) => {
        const t = trainers.find(tr => tr.id === speakerIdsArr[i]);
        return { event_id: event.id, trainer_id: speakerIdsArr[i], trainer_name: name, trainer_email: t?.email || null, is_external: false };
      }),
      ...externalNames.map(name => ({ event_id: event.id, trainer_name: name, is_external: true })),
    ];
    if (trainerInserts.length > 0) {
      await s.from("event_trainers").insert(trainerInserts);
    }

    // 2. Insert event_materials
    const selectedMats = materials.filter(m => selectedMaterialIds.has(m.id));
    if (selectedMats.length > 0) {
      const { error: me } = await s.from("event_materials").insert(
        selectedMats.map((m, i) => ({ event_id: event.id, material_id: m.id, sort_order: i }))
      );
      if (me) toast.error("Link materi gagal: " + me.message);
    }

    // 3. Auto-compose test from material test_data
    await autoComposeTest(event.id, selectedMats);

    // 4. Bind kuesioner if selected
    if (selectedKuesionerId) {
      // Find the kuesioner's phases
      const kues = tests.find(t => t.id === selectedKuesionerId);
      if (kues && kues.phases.length > 0) {
        const { error: ke } = await s.from("event_tests").insert(
          kues.phases.map((p: any) => ({
            event_id: event.id,
            phase_id: p.id,
            open_time: "during",
          }))
        );
        if (ke) toast.error("Binding kuesioner gagal: " + ke.message);
      }
    }

    toast.success("Event berhasil dibuat!");
    router.push("/events");
  };

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563EB', marginBottom: 4 }}>
          Event Management
        </div>
        <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Buat Event Baru
        </h2>
        <p style={{ color: '#64748B', fontSize: 13.5, marginTop: 6 }}>
          Buat event atau pelatihan untuk UMKM binaan
        </p>
      </div>

      <form onSubmit={submit} style={{
        background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
        padding: 28, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div>
          <Label>Judul Event *</Label>
          <input required value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Pelatihan Digital Marketing UMKM" className={ic} />
        </div>
        <div>
          <Label>Deskripsi</Label>
          <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Deskripsi..." rows={3} className={ic} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <Label>Tipe</Label>
            <select value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className={ic}>
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <Label>Registrasi</Label>
            <select value={f.registration_type} onChange={e => setF({ ...f, registration_type: e.target.value })} className={ic}>
              <option value="invitation">Undangan</option>
              <option value="open">Terbuka</option>
              <option value="both">Keduanya</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <div><Label>Tgl Mulai *</Label><input type="date" required value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className={ic} /></div>
          <div><Label>Tgl Selesai</Label><input type="date" value={f.end_date} onChange={e => setF({ ...f, end_date: e.target.value })} className={ic} /></div>
          <div><Label>Jam Mulai</Label><input type="time" value={f.start_time} onChange={e => setF({ ...f, start_time: e.target.value })} className={ic} /></div>
          <div><Label>Jam Selesai</Label><input type="time" value={f.end_time} onChange={e => setF({ ...f, end_time: e.target.value })} className={ic} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div><Label>Lokasi</Label><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Hall MWX" className={ic} /></div>
          <div><Label>Kuota</Label><input type="number" value={f.quota} onChange={e => setF({ ...f, quota: e.target.value })} placeholder="50" className={ic} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <Label>Tipe Tiket</Label>
            <div style={{ display: 'flex', gap: 0, marginTop: 4 }}>
              <button type="button" onClick={() => setF({ ...f, is_paid: true })} style={{
                flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600,
                border: f.is_paid ? '2px solid #2563EB' : '1.5px solid var(--border)',
                borderRadius: '10px 0 0 10px', cursor: 'pointer',
                background: f.is_paid ? '#EFF6FF' : '#fff', color: f.is_paid ? '#2563EB' : '#64748B',
              }}>💰 Berbayar</button>
              <button type="button" onClick={() => setF({ ...f, is_paid: false })} style={{
                flex: 1, padding: '10px 16px', fontSize: 13, fontWeight: 600,
                border: !f.is_paid ? '2px solid #059669' : '1.5px solid var(--border)',
                borderRadius: '0 10px 10px 0', cursor: 'pointer',
                background: !f.is_paid ? '#ECFDF5' : '#fff', color: !f.is_paid ? '#059669' : '#64748B',
              }}>🆓 Gratis</button>
            </div>
          </div>
          {f.is_paid && (
            <div><Label>Harga Tiket (Rp)</Label><input type="number" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} placeholder="50000" className={ic} /></div>
          )}
        </div>

        <div>
          <Label>Narasumber</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {/* Internal trainers */}
            {trainers.map((t) => (
              <label key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 10, cursor: 'pointer', fontSize: 13,
                background: selectedTrainerIds.has(t.id) ? '#EFF6FF' : '#fff',
                border: selectedTrainerIds.has(t.id) ? '1px solid #3B82F6' : '1px solid var(--border)',
              }}>
                <input type="checkbox" checked={selectedTrainerIds.has(t.id)}
                  onChange={() => {
                    const next = new Set(selectedTrainerIds);
                    if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                    setSelectedTrainerIds(next);
                  }}
                  style={{ width: 16, height: 16, accentColor: '#2563EB' }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>{t.name}</span>
                  <span style={{ color: '#64748B', marginLeft: 8, fontSize: 12 }}>{t.email}</span>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                  background: t.role === 'trainer' ? '#DBEAFE' : '#F3F4F6',
                  color: t.role === 'trainer' ? '#1E40AF' : '#374151',
                }}>{t.role === 'trainer' ? 'Trainer' : 'Admin'}</span>
              </label>
            ))}
            {/* External names added */}
            {externalNames.map((name, i) => (
              <div key={`ext-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 10, fontSize: 13,
                background: '#FFF7ED', border: '1px solid #FDBA74',
              }}>
                <span style={{ flex: 1, fontWeight: 600, color: '#9A3412' }}>{name}</span>
                <span style={{ fontSize: 10, color: '#C2410C' }}>External</span>
                <button onClick={() => setExternalNames(prev => prev.filter((_, j) => j !== i))}
                  style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ))}
            {/* Add external */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newExternal} onChange={e => setNewExternal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newExternal.trim()) { setExternalNames(prev => [...prev, newExternal.trim()]); setNewExternal(''); e.preventDefault(); } }}
                placeholder="+ Nama narasumber lain (external)"
                className={ic} style={{ flex: 1 }} />
              <button type="button" onClick={() => { if (newExternal.trim()) { setExternalNames(prev => [...prev, newExternal.trim()]); setNewExternal(''); } }}
                style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Tambah</button>
            </div>
          </div>
          {(selectedTrainerIds.size > 0 || externalNames.length > 0) && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#64748B' }}>
              {selectedTrainerIds.size + externalNames.length} narasumber dipilih
            </div>
          )}
        </div>

        {/* ─── PILIH MATERI (BARU) ─── */}
        <div style={{ paddingTop: 4, borderTop: '1px solid var(--border-2)' }}>
          <Label style={{ marginBottom: 12 }}>Pilih Materi</Label>
          <div style={{ marginBottom: 10 }}>
            <input value={materialSearch} onChange={e => setMaterialSearch(e.target.value)}
              placeholder="Cari materi..."
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 10,
                border: '1px solid var(--border)', fontSize: 13, outline: 'none',
                boxSizing: 'border-box', background: '#fff',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {materials.filter(m => !materialSearch || m.title.toLowerCase().includes(materialSearch.toLowerCase())).length === 0 ? (
              <p style={{ fontSize: 13, color: '#64748B', padding: '12px 0' }}>
                {materialSearch ? "Tidak ada materi yang cocok." : "Belum ada materi. Buat materi dulu di halaman Materi."}
              </p>
            ) : (
              materials
                .filter(m => !materialSearch || m.title.toLowerCase().includes(materialSearch.toLowerCase()))
                .map(m => {
                  const isSelected = selectedMaterialIds.has(m.id);
                  const hasTest = m.test_data && (m.test_data?.pre_test?.length > 0 || m.test_data?.post_test?.length > 0);
                  return (
                    <div key={m.id} onClick={() => toggleMaterial(m.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                      padding: '10px 14px', borderRadius: 12,
                      border: `1.5px solid ${isSelected ? '#3B82F6' : 'var(--border-2)'}`,
                      background: isSelected ? '#F6FEF8' : '#FAFAF8',
                      transition: 'all 0.15s',
                    }}>
                      {/* Checkbox */}
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flex: '0 0 auto',
                        border: `2px solid ${isSelected ? '#1E3A5F' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isSelected ? '#1E3A5F' : 'transparent',
                      }}>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1E293B' }}>{m.title}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 11.5, color: '#64748B' }}>
                          <span>{m.total_days || 1} hari</span>
                          {hasTest && <span style={{ color: '#2563EB', fontWeight: 600 }}>✓ ada test</span>}
                          {!hasTest && <span style={{ color: '#B57A1E' }}>tanpa test</span>}
                        </div>
                      </div>
                      {/* Badge */}
                      <span style={{
                        fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                        background: m.is_ai_generated ? '#E7EEFB' : '#F0F2EC',
                        color: m.is_ai_generated ? '#3C68B5' : '#64748B',
                      }}>
                        {m.is_ai_generated ? 'AI' : 'Manual'}
                      </span>
                    </div>
                  );
                })
            )}
          </div>
          {selectedMaterialIds.size > 0 && (
            <p style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', marginTop: 8 }}>
              {selectedMaterialIds.size} materi dipilih
            </p>
          )}
        </div>

        {/* ─── PILIH KUESIONER (BARU) ─── */}
        <div style={{ paddingTop: 4, borderTop: '1px solid var(--border-2)' }}>
          <Label style={{ marginBottom: 12 }}>Pilih Kuesioner (Opsional)</Label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={selectedKuesionerId || ""} onChange={e => setSelectedKuesionerId(e.target.value || null)}
              className={ic} style={{ flex: 1 }}>
              <option value="">Tidak pakai kuesioner</option>
              {tests.filter(t => t.type === 'kuesioner').map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <a href="/tests" style={{
              padding: '7px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
              border: '1px solid #3B82F6', color: '#2563EB', textDecoration: 'none',
              whiteSpace: 'nowrap', display: 'inline-block',
            }}>
              + Buat Baru
            </a>
          </div>
          <p style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
            Kuesioner akan dibuka saat event berlangsung.
          </p>
        </div>

        <button type="submit" disabled={loading}
          className={`w-full btn ${loading ? '' : 'btn-primary'}`}
          style={{
            padding: '13px 0', fontSize: 14.5, fontWeight: 700,
            background: loading ? '#64748B' : '#1E3A5F', color: '#fff',
            border: 'none', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 10px 22px -10px rgba(15,61,43,0.6)',
            transition: 'all 0.18s',
          }}
        >
          {loading ? "Menyimpan..." : "Buat Event"}
        </button>
      </form>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: '#475569', marginBottom: 6, display: 'block',
      ...style,
    }}>
      {children}
    </label>
  );
}
