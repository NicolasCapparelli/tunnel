import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { ArrowUp, Check } from "lucide-react";

export default function SendRail({
  ready,
  busy,
  onSend,
}: {
  ready: boolean;
  busy: boolean;
  onSend: () => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const update = (event: PointerEvent) => {
    if (start.current === null) return;
    const travel = (rail.current?.clientHeight ?? 400) - 84;
    setProgress(
      Math.max(0, Math.min(1, (start.current - event.clientY) / travel)),
    );
  };
  const release = (event: PointerEvent) => {
    if (start.current === null) return;
    const travel = (rail.current?.clientHeight ?? 400) - 84;
    const completed = (start.current - event.clientY) / travel >= 0.8;
    start.current = null;
    setProgress(0);
    if (completed && ready && !busy) onSend();
  };
  const keyboard = (event: KeyboardEvent) => {
    if (!ready || busy) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setProgress((p) => Math.min(1, p + 0.25));
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setProgress((p) => Math.max(0, p - 0.25));
    }
    if (event.key === "Escape") setProgress(0);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setProgress(0);
      onSend();
    }
  };
  return (
    <div
      className={`send-rail ${ready ? "ready" : ""} ${busy ? "busy" : ""}`}
      ref={rail}
      role="slider"
      aria-label="Slide up to send quanta. Press Enter to send with keyboard."
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-disabled={!ready || busy}
      aria-orientation="vertical"
      tabIndex={0}
      onKeyDown={keyboard}
      onPointerDown={(e) => {
        if (!ready || busy) return;
        start.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={update}
      onPointerUp={release}
      onPointerCancel={() => {
        start.current = null;
        setProgress(0);
      }}
    >
      <div className={`rail-target ${progress >= 0.8 ? "active" : ""}`}>
        {progress >= 0.8 ? <Check size={18} /> : <ArrowUp size={18} />}
      </div>
      <div className="rail-dots">
        {Array.from({ length: 11 }, (_, i) => (
          <i key={i} style={{ opacity: 0.25 + i * 0.04 }} />
        ))}
      </div>
      <span className="rail-label">{busy ? "TUNNELING" : "SLIDE TO SEND"}</span>
      <div
        className="rail-handle"
        style={{ bottom: `calc(12px + ${progress} * (100% - 84px))` }}
      >
        <ArrowUp size={24} />
      </div>
    </div>
  );
}
