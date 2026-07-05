"use client";

interface Element {
  id: string;
  type: string;
  x: number; y: number; w: number; h: number;
  props: Record<string, any>;
}

const VARIABLES = [
  { label: "Nama Usaha", value: "{nama_usaha}" },
  { label: "Nama Pemilik", value: "{nama_pemilik}" },
  { label: "Nama Event", value: "{nama_event}" },
  { label: "Tanggal Mulai", value: "{tanggal_mulai}" },
  { label: "Tanggal Selesai", value: "{tanggal_selesai}" },
  { label: "Skor Pre-test", value: "{skor_pre}" },
  { label: "Skor Post-test", value: "{skor_post}" },
  { label: "Delta", value: "{delta}" },
  { label: "Nomor Sertifikat", value: "{nomor_sertifikat}" },
  { label: "Tanggal Terbit", value: "{tanggal_terbit}" },
  { label: "Kota", value: "{kota}" },
];

interface PropertiesPanelProps {
  element: Element | null;
  onUpdate: (id: string, props: Record<string, any>) => void;
  onRemove: (id: string) => void;
}

export default function PropertiesPanel({ element, onUpdate, onRemove }: PropertiesPanelProps) {
  if (!element) {
    return (
      <div className="p-4 text-center text-ink-2 text-sm">
        <p className="mt-12">Klik elemen di canvas untuk mengedit properti</p>
      </div>
    );
  }

  const update = (key: string, value: any) => {
    onUpdate(element.id, { ...element.props, [key]: value });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wider">
          {element.type === "text" ? "Teks" : element.type === "image" ? "Gambar" : element.type === "line" ? "Garis" : "Kotak"}
        </h3>
        <button onClick={() => onRemove(element.id)} className="text-xs text-red-500 hover:text-red-600">Hapus</button>
      </div>

      {/* Position & Size */}
      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <label className="text-[10px] text-ink-2 block mb-0.5">X</label>
          <input type="number" value={element.x} onChange={e => { element.x = parseInt(e.target.value) || 0; onUpdate(element.id, element.props); }}
            className="w-full px-1.5 py-1 text-xs border border-border rounded" />
        </div>
        <div>
          <label className="text-[10px] text-ink-2 block mb-0.5">Y</label>
          <input type="number" value={element.y} onChange={e => { element.y = parseInt(e.target.value) || 0; onUpdate(element.id, element.props); }}
            className="w-full px-1.5 py-1 text-xs border border-border rounded" />
        </div>
        <div>
          <label className="text-[10px] text-ink-2 block mb-0.5">W</label>
          <input type="number" value={element.w} onChange={e => { element.w = parseInt(e.target.value) || 0; onUpdate(element.id, element.props); }}
            className="w-full px-1.5 py-1 text-xs border border-border rounded" />
        </div>
        <div>
          <label className="text-[10px] text-ink-2 block mb-0.5">H</label>
          <input type="number" value={element.h} onChange={e => { element.h = parseInt(e.target.value) || 0; onUpdate(element.id, element.props); }}
            className="w-full px-1.5 py-1 text-xs border border-border rounded" />
        </div>
      </div>

      {/* Type-specific properties */}
      {element.type === "text" && (
        <>
          {/* Content with variable autocomplete */}
          <div>
            <label className="text-[10px] text-ink-2 block mb-0.5">Konten</label>
            <div className="relative">
              <textarea
                value={element.props.content || ""}
                onChange={e => update("content", e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 text-xs border border-border rounded font-mono resize-none"
                placeholder="Teks atau {variable}"
              />
              <div className="mt-1">
                <details className="text-[10px]">
                  <summary className="text-leaf cursor-pointer">Insert variable</summary>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {VARIABLES.map(v => (
                      <button
                        key={v.value}
                        onClick={() => update("content", (element.props.content || "") + v.value)}
                        className="px-1.5 py-0.5 text-[10px] bg-surface text-ink-2 rounded hover:bg-leaf-soft hover:text-leaf transition-colors"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] text-ink-2 block mb-0.5">Font Size</label>
              <input type="number" value={element.props.fontSize || 14}
                onChange={e => update("fontSize", parseInt(e.target.value) || 14)}
                className="w-full px-1.5 py-1 text-xs border border-border rounded" />
            </div>
            <div>
              <label className="text-[10px] text-ink-2 block mb-0.5">Font</label>
              <select value={element.props.fontFamily || "Plus Jakarta Sans"}
                onChange={e => update("fontFamily", e.target.value)}
                className="w-full px-1.5 py-1 text-xs border border-border rounded">
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Sora">Sora</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs">
              <input type="color" value={element.props.color || "#000000"}
                onChange={e => update("color", e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0" />
              Warna
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={element.props.bold || false}
                onChange={e => update("bold", e.target.checked)} />
              Bold
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={element.props.italic || false}
                onChange={e => update("italic", e.target.checked)} />
              Italic
            </label>
          </div>
          <div>
            <label className="text-[10px] text-ink-2 block mb-0.5">Rata</label>
            <div className="flex gap-1">
              {["left", "center", "right"].map(a => (
                <button key={a} onClick={() => update("align", a)}
                  className={`px-3 py-1 text-xs rounded border ${element.props.align === a ? "bg-leaf text-white border-leaf" : "border-border text-ink hover:bg-surface"}`}>
                  {a === "left" ? "⬅" : a === "center" ? "⬌" : "➡"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {element.type === "image" && (
        <div>
          <label className="text-[10px] text-ink-2 block mb-0.5">URL Gambar</label>
          <input type="text" value={element.props.src || ""}
            onChange={e => update("src", e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-border rounded"
            placeholder="https://example.com/logo.png" />
        </div>
      )}

      {element.type === "line" && (
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] text-ink-2 block mb-0.5">Tebal</label>
            <input type="number" value={element.props.thickness || 2}
              onChange={e => update("thickness", parseInt(e.target.value) || 1)}
              className="w-full px-1.5 py-1 text-xs border border-border rounded" />
          </div>
          <div>
            <label className="text-[10px] text-ink-2 block mb-0.5">Warna</label>
            <input type="color" value={element.props.color || "#000000"}
              onChange={e => update("color", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0" />
          </div>
        </div>
      )}

      {element.type === "rect" && (
        <>
          <div>
            <label className="text-[10px] text-ink-2 block mb-0.5">Warna Latar</label>
            <input type="color" value={element.props.bgColor || "transparent"}
              onChange={e => update("bgColor", e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="text-[10px] text-ink-2 block mb-0.5">Border</label>
              <input type="number" value={element.props.borderWidth || 0}
                onChange={e => update("borderWidth", parseInt(e.target.value) || 0)}
                className="w-full px-1.5 py-1 text-xs border border-border rounded" />
            </div>
            <div>
              <label className="text-[10px] text-ink-2 block mb-0.5">W Border</label>
              <input type="color" value={element.props.borderColor || "#000000"}
                onChange={e => update("borderColor", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0" />
            </div>
            <div>
              <label className="text-[10px] text-ink-2 block mb-0.5">Radius</label>
              <input type="number" value={element.props.borderRadius || 0}
                onChange={e => update("borderRadius", parseInt(e.target.value) || 0)}
                className="w-full px-1.5 py-1 text-xs border border-border rounded" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
