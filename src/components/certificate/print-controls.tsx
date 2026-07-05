"use client";

export default function PrintControls({ certNumber }: { certNumber: string }) {
  return (
    <div className="no-print" style={{
      position: "fixed", top: 16, right: 16, left: 16, zIndex: 1000,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
      padding: "12px 20px", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "Sora" }}>
        🏆 {certNumber}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            backgroundColor: "#1E3A5F", color: "#fff",
            fontFamily: "Plus Jakarta Sans", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ⬇ Download PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0",
            backgroundColor: "#fff", color: "#475569",
            fontFamily: "Plus Jakarta Sans", fontSize: 13, cursor: "pointer",
          }}
        >
          Tutup
        </button>
      </div>
    </div>
  );
}
