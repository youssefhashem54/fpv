import { useRef } from "react";
import { Crosshair, Pause } from "lucide-react";
import type { FlightEngine } from "../game/engine";

/* ------------------------------------------------------------------ */
/*  Virtual controller — twin sticks + fire trigger                   */
/*  LEFT  stick : Y = throttle (center = hover), X = yaw              */
/*  RIGHT stick : Y = pitch, X = roll                                 */
/* ------------------------------------------------------------------ */

const DEADZONE = 0.1;

interface JoystickProps {
  label: string;
  sub: string;
  accent: "cyan" | "fuchsia";
  onMove: (x: number, y: number) => void;
}

function Joystick({ label, sub, accent, onMove }: JoystickProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<number | null>(null);

  const apply = (x: number, y: number) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${(x * 46).toFixed(1)}px, ${(y * 46).toFixed(1)}px)`;
    }
    // radial deadzone, rescaled so the usable range stays full
    const len = Math.hypot(x, y);
    if (len < DEADZONE) {
      onMove(0, 0);
      return;
    }
    const scaled = (len - DEADZONE) / (1 - DEADZONE) / len;
    onMove(x * scaled, y * scaled);
  };

  const track = (e: React.PointerEvent) => {
    if (idRef.current !== e.pointerId || !padRef.current) return;
    const r = padRef.current.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    apply(dx, dy);
  };

  const release = (e: React.PointerEvent) => {
    if (idRef.current !== e.pointerId) return;
    idRef.current = null;
    apply(0, 0);
  };

  const ring = accent === "cyan" ? "border-cyan-400/35" : "border-fuchsia-400/35";
  const knob =
    accent === "cyan"
      ? "border-cyan-300/80 bg-cyan-400/20 shadow-[0_0_22px_rgba(34,211,238,0.45)]"
      : "border-fuchsia-300/80 bg-fuchsia-400/20 shadow-[0_0_22px_rgba(255,43,214,0.45)]";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={padRef}
        className={`relative h-[8.5rem] w-[8.5rem] rounded-full border ${ring} bg-black/45 backdrop-blur-[2px]`}
        onPointerDown={(e) => {
          idRef.current = e.pointerId;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          track(e);
        }}
        onPointerMove={track}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="absolute left-1/2 top-1/2 h-px w-2/3 -translate-x-1/2 -translate-y-1/2 bg-white/10" />
        <div className="absolute left-1/2 top-1/2 h-2/3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/10" />
        <div className="absolute inset-[22%] rounded-full border border-white/10" />
        <div ref={knobRef} className="absolute left-1/2 top-1/2 h-0 w-0">
          <div className={`h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border ${knob}`} />
        </div>
      </div>
      <div className="text-center leading-tight">
        <div className="hud-label">{label}</div>
        <div className="font-mono2 text-[0.55rem] tracking-[0.18em] text-indigo-300/45">{sub}</div>
      </div>
    </div>
  );
}

export default function TouchControls({ getEngine }: { getEngine: () => FlightEngine | null }) {
  return (
    <div className="absolute inset-0 z-30 select-none" style={{ touchAction: "none" }}>
      {/* LEFT: throttle + yaw */}
      <div className="absolute bottom-7 left-5">
        <Joystick
          label="THR / YAW"
          sub="UP=CLIMB"
          accent="cyan"
          onMove={(x, y) => {
            const eng = getEngine();
            if (!eng) return;
            eng.touch.yaw = x;
            eng.touch.throttleAxis = -y; // screen-down is positive
          }}
        />
      </div>

      {/* RIGHT: pitch + roll */}
      <div className="absolute bottom-7 right-5">
        <Joystick
          label="PITCH / ROLL"
          sub="ATTITUDE"
          accent="fuchsia"
          onMove={(x, y) => {
            const eng = getEngine();
            if (!eng) return;
            eng.touch.stickX = x;
            eng.touch.stickY = y;
          }}
        />
      </div>

      {/* FIRE trigger */}
      <button
        className="absolute bottom-[10.5rem] right-7 flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-full border-2 border-red-400/60 bg-red-500/15 text-red-300 shadow-[0_0_26px_rgba(248,80,80,0.35)] backdrop-blur-[2px] transition-transform active:scale-90 active:bg-red-500/40"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const eng = getEngine();
          if (eng) eng.touch.firing = true;
        }}
        onPointerUp={() => {
          const eng = getEngine();
          if (eng) eng.touch.firing = false;
        }}
        onPointerCancel={() => {
          const eng = getEngine();
          if (eng) eng.touch.firing = false;
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="fire"
      >
        <div className="flex flex-col items-center gap-0.5">
          <Crosshair size={24} />
          <span className="font-display text-[0.5rem] font-bold tracking-[0.18em]">FIRE</span>
        </div>
      </button>

      {/* pause */}
      <button
        className="btn-ghost absolute right-4 top-16 flex h-10 w-10 items-center justify-center rounded-md text-white/80"
        onClick={() => getEngine()?.togglePause()}
        aria-label="pause"
      >
        <Pause size={18} />
      </button>
    </div>
  );
}
