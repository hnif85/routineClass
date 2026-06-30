"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";

export default function AddUmkmButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const baseUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}`
    : "";

  function copyLink() {
    const link = `${baseUrl}/daftar`;
    navigator.clipboard.writeText(link).then(() => {
      toast.success("Link pendaftaran disalin!");
      setOpen(false);
    }).catch(() => {
      toast.error("Gagal menyalin link");
    });
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        className="btn btn-primary"
        style={{ padding: "8px 16px", fontSize: 13 }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Tambah UMKM
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          minWidth: 260,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
          zIndex: 100,
        }}>
          {/* Link Pendaftaran */}
          <button onClick={copyLink}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", border: "none", background: "none",
              cursor: "pointer", fontSize: 13, textAlign: "left", color: "#152019",
              borderBottom: "1px solid var(--border-2)",
              transition: "background 0.12s",
            }}
            className="hover:bg-[#F8F9F5]"
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#DFF5E8", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#1F9D5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Salin Link Pendaftaran</div>
              <div style={{ fontSize: 11.5, color: "#73837A", marginTop: 1 }}>
                Bagikan link ini ke UMKM via WA
              </div>
            </div>
          </button>

          {/* Input Manual */}
          <button
            onClick={() => {
              toast.info("Fitur Input Manual akan segera tersedia");
              setOpen(false);
            }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", border: "none", background: "none",
              cursor: "pointer", fontSize: 13, textAlign: "left", color: "#152019",
              borderBottom: "1px solid var(--border-2)",
              transition: "background 0.12s",
            }}
            className="hover:bg-[#F8F9F5]"
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#FBEFD6", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#E2A33A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Input Manual</div>
              <div style={{ fontSize: 11.5, color: "#73837A", marginTop: 1 }}>
                Isi data UMKM satu per satu
              </div>
            </div>
          </button>

          {/* Import CSV */}
          <Link href="/umkm/import"
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", border: "none", background: "none",
              cursor: "pointer", fontSize: 13, textAlign: "left", color: "#152019",
              textDecoration: "none", transition: "background 0.12s",
            }}
            className="hover:bg-[#F8F9F5]"
            onClick={() => setOpen(false)}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#E7EEFB", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#3C68B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Import CSV</div>
              <div style={{ fontSize: 11.5, color: "#73837A", marginTop: 1 }}>
                Upload file CSV massal
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
