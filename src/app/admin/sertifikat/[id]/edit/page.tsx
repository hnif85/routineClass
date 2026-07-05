"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import ElementPalette from "@/components/certificate-editor/element-palette";
import PropertiesPanel from "@/components/certificate-editor/properties-panel";
import EditorCanvas from "@/components/certificate-editor/editor-canvas";

interface Element {
  id: string;
  type: string;
  x: number; y: number; w: number; h: number;
  props: Record<string, any>;
}

interface TemplateConfig {
  page: { width: number; height: number; bgColor: string; padding: number };
  elements: Element[];
}

let _elCounter = 0;
function genId(): string {
  _elCounter++;
  return `el_${_elCounter}_${Date.now().toString(36)}`;
}

function createDefaultElement(type: string): Element {
  const id = genId();
  const base = { id, type, x: 100, y: 100, w: 200, h: 40 };
  switch (type) {
    case "text": return { ...base, w: 400, h: 50, props: { content: "Teks Baru", fontSize: 24, fontFamily: "Sora", color: "#1E3A5F", bold: false, align: "center" } };
    case "image": return { ...base, w: 100, h: 100, props: { src: "https://udupiblnzlzjmaafvdtv.supabase.co/storage/v1/object/public/umkmConnect/logo%20RoutineClass.png" } };
    case "line":  return { ...base, w: 300, h: 2, props: { color: "#E2A33A", thickness: 2 } };
    case "rect":  return { ...base, w: 200, h: 100, props: { bgColor: "transparent", borderColor: "#1E3A5F", borderWidth: 2, borderRadius: 8 } };
    default: return { ...base, props: {} };
  }
}

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [config, setConfig] = useState<TemplateConfig>({
    page: { width: 1100, height: 780, bgColor: "#FFFFFF", padding: 40 },
    elements: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [zoom, setZoom] = useState(60); // percent
  const [showBgPicker, setShowBgPicker] = useState(false);

  const templateId = params.id as string;
  const isNew = templateId === "new";

  useEffect(() => {
    if (isNew) {
      setTemplateName("Template Baru");
      setLoading(false);
      return;
    }
    fetch(`/api/certificate-templates/${templateId}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setTemplateName(json.data.name);
          setConfig(json.data.config || config);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [templateId]);

  const selectedEl = config.elements.find(el => el.id === selectedId) || null;

  const addElement = useCallback((type: string) => {
    const el = createDefaultElement(type);
    // Offset for multiple adds
    const count = config.elements.filter(e => e.type === type).length;
    el.x += count * 20;
    el.y += count * 20;
    setConfig(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }, [config.elements]);

  const updateElement = useCallback((id: string, props: Record<string, any>) => {
    setConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, props } : el),
    }));
  }, []);

  const moveElement = useCallback((id: string, x: number, y: number) => {
    setConfig(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, x, y } : el),
    }));
  }, []);

  const removeElement = useCallback((id: string) => {
    setConfig(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id),
    }));
    setSelectedId(null);
  }, []);

  const updatePageConfig = useCallback((key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      page: { ...prev.page, [key]: value },
    }));
  }, []);

  const handleSave = async () => {
    if (!templateName.trim()) return;
    setSaving(true);
    try {
      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/certificate-templates" : `/api/certificate-templates/${templateId}`;
      const body = isNew
        ? { name: templateName, description: "", config }
        : { name: templateName, config };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const json = await res.json();
        if (isNew && json.data?.id) {
          router.push(`/admin/sertifikat/${json.data.id}/edit`);
        } else {
          alert("Template tersimpan!");
        }
      } else {
        const err = await res.json();
        alert(err.error || "Gagal menyimpan");
      }
    } catch (e: any) {
      alert("Gagal menyimpan: " + e.message);
    }
    setSaving(false);
  };

  // Drag and drop from palette to canvas using native DnD
  const handlePaletteDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData("element-type", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("element-type");
    if (!type) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const el = createDefaultElement(type);
    el.x = Math.round((e.clientX - rect.left) / 0.6 - el.w / 2);
    el.y = Math.round((e.clientY - rect.top) / 0.6 - el.h / 2);
    setConfig(prev => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  };

  if (loading) return <div className="p-8 text-center text-ink-2">Memuat template...</div>;

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/sertifikat")} className="text-ink-2 hover:text-ink text-sm">
            ← Kembali
          </button>
          <div className="w-px h-5 bg-border" />
          <input
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="text-sm font-heading text-brand font-semibold bg-transparent border-none outline-none px-1 py-0.5 rounded hover:bg-surface focus:bg-white focus:ring-2 focus:ring-leaf/30"
            placeholder="Nama template..."
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" checked={previewMode} onChange={e => setPreviewMode(e.target.checked)} />
            Preview
          </label>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(30, z - 10))} className="px-1.5 py-0.5 text-xs text-ink-2 hover:text-ink border border-border rounded">−</button>
            <span className="text-xs text-ink-2 w-8 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(100, z + 10))} className="px-1.5 py-0.5 text-xs text-ink-2 hover:text-ink border border-border rounded">+</button>
          </div>
          <div className="w-px h-5 bg-border" />
          <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer" onClick={() => setShowBgPicker(!showBgPicker)}>
            <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: config.page.bgColor }} />
            BG
          </label>
          {showBgPicker && (
            <input type="color" value={config.page.bgColor}
              onChange={e => updatePageConfig("bgColor", e.target.value)}
              className="w-8 h-8 border-0 cursor-pointer" />
          )}
          <div className="w-px h-5 bg-border" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium bg-leaf text-white rounded-lg hover:bg-leaf-strong disabled:opacity-50 transition-colors"
          >
            {saving ? "Menyimpan..." : "💾 Simpan"}
          </button>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Palette */}
        <div className="w-48 shrink-0 bg-white border-r border-border overflow-y-auto">
          <ElementPalette onAddElement={addElement} />
          {/* Draggable palette items */}
          <div className="p-3">
            <div className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">Drag & Drop</div>
            {[
              { type: "text", icon: "T", label: "Teks" },
              { type: "image", icon: "🖼", label: "Gambar" },
              { type: "line", icon: "━", label: "Garis" },
              { type: "rect", icon: "▬", label: "Kotak" },
            ].map(item => (
              <div
                key={item.type}
                draggable
                onDragStart={e => handlePaletteDragStart(e, item.type)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink hover:bg-surface hover:text-brand transition-colors cursor-grab active:cursor-grabbing mb-1"
              >
                <span className="w-6 h-6 flex items-center justify-center rounded bg-amber-soft text-amber text-xs font-bold shrink-0">
                  {item.icon}
                </span>
                {item.label}
              </div>
            ))}
          </div>
          {/* Element list */}
          <div className="p-3 border-t border-border">
            <div className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">Elemen ({config.elements.length})</div>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {config.elements.map(el => (
                <button
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  className={`w-full text-left px-2 py-1 text-xs rounded truncate ${
                    selectedId === el.id ? "bg-leaf-soft text-leaf font-medium" : "text-ink hover:bg-surface"
                  }`}
                >
                  {el.type === "text" ? (el.props?.content || "Teks").substring(0, 25) : el.type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div
          className="flex-1 overflow-auto bg-[#E8EBE6] flex items-start justify-center p-8"
          onDragOver={e => e.preventDefault()}
          onDrop={handleCanvasDrop}
        >
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
            <EditorCanvas
              elements={config.elements}
              page={config.page}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdateElement={(id, updates) => {
                setConfig(prev => ({
                  ...prev,
                  elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el),
                }));
              }}
              onMoveElement={moveElement}
            />
          </div>

          {previewMode && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setPreviewMode(false)}>
              <div className="bg-white rounded-xl p-4 shadow-2xl" onClick={e => e.stopPropagation()} style={{ transform: "scale(0.85)", transformOrigin: "center center" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-heading text-brand">Preview</h3>
                  <button onClick={() => setPreviewMode(false)} className="text-ink-2 hover:text-ink text-sm">Tutup ✕</button>
                </div>
                <EditorCanvas
                  elements={config.elements.map(el => ({
                    ...el,
                    props: {
                      ...el.props,
                      content: el.props?.content
                        ?.replace(/\{nama_usaha\}/g, "WARUNG MAKMUR JAYA")
                        .replace(/\{nama_pemilik\}/g, "Siti Nurjanah")
                        .replace(/\{nama_event\}/g, "Pelatihan Digital Marketing 2026")
                        .replace(/\{tanggal_mulai\}/g, "12 Juni 2026")
                        .replace(/\{tanggal_selesai\}/g, "13 Juni 2026")
                        .replace(/\{skor_pre\}/g, "75")
                        .replace(/\{skor_post\}/g, "92")
                        .replace(/\{delta\}/g, "17")
                        .replace(/\{nomor_sertifikat\}/g, "MWX/RC/2026/00001")
                        .replace(/\{tanggal_terbit\}/g, "14 Juni 2026")
                        .replace(/\{kota\}/g, "Jakarta") || el.props?.content,
                    },
                  }))}
                  page={config.page}
                  selectedId={null}
                  onSelect={() => {}}
                  onUpdateElement={() => {}}
                  onMoveElement={() => {}}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Properties */}
        <div className="w-64 shrink-0 bg-white border-l border-border overflow-y-auto">
          <PropertiesPanel
            element={selectedEl}
            onUpdate={updateElement}
            onRemove={removeElement}
          />
        </div>
      </div>
    </div>
  );
}
