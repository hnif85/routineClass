"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface HistoryItem {
  event_id: string;
  event_title: string;
  event_start: string;
  event_end: string;
  event_type: string;
  status: string;
  attended: boolean;
  pre_score: number | null;
  post_score: number | null;
  delta: number | null;
  cert_id: string | null;
  cert_number: string | null;
}

export default function PortalHistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/portal/history")
      .then(res => res.json())
      .then(json => {
        setItems(json.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Gagal memuat riwayat");
        setLoading(false);
      });
  }, []);

  const completed = items.filter(i => i.pre_score !== null && i.post_score !== null);
  const certified = items.filter(i => i.cert_id);
  const avgDelta = completed.length > 0
    ? Math.round(completed.reduce((sum, i) => sum + (i.delta || 0), 0) / completed.length)
    : 0;

  if (loading) return <div className="p-8 text-center text-ink-2">Memuat riwayat...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl bg-white border border-border p-4 text-center">
          <div className="text-2xl font-heading text-brand font-bold">{items.length}</div>
          <div className="text-xs text-ink-2 mt-1">Event Diikuti</div>
        </div>
        <div className="rounded-xl bg-white border border-border p-4 text-center">
          <div className="text-2xl font-heading text-leaf font-bold">{certified.length}</div>
          <div className="text-xs text-ink-2 mt-1">Tersertifikasi</div>
        </div>
        <div className="rounded-xl bg-white border border-border p-4 text-center">
          <div className="text-2xl font-heading text-amber font-bold">+{avgDelta}</div>
          <div className="text-xs text-ink-2 mt-1">Rata-rata Peningkatan</div>
        </div>
      </div>

      <h2 className="text-lg font-heading text-brand mb-4">Riwayat Pelatihan</h2>

      {items.length === 0 ? (
        <div className="text-center py-12 text-ink-2">
          <p className="text-lg">Belum ada riwayat pelatihan</p>
          <p className="text-sm mt-1">Ikuti event pelatihan untuk melihat riwayat di sini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.event_id}
              className="rounded-xl bg-white border border-border p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                      item.event_type === "offline" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    }`}>
                      {item.event_type === "offline" ? "Offline" : "Online"}
                    </span>
                    {item.attended && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-leaf-soft text-leaf rounded-full">Hadir</span>
                    )}
                  </div>
                  <Link href={`/portal/events/${item.event_id}`} className="text-brand font-heading font-semibold hover:text-leaf transition-colors">
                    {item.event_title}
                  </Link>
                  <p className="text-xs text-ink-2 mt-0.5">
                    {item.event_start} {item.event_end ? `- ${item.event_end}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  {/* Score */}
                  {item.pre_score !== null && item.post_score !== null ? (
                    <div className="mb-1">
                      <div className="text-sm font-heading font-semibold text-brand">
                        {item.pre_score} → {item.post_score}
                        <span className="text-leaf ml-1">▲+{item.delta}</span>
                      </div>
                      <div className="text-[10px] text-ink-2">Pre → Post</div>
                    </div>
                  ) : item.pre_score !== null ? (
                    <div className="mb-1">
                      <div className="text-sm font-heading text-brand">Pre: {item.pre_score}</div>
                      <div className="text-[10px] text-ink-2">Post: belum</div>
                    </div>
                  ) : (
                    <div className="text-xs text-ink-2 mb-1">Tes belum dikerjakan</div>
                  )}

                  {/* Certificate status */}
                  {item.cert_id ? (
                    <a
                      href={`/api/certificates/${item.cert_id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-leaf text-white rounded-lg hover:bg-leaf-strong transition-colors"
                    >
                      ⬇ Download Sertifikat
                    </a>
                  ) : item.pre_score !== null && item.post_score !== null ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-soft text-amber rounded-lg">
                      ⏳ Menyiapkan sertifikat...
                    </span>
                  ) : (
                    <span className="text-xs text-ink-2">Selesaikan tes untuk mendapat sertifikat</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
