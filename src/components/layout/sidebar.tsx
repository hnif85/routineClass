"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { AppConfig } from "@/lib/config/app-config";
import { useSidebar } from "./sidebar-context";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface SidebarProps { config: AppConfig; }

const MAIN_NAV = [
  { href: "/dashboard", label: "Dashboard",
    icon: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></> },
  { href: "/umkm", label: "Data UMKM", badge: true,
    icon: <><path d="M3 5h18M3 12h18M3 19h18" /></> },
  { href: "/events", label: "Event", badge: true,
    icon: <><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" /></> },
];

const MORE_NAV: { href: string; label: string; icon: React.ReactNode; badge?: boolean }[] = [
  { href: "/tests", label: "Test",
    icon: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></> },
  { href: "/materials", label: "Materi",
    icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M20 2v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20Z" /><path d="M12 6v4m-2-2h4" /></> },
  { href: "/wa-inbox", label: "WA Inbox",
    icon: <><path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-6A8.4 8.4 0 1 1 21 11.5Z" /></> },
  { href: "/admin/sertifikat", label: "Sertifikat",
    icon: <><path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Z" /><path d="M4 13a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z" /><path d="M6 7v6M18 7v6" /></> },
];

const ALL_ICON = (paths: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
    {paths}
  </svg>
);

export function Sidebar({ config }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const [showMore, setShowMore] = useState(false);
  const [evCount, setEvCount] = useState(0);
  const [umkmCount, setUmkmCount] = useState(0);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const s = createClient();
    s.from("events").select("*", { count: "exact", head: true }).then(({ count }) => setEvCount(count || 0));
    s.from("umkm").select("*", { count: "exact", head: true }).eq("is_active", true).then(({ count }) => setUmkmCount(count || 0));
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user) { setUserName(d.user.name); setUserRole(d.user.role); } }).catch(() => {});
  }, []);

  // Filter nav by role
  const filteredNav = (() => {
    const all = [...MAIN_NAV, ...MORE_NAV];
    if (userRole === "pemateri") {
      return all.filter(item => 
        item.href === "/dashboard" || 
        item.href === "/events" || 
        item.href === "/materials"
      );
    }
    if (userRole === "umkm") {
      return all.filter(item => item.href === "/portal");
    }
    return all; // admin, perusahaan — all access
  })();

  const roleLabel = (() => {
    switch (userRole) {
      case "pemateri": return "Trainer";
      case "umkm": return "Peserta";
      case "admin": return "Admin";
      case "perusahaan": return "Mitra";
      default: return config.brand_short_name;
    }
  })();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Berhasil logout");
    window.location.href = "/login";
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* ══════════ DESKTOP SIDEBAR ══════════ */}
      <aside
        className="sidebar desktop-only"
        style={{
          background: 'linear-gradient(180deg, #1E3A5F 0%, #1E3A5F 100%)',
          color: '#E8F1EC', display: 'flex', flexDirection: 'column',
          position: 'sticky', top: 0, height: '100vh',
          overflow: 'hidden', transition: 'all 0.3s ease',
        }}
      >
        {/* Collapsed state */}
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 16 }}>
            <img src="https://udupiblnzlzjmaafvdtv.supabase.co/storage/v1/object/public/umkmConnect/logo%20RoutineClass.png" alt=""
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
            <button onClick={toggle}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.10)', color: '#C9DDD2',
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              title="Buka sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            {/* Topo overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='264' height='560' viewBox='0 0 264 560'%3E%3Cg fill='none' stroke='%2300150d' stroke-opacity='0.5' stroke-width='1.1'%3E%3Cpath d='M-20 70 C60 30 150 110 300 60'/%3E%3Cpath d='M-20 110 C60 70 150 150 300 100'/%3E%3Cpath d='M-20 150 C60 110 150 190 300 140'/%3E%3Cpath d='M-30 470 C70 520 160 440 300 510'/%3E%3Cpath d='M-30 510 C70 560 160 480 300 550'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundSize: 'cover', mixBlendMode: 'soft-light',
            }} />

            {/* Brand + Toggle */}
            <div style={{ position: 'relative', zIndex: 1, padding: '26px 22px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <img src="https://udupiblnzlzjmaafvdtv.supabase.co/storage/v1/object/public/umkmConnect/logo%20RoutineClass.png" alt="MWX"
                style={{ width: 40, height: 40, borderRadius: 10, flex: '0 0 auto', objectFit: 'contain', background: 'rgba(255,255,255,0.12)', padding: 3, boxShadow: '0 4px 12px -4px rgba(0,0,0,0.3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-sora)', fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>{config.app_name}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', color: '#9FC6B2', textTransform: 'uppercase', marginTop: 2 }}>{config.brand_short_name}</div>
              </div>
              <button onClick={toggle}
                style={{
                  border: 'none', background: 'rgba(255,255,255,0.08)', color: '#C9DDD2',
                  width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
                }}
                title="Ciutkan sidebar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>

            {/* Nav items */}
            <nav style={{ position: 'relative', zIndex: 1, padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: '#83AC97', textTransform: 'uppercase', padding: '8px 12px 4px' }}>
                Menu
              </div>
              {filteredNav.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      color: active ? '#fff' : '#C9DDD2', fontSize: 13.5, fontWeight: 600,
                      textDecoration: 'none', transition: 'background 0.18s, color 0.18s',
                      position: 'relative',
                      background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
                    }}
                    className={active ? '' : 'sidebar-link-hover'}
                  >
                    <span style={{ width: 18, height: 18, flex: '0 0 auto', opacity: 0.85, display: 'grid', placeItems: 'center' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>{item.icon}</svg>
                    </span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999 }}>
                        {item.href === "/events" ? evCount : item.href === "/umkm" ? umkmCount : 0}
                      </span>
                    )}
                    {active && (
                      <span style={{
                        position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)',
                        width: 4, height: 20, borderRadius: '0 4px 4px 0', background: '#3B82F6',
                      }} />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', padding: '12px 14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'linear-gradient(135deg, #1D6C49, #0C3624)',
                  display: 'grid', placeItems: 'center',
                  fontFamily: 'var(--font-sora)', fontWeight: 700, color: '#CFF3DF', fontSize: 14, flex: '0 0 auto',
                }}>
                  {config.brand_short_name?.charAt(0) || 'P'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#EAF4EF', lineHeight: 1.15 }}>{userName || config.brand_name}</div>
                  <div style={{ fontSize: 10.5, color: '#86AD98', marginTop: 1 }}>
                    {userName ? `${roleLabel} · v${config.version}` : config.brand_short_name}
                  </div>
                </div>
                {userName && (
                  <button onClick={logout} title="Logout"
                    style={{
                      border: 'none', background: 'rgba(255,255,255,0.08)', color: '#86AD98',
                      width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flex: '0 0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ══════════ MOBILE BOTTOM NAV ══════════ */}
      <nav className="mobile-bottombar" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
        background: '#1E3A5F', display: 'flex', alignItems: 'center',
        padding: '6px 8px', paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        gap: 2, borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        {MAIN_NAV.map(item => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, padding: '6px 4px', borderRadius: 10,
                textDecoration: 'none', position: 'relative',
                background: active ? 'rgba(255,255,255,0.10)' : 'transparent',
              }}>
              <span style={{ width: 20, height: 20, color: active ? '#fff' : '#9FC6B2' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>{item.icon}</svg>
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: active ? '#fff' : '#9FC6B2' }}>{item.label}</span>
              {active && <span style={{ position: 'absolute', top: 0, left: '30%', right: '30%', height: 2, borderRadius: '0 0 2px 2px', background: '#3B82F6' }} />}
            </Link>
          );
        })}

        {/* More button */}
        <button onClick={() => setShowMore(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: '6px 4px', borderRadius: 10,
            border: 'none', background: 'transparent', cursor: 'pointer', color: '#9FC6B2',
          }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
          <span style={{ fontSize: 9.5, fontWeight: 700 }}>Lainnya</span>
        </button>
      </nav>

      {/* ══════════ MOBILE MORE DRAWER ══════════ */}
      {showMore && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999999,
          background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) setShowMore(false); }}>
          <div style={{
            background: '#F4F7FC', borderRadius: '20px 20px 0 0',
            width: '100%', maxWidth: 500, padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748B', padding: '4px 12px 8px' }}>
                Menu Lainnya
              </div>
              {MORE_NAV.map(item => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setShowMore(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      textDecoration: 'none', fontSize: 14, fontWeight: 600,
                      background: active ? '#EFF6FF' : 'transparent',
                      color: active ? '#2563EB' : '#1E293B',
                    }}>
                    <span style={{ width: 20, height: 20 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>{item.icon}</svg>
                    </span>
                    {item.label}
                  </Link>
                );
              })}
              <button onClick={() => { setShowMore(false); logout(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 12,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600, color: '#DC2626', width: '100%', textAlign: 'left',
                }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
            <button onClick={() => setShowMore(false)}
              style={{
                width: '100%', marginTop: 14, padding: 12, borderRadius: 12,
                border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: '#64748B',
              }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
