import React, { useState } from "react";
import { Rnd } from "react-rnd";
import { useWorkspace } from "@/pages/Workspace";
import { X, Minus, GripHorizontal, Maximize2 } from "lucide-react";

export default function WindowFrame({ item, title, icon, children, accentColor }) {
  const { setLayoutAndSave, unpin, appearance } = useWorkspace();
  const [minimized, setMinimized] = useState(false);

  const outlineColor = accentColor || appearance.window_outline_color || "#E63946";
  const outlineWidth = appearance.window_outline_width ?? 1;

  const bringToFront = () => {
    setLayoutAndSave((prev) => {
      const maxZ = prev.reduce((m, i) => Math.max(m, i.z_index || 1), 1);
      if (item.z_index === maxZ) return prev;
      return prev.map((i) => (i.id === item.id ? { ...i, z_index: maxZ + 1 } : i));
    });
  };

  return (
    <Rnd
      default={{ x: item.x, y: item.y, width: item.width, height: item.height }}
      position={{ x: item.x, y: item.y }}
      size={{ width: item.width, height: minimized ? 44 : item.height }}
      bounds="parent"
      minWidth={220}
      minHeight={44}
      style={{ zIndex: item.z_index || 1 }}
      dragHandleClassName="win-handle"
      onDragStart={bringToFront}
      onMouseDown={bringToFront}
      onDragStop={(e, d) => setLayoutAndSave((prev) => prev.map((i) => (i.id === item.id ? { ...i, x: d.x, y: d.y } : i)))}
      onResizeStop={(e, dir, ref, delta, pos) =>
        setLayoutAndSave((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, width: parseInt(ref.style.width), height: parseInt(ref.style.height), x: pos.x, y: pos.y } : i
          )
        )
      }
    >
      <div
        className="win-shell w-full h-full"
        style={{ borderColor: outlineColor, borderWidth: outlineWidth }}
        data-testid={`window-${item.content_type}-${item.content_id || item.id}`}
      >
        <div className="win-handle flex items-center gap-2 px-2.5 h-11 shrink-0 border-b border-border bg-card">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          {icon}
          <span className="text-xs font-bold tracking-tight truncate flex-1">{title}</span>
          <button data-testid="window-minimize" onClick={() => setMinimized((m) => !m)} className="p-1 hover:bg-secondary transition-colors">
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button data-testid="window-close" onClick={() => unpin(item.id)} className="p-1 hover:bg-primary hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {!minimized && <div className="flex-1 overflow-auto min-h-0">{children}</div>}
      </div>
    </Rnd>
  );
}
