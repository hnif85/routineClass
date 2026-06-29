"use client";

import { usePathname } from "next/navigation";
import type { AppConfig } from "@/lib/config/app-config";

interface HeaderProps { config: AppConfig; }

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/umkm": "Data UMKM",
  "/events": "Event",
  "/wa-inbox": "WA Inbox",
};

export function Topbar({ config }: HeaderProps) {
  const pathname = usePathname();
  const label = Object.entries(PAGE_LABELS).find(([k]) => pathname.startsWith(k))?.[1] || "";

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 30px',
        background: 'rgba(245,246,242,0.82)',
        backdropFilter: 'saturate(160%) blur(10px)',
        WebkitBackdropFilter: 'saturate(160%) blur(10px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: '#3C4A42' }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#2FB36B',
          boxShadow: '0 0 0 3px #DFF5E8',
          flex: '0 0 auto',
        }} />
        <span>{config.brand_short_name}</span>
        <span style={{ color: '#73837A', opacity: 0.5 }}>/</span>
        <span style={{ color: '#152019' }}>{label || "Dashboard"}</span>
      </div>

      {/* Live pill */}
      <div style={{
        marginLeft: 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12.5,
        fontWeight: 600,
        color: '#1A7A4C',
        background: '#fff',
        border: '1px solid var(--border)',
        padding: '7px 13px',
        borderRadius: 999,
        boxShadow: 'var(--shadow)',
      }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#2FB36B',
          position: 'relative',
        }}>
          <span style={{
            content: '""',
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: '#2FB36B',
            opacity: 0.35,
            animation: 'ping 1.8s ease-out infinite',
          }} />
        </span>
        Sistem Online
      </div>
    </header>
  );
}
