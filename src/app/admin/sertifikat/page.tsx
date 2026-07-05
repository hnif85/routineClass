"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  config: any;
  created_at: string;
}

export default function SertifikatPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const router = useRouter();

  const fetchTemplates = async () => {
    const res = await fetch("/api/certificate-templates");
    if (res.ok) {
      const json = await res.json();
      setTemplates(json.data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/certificate-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    if (res.ok) {
      const json = await res.json();
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      router.push(`/admin/sertifikat/${json.data.id}/edit`);
    } else {
      const err = await res.json();
      alert(err.error || "Gagal membuat template");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus template "${name}"?`)) return;
    const res = await fetch(`/api/certificate-templates/${id}`, { method: "DELETE" });
    if (res.ok) fetchTemplates();
  };

  if (loading) return <div className="p-8 text-ink-2">Memuat...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading text-brand">Sertifikat</h1>
          <p className="text-ink-2 text-sm mt-1">Kelola template sertifikat pelatihan</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg bg-leaf text-white font-medium hover:bg-leaf-strong transition-colors"
        >
          + Template Baru
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-heading text-brand mb-4">Template Baru</h2>
            <input
              autoFocus
              placeholder="Nama template..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              className="w-full px-3 py-2 border border-border rounded-lg mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <input
              placeholder="Deskripsi (opsional)..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-leaf/30"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-ink-2 hover:text-ink rounded-lg">Batal</button>
              <button onClick={handleCreate} className="px-4 py-2 text-sm bg-leaf text-white rounded-lg hover:bg-leaf-strong">Buat & Edit</button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="text-center py-16 text-ink-2">
          <div className="text-5xl mb-3">🏆</div>
          <p className="text-lg font-medium">Belum ada template</p>
          <p className="text-sm">Klik "Template Baru" untuk membuat desain sertifikat</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="rounded-xl border border-border bg-white p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading text-brand truncate">{t.name}</h3>
                  {t.description && <p className="text-xs text-ink-2 mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
                {t.is_default && (
                  <span className="ml-2 px-2 py-0.5 text-[10px] font-medium bg-leaf-soft text-leaf rounded-full shrink-0">Default</span>
                )}
              </div>

              {/* Mini preview of certificate */}
              <div className="aspect-[1.414/1] bg-surface rounded-lg mb-3 overflow-hidden relative border border-border/50">
                {renderMiniPreview(t.config)}
              </div>

              <div className="flex items-center justify-between text-xs text-ink-2">
                <span>{new Date(t.created_at).toLocaleDateString("id-ID")}</span>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/sertifikat/${t.id}/edit`}
                    className="text-leaf hover:text-leaf-strong font-medium"
                  >
                    Edit
                  </Link>
                  {!t.is_default && (
                    <button onClick={() => handleDelete(t.id, t.name)} className="text-red-500 hover:text-red-600 font-medium">
                      Hapus
                    </button>
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

function renderMiniPreview(config: any) {
  if (!config?.elements) return <div className="w-full h-full flex items-center justify-center text-ink-2/50 text-xs">Kosong</div>;
  // Scale down: A4 landscape 1100x780 → mini preview
  const scale = 0.15;
  return (
    <div className="w-full h-full relative" style={{ backgroundColor: config.page?.bgColor || "#FFFFFF" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: config.page?.width || 1100, height: config.page?.height || 780, position: "relative" }}>
        {(config.elements || []).map((el: any) => (
          <div key={el.id} style={{
            position: "absolute",
            left: el.x, top: el.y, width: el.w, height: el.h,
          }}>
            {el.type === "text" && (
              <div style={{
                fontSize: (el.props?.fontSize || 14),
                fontFamily: el.props?.fontFamily || "inherit",
                color: el.props?.color || "#000",
                fontWeight: el.props?.bold ? "bold" : "normal",
                textAlign: el.props?.align || "left",
                width: "100%", height: "100%",
                display: "flex", alignItems: "center",
                justifyContent: el.props?.align === "center" ? "center" : el.props?.align === "right" ? "flex-end" : "flex-start",
                overflow: "hidden",
              }}>
                {el.props?.content?.replace(/[{].*?[}]/g, "___") || ""}
              </div>
            )}
            {el.type === "image" && <div className="w-full h-full bg-surface/50" />}
            {el.type === "line" && (
              <div style={{ width: "100%", height: el.props?.thickness || 2, backgroundColor: el.props?.color || "#000", marginTop: (el.h - (el.props?.thickness || 2)) / 2 }} />
            )}
            {el.type === "rect" && (
              <div style={{
                width: "100%", height: "100%",
                backgroundColor: el.props?.bgColor || "transparent",
                border: el.props?.borderWidth ? `${el.props.borderWidth}px solid ${el.props.borderColor || "#000"}` : "none",
                borderRadius: el.props?.borderRadius || 0,
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
