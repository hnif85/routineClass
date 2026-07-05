"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const C = 289;

export default function DashboardPage() {
  const s = createClient();
  const [d, setD] = useState<any>({ loading: true });
  const [isMobile, setIsMobile] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [trainerEvents, setTrainerEvents] = useState<any[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    (async () => {
      const { count: totalUmkm } = await s.from("umkm").select("*", { count: "exact", head: true }).eq("is_active", true);
      const { count: withNib } = await s.from("umkm").select("*", { count: "exact", head: true }).eq("is_active", true).eq("has_nib", true);
      const nibPercent = totalUmkm && totalUmkm > 0 ? Math.round(((withNib || 0) / totalUmkm) * 100) : 0;
      const nibOffset = C * (1 - nibPercent / 100);

      const { data: catData } = await s.from("umkm").select("business_category").eq("is_active", true);
      const categoryCounts: Record<string, number> = {};
      (catData || []).forEach((u: any) => {
        (u.business_category || []).forEach((c: string) => { categoryCounts[c] = (categoryCounts[c] || 0) + 1; });
      });
      const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

      const { data: cityData } = await s.from("umkm").select("city").eq("is_active", true);
      const cityCounts: Record<string, number> = {};
      (cityData || []).forEach((u: any) => { const c = u.city || "Lainnya"; cityCounts[c] = (cityCounts[c] || 0) + 1; });
      const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

      const { data: revData } = await s.from("umkm").select("monthly_revenue_estimate").eq("is_active", true);
      const revCounts: Record<string, number> = {};
      (revData || []).forEach((u: any) => { const r = u.monthly_revenue_estimate || "unknown"; revCounts[r] = (revCounts[r] || 0) + 1; });

      const { data: upcomingEvents } = await s.from("events").select("id, title, start_date, location, type, quota").gte("start_date", new Date().toISOString().split("T")[0]).neq("status", "cancelled").order("start_date").limit(5);

      setD({ totalUmkm, withNib, nibPercent, nibOffset, topCategories, cityCounts, topCities, revCounts, upcomingEvents, loading: false });
      // Fetch user role + trainer schedule
      fetch("/api/auth/me").then(r => r.json()).then(res => {
        if (res.user) {
          setUserRole(res.user.role);
          if (res.user.role === "pemateri" && res.user.email) {
            // Find trainer in admin_users by email
            s.from("admin_users").select("id").eq("email", res.user.email).single().then(({ data: admin }) => {
              if (admin) {
                s.from("events").select("id, title, start_date, location, type, quota, status, speaker_name")
                  .contains("speaker_ids", [admin.id])
                  .gte("start_date", new Date().toISOString().split("T")[0])
                  .order("start_date")
                  .then(({ data }) => setTrainerEvents(data || []));
              }
            });
          }
        }
      });
    })();
  }, []);

  if (d.loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#64748B', fontSize: 14 }}>Memuat dashboard...</div>;
  }

  const { totalUmkm, withNib, nibPercent, nibOffset, topCategories, cityCounts, topCities, revCounts, upcomingEvents } = d;
  const catMax = topCategories.length > 0 ? Math.max(...topCategories.map(([, v]: [string, number]) => v)) : 1;
  const cityMax = topCities.length > 0 ? Math.max(...topCities.map(([, v]: [string, number]) => v)) : 1;

  const revLabels: Record<string, string> = { "<5jt": "< Rp 5 jt", "5-15jt": "Rp 5–15 jt", "15-50jt": "Rp 15–50 jt", ">50jt": "> Rp 50 jt", "unknown": "Tidak diketahui" };
  const revOrder = ["<5jt", "5-15jt", "15-50jt", ">50jt"];
  const revMax = Math.max(...revOrder.map((r) => revCounts[r] || 0), 1);

  const barW = (v: number, max: number) => `${Math.max((v / max) * 100, 4)}%`;

  const kpiCols = isMobile ? '1fr' : 'repeat(3, 1fr)';
  const panelCols = isMobile ? '1fr' : 'repeat(3, 1fr)';
  const mainGrid = isMobile ? '1fr' : '1fr 360px';
  const pageTitleSize = isMobile ? 24 : 34;
  const kpiFontSize = isMobile ? 30 : 44;

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#2563EB' }}>
            Program Pembinaan UMKM
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: pageTitleSize, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>
            Dashboard Binaan
          </h2>
          <p style={{ color: '#64748B', fontSize: 13.5, marginTop: 6, maxWidth: isMobile ? '100%' : 520 }}>
            Selamat datang di Routine Class MWX. Kelola event, peserta, dan materi pelatihan di satu tempat.
          </p>
        </div>
        <div style={{ marginLeft: isMobile ? 0 : 'auto', marginTop: isMobile ? 0 : 4, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/umkm/import" className="btn" style={{ padding: '8px 14px', fontSize: 12.5 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Import CSV
          </Link>
          <Link href="/events/new" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Buat Event
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <section style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: isMobile ? 12 : 18, marginBottom: 24 }}>
        {/* KPI 1 */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#EFF6FF', color: '#2563EB' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <circle cx="9" cy="8" r="3.2" /><path d="M2.5 19c.5-3.2 3-5 6.5-5s6 1.8 6.5 5" /><path d="M17 7.5a3 3 0 0 1 0 5.6M21.5 19c-.3-2-1.4-3.5-3.2-4.3" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#EFF6FF', color: '#2563EB' }}>Aktif</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Total UMKM Binaan</div>
          <div className="num" style={{ fontSize: kpiFontSize, fontWeight: 800, lineHeight: 1, margin: '3px 0 6px', letterSpacing: '-0.025em' }}>
            {(totalUmkm || 0).toLocaleString("id-ID")}
          </div>
          <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
            Tersebar di <b style={{ color: '#1E293B', fontWeight: 700 }}>{Object.keys(cityCounts).length} kecamatan</b> Jakarta
          </div>
        </div>

        {/* KPI 2: NIB */}
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: isMobile ? 16 : 22,
          boxShadow: 'var(--shadow)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
          alignItems: 'center', gap: isMobile ? 12 : 8,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#E7EEFB', color: '#3C68B5' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                  <path d="M9 12.5l2 2 4-4.5" /><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 3v0M9 7h6" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Kepemilikan NIB</div>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 500, marginTop: 4 }}>
              <b className="num" style={{ color: '#1E293B', fontWeight: 700 }}>{withNib || 0}</b> dari {totalUmkm || 0} UMKM sudah ber-NIB
            </div>
            <div style={{ marginTop: 10, height: 5, borderRadius: 999, background: '#EEF1EA', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #3B82F6, #2563EB)', width: `${nibPercent}%`, transition: 'width 1.1s cubic-bezier(.22,1,.36,1)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748B', marginTop: 6, fontWeight: 600 }}>
              <span>Progres ke target</span><span>Target 80%</span>
            </div>
          </div>
          {/* Donut */}
          {!isMobile && (
            <div style={{ width: 100, height: 100, position: 'relative', flex: '0 0 auto' }}>
              <svg width="100" height="100" viewBox="0 0 108 108" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="54" cy="54" r="46" fill="none" stroke="#EEF1EA" strokeWidth="12" />
                <circle cx="54" cy="54" r="46" fill="none" stroke="url(#gleaf)" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={nibOffset} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
                <defs><linearGradient id="gleaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3BC177" /><stop offset="1" stopColor="#2563EB" /></linearGradient></defs>
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
                <div className="num" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{nibPercent}%</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginTop: 2 }}>BER-NIB</div>
              </div>
            </div>
          )}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 40, borderRadius: 10, background: '#EEF1EA', position: 'relative', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 10, background: 'linear-gradient(90deg, #3B82F6, #2563EB)', width: `${nibPercent}%`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{nibPercent}%</span>
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>BER-NIB</span>
            </div>
          )}
        </div>

        {/* KPI 3 */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: isMobile ? 16 : 22, boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#FBEFD6', color: '#B57A1E' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
                <rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" />
              </svg>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#F0F2EC', color: '#64748B' }}>30 hari</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Event Mendatang</div>
          <div className="num" style={{ fontSize: kpiFontSize, fontWeight: 800, lineHeight: 1, margin: '3px 0 6px', letterSpacing: '-0.025em' }}>
            {upcomingEvents?.length || 0}
          </div>
          {upcomingEvents && upcomingEvents.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {upcomingEvents.slice(0, 3).map((ev: any) => {
                const d = new Date(ev.start_date);
                return (
                  <div key={ev.id} style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#F4F6F0', border: '1px solid var(--border-2)', borderRadius: 8, padding: '4px 8px', display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ color: '#E2A33A', fontWeight: 800 }}>{d.getDate()}</span>
                    {d.toLocaleDateString("id-ID", { month: "short" })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Grid: Panels + Events */}
      <div style={{ display: 'grid', gridTemplateColumns: mainGrid, gap: 18, alignItems: 'start' }}>
        {/* LEFT */}
        <section>
          <SectionHeader title="Profil UMKM" count={`${totalUmkm || 0} binaan`} />
          <div style={{ display: 'grid', gridTemplateColumns: panelCols, gap: isMobile ? 12 : 14 }}>
            <CtxBox title="Per Kategori" count={`${topCategories.length} jenis`}>
              {topCategories.map(([cat, cnt]: [string, number]) => <RowBar key={cat} label={cat.replace(/_/g, " ")} value={cnt} maxVal={catMax} />)}
              {topCategories.length === 0 && <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', padding: 20 }}>Belum ada data</div>}
            </CtxBox>
            <CtxBox title="Per Kecamatan" count={`${topCities.length} wilayah`}>
              {topCities.map(([city, cnt]: [string, number]) => <RowBar key={city} label={city} value={cnt} maxVal={cityMax} colorClass="fill-blue" />)}
              {topCities.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)', fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                  Konsentrasi tertinggi di <b style={{ color: '#1E293B' }}>{topCities[0][0]}</b>
                </div>
              )}
            </CtxBox>
            <CtxBox title="Per Omzet / Bulan" count="Rp">
              {revOrder.map((r) => {
                const cnt = revCounts[r] || 0;
                const isZero = cnt === 0;
                return (
                  <div key={r} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: isZero ? '#64748B' : '#1E293B' }}>{revLabels[r] || r}</span>
                      <span className="num" style={{ fontSize: 13, fontWeight: 700, color: isZero ? '#64748B' : '#1E293B' }}>{cnt}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: '#F0F2EC', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: isZero ? '#E2E6DD' : 'linear-gradient(90deg, #E2A33A, #D48C1E)', width: barW(cnt, revMax) }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--border)', fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>
                Mayoritas di segmen <b style={{ color: '#1E293B' }}>Rp 5–15 jt</b>
              </div>
            </CtxBox>
          </div>
        </section>

        {/* RIGHT: Events */}
        <section>
          <SectionHeader title="Event Mendatang" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(!upcomingEvents || upcomingEvents.length === 0) && (
              <div style={{ border: '1.5px dashed var(--border)', borderRadius: 18, padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13, fontWeight: 600 }}>
                Belum ada event mendatang
              </div>
            )}
            {upcomingEvents?.map((ev: any, i: number) => {
              const isAmber = i % 2 === 1;
              const d = new Date(ev.start_date);
              return (
                <Link key={ev.id} href={`/events/${ev.id}`} className="card-hover" style={{
                  background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: isMobile ? 14 : 16,
                  boxShadow: 'var(--shadow)', display: 'flex', gap: isMobile ? 10 : 14, transition: 'all 0.2s',
                  cursor: 'pointer', position: 'relative', overflow: 'hidden', textDecoration: 'none', color: 'inherit',
                }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: isAmber ? '#E2A33A' : '#3B82F6' }} />
                  <div style={{ flex: '0 0 auto', width: 48, textAlign: 'center', borderRadius: 10, padding: isMobile ? '6px 0' : '10px 0', background: isAmber ? '#FBEFD6' : '#EFF6FF', color: isAmber ? '#B57A1E' : '#2563EB' }}>
                    <div className="num" style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>
                      {d.toLocaleDateString("id-ID", { month: "short" })}
                    </div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: isMobile ? 13.5 : 14.5, fontWeight: 700, lineHeight: 1.25, color: '#1E293B' }}>{ev.title}</div>
                    <div style={{ fontSize: isMobile ? 11.5 : 12.5, color: '#64748B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, opacity: 0.7 }}>
                        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.4" />
                      </svg>
                      {ev.location || "Online"}
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 5, background: '#F0F2EC', color: '#475569' }}>{ev.type || "offline"}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
            <Link href="/events/new" className="hover:border-[var(--leaf)] hover:text-[var(--leaf-strong)]" style={{
              border: '1.5px dashed var(--border)', borderRadius: 18, padding: isMobile ? 12 : 15, textAlign: 'center',
              color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s',
              background: 'transparent', textDecoration: 'none', display: 'block',
            }}>
              + Tambah event baru
            </Link>
          </div>
        </section>
        {/* Trainer Schedule */}
        {userRole === "pemateri" && (
          <section style={{ marginTop: 32 }}>
            <SectionHeader title="Jadwal Mengajar Saya" count={trainerEvents.length ? `${trainerEvents.length} event` : undefined} />
            {trainerEvents.length === 0 ? (
              <p style={{ color: '#64748B', fontSize: 13 }}>Belum ada jadwal mengajar.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {trainerEvents.map((ev: any) => {
                  const d = new Date(ev.start_date);
                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
                  return (
                    <Link key={ev.id} href={`/events/${ev.id}`} style={{
                      background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: '14px 16px',
                      boxShadow: 'var(--shadow)', display: 'flex', gap: 14, transition: 'all 0.2s', textDecoration: 'none',
                    }}>
                      <div style={{ flex: '0 0 auto', width: 48, textAlign: 'center', borderRadius: 10, padding: '10px 0', background: '#EFF6FF', color: '#2563EB' }}>
                        <div className="num" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{monthNames[d.getMonth()]}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{ev.title}</div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                          {ev.location || "Online"} · {ev.type === "online" ? "Online" : "Offline"}
                          {ev.status === "draft" && <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 600 }}>Draft</span>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h3>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {count && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', background: '#fff', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 999 }}>{count}</span>}
    </div>
  );
}

function RowBar({ label, value, maxVal, colorClass }: { label: string; value: number; maxVal: number; colorClass?: string }) {
  const w = `${Math.max((value / maxVal) * 100, 4)}%`;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{label}</span>
        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: '#F0F2EC', overflow: 'hidden' }}>
        <div className={colorClass || "fill-green"} style={{ height: '100%', width: w, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function CtxBox({ children, title, count }: { children: React.ReactNode; title: string; count: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 18, padding: 16, boxShadow: 'var(--shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#475569' }}>{title}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>{count}</span>
      </div>
      {children}
    </div>
  );
}
