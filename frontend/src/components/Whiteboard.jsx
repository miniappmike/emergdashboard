import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { Pencil, Eraser, Trash2, Undo2 } from "lucide-react";

const COLORS = ["#0A0A0B", "#E63946", "#1D3557", "#457B9D", "#F4A261"];

const Whiteboard = forwardRef(({ initial, onChange }, ref) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#0A0A0B");
  const [size, setSize] = useState(3);
  const [erasing, setErasing] = useState(false);
  const strokes = useRef([]); // for undo (snapshots)

  useImperativeHandle(ref, () => ({
    dataUrl: () => canvasRef.current?.toDataURL("image/png"),
  }));

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cv.width, cv.height);
      img.src = initial;
    }
  }, []); // eslint-disable-line

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    return { x: cx * (canvasRef.current.width / r.width), y: cy * (canvasRef.current.height / r.height) };
  };

  const snapshot = () => {
    strokes.current.push(canvasRef.current.toDataURL());
    if (strokes.current.length > 20) strokes.current.shift();
  };

  const start = (e) => {
    snapshot();
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = pos(e);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? 18 : size;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (drawing.current) { drawing.current = false; onChange?.(); }
  };
  const undo = () => {
    const prev = strokes.current.pop();
    if (!prev) return;
    const ctx = canvasRef.current.getContext("2d");
    const img = new Image();
    img.onload = () => { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); ctx.drawImage(img, 0, 0); onChange?.(); };
    img.src = prev;
  };
  const clear = () => {
    snapshot();
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange?.();
  };

  return (
    <div className="border border-border">
      <div className="flex items-center gap-2 p-2 border-b border-border bg-secondary/40 flex-wrap">
        {COLORS.map((c) => (
          <button key={c} data-testid={`wb-color-${c}`} onClick={() => { setColor(c); setErasing(false); }}
            className={`w-5 h-5 border-2 ${color === c && !erasing ? "border-primary" : "border-transparent"}`} style={{ background: c }} />
        ))}
        <input type="range" min="1" max="10" value={size} onChange={(e) => setSize(+e.target.value)} className="w-20" />
        <button data-testid="wb-eraser" onClick={() => setErasing((v) => !v)} className={`p-1.5 ${erasing ? "bg-primary text-white" : "hover:bg-secondary"}`}><Eraser className="w-4 h-4" /></button>
        <button data-testid="wb-undo" onClick={undo} className="p-1.5 hover:bg-secondary"><Undo2 className="w-4 h-4" /></button>
        <button data-testid="wb-clear" onClick={clear} className="p-1.5 hover:bg-secondary text-primary"><Trash2 className="w-4 h-4" /></button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        data-testid="whiteboard-canvas"
        className="w-full touch-none bg-white cursor-crosshair block"
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
      />
    </div>
  );
});

export default Whiteboard;
