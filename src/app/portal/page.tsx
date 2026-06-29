"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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
  email: string;
  whatsapp: string;
  business_category: string[];
  monthly_revenue_estimate: string;
  employee_count: number;
  year_established: number;
}

interface EventInvitation {
  id: string;
  status: string;
  rsvp_at: string | null;
  attended_at: string | null;
  event: {
    id: string;
    title: string;
    description: string;
    type: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    status: string;
    quota: number | null;
    speaker_name: string | null;
  };
}

interface DisplayEvent {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  status: string;
  quota: number | null;
  speaker_name: string | null;
  registration_type: string;
  /** Tag: undangan-dari-admin / terdaftar-sendiri / terbuka */
  tag: "undangan" | "terdaftar" | "terbuka";
  invStatus?: string; // invitation status if applicable
}

export default function PortalPage() {
  const { push } = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [profile, setProfile] = useState<UmkmProfile | null>(null);
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (d) => {
        if (!d.user || d.user.role !== "umkm") {
          push("/login");
          return;
        }
        setUser(d.user);
        await loadData(d.user);
      })
      .catch(() => push("/login"));
  }, []);

  async function loadData(u: UserInfo) {
    if (!u.umkm_id) return;

    // Load UMKM profile
    const { data: p } = await supabase
      .from("umkm")
      .select("*")
      .eq("id", u.umkm_id)
      .single();
    setProfile(p);

    // Load all events: invited + open
    const { data: rawInv } = await supabase
      .from("event_invitations")
      .select("status, event:events(*)")
      .eq("umkm_id", u.umkm_id);
    const inv: { status: string; event: any }[] = rawInv || [];
    const invitedEventIds = new Set(inv.map((i) => i.event.id));

    const { data: allEv } = await supabase
      .from("events")
      .select("id, title, description, type, start_date, end_date, location, status, registration_type, quota, speaker_name")
      .in("status", ["published", "ongoing"])
      .order("start_date", { ascending: true });

    const list: DisplayEvent[] = [];
    const addedIds = new Set<string>();

    // 1) Events user is INVITED to (from admin)
    for (const i of inv) {
      if (!addedIds.has(i.event.id)) {
        addedIds.add(i.event.id);
        if (i.event.status === "published" || i.event.status === "ongoing") {
          list.push({
            ...i.event,
            registration_type: i.event.registration_type || "invitation",
            tag: "undangan",
            invStatus: i.status,
          });
        }
      }
    }

    // 2) Events user already registered (rsvp_yes) via self-register
    for (const i of inv) {
      if (!addedIds.has(i.event.id) && i.status === "rsvp_yes") {
        addedIds.add(i.event.id);
        list.push({
          ...i.event,
          registration_type: i.event.registration_type || "invitation",
          tag: "terdaftar",
          invStatus: i.status,
        });
      }
    }

    // 3) Open / published events user hasn't joined yet
    for (const ev of allEv || []) {
      if (!addedIds.has(ev.id)) {
        addedIds.add(ev.id);
        list.push({
          ...ev,
          tag: "terbuka",
        });
      }
    }

    setEvents(list);
    setLoading(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Berhasil logout");
    push("/login");
  }

  async function registerForEvent(eventId: string) {
    if (!user?.umkm_id) return;
    setRegistering(eventId);
    try {
      const { error } = await supabase.from("event_invitations").insert({
        event_id: eventId,
        umkm_id: user.umkm_id,
        status: "rsvp_yes",
        rsvp_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Berhasil mendaftar!");
      // Update tag in-place
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, tag: "terdaftar" as const, invStatus: "rsvp_yes" }
            : e
        )
      );
    } catch (e: any) {
      toast.error(e.message || "Gagal mendaftar");
    } finally {
      setRegistering(null);
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      sent: { bg: "#E0E7FF", color: "#3730A3", label: "Undangan Terkirim" },
      rsvp_yes: { bg: "#DFF5E8", color: "#1F9D5A", label: "Konfirmasi Hadir" },
      rsvp_no: { bg: "#FEE2E2", color: "#991B1B", label: "Tidak Hadir" },
      attended: { bg: "#D1FAE5", color: "#065F46", label: "Hadir" },
      no_show: { bg: "#FEF3C7", color: "#92400E", label: "Tidak Datang" },
      cancelled: { bg: "#F3F4F6", color: "#6B7280", label: "Dibatalkan" },
    };
    const s = styles[status] || styles.sent;
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          background: s.bg,
          color: s.color,
        }}
      >
        {s.label}
      </span>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F6F2",
        }}
      >
        <div style={{ color: "#73837A", fontSize: 14 }}>Memuat data...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F6F2" }}>
      {/* ══ HEADER ══ */}
      <header
        style={{
          background: "#0F3D2B",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="https://pupukkaltim.com/public/assets/files/img/logodasar.png"
            alt=""
            style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", padding: 3 }}
          />
          <div>
            <div
              style={{
                fontFamily: "var(--font-sora)",
                fontSize: 14,
                fontWeight: 700,
                color: "#EAF4EF",
                lineHeight: 1.15,
              }}
            >
              Portal UMKM
            </div>
            <div style={{ fontSize: 10.5, color: "#86AD98", marginTop: 1 }}>
              {user?.email}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Profile trigger */}
          <button
            onClick={() => setShowProfile(true)}
            title="Lihat profil"
            style={{
              border: "2px solid rgba(255,255,255,0.2)",
              background: "linear-gradient(135deg, #2FB36B, #1F9D5A)",
              width: 34,
              height: 34,
              borderRadius: "50%",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sora)",
            }}
          >
            {(user?.name || profile?.full_name || "U").charAt(0).toUpperCase()}
          </button>
          <button
            onClick={handleLogout}
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "#CFF3DF",
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 80px" }}>
        {/* ══ GREETING ══ */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: 22,
              fontWeight: 800,
              color: "#152019",
              margin: 0,
            }}
          >
            Halo, {user?.name || profile?.full_name || "UMKM"}!
          </h1>
          <p style={{ fontSize: 13, color: "#73837A", marginTop: 4 }}>
            Selamat datang di portal monitoring UMKM Pupuk Kaltim
          </p>
        </div>

        {/* ══ EVENT ══ */}
        <section
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 20,
            marginBottom: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: 15,
              fontWeight: 700,
              color: "#152019",
              margin: "0 0 14px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#2FB36B" strokeWidth="2" style={{ width: 18, height: 18 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Event
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                background: "#2FB36B",
                borderRadius: 10,
                padding: "1px 8px",
              }}
            >
              {events.length}
            </span>
          </h2>

          {events.length === 0 ? (
            <p style={{ fontSize: 13, color: "#73837A", margin: 0 }}>
              Belum ada event tersedia.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (ev.tag !== "terbuka") push(`/portal/events/${ev.id}`);
                  }}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background:
                      ev.tag === "terbuka" ? "#FFF9E6"
                      : ev.tag === "undangan" ? "#F5F6F2"
                      : "#F0FDF4",
                    border: ev.tag === "terbuka" ? "1px solid #FBEFD6" : "1px solid transparent",
                    cursor: ev.tag !== "terbuka" ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                  onMouseOver={e => { if (ev.tag !== "terbuka") e.currentTarget.style.background = "#E7EAE2"; }}
                  onMouseOut={e => { if (ev.tag !== "terbuka") e.currentTarget.style.background = ev.tag === "undangan" ? "#F5F6F2" : "#F0FDF4"; }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "1px 7px",
                          borderRadius: 4,
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          background:
                            ev.tag === "terbuka" ? "#FBEFD6"
                            : ev.tag === "undangan" ? "#E0E7FF"
                            : "#DFF5E8",
                          color:
                            ev.tag === "terbuka" ? "#92400E"
                            : ev.tag === "undangan" ? "#3730A3"
                            : "#065F46",
                        }}
                      >
                        {ev.tag === "terbuka" ? "Terbuka"
                          : ev.tag === "undangan" ? "Undangan"
                          : "Terdaftar"}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#152019" }}>
                        {ev.title}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#73837A", marginTop: 2 }}>
                      {ev.start_date}
                      {ev.type && ` · ${ev.type}`}
                      {ev.location && ` · ${ev.location}`}
                      {ev.quota && ` · Kuota: ${ev.quota}`}
                    </div>
                    {ev.description && (
                      <div style={{ fontSize: 11, color: "#86AD98", marginTop: 3, lineHeight: 1.4 }}>
                        {ev.description.length > 80 ? ev.description.slice(0, 80) + "..." : ev.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                    {ev.tag === "undangan" && ev.invStatus && getStatusBadge(ev.invStatus)}
                    {ev.tag === "undangan" && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#73837A" strokeWidth="2" style={{ width: 14, height: 14 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                    {ev.tag === "terbuka" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); registerForEvent(ev.id); }}
                        disabled={registering === ev.id}
                        style={{
                          border: "none",
                          background: registering === ev.id ? "#86AD98" : "#2FB36B",
                          color: "#fff",
                          padding: "7px 16px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: registering === ev.id ? "wait" : "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {registering === ev.id ? "..." : "Daftar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ══ PROFILE MODAL ══ */}
      {showProfile && profile && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 999999,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowProfile(false); }}
        >
          <div style={{
            background: "#F5F6F2", borderRadius: 24, padding: "28px 24px",
            width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "var(--font-sora)", fontSize: 17, fontWeight: 700, color: "#152019", margin: 0 }}>
                Profil Usaha
              </h3>
              <button onClick={() => setShowProfile(false)}
                style={{ border: "none", background: "#E7EAE2", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#3C4A42" }}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "6px 12px", alignItems: "baseline" }}>
                <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>NAMA USAHA</span>
                <span style={{ color: "#152019", fontWeight: 600 }}>{profile.business_name}</span>

                <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>PEMILIK</span>
                <span style={{ color: "#152019", fontWeight: 600 }}>{profile.full_name}</span>

                <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>KOTA</span>
                <span style={{ color: "#152019" }}>{profile.city}</span>

                <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>EMAIL</span>
                <span style={{ color: "#152019" }}>{profile.email}</span>

                <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>WHATSAPP</span>
                <span style={{ color: "#152019" }}>{profile.whatsapp}</span>

                {profile.business_category && profile.business_category.length > 0 && <>
                  <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>KATEGORI</span>
                  <span style={{ color: "#152019" }}>{profile.business_category.join(", ")}</span>
                </>}

                {profile.monthly_revenue_estimate && <>
                  <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>OMSET</span>
                  <span style={{ color: "#152019" }}>{profile.monthly_revenue_estimate}</span>
                </>}

                {profile.employee_count && <>
                  <span style={{ color: "#73837A", fontSize: 10.5, fontWeight: 600 }}>KARYAWAN</span>
                  <span style={{ color: "#152019" }}>{profile.employee_count} orang</span>
                </>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
