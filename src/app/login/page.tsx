"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { push } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Redirect if already logged in
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) {
        push(d.user.role === "umkm" ? "/portal" : "/dashboard");
      } else {
        setChecking(false);
      }
    }).catch(() => setChecking(false));
  }, [push]);

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1E3A5F 0%, #1E3A5F 100%)' }}>
        <div style={{ color: '#86AD98', fontSize: 14 }}>Memeriksa sesi...</div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Email dan password harus diisi"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login gagal");
      // Redirect based on role
      push(json.user?.role === "umkm" ? "/portal" : "/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1E3A5F 0%, #1E3A5F 100%)',
      padding: 20,
    }}>
      <div style={{
        background: '#F4F7FC', borderRadius: 24, padding: '40px 36px',
        width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/assets/default-logo.png" alt=""
            style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain', background: '#fff', padding: 6, marginBottom: 12 }} />
          <h1 style={{ fontFamily: 'var(--font-sora)', fontSize: 22, fontWeight: 800, color: '#1E293B', margin: 0 }}>
            UMKM Connect
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Masuk ke platform monitoring UMKM</p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, background: '#FEE2E2', color: '#991B1B',
            fontSize: 13, fontWeight: 600, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, display: 'block', letterSpacing: '0.04em' }}>EMAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 11, fontSize: 14,
                border: '1px solid var(--border)', outline: 'none', boxSizing: 'border-box',
                background: '#fff',
              }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 5, display: 'block', letterSpacing: '0.04em' }}>PASSWORD</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 11, fontSize: 14,
                border: '1px solid var(--border)', outline: 'none', boxSizing: 'border-box',
                background: '#fff',
              }} />
          </div>
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700,
              border: 'none', cursor: 'pointer', marginTop: 8,
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#fff',
            }}>
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
