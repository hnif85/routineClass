"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/* ─── Types ─── */
interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  umkm_id: string;
}

interface UmkmProfile {
  id: string;
  full_name: string;
  business_name: string;
  city: string;
  province: string;
  email: string;
  whatsapp: string;
  business_category: string[];
  monthly_revenue_estimate: string;
  employee_count: number;
  year_established: number;
}

interface DisplayEvent {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string;
  quota: number | null;
  speaker_name: string | null;
  registration_type: string;
  tag: "terdaftar" | "terbuka";
  invStatus?: string;
  paymentStatus?: string;
  invitationId?: string;
  attendees?: number;
}

/* ─── Helpers ─── */
function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  const day = date.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(t: string | null) {
  if (!t) return "";
  // "10:00:00" → "10.00"
  const parts = t.split(":");
  return `${parts[0]}.${parts[1]}`;
}

function getQuotaPercent(quota: number | null, attendees: number) {
  if (!quota || quota === 0) return 0;
  return Math.min(100, Math.round((attendees / quota) * 100));
}

function getQuotaColor(percent: number) {
  if (percent >= 80) return "#EF4444"; // red
  if (percent >= 50) return "#F59E0B"; // orange
  return "#3B82F6"; // blue
}

/* ─── Component ─── */
export default function PortalPage() {
  const { push } = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [profile, setProfile] = useState<UmkmProfile | null>(null);
  const [myEvents, setMyEvents] = useState<DisplayEvent[]>([]);
  const [openEvents, setOpenEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const supabase = createClient();

  /* ─── Auth + Load ─── */
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (d) => {
        if (!d.user || d.user.role !== "umkm") {
          push("/login");
          return;
        }
        setUser(d.user);
        setIsFirstLogin(d.is_first_login || false);
        if (d.is_first_login) setShowPasswordModal(true);
        await loadData(d.user);
      })
      .catch(() => push("/login"));
  }, []);

  async function loadData(u: UserInfo) {
    // Profile
    const { data: p } = await supabase
      .from("umkm")
      .select("*")
      .eq("id", u.umkm_id)
      .maybeSingle();
    setProfile(p);

    // Invitations (registered events)
    let invQuery = supabase
      .from("event_invitations")
      .select("status, payment_status, id, event:events(*)")
      .in("event.status", ["published", "ongoing"]);

    if (u.umkm_id) {
      invQuery = invQuery.or(
        `umkm_id.eq.${u.umkm_id},email.eq.${u.email.toLowerCase()}`
      );
    } else {
      invQuery = invQuery.eq("email", u.email.toLowerCase());
    }

    const { data: rawInv } = await invQuery;
    const inv: { status: string; payment_status: string; id: string; event: any }[] = rawInv || [];

    // My events (registered)
    const my: DisplayEvent[] = [];
    const myIds = new Set<string>();
    for (const i of inv) {
      if (!myIds.has(i.event.id)) {
        myIds.add(i.event.id);

        // Count attendees for this event
        const { count } = await supabase
          .from("event_invitations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", i.event.id)
          .in("status", ["confirmed", "attended", "rsvp_yes", "pending"]);

        my.push({
          ...i.event,
          tag: "terdaftar",
          invStatus: i.status,
          paymentStatus: i.payment_status,
          invitationId: i.id,
          attendees: count || 0,
        });
      }
    }
    setMyEvents(my);

    // Open events (not registered)
    const { data: allEv } = await supabase
      .from("events")
      .select(
        "id, title, description, type, start_date, end_date, start_time, end_time, location, status, registration_type, quota, speaker_name"
      )
      .in("status", ["published", "ongoing"])
      .order("start_date", { ascending: true });

    const open: DisplayEvent[] = [];
    for (const ev of allEv || []) {
      if (!myIds.has(ev.id)) {
        // Count attendees
        const { count } = await supabase
          .from("event_invitations")
          .select("id", { count: "exact", head: true })
          .eq("event_id", ev.id)
          .in("status", ["confirmed", "attended", "rsvp_yes", "pending"]);

        open.push({ ...ev, tag: "terbuka", attendees: count || 0 });
      }
    }
    setOpenEvents(open);
    setLoading(false);
  }

  /* ─── Actions ─── */
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Berhasil logout");
    push("/login");
  }

  async function payEvent(invitationId: string) {
    try {
      const res = await fetch(`/api/pay/${invitationId}`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.payLink) window.open(data.payLink, "_blank");
    } catch (e: any) {
      toast.error("Gagal: " + e.message);
    }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        setChangingPw(false);
        return;
      }
      toast.success("Password berhasil diubah!");
      setShowPasswordModal(false);
      setNewPassword("");
      setIsFirstLogin(false);
    } catch (e: any) {
      toast.error(e.message);
    }
    setChangingPw(false);
  }

  async function registerForEvent(eventId: string) {
    if (!user?.umkm_id) return;
    setRegistering(eventId);
    try {
      // Use the self-registration API to create invitation + Mayar invoice
      const res = await fetch("/api/daftar/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          email: user.email,
          full_name: profile?.full_name || user.name,
          phone: profile?.whatsapp || "",
          business_name: profile?.business_name || "",
          province: profile?.province || "",
          city: profile?.city || "",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Berhasil mendaftar!");
      if (data.payLink) window.open(data.payLink, "_blank");
      // Reload data
      await loadData(user);
    } catch (e: any) {
      toast.error(e.message || "Gagal mendaftar");
    } finally {
      setRegistering(null);
    }
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ color: "#94A3B8", fontSize: 14, fontFamily: "var(--font-sora)" }}>Memuat data...</div>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "var(--font-sora), system-ui, sans-serif" }}>
      {/* ═══ HEADER ═══ */}
      <header
        style={{
          background: "#fff",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="https://udupiblnzlzjmaafvdtv.supabase.co/storage/v1/object/public/umkmConnect/logo%20RoutineClass.png"
            alt=""
            style={{ width: 24, height: 24, borderRadius: 5 }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", letterSpacing: "0.03em" }}>
            PORTAL MONITORING UMKM.MWX
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href="/portal/history"
            style={{
              border: "1px solid #E2E8F0",
              background: "#fff",
              color: "#64748B",
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Riwayat
          </a>
          <button
            onClick={() => setShowProfile(true)}
            title="Profil & Logout"
            style={{
              border: "2px solid #E2E8F0",
              background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              color: "#2563EB",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {(user?.name || profile?.full_name || "U").charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 80px" }}>
        {/* ═══ GREETING ═══ */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#1E293B", margin: 0 }}>
            Halo, {user?.name || profile?.full_name || "UMKM"}! 👋
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 6 }}>
            Siap meningkatkan kapasitas bisnismu hari ini?
          </p>
        </div>

        {/* ═══ AGENDA PELATIHAN KAMU ═══ */}
        {myEvents.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 4, height: 20, borderRadius: 2, background: "#22C55E" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", margin: 0 }}>
                Agenda Pelatihan Kamu
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myEvents.map((ev) => {
                const isPaid = ev.paymentStatus === "pending";
                const isConfirmed =
                  ev.invStatus === "confirmed" || ev.paymentStatus === "paid";

                return (
                  <div
                    key={ev.id}
                    onClick={() => {
                      if (isPaid && ev.invitationId) {
                        payEvent(ev.invitationId!);
                      } else {
                        push(`/portal/events/${ev.id}`);
                      }
                    }}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      padding: "16px 18px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      border: "1px solid #F1F5F9",
                      cursor: "pointer",
                      transition: "box-shadow 0.15s, transform 0.15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Top row: title (wide) + status badge (right) */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      {/* Left: title + info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 6, lineHeight: 1.3 }}>
                          {ev.title}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", fontSize: 12, color: "#64748B" }}>
                          <span>📅 {formatDate(ev.start_date)}</span>
                          {ev.start_time && (
                            <span>🕐 {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""} WIB</span>
                          )}
                        </div>
                        {ev.location && (
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                            📍 {ev.location}
                          </div>
                        )}
                      </div>

                      {/* Right: status badge */}
                      <div
                        style={{
                          flex: "0 0 auto",
                          textAlign: "center",
                          padding: "6px 12px",
                          borderRadius: 10,
                          background: isConfirmed ? "#F0FDF4" : isPaid ? "#FEF3C7" : "#F0F9FF",
                          minWidth: 80,
                        }}
                      >
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Status
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            marginTop: 2,
                            color: isConfirmed ? "#16A34A" : isPaid ? "#D97706" : "#2563EB",
                          }}
                        >
                          {isPaid ? "Belum Bayar" : isConfirmed ? "Terkonfirmasi" : "Terdaftar"}
                        </div>
                      </div>
                    </div>

                    {/* Action hint */}
                    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: isPaid ? "#D97706" : "#2563EB" }}>
                      {isPaid ? "💰 Klik untuk bayar →" : "Klik untuk lihat detail →"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ PELATIHAN TERBUKA ═══ */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 4, height: 20, borderRadius: 2, background: "#2563EB" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", margin: 0 }}>
              Pelatihan Terbuka
            </h2>
          </div>

          {openEvents.length === 0 ? (
            <div style={{
              background: "#fff",
              borderRadius: 16,
              padding: "32px 20px",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: 13,
              border: "1px solid #F1F5F9",
            }}>
              Tidak ada pelatihan terbuka saat ini.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {openEvents.map((ev) => {
                const percent = getQuotaPercent(ev.quota, ev.attendees || 0);
                const remaining = (ev.quota || 0) - (ev.attendees || 0);
                const barColor = getQuotaColor(percent);

                return (
                  <div
                    key={ev.id}
                    onClick={() => registerForEvent(ev.id)}
                    style={{
                      background: "#fff",
                      borderRadius: 16,
                      padding: "16px 18px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      border: "1px solid #F1F5F9",
                      cursor: "pointer",
                      transition: "box-shadow 0.15s, transform 0.15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    {/* Top row: badge + date */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#2563EB",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        TERBUKA
                      </span>
                      <span style={{ fontSize: 12, color: "#94A3B8" }}>
                        {formatDate(ev.start_date)}
                      </span>
                    </div>

                    {/* Title */}
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 6, lineHeight: 1.3 }}>
                      {ev.title}
                    </div>

                    {/* Meta: location + capacity */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 12, color: "#64748B", marginBottom: 10 }}>
                      {ev.location && <span>📍 {ev.location}</span>}
                      {ev.quota && <span>👥 Kapasitas {ev.quota}</span>}
                    </div>

                    {/* Quota progress */}
                    {ev.quota && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748B", marginBottom: 4 }}>
                          <span>Sisa Kuota</span>
                          <span style={{ fontWeight: 700, color: barColor }}>
                            {Math.max(0, remaining)} / {ev.quota}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "#F1F5F9", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${percent}%`,
                              borderRadius: 3,
                              background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action hint */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2563EB" }}>
                      {registering === ev.id ? "Mendaftar..." : "Klik untuk daftar →"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ═══ PROFILE MODAL ═══ */}
      {showProfile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProfile(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#1E293B",
                  margin: 0,
                }}
              >
                Profil Usaha
              </h3>
              <button
                onClick={() => setShowProfile(false)}
                style={{
                  border: "none",
                  background: "#F1F5F9",
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#64748B",
                }}
              >
                ✕
              </button>
            </div>

            {profile ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["NAMA USAHA", profile.business_name],
                  ["PEMILIK", profile.full_name],
                  ["KOTA", profile.city],
                  ["EMAIL", profile.email],
                  ["WHATSAPP", profile.whatsapp],
                  ...(profile.business_category?.length
                    ? [["KATEGORI", profile.business_category.join(", ")]]
                    : []),
                  ...(profile.monthly_revenue_estimate
                    ? [["OMSET/BULAN", profile.monthly_revenue_estimate]]
                    : []),
                  ...(profile.employee_count
                    ? [["KARYAWAN", `${profile.employee_count} orang`]]
                    : []),
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr",
                      gap: "2px 12px",
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ color: "#94A3B8", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                      {label}
                    </span>
                    <span style={{ color: "#1E293B", fontSize: 13, fontWeight: 600 }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" }}>
                Profil belum lengkap.
              </p>
            )}

            {/* Logout button */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  border: "1px solid #FEE2E2",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  padding: "10px 0",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PASSWORD CHANGE MODAL ═══ */}
      {showPasswordModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isFirstLogin)
              setShowPasswordModal(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "32px 28px",
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "#1E293B" }}>
              Ganti Password
            </h2>
            <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
              {isFirstLogin
                ? "Demi keamanan, kamu harus ganti password sebelum melanjutkan."
                : "Masukkan password baru kamu."}
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password baru (min. 6 karakter)"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                border: "1.5px solid #E2E8F0",
                borderRadius: 12,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 16,
                textAlign: "center",
              }}
            />
            <button
              onClick={changePassword}
              disabled={changingPw}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: changingPw ? "wait" : "pointer",
                background: "#2563EB",
                color: "#fff",
              }}
            >
              {changingPw ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
