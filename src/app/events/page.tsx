"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  draft: { bg: '#FBEFD6', fg: '#92400e' },
  published: { bg: '#DFF5E8', fg: '#1F9D5A' },
  ongoing: { bg: '#DFF5E8', fg: '#1F9D5A' },
  completed: { bg: '#F0F2EC', fg: '#73837A' },
  cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
};

const FILTER_STATUS = [
  { value: '', label: 'Semua Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

const FILTER_TYPE = [
  { value: '', label: 'Semua Tipe' },
  { value: 'offline', label: 'Offline' },
  { value: 'online', label: 'Online' },
];

export default function EventsPage() {
  const s = createClient();
  const [events, setEvents] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    s.from("events").select("*", { count: "exact" }).order("start_date", { ascending: false }).then(({ data, count: c }) => {
      setEvents(data || []);
      setCount(c || 0);
      setLoading(false);
    });
  }, []);

  const filtered = events.filter(e => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (typeFilter && e.type !== typeFilter) return false;
    return true;
  });

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1F9D5A' }}>
            Event & Pelatihan
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>
            Event
          </h2>
          <p style={{ color: '#73837A', fontSize: 13.5, marginTop: 6 }}>
            {loading ? "Memuat..." : `${filtered.length} dari ${count} event`}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', marginTop: 4 }}>
          <Link href="/events/new" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Buat Event
          </Link>
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{
          flex: '1 0 200px', maxWidth: 360, position: 'relative',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#73837A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 15, height: 15, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama event..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
              border: '1px solid var(--border)', fontSize: 13, background: '#fff',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter Status */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
          padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13,
          background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 130,
        }}>
          {FILTER_STATUS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Filter Type */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
          padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13,
          background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 130,
        }}>
          {FILTER_TYPE.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Result count chip */}
        {filtered.length < count && (
          <span style={{
            fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999,
            background: '#E7EEFB', color: '#3C68B5', whiteSpace: 'nowrap',
          }}>
            {filtered.length} hasil
          </span>
        )}
      </div>

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)', borderRadius: 18,
          padding: 48, textAlign: 'center', boxShadow: 'var(--shadow)',
        }}>
          <p style={{ color: '#73837A', fontSize: 14 }}>
            {search || statusFilter || typeFilter
              ? "Tidak ada event yang cocok dengan filter."
              : "Belum ada event."}
          </p>
        </div>
      )}

      {/* Event Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map((e: any, i: number) => {
          const st = STATUS_STYLES[e.status] || STATUS_STYLES.draft;
          const d = new Date(e.start_date);
          return (
            <div key={e.id} style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 20,
              boxShadow: 'var(--shadow)',
              transition: 'all 0.2s',
              animation: 'fade-in-up 0.5s ease-out both',
              animationDelay: `${(i % 6) * 0.05}s`,
            }} className="card-hover">
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-sora)',
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#152019',
                    letterSpacing: '-0.01em',
                  }}>
                    {e.title}
                  </h3>
                  <p style={{ fontSize: 13, color: '#73837A', marginTop: 4 }}>
                    {d.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    {e.start_time && ` • ${e.start_time}`}
                  </p>
                </div>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  background: st.bg,
                  color: st.fg,
                }}>
                  {e.status}
                </span>
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12.5, color: '#73837A', marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.4" />
                  </svg>
                  {e.location || "Online"}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {e.quota ? `${e.quota} peserta` : "Tak terbatas"}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                  {e.speaker_name || "-"}
                </span>
                <span style={{
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: '#F0F2EC',
                  fontWeight: 700,
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#3C4A42',
                }}>
                  {e.type || "offline"}
                </span>
              </div>

              {/* Description */}
              {e.description && (
                <p className="line-clamp-2" style={{ fontSize: 14, color: '#3C4A42', marginBottom: 14 }}>
                  {e.description}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href={`/events/${e.id}`} className="btn" style={{ padding: '8px 14px', fontSize: 13 }}>
                  Detail
                </Link>
                {e.status === "draft" && (
                  <Link href={`/events/${e.id}`} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}>
                    Undang UMKM →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
