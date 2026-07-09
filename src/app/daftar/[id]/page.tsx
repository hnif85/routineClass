"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";

const DOKU_JS = process.env.NEXT_PUBLIC_DOKU_SANDBOX === "true"
  ? "https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js"
  : "https://jokul.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js";

function openDokuCheckout(url: string) {
  if (typeof window !== "undefined" && (window as any).loadJokulCheckout) {
    (window as any).loadJokulCheckout(url);
  } else {
    window.open(url, "_blank");
  }
}

export default function DaftarPage() {
  const eventId = useParams().id as string;
  const { push } = useRouter();
  const s = createClient();

  const [ev, setEv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"email" | "form" | "pay" | "redirecting">("email");

  // Form state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [business, setBusiness] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  // Wilayah data
  const [provinces, setProvinces] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/wilayah/provinces").then(r => r.json()).then(setProvinces);
    s.from("events").select("*").eq("id", eventId).single().then(({ data }) => {
      setEv(data); setLoading(false);
    });
  }, [eventId]);

  useEffect(() => {
    if (province) {
      fetch(`/api/wilayah/cities?province=${encodeURIComponent(province)}`)
        .then(r => r.json()).then((d: string[]) => { setCities(d); setCity(""); });
    } else { setCities([]); }
  }, [province]);

  // ═══ Auto-check: jika sudah login, langsung register ═══
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(async (d) => {
        if (d.user && d.user.role === "umkm" && d.user.email) {
          // Sudah login → cek apakah sudah terdaftar di event ini
          setStep("redirecting");
          setEmail(d.user.email.toLowerCase());

          // Cek invitation yang sudah ada
          const { data: existingInv } = await s
            .from("event_invitations")
            .select("id, status, payment_status")
            .eq("event_id", eventId)
            .eq("email", d.user.email.toLowerCase())
            .in("status", ["pending", "confirmed"])
            .maybeSingle();

          if (existingInv) {
            // Sudah terdaftar → langsung ke portal
            if (existingInv.status === "confirmed" || existingInv.payment_status === "paid") {
              push("/portal");
              return;
            }
            // Pending → ke portal juga (bisa bayar di sana)
            push("/portal");
            return;
          }

          // Belum terdaftar → ambil data dari umkm lalu auto-register
          const { data: umkm } = await s
            .from("umkm")
            .select("*")
            .eq("id", d.user.umkm_id)
            .maybeSingle();

          if (umkm) {
            // Auto-register langsung
            try {
              const res = await fetch("/api/daftar/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  eventId,
                  email: d.user.email.toLowerCase(),
                  full_name: umkm.full_name || d.user.name || "",
                  phone: umkm.whatsapp || "",
                  business_name: umkm.business_name || "",
                  province: umkm.province || "",
                  city: umkm.city || "",
                }),
              });
              const data = await res.json();
              if (data.error) {
                // Fallback: tampilkan form
                setFullName(umkm.full_name || "");
                setPhone(umkm.whatsapp || "");
                setBusiness(umkm.business_name || "");
                setProvince(umkm.province || "");
                setCity(umkm.city || "");
                setStep("form");
                return;
              }
              if (data.payLink) {
                openDokuCheckout(data.payLink);
              }
              push("/portal");
            } catch {
              push("/portal");
            }
            return;
          }

          // Tidak ada data umkm → tampilkan form dengan nama dari users
          setFullName(d.user.name || "");
          setStep("form");
        }
      })
      .catch(() => {});
  }, [eventId]);

  function validatePhone(wa: string): string | null {
    const cleaned = wa.replace(/\D/g, "");
    if (!/^08\d{8,11}$/.test(cleaned)) return "Nomor WA harus diawali 08 dan 10-13 digit";
    return null;
  }

  function formatPhone(wa: string): string {
    return wa.replace(/\D/g, "");
  }

  function validateEmail(e: string): string | null {
    const cleaned = e.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return "Format email tidak valid";
    if (cleaned.length < 5) return "Email terlalu pendek";
    return null;
  }

  async function handleCheckEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);
    const emErr = validateEmail(normalizedEmail);
    if (emErr) { setError(emErr); return; }
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/daftar/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, email: normalizedEmail }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setSending(false); return; }

      // Sudah terdaftar → langsung redirect
      if (data.redirect) {
        push(data.redirect);
        return;
      }

      if (data.needFields) {
        // Sudah terdaftar di event → redirect ke portal
        if (data.alreadyRegistered) {
          push("/portal");
          return;
        }

        // Sudah punya akun + data lengkap + belum daftar → auto-register
        if (data.autoRegister && data.customer) {
          setSending(true);
          const regRes = await fetch("/api/daftar/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              email: normalizedEmail,
              full_name: data.customer.full_name || "",
              phone: data.customer.phone || "",
              business_name: data.customer.business_name || "",
              province: data.customer.province || "",
              city: data.customer.city || "",
            }),
          });
          const regData = await regRes.json();
          if (regData.error) {
            setError(regData.error);
            setSending(false);
            return;
          }
          if (regData.payLink) {
            openDokuCheckout(regData.payLink);
          }
          push("/portal");
          return;
        }

        // Semua field sudah ada → auto-register
        const allFilled = data.allFilled;
        if (allFilled && data.customer) {
          setSending(true);
          const regRes = await fetch("/api/daftar/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              email: normalizedEmail,
              full_name: data.customer.full_name || "",
              phone: data.customer.phone || "",
              business_name: data.customer.business_name || "",
              province: data.customer.province || "",
              city: data.customer.city || "",
            }),
          });
          const regData = await regRes.json();
          if (regData.error) {
            setError(regData.error);
            setSending(false);
            return;
          }
          if (regData.payLink) {
            openDokuCheckout(regData.payLink);
          }
          push("/portal");
          return;
        }

        // Ada field yang kurang → tampilkan form
        setFullName(data.customer?.full_name || "");
        setPhone(data.customer?.phone || "");
        setBusiness(data.customer?.business_name || "");
        setProvince(data.customer?.province || "");
        setCity(data.customer?.city || "");
        setStep("form");
      }
      setSending(false);
    } catch (e: any) { setError(e.message); setSending(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const emErr = validateEmail(email);
    if (emErr) { setError(emErr); return; }

    // Validate WA
    const waErr = validatePhone(phone);
    if (waErr) { setError(waErr); return; }

    setSending(true);
    try {
      const res = await fetch("/api/daftar/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId, email: email.toLowerCase(),
          full_name: fullName,
          phone: formatPhone(phone),
          business_name: business,
          province, city,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setSending(false); return; }

      if (data.redirect) {
        push(data.redirect);
      } else if (data.payLink) {
        openDokuCheckout(data.payLink);
        push("/portal");
      } else {
        push("/portal");
      }
      setSending(false);
    } catch (e: any) { setError(e.message); setSending(false); }
  }

  if (loading || step === "redirecting") return <Center>⏳ Memuat...</Center>;
  if (!ev) return <Center>❌ Event tidak ditemukan</Center>;

  const d = ev.start_date ? new Date(ev.start_date + "T" + (ev.start_time || "00:00")) : null;
  const price = ev.is_paid !== false ? (ev.price || 50000) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        {/* Event Card */}
        <div style={{ background: "linear-gradient(135deg, #0A1628, #0D2137)", borderRadius: 20, padding: "24px 28px", color: "#fff", marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#60A5FA", marginBottom: 6 }}>Routine Class</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.3 }}>{ev.title}</h1>
          {d && (
            <div style={{ fontSize: 13, color: "#94A3B8", display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              <span>📅 {d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</span>
              {ev.start_time && <span>⏰ {ev.start_time.substring(0, 5)} - {ev.end_time?.substring(0, 5)}</span>}
              <span>📍 {ev.location || "Online"}</span>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <span style={{ background: price > 0 ? "#2563EB" : "#059669", padding: "6px 16px", borderRadius: 999, fontSize: 16, fontWeight: 800 }}>
              {price > 0 ? `Rp${price.toLocaleString("id-ID")}` : "GRATIS"}
            </span>
          </div>
        </div>

        {error && <div style={{ padding: "12px 16px", borderRadius: 12, fontSize: 13, background: "#FEE2E2", color: "#991B1B", marginBottom: 16 }}>{error}</div>}

        {/* Step: Email */}
        {step === "email" && (
          <form onSubmit={handleCheckEmail} style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px", color: "#1E293B" }}>Daftar Event</h3>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>Masukkan email untuk melanjutkan</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@kamu.com" required
              style={{ width: "100%", padding: "12px 16px", fontSize: 15, border: "1.5px solid var(--border)", borderRadius: 12, outline: "none", boxSizing: "border-box", background: "#F8FAFC" }} />
            <button type="submit" disabled={sending} style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: sending ? "wait" : "pointer", background: "#2563EB", color: "#fff" }}>
              {sending ? "Memeriksa..." : "Lanjutkan"}
            </button>
          </form>
        )}

        {/* Step: Form */}
        {step === "form" && (
          <form onSubmit={handleRegister} style={{ background: "#fff", borderRadius: 16, padding: "24px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1E293B" }}>Lengkapi Data</h3>
            <Field label="Email" value={email} onChange={() => {}} disabled placeholder="email@kamu.com" />
            <Field label="Nama Lengkap" value={fullName} onChange={setFullName} placeholder="Nama kamu" required />
            <Field label="Nomor WhatsApp" value={phone} onChange={setPhone} placeholder="0812xxxxxxxx" type="tel" required />
            <Field label="Nama Usaha" value={business} onChange={setBusiness} placeholder="Nama UMKM / bisnis" required />

            {/* Province dropdown */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1E293B", marginBottom: 5 }}>
                Provinsi <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select value={province} onChange={e => { setProvince(e.target.value); setCity(""); }} required
                style={{ width: "100%", padding: "10px 14px", fontSize: 14, border: "1.5px solid var(--border)", borderRadius: 12, outline: "none", background: "#F8FAFC", fontFamily: "inherit" }}>
                <option value="">Pilih Provinsi</option>
                {provinces.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* City dropdown */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1E293B", marginBottom: 5 }}>
                Kota/Kabupaten <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select value={city} onChange={e => setCity(e.target.value)} required disabled={!province}
                style={{ width: "100%", padding: "10px 14px", fontSize: 14, border: "1.5px solid var(--border)", borderRadius: 12, outline: "none", background: province ? "#F8FAFC" : "#F1F5F9", fontFamily: "inherit" }}>
                <option value="">{province ? "Pilih Kota/Kabupaten" : "Pilih Provinsi dulu"}</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button type="submit" disabled={sending} style={{ padding: "12px", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: sending ? "wait" : "pointer", background: "#2563EB", color: "#fff" }}>
              {sending ? "Mendaftarkan..." : price > 0 ? `Lanjut ke Pembayaran — Rp${price.toLocaleString("id-ID")}` : "Daftar Gratis"}
            </button>
          </form>
        )}

      </div>
      <Script src={DOKU_JS} strategy="afterInteractive" />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, type, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1E293B", marginBottom: 5 }}>
        {label} {required && <span style={{ color: "#DC2626" }}>*</span>}
      </label>
      <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} disabled={disabled}
        style={{ width: "100%", padding: "10px 14px", fontSize: 14, border: "1.5px solid var(--border)", borderRadius: 12, outline: "none", boxSizing: "border-box", background: disabled ? "#F1F5F9" : "#F8FAFC", fontFamily: "inherit" }} />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", color: "#64748B", fontSize: 15 }}>{children}</div>;
}