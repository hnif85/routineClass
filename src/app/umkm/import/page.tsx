"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";

const EXPECTED = ["full_name", "whatsapp", "email", "city", "business_name", "year_established", "monthly_revenue_estimate", "employee_count", "business_category"];

export default function ImportCsvPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "map" | "importing" | "done">("upload");
  const [result, setResult] = useState<{ success: number; errors: number; duplicates: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    Papa.parse(f, {
      header: true, skipEmptyLines: true, preview: 5,
      complete: (r) => {
        setHeaders(r.meta.fields || []);
        setPreview(r.data as Record<string, string>[]);
        const am: Record<string, string> = {};
        for (const ex of EXPECTED) {
          const m = r.meta.fields?.find((x) => x.toLowerCase().replace(/\s+/g, "_") === ex);
          if (m) am[ex] = m;
        }
        setMapping(am);
        setStep("map");
      },
      error: (err) => toast.error("Gagal baca: " + err.message),
    });
  };

  const doImport = async () => {
    if (!file) return;
    setLoading(true);
    setStep("importing");
    const s = createClient();
    let ok = 0, err = 0, dup = 0;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      step: async (row) => {
        const d = row.data as Record<string, string>;
        const m: Record<string, unknown> = { source: "csv_import", is_active: true };
        for (const [f, c] of Object.entries(mapping)) {
          const v = d[c]?.trim();
          if (!v) continue;
          if (["business_category", "profit_usage_priority", "brand_completeness", "marketing_channels"].includes(f))
            m[f] = v.split(/[,;]/).map(x => x.trim().toLowerCase().replace(/\s+/g, "_"));
          else if (["has_nib", "separates_business_account", "uses_qris", "uses_smartphone_for_business", "has_growth_target_1_2yr", "willing_to_subscribe_100k"].includes(f))
            m[f] = v.toLowerCase() === "ya" || v.toLowerCase() === "yes" || v === "1" || v === "true";
          else if (["year_established", "employee_count"].includes(f))
            m[f] = parseInt(v) || null;
          else m[f] = v;
        }
        if (!m.whatsapp) { err++; return; }
        const { error } = await s.from("umkm").upsert(m, { onConflict: "whatsapp" });
        if (error) { if (error.code === "23505") dup++; else err++; }
        else ok++;
      },
      complete: () => {
        setResult({ success: ok, errors: err, duplicates: dup });
        setLoading(false);
        setStep("done");
        toast.success(`Import: ${ok} berhasil, ${dup} duplikat, ${err} error`);
      },
      error: (err) => { setLoading(false); toast.error("Gagal: " + err.message); },
    });
  };

  const ic = "w-full bg-white border border-[var(--border)] rounded-[12px] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1F9D5A', marginBottom: 4 }}>
          Data UMKM
        </div>
        <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Import CSV
        </h2>
        <p style={{ color: '#73837A', fontSize: 13.5, marginTop: 6 }}>
          Upload file CSV untuk mendaftarkan UMKM secara massal
        </p>
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div style={{
          background: '#F4F6F0',
          border: '2px dashed var(--border)',
          borderRadius: 18,
          padding: 48,
          textAlign: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 40, height: 40, margin: '0 auto 16px', color: '#73837A', opacity: 0.5 }}>
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            borderRadius: 12,
            background: '#0F3D2B',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.18s',
            boxShadow: '0 10px 22px -10px rgba(15,61,43,0.6)',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#13513A'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0F3D2B'; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Pilih File CSV
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" style={{ display: 'none' }} />
          </label>
          <p style={{ fontSize: 13, color: '#73837A', marginTop: 16, fontWeight: 500 }}>
            Header di baris pertama. Kolom wajib: whatsapp, full_name, business_name
          </p>
        </div>
      )}

      {/* Step: Map columns */}
      {step === "map" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 24,
            boxShadow: 'var(--shadow)',
          }}>
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 20 }}>
              Mapping Kolom
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {EXPECTED.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ width: 180, fontSize: 13, fontWeight: 600, color: '#3C4A42', flexShrink: 0 }}>
                    {f.replace(/_/g, " ")}
                  </label>
                  <select
                    className={ic}
                    value={mapping[f] || ""}
                    onChange={e => setMapping({ ...mapping, [f]: e.target.value })}
                    style={{ flex: 1 }}
                  >
                    <option value="">— Skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 24,
            boxShadow: 'var(--shadow)',
          }}>
            <h4 style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 14 }}>
              Preview (5 baris)
            </h4>
            <div style={{
              overflowX: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F9F5', borderBottom: '1px solid var(--border)' }}>
                    {headers.map(h => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', fontWeight: 700, color: '#73837A', textTransform: 'uppercase', fontSize: 10.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ borderCollapse: 'collapse' }}>
                  {preview.map((r, i) => (
                    <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid var(--border-2)' : 'none' }}>
                      {headers.map(h => (
                        <td key={h} style={{ padding: 8, color: '#3C4A42', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep("upload")} className="btn">
              ← Ganti File
            </button>
            <button onClick={doImport} disabled={!mapping.whatsapp} className="btn btn-primary">
              Mulai Import
            </button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 48,
          textAlign: 'center',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            width: 32, height: 32,
            border: '3px solid #E7EAE2',
            borderTopColor: '#0F3D2B',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#73837A', fontSize: 14 }}>Mengimport data...</p>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && result && (
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 28,
          boxShadow: 'var(--shadow)',
        }}>
          <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 20 }}>
            Hasil Import
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div style={{ textAlign: 'center', padding: 20, borderRadius: 12, background: '#DFF5E8' }}>
              <p className="num" style={{ fontSize: 36, fontWeight: 800, color: '#1F9D5A', letterSpacing: '-0.02em' }}>{result.success}</p>
              <p style={{ fontSize: 13, color: '#1F9D5A', fontWeight: 600, marginTop: 4 }}>Berhasil</p>
            </div>
            <div style={{ textAlign: 'center', padding: 20, borderRadius: 12, background: '#FBEFD6' }}>
              <p className="num" style={{ fontSize: 36, fontWeight: 800, color: '#92400e', letterSpacing: '-0.02em' }}>{result.duplicates}</p>
              <p style={{ fontSize: 13, color: '#92400e', fontWeight: 600, marginTop: 4 }}>Duplikat</p>
            </div>
            <div style={{ textAlign: 'center', padding: 20, borderRadius: 12, background: '#FEE2E2' }}>
              <p className="num" style={{ fontSize: 36, fontWeight: 800, color: '#991B1B', letterSpacing: '-0.02em' }}>{result.errors}</p>
              <p style={{ fontSize: 13, color: '#991B1B', fontWeight: 600, marginTop: 4 }}>Error</p>
            </div>
          </div>
          <button onClick={() => router.push("/umkm")} className="btn btn-primary" style={{ marginTop: 20 }}>
            Lihat Data →
          </button>
        </div>
      )}
    </div>
  );
}
