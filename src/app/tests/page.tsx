"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { deleteTest } from "./actions";

export default function TestsPage() {
  const { push } = useRouter();
  const s = createClient();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"test" | "kuesioner">("test");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await s.from("tests").select("*, test_phases(id,phase,label, test_questions(count))").order("created_at", { ascending: false });
    setTests(data || []);
    setLoading(false);
  }

  async function createTest() {
    if (!name.trim()) { toast.error("Nama test harus diisi"); return; }
    setSaving(true);
    const { data: test, error } = await s.from("tests").insert({ name: name.trim(), description: desc.trim() || null, type }).select().single();
    if (error) { toast.error("Gagal: " + error.message); setSaving(false); return; }

    // Auto-create phases
    const phases = type === "test"
      ? [{ test_id: test.id, phase: "pre", label: "Pre-Test", sort_order: 0 }, { test_id: test.id, phase: "post", label: "Post-Test", sort_order: 1 }]
      : [{ test_id: test.id, phase: "only", label: "Kuesioner", sort_order: 0 }];

    const { error: pe } = await s.from("test_phases").insert(phases);
    if (pe) toast.error("Phase gagal dibuat: " + pe.message);
    else toast.success("Test berhasil dibuat!");
    setShowForm(false); setName(""); setDesc(""); setType("test");
    setSaving(false);
    load();
  }

  async function handleDeleteTest(id: string, name: string) {
    if (!confirm(`Hapus test "${name}"? Semua soal & jawaban akan ikut terhapus.`)) return;
    try {
      const result = await deleteTest(id);
      if (result.error) throw new Error(result.error);
      toast.success("Test dihapus");
    } catch (err: any) {
      toast.error(err.message);
    }
    load();
  }

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "#64748B" }}>Memuat...</div>;

  return (
    <div style={{ animation: "fade-in-up 0.5s ease-out both" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#2563EB", marginBottom: 4 }}>
            Master
          </div>
          <h2 style={{ fontFamily: "var(--font-sora)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Test & Kuesioner
          </h2>
          <p style={{ color: "#64748B", fontSize: 13.5, marginTop: 6 }}>Buat template test/kuesioner, lalu binding ke event.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ padding: "10px 20px", fontSize: 13.5 }}>
          + Buat Test Baru
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{
          background: "#fff", border: "1px solid var(--border)", borderRadius: 18,
          padding: 24, marginBottom: 24, boxShadow: "var(--shadow)",
        }}>
          <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Buat Test Baru</h3>
          <div style={{ marginBottom: 14 }}>
            <Label>Nama Test *</Label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Digital Marketing Dasar" className={inputClass} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Label>Deskripsi</Label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Deskripsi singkat..." rows={2} className={inputClass} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <Label>Tipe</Label>
            <div style={{ display: "flex", gap: 12 }}>
              {(["test", "kuesioner"] as const).map(t => (
                <label key={t} style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 16px", border: `2px solid ${type === t ? "#3B82F6" : "var(--border)"}`,
                  borderRadius: 14, cursor: "pointer", transition: "border 0.15s",
                }}>
                  <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} style={{ accentColor: "#1E3A5F" }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1E293B" }}>{t === "test" ? "Test" : "Kuesioner"}</div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      {t === "test" ? "Pre-Test + Post-Test otomatis" : "Satu kali pengisian, anonim"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createTest} disabled={saving} className="btn btn-primary" style={{ padding: "9px 18px", fontSize: 13 }}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
            <button onClick={() => setShowForm(false)} className="btn" style={{ padding: "9px 18px", fontSize: 13 }}>Batal</button>
          </div>
        </div>
      )}

      {/* List */}
      {tests.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748B", fontSize: 13 }}>
          Belum ada test. Klik "Buat Test Baru" untuk memulai.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tests.map(t => (
            <div key={t.id} style={{
              background: "#fff", border: "1px solid var(--border)", borderRadius: 18,
              padding: "16px 20px", boxShadow: "var(--shadow)", cursor: "pointer",
              transition: "box-shadow 0.15s, border-color 0.15s",
            }}
              className="hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              onClick={() => push(`/tests/${t.id}`)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
                      padding: "2px 8px", borderRadius: 6,
                      background: t.type === "test" ? "#EFF6FF" : "#FBEFD6",
                      color: t.type === "test" ? "#2563EB" : "#B57A1E",
                    }}>
                      {t.type === "test" ? "Test" : "Kuesioner"}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748B" }}>
                      {(t.test_phases || []).length} phase
                    </span>
                    <span style={{ fontSize: 12, color: "#64748B" }}>
                      • {(t.test_phases || []).reduce((sum: number, p: any) => sum + (p.test_questions?.[0]?.count || 0), 0)} soal
                    </span>
                  </div>
                  <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 16, fontWeight: 700 }}>{t.name}</h3>
                  {t.description && <p style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>{t.description}</p>}
                </div>
                <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                  <button onClick={e => { e.stopPropagation(); push(`/tests/${t.id}`); }}
                    style={{
                      padding: "6px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      border: "1px solid var(--border)", background: "#fff", cursor: "pointer",
                      color: "#1E293B",
                    }}>
                    Kelola Soal
                  </button>
                  <button onClick={async e => { e.stopPropagation(); await handleDeleteTest(t.id, t.name); }}
                    style={{
                      padding: "6px 10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      border: "none", background: "#FEE2E2", cursor: "pointer", color: "#991B1B",
                    }}>
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputClass = "w-full bg-white border border-[var(--border)] rounded-[10px] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: 6, display: "block" }}>{children}</label>;
}
