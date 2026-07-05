"use client";

import { useState } from "react";
import { toast } from "sonner";

const REVENUE_OPTIONS = [
  { value: "", label: "Pilih (opsional)" },
  { value: "<5jt", label: "Kurang dari Rp 5 juta" },
  { value: "5-15jt", label: "Rp 5 - 15 juta" },
  { value: "15-50jt", label: "Rp 15 - 50 juta" },
  { value: ">50jt", label: "Lebih dari Rp 50 juta" },
];

const CATEGORY_OPTIONS = [
  "kuliner", "fashion", "kerajinan", "agribisnis",
  "jasa", "teknologi", "pendidikan", "kesehatan",
  "properti", "otomotif", "lainnya",
];

export default function DaftarPage() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [businessName, setBusinessName] = useState("");

  // Form state
  const [form, setForm] = useState({
    full_name: "",
    whatsapp: "",
    email: "",
    city: "",
    business_name: "",
    year_established: "",
    monthly_revenue_estimate: "",
    employee_count: "",
    business_category: [] as string[],
  });

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleCategory(cat: string) {
    setForm(prev => ({
      ...prev,
      business_category: prev.business_category.includes(cat)
        ? prev.business_category.filter(c => c !== cat)
        : [...prev.business_category, cat],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Basic validation
    if (!form.full_name.trim()) { toast.error("Nama lengkap harus diisi"); return; }
    if (!form.whatsapp.trim()) { toast.error("Nomor WhatsApp harus diisi"); return; }
    if (!/^62\d{8,15}$/.test(form.whatsapp.replace(/[\s\-]/g, ""))) {
      toast.error("Format WA: 62xxxxxxxxxx (contoh: 6281234567890)");
      return;
    }
    if (!form.business_name.trim()) { toast.error("Nama usaha harus diisi"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/umkm/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mendaftar");

      setBusinessName(json.business_name);
      setSuccess(true);
      toast.success(json.message);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#F4F7FC", padding: 24,
      }}>
        <div style={{
          background: "#fff", borderRadius: 24, padding: "48px 40px",
          maxWidth: 460, width: "100%", textAlign: "center",
          boxShadow: "var(--shadow-lg)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#EFF6FF", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 20px",
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{
            fontFamily: "var(--font-sora)", fontSize: 24, fontWeight: 800,
            color: "#1E293B", marginBottom: 8,
          }}>
            Pendaftaran Berhasil!
          </h2>
          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
            <strong style={{ color: "#1E293B" }}>{businessName}</strong> telah terdaftar sebagai UMKM binaan MWX.
          </p>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
            Tim kami akan menghubungi Anda melalui WhatsApp untuk informasi selanjutnya.
          </p>
        </div>
      </div>
    );
  }

  const input = "w-full bg-white border border-[var(--border)] rounded-[12px] px-3 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";
  const label = "block text-[12px] font-bold tracking-[0.06em] uppercase text-[#475569] mb-1.5";

  return (
    <div style={{
      minHeight: "100vh", background: "#F4F7FC",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid var(--border)",
        padding: "14px 24px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <img
           src="https://udupiblnzlzjmaafvdtv.supabase.co/storage/v1/object/public/umkmConnect/logo%20RoutineClass.png"
          alt="MWX"
          style={{ height: 28, objectFit: "contain" }}
        />
        <div style={{
          width: 1, height: 20, background: "var(--border)",
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>
          Pendaftaran UMKM Binaan
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "32px 20px" }}>
        <div style={{
          background: "#fff", borderRadius: 20,
          maxWidth: 560, width: "100%", padding: "32px 28px",
          boxShadow: "var(--shadow-lg)", alignSelf: "flex-start",
        }}>
          {/* Title */}
          <h2 style={{
            fontFamily: "var(--font-sora)", fontSize: 22, fontWeight: 800,
            color: "#1E293B", marginBottom: 4,
          }}>
            Daftar Sekarang
          </h2>
          <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24, lineHeight: 1.5 }}>
            Isi data usaha Anda untuk bergabung sebagai UMKM binaan MWX. Dapatkan akses pelatihan, pendampingan, dan berbagai manfaat lainnya.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Nama */}
            <div>
              <label className={label}>Nama Lengkap <span style={{ color: "#DC2626" }}>*</span></label>
              <input value={form.full_name} onChange={e => update("full_name", e.target.value)}
                placeholder="Contoh: Siti Nurhaliza"
                className={input} required
              />
            </div>

            {/* WA */}
            <div>
              <label className={label}>No. WhatsApp <span style={{ color: "#DC2626" }}>*</span></label>
              <input value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)}
                placeholder="6281234567890"
                className={input} required
              />
              <p style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>Awali dengan 62, tanpa + atau spasi</p>
            </div>

            {/* Email */}
            <div>
              <label className={label}>Email</label>
              <input value={form.email} onChange={e => update("email", e.target.value)}
                placeholder="contoh@email.com"
                className={input} type="email"
              />
            </div>

            {/* Kota */}
            <div>
              <label className={label}>Kota</label>
              <input value={form.city} onChange={e => update("city", e.target.value)}
                placeholder="Jakarta"
                className={input}
              />
            </div>

            {/* Nama Usaha */}
            <div>
              <label className={label}>Nama Usaha <span style={{ color: "#DC2626" }}>*</span></label>
              <input value={form.business_name} onChange={e => update("business_name", e.target.value)}
                placeholder="Contoh: Warung Makan Sari Rasa"
                className={input} required
              />
            </div>

            {/* Tahun Berdiri */}
            <div>
              <label className={label}>Tahun Berdiri</label>
              <input value={form.year_established} onChange={e => update("year_established", e.target.value)}
                placeholder="2020"
                className={input} type="number" min={1900} max={2030}
              />
            </div>

            {/* Omzet */}
            <div>
              <label className={label}>Perkiraan Omzet Bulanan</label>
              <select value={form.monthly_revenue_estimate}
                onChange={e => update("monthly_revenue_estimate", e.target.value)}
                className={input}
              >
                {REVENUE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Karyawan */}
            <div>
              <label className={label}>Jumlah Karyawan</label>
              <input value={form.employee_count} onChange={e => update("employee_count", e.target.value)}
                placeholder="0"
                className={input} type="number" min={0}
              />
            </div>

            {/* Kategori */}
            <div>
              <label className={label}>Kategori Usaha</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORY_OPTIONS.map(cat => {
                  const selected = form.business_category.includes(cat);
                  return (
                    <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                      style={{
                        padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                        border: selected ? "2px solid #2563EB" : "1px solid var(--border)",
                        background: selected ? "#EFF6FF" : "#fff",
                        color: selected ? "#2563EB" : "#475569",
                        cursor: "pointer", transition: "all 0.12s",
                      }}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={submitting}
              className="btn btn-primary" style={{
                width: "100%", padding: "12px", fontSize: 14, fontWeight: 700,
                justifyContent: "center", marginTop: 8,
              }}>
              {submitting ? "Mendaftarkan..." : "Daftar Sekarang"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
