"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface Element {
  id: string;
  type: string;
  x: number; y: number; w: number; h: number;
  props: Record<string, any>;
}

interface PageConfig {
  width: number;
  height: number;
  bgColor: string;
  padding?: number;
}

interface EditorCanvasProps {
  elements: Element[];
  page: PageConfig;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<Element>) => void;
  onMoveElement: (id: string, x: number, y: number) => void;
}

export default function EditorCanvas({
  elements, page, selectedId,
  onSelect, onUpdateElement, onMoveElement,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState<string | null>(null);
  const [resizeDir, setResizeDir] = useState<string>("");

  // ── Element drag ──
  const handleMouseDown = useCallback((e: React.MouseEvent, el: Element) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(el.id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(el.id);
    setDragOffset({
      x: e.clientX - rect.left - el.x,
      y: e.clientY - rect.top - el.y,
    });
  }, [onSelect]);

  // ── Resize ──
  const handleResizeDown = useCallback((e: React.MouseEvent, id: string, dir: string) => {
    e.stopPropagation();
    setResizing(id);
    setResizeDir(dir);
  }, []);

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (dragging) {
        const newX = Math.max(0, Math.min(page.width - 10, e.clientX - rect.left - dragOffset.x));
        const newY = Math.max(0, Math.min(page.height - 10, e.clientY - rect.top - dragOffset.y));
        onMoveElement(dragging, Math.round(newX), Math.round(newY));
      }

      if (resizing) {
        const el = elements.find(el => el.id === resizing);
        if (!el) return;
        const dx = e.clientX - rect.left;
        const dy = e.clientY - rect.top;
        let newW = el.w, newH = el.h;
        if (resizeDir.includes("e")) newW = Math.max(20, dx - el.x);
        if (resizeDir.includes("s")) newH = Math.max(20, dy - el.y);
        if (resizeDir.includes("w")) {
          const change = el.x - dx;
          if (el.w + change > 20) { newW = el.w + change; onMoveElement(resizing, Math.round(dx), el.y); }
        }
        if (resizeDir.includes("n")) {
          const change = el.y - dy;
          if (el.h + change > 20) { newH = el.h + change; onMoveElement(resizing, el.x, Math.round(dy)); }
        }
        onUpdateElement(resizing, { w: Math.round(newW), h: Math.round(newH) });
      }
    };

    const handleUp = () => {
      setDragging(null);
      setResizing(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, resizing, dragOffset, page, elements, onMoveElement, onUpdateElement]);

  // ── Page click (deselect) ──
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset?.canvas) {
      onSelect(null);
    }
  };

  const scale = 0.6;
  const scaledW = page.width * scale;
  const scaledH = page.height * scale;

  return (
    <div
      ref={canvasRef}
      data-canvas="true"
      onClick={handleCanvasClick}
      style={{
        width: scaledW, height: scaledH,
        backgroundColor: page.bgColor || "#FFFFFF",
        position: "relative", overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        borderRadius: 4,
        cursor: dragging ? "grabbing" : "default",
        margin: "0 auto",
      }}
    >
      <div style={{
        transform: `scale(${scale})`, transformOrigin: "top left",
        width: page.width, height: page.height,
        position: "relative",
      }}>
        {elements.map(el => (
          <div
            key={el.id}
            onMouseDown={e => handleMouseDown(e, el)}
            style={{
              position: "absolute",
              left: el.x, top: el.y,
              width: el.w, height: el.h,
              cursor: dragging === el.id ? "grabbing" : "grab",
              outline: selectedId === el.id ? "2px dashed #3B82F6" : "1px dashed transparent",
              outlineOffset: 1,
              zIndex: el.type === "rect" && el.props?.bgColor === "transparent" ? 0 : 1,
              pointerEvents: "auto",
            }}
          >
            {el.type === "text" && (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center",
                justifyContent: el.props?.align === "center" ? "center" : el.props?.align === "right" ? "flex-end" : "flex-start",
                fontSize: el.props?.fontSize || 14,
                fontFamily: el.props?.fontFamily || "Plus Jakarta Sans",
                color: el.props?.color || "#000",
                fontWeight: el.props?.bold ? 700 : 400,
                fontStyle: el.props?.italic ? "italic" : "normal",
                textAlign: el.props?.align || "left",
                lineHeight: 1.3,
                overflow: "hidden",
                wordBreak: "break-word",
                pointerEvents: "none",
              }}>
                {el.props?.content || "Teks"}
              </div>
            )}
            {el.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={el.props?.src || ""}
                alt=""
                style={{
                  width: "100%", height: "100%", objectFit: "contain",
                  pointerEvents: "none",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            {el.type === "line" && (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center",
                pointerEvents: "none",
              }}>
                <div style={{
                  width: "100%",
                  height: el.props?.thickness || 2,
                  backgroundColor: el.props?.color || "#000",
                  borderRadius: 1,
                }} />
              </div>
            )}
            {el.type === "rect" && (
              <div style={{
                width: "100%", height: "100%",
                backgroundColor: el.props?.bgColor || "transparent",
                border: el.props?.borderWidth
                  ? `${el.props.borderWidth}px solid ${el.props.borderColor || "#000"}`
                  : "none",
                borderRadius: el.props?.borderRadius || 0,
                pointerEvents: "none",
              }} />
            )}

            {/* Resize handles */}
            {selectedId === el.id && (
              <>
                {["nw", "ne", "sw", "se", "n", "s", "e", "w"].map(dir => (
                  <div
                    key={dir}
                    onMouseDown={e => handleResizeDown(e, el.id, dir)}
                    style={{
                      position: "absolute",
                      width: dir.length === 1 ? 8 : 10,
                      height: dir.length === 1 ? 8 : 10,
                      backgroundColor: "#3B82F6",
                      border: "2px solid white",
                      borderRadius: "50%",
                      cursor: `${dir}-resize`,
                      zIndex: 10,
                      ...(dir.includes("n") ? { top: -5 } : dir.includes("s") ? { bottom: -5 } : { top: "50%", marginTop: -5 }),
                      ...(dir.includes("w") ? { left: -5 } : dir.includes("e") ? { right: -5 } : { left: "50%", marginLeft: -5 }),
                    }}
                  />
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
