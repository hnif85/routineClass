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

  const [f, setF] = useState({
    title: "", description: "", type: "offline", start_date: "", end_date: "",
    start_time: "", end_time: "", location: "", quota: "", speaker_name: "",
    registration_type: "invitation",
  });

  // Test bindings: { phase_id, open_time }
  const [bindings, setBindings] = useState<{ phase_id: string; open_time: "before" | "during" | "after" }[]>([]);

  useEffect(() => {
    s.from("tests").select("*, test_phases(id,phase,label)").then(({ data }) => {
      const mapped = (data || []).map((t: any) => ({ ...t, phases: t.test_phases || [] }));
      setTests(mapped);
    });
  }, []);

  const ic = "w-full bg-white border border-[var(--border)] rounded-[12px] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";

  function togglePhase(phaseId: string, openTime: "before" | "during" | "after") {
    setBindings(prev => {
      const exists = prev.find(b => b.phase_id === phaseId);
      if (exists) return prev.filter(b => b.phase_id !== phaseId);
      return [...prev, { phase_id: phaseId, open_time: openTime }];
    });
  }

  function updateOpenTime(phaseId: string, ot: "before" | "during" | "after") {
    setBindings(prev => prev.map(b => b.phase_id === phaseId ? { ...b, open_time: ot } : b));
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: event, error } = await s.from("events")
      .insert({
        ...f,
        status: "draft",
        quota: f.quota ? parseInt(f.quota) : null,
        end_date: f.end_date || null,
        start_time: f.start_time || null,
        end_time: f.end_time || null,
        speaker_name: f.speaker_name || null,
      })
      .select().single();
    if (error) { toast.error("Gagal: " + error.message); setLoading(false); return; }

    // Insert test bindings
    if (bindings.length > 0) {
      const { error: be } = await s.from("event_tests").insert(
        bindings.map(b => ({ event_id: event.id, phase_id: b.phase_id, open_time: b.open_time }))
      );
      if (be) toast.error("Binding test gagal: " + be.message);
    }

    toast.success("Event berhasil dibuat!");
    router.push("/events");
  };

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1F9D5A', marginBottom: 4 }}>
          Event Management
        </div>
        <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Buat Event Baru
        </h2>
        <p style={{ color: '#73837A', fontSize: 13.5, marginTop: 6 }}>
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
          <div><Label>Lokasi</Label><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Hall Pupuk Kaltim" className={ic} /></div>
          <div><Label>Kuota</Label><input type="number" value={f.quota} onChange={e => setF({ ...f, quota: e.target.value })} placeholder="50" className={ic} /></div>
        </div>

        <div><Label>Narasumber</Label><input value={f.speaker_name} onChange={e => setF({ ...f, speaker_name: e.target.value })} placeholder="Nama narasumber" className={ic} /></div>

        {/* ─── TEST BINDING ─── */}
        <div style={{ paddingTop: 4, borderTop: '1px solid var(--border-2)' }}>
          <Label style={{ marginBottom: 12 }}>Binding Test / Kuesioner</Label>
          {tests.length === 0 ? (
            <p style={{ fontSize: 13, color: '#73837A' }}>
              Belum ada test.{" "}
              <a href="/tests" style={{ color: '#1F9D5A', fontWeight: 700 }}>Buat test dulu</a>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tests.filter(t => t.type === 'test').length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1F9D5A', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Test (Pre + Post)</div>
                  {tests.filter(t => t.type === 'test').map(t => (
                    <TestBindingRow key={t.id} test={t} bindings={bindings} onToggle={togglePhase} onUpdateTime={updateOpenTime} />
                  ))}
                </>
              )}
              {tests.filter(t => t.type === 'kuesioner').length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#B57A1E', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 8 }}>Kuesioner</div>
                  {tests.filter(t => t.type === 'kuesioner').map(t => (
                    <TestBindingRow key={t.id} test={t} bindings={bindings} onToggle={togglePhase} onUpdateTime={updateOpenTime} />
                  ))}
                </>
              )}
            </div>
          )}
          <p style={{ fontSize: 11, color: '#73837A', marginTop: 10 }}>
            Pilih test/kuesioner yang akan diikat ke event ini. Tentukan kapan dibuka: sebelum, saat, atau setelah event.
          </p>
        </div>

        <button type="submit" disabled={loading}
          className={`w-full btn ${loading ? '' : 'btn-primary'}`}
          style={{
            padding: '13px 0', fontSize: 14.5, fontWeight: 700,
            background: loading ? '#73837A' : '#0F3D2B', color: '#fff',
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

/* ─── Test Binding Row ─── */
function TestBindingRow({ test, bindings, onToggle, onUpdateTime }: {
  test: AvailableTest; bindings: { phase_id: string; open_time: string }[];
  onToggle: (phaseId: string, openTime: "before" | "during" | "after") => void;
  onUpdateTime: (phaseId: string, openTime: "before" | "during" | "after") => void;
}) {
  const boundPhases = bindings.filter(b => test.phases.some(p => p.id === b.phase_id));
  const isBound = boundPhases.length > 0;

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${isBound ? '#2FB36B' : 'var(--border-2)'}`,
      background: isBound ? '#F6FEF8' : '#FAFAF8', transition: 'border 0.15s, background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={() => {
            if (isBound) {
              test.phases.forEach(p => onToggle(p.id, 'before'));
            } else {
              test.phases.forEach(p => onToggle(p.id, 'before'));
            }
          }} style={{
            width: 20, height: 20, borderRadius: 6, cursor: 'pointer', flex: '0 0 auto',
            border: `2px solid ${isBound ? '#0F3D2B' : 'var(--border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', background: isBound ? '#0F3D2B' : 'transparent',
          }}>
            {isBound && (
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#152019' }}>{test.name}</div>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: 5,
            background: test.type === 'test' ? '#DFF5E8' : '#FBEFD6', color: test.type === 'test' ? '#1F9D5A' : '#B57A1E',
          }}>
            {test.type === 'test' ? 'Pre+Post' : 'Kuesioner'}
          </span>
        </div>

        {isBound && (
          <div style={{ display: 'flex', gap: 6 }}>
            {test.phases.map(p => (
              <select key={p.id} value={boundPhases.find(b => b.phase_id === p.id)?.open_time || 'before'}
                onChange={e => onUpdateTime(p.id, e.target.value as any)}
                onClick={e => e.stopPropagation()}
                style={{
                  padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                  border: '1px solid var(--border)', background: '#fff',
                }}>
                <option value="before">Sebelum</option>
                <option value="during">Saat</option>
                <option value="after">Setelah</option>
              </select>
            ))}
          </div>
        )}
      </div>

      {isBound && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {test.phases.map(p => (
            <span key={p.id} style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: '#E7F3ED', color: '#1F9D5A',
            }}>
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      color: '#3C4A42', marginBottom: 6, display: 'block',
      ...style,
    }}>
      {children}
    </label>
  );
}
