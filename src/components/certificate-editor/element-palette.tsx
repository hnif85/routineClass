"use client";

interface ElementPaletteProps {
  onAddElement: (type: string) => void;
}

const ITEMS = [
  { type: "text", icon: "T", label: "Teks" },
  { type: "image", icon: "🖼", label: "Gambar" },
  { type: "line", icon: "━", label: "Garis" },
  { type: "rect", icon: "▬", label: "Kotak" },
];

export default function ElementPalette({ onAddElement }: ElementPaletteProps) {
  return (
    <div className="p-3 border-b border-border">
      <div className="text-xs font-semibold text-ink-2 uppercase tracking-wider mb-2">Tambahkan</div>
      <div className="space-y-1">
        {ITEMS.map(item => (
          <button
            key={item.type}
            onClick={() => onAddElement(item.type)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-ink hover:bg-surface hover:text-brand transition-colors text-left"
            title={`Tambah ${item.label}`}
          >
            <span className="w-6 h-6 flex items-center justify-center rounded bg-leaf-soft text-leaf text-xs font-bold shrink-0">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
