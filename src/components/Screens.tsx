import {
  Crosshair,
  Flag,
  Gauge,
  Home,
  Monitor,
  MousePointer2,
  Play,
  Smartphone,
  RotateCcw,
  Skull,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from "lucide-react";
import type { RaceResult, Settings } from "../game/engine";
import { formatTime, TOTAL_GATES } from "../game/track";

/* ------------------------------- INTRO ------------------------------- */

interface IntroProps {
  onStart: () => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  bestLabel: string | null;
  device: "pc" | "mobile";
  onChangeDevice: () => void;
}

export function IntroScreen({ onStart, settings, onSettings, bestLabel, device, onChangeDevice }: IntroProps) {
  const set = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch });
  const mobile = device === "mobile";
  return (
    <div className="absolute inset-0 z-40 flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-b from-[#05030d]/80 via-[#05030d]/25 to-[#05030d]/90" />

      {/* frame corners */}
      <div className="pointer-events-none absolute left-5 top-5 font-mono2 text-[0.62rem] tracking-[0.3em] text-cyan-300/50">
        SYS.CHECK <span className="text-emerald-400/80">OK</span> — RADIO LINK <span className="text-emerald-400/80">OK</span>
      </div>
      <div className="pointer-events-none absolute right-5 top-5 font-mono2 text-[0.62rem] tracking-[0.3em] text-fuchsia-300/50">
        SECTOR 7G — NIGHT GRID
      </div>
      <div className="pointer-events-none absolute bottom-5 left-5 font-mono2 text-[0.62rem] tracking-[0.3em] text-indigo-300/40">
        NEONLINE v1.0 // WEBGL
      </div>
      <div className="pointer-events-none absolute bottom-5 right-5 font-mono2 text-[0.62rem] tracking-[0.3em] text-indigo-300/40">
        HEADPHONES RECOMMENDED
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 font-tech text-[0.66rem] font-medium tracking-[0.55em] text-cyan-300/80 glow-cyan">
            VELOCITY SERIES — SYNTHWAVE FPV RACING
          </div>
          <h1 className="title-gradient anim-flicker font-display text-[clamp(2.6rem,9vw,6.5rem)] font-black leading-none tracking-[0.1em]">
            NEONLINE
          </h1>
          <div className="mt-3 flex items-center gap-3 font-mono2 text-[0.68rem] tracking-[0.3em] text-indigo-200/60">
            <span className="h-px w-8 bg-indigo-300/30" />
            FPV // ANGLE MODE // {TOTAL_GATES} GATES // ARMED
            <span className="h-px w-8 bg-indigo-300/30" />
          </div>
        </div>

        {/* controls + settings */}
        <div className="flex max-w-3xl flex-wrap items-stretch justify-center gap-3">
          <div className="panel min-w-[290px] flex-1 px-5 py-4">
            <div className="hud-label mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Crosshair size={11} className="text-cyan-300" /> Flight Controls
              </span>
              <button
                onClick={onChangeDevice}
                className="flex items-center gap-1 border border-white/15 px-2 py-0.5 text-[0.55rem] tracking-[0.18em] text-indigo-200/80 transition-colors hover:border-cyan-400/60 hover:text-cyan-200"
              >
                {mobile ? <Smartphone size={9} /> : <Monitor size={9} />}
                {mobile ? "MOBILE" : "PC"} · SWITCH
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[0.72rem] text-indigo-100/85">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-indigo-300/70">
                  <MousePointer2 size={11} /> ATTITUDE
                </span>
                <span className="kbd">{mobile ? "R-STICK" : "MOUSE"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-indigo-300/70">
                  <Gauge size={11} /> THROTTLE
                </span>
                {mobile ? (
                  <span className="kbd">L-STICK Y</span>
                ) : (
                  <span>
                    <span className="kbd">W</span> <span className="kbd">S</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-indigo-300/70">
                  <RotateCcw size={11} /> YAW
                </span>
                {mobile ? (
                  <span className="kbd">L-STICK X</span>
                ) : (
                  <span>
                    <span className="kbd">A</span> <span className="kbd">D</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-indigo-300/70">
                  <Zap size={11} /> {mobile ? "HOVER" : "PUNCH"}
                </span>
                <span className="kbd">{mobile ? "CENTER" : "SPACE"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-indigo-300/70">
                  <Wind size={11} /> BRAKE
                </span>
                <span className="kbd">{mobile ? "PULL BACK" : "SHIFT"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-indigo-300/70">
                  <Flag size={11} /> RESET
                </span>
                <span className="kbd">{mobile ? "PAUSE MENU" : "R"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-red-400/80">
                  <Target size={11} /> FIRE
                </span>
                {mobile ? (
                  <span className="kbd">TRIGGER</span>
                ) : (
                  <span>
                    <span className="kbd">R-CLICK</span> <span className="kbd">F</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-red-400/80">
                  <Skull size={11} /> KILL BONUS
                </span>
                <span className="font-mono2 text-[0.66rem] text-emerald-300">−2.0S</span>
              </div>
            </div>
          </div>

          <div className="panel min-w-[250px] px-5 py-4">
            <div className="hud-label mb-3 flex items-center gap-2">
              <Sparkles size={11} className="text-fuchsia-300" /> Tuning
            </div>
            <div className="flex flex-col gap-3 text-[0.72rem]">
              {!mobile && (
                <label className="flex items-center justify-between gap-4">
                  <span className="text-indigo-300/70">SENSITIVITY</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.4}
                      max={2.2}
                      step={0.05}
                      value={settings.sensitivity}
                      onChange={(e) => set({ sensitivity: Number(e.target.value) })}
                      className="fader w-24"
                    />
                    <span className="w-8 font-mono2 text-cyan-300">{settings.sensitivity.toFixed(2)}</span>
                  </span>
                </label>
              )}
              {(
                [
                  ["INVERT Y", "invertY"],
                  ["BLOOM FX", "bloom"],
                  ["SOUND", "muted", true],
                ] as const
              )
                .filter(([, key]) => !(mobile && key === "invertY"))
                .map(([label, key, invert]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-indigo-300/70">{label}</span>
                  <button
                    className="toggle"
                    data-on={String(invert ? !settings[key] : settings[key])}
                    onClick={() =>
                      invert ? set({ muted: !settings.muted }) : set({ [key]: !settings[key] } as Partial<Settings>)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onStart}
          className="btn-primary anim-pulse-soft group flex items-center gap-3 px-12 py-4 font-display text-base font-bold tracking-[0.4em] text-white"
        >
          <Zap size={17} className="text-cyan-300 transition-transform group-hover:scale-125" />
          INITIATE RUN
        </button>

        {bestLabel && (
          <div className="flex items-center gap-2 font-mono2 text-[0.7rem] tracking-[0.25em] text-amber-300/80">
            <Trophy size={12} />
            PERSONAL BEST {bestLabel}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- COUNTDOWN ----------------------------- */

export function CountdownOverlay({ n }: { n: number }) {
  const go = n === 0;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="relative flex items-center justify-center">
        <div
          key={`ring-${n}`}
          className="anim-ring-ping absolute h-44 w-44 rounded-full border-2"
          style={{ borderColor: go ? "rgba(52,211,153,0.8)" : "rgba(34,211,238,0.7)" }}
        />
        <div
          key={n}
          className={`anim-cd font-display text-8xl font-black tracking-widest ${
            go ? "text-emerald-300" : "text-white glow-cyan"
          }`}
          style={{ textShadow: go ? "0 0 30px rgba(52,211,153,0.9)" : undefined }}
        >
          {go ? "GO" : n}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- PAUSE ------------------------------- */

interface PauseProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function PauseScreen({ onResume, onRestart, onExit }: PauseProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#05030d]/60 backdrop-blur-[6px]">
      <div className="panel brackets flex w-[320px] flex-col items-center gap-5 px-8 py-8">
        <div>
          <div className="hud-label mb-1 text-center">Transmission Held</div>
          <h2 className="font-display text-3xl font-black tracking-[0.25em] text-white glow-magenta">PAUSED</h2>
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <button
            onClick={onResume}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 font-display text-sm font-bold tracking-[0.3em] text-white"
          >
            <Play size={15} className="text-cyan-300" /> RESUME
          </button>
          <button
            onClick={onRestart}
            className="btn-ghost flex items-center justify-center gap-2 px-6 py-2.5 font-tech text-xs font-semibold tracking-[0.25em] text-indigo-100"
          >
            <RotateCcw size={14} /> RESTART RUN
          </button>
          <button
            onClick={onExit}
            className="btn-ghost flex items-center justify-center gap-2 px-6 py-2.5 font-tech text-xs font-semibold tracking-[0.25em] text-indigo-100"
          >
            <Home size={14} /> EXIT TO MENU
          </button>
        </div>
        <div className="font-mono2 text-[0.6rem] tracking-[0.2em] text-indigo-300/40">POINTER RE-CAPTURES ON RESUME</div>
      </div>
    </div>
  );
}

/* ------------------------------- FINISH ------------------------------- */

interface FinishProps {
  result: RaceResult;
  onAgain: () => void;
  onExit: () => void;
}

export function FinishScreen({ result, onAgain, onExit }: FinishProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-[#05030d]/70 via-transparent to-[#05030d]/85" />
      <div className="panel brackets relative z-10 flex w-[min(92vw,480px)] flex-col items-center gap-5 px-8 py-8 text-center">
        <div>
          {result.best ? (
            <div className="anim-glitch mb-2 flex items-center justify-center gap-2 font-display text-lg font-bold tracking-[0.3em] text-amber-300">
              <Trophy size={18} /> NEW TRACK RECORD
            </div>
          ) : (
            <div className="hud-label mb-2">Run Complete</div>
          )}
          <div className="font-mono2 text-[clamp(2.2rem,7vw,3.6rem)] font-bold leading-none text-white glow-cyan">
            {formatTime(result.timeMs)}
          </div>
          {!result.best && (
            <div className="mt-2 font-mono2 text-[0.7rem] tracking-[0.2em] text-indigo-300/60">
              PB {formatTime(result.bestMs)}
            </div>
          )}
        </div>

        <div className="grid w-full grid-cols-3 gap-2 border-y border-white/10 py-3">
          <div>
            <div className="hud-label">Top</div>
            <div className="font-display text-lg font-bold text-cyan-300">{Math.round(result.topSpeed)}</div>
            <div className="font-mono2 text-[0.55rem] text-indigo-300/50">KM/H</div>
          </div>
          <div>
            <div className="hud-label">Avg</div>
            <div className="font-display text-lg font-bold text-fuchsia-300">{Math.round(result.avgSpeed)}</div>
            <div className="font-mono2 text-[0.55rem] text-indigo-300/50">KM/H</div>
          </div>
          <div>
            <div className="hud-label">Gates</div>
            <div className="font-display text-lg font-bold text-emerald-300">
              {TOTAL_GATES}/{TOTAL_GATES}
            </div>
            <div className="font-mono2 text-[0.55rem] text-indigo-300/50">CLEARED</div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2.5">
          <button
            onClick={onAgain}
            className="btn-primary flex items-center justify-center gap-2 px-6 py-3 font-display text-sm font-bold tracking-[0.3em] text-white"
          >
            <Zap size={15} className="text-cyan-300" /> FLY AGAIN
          </button>
          <button
            onClick={onExit}
            className="btn-ghost flex items-center justify-center gap-2 px-6 py-2.5 font-tech text-xs font-semibold tracking-[0.25em] text-indigo-100"
          >
            <Home size={14} /> BACK TO MENU
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ CRASH FLASH ------------------------------ */

export function CrashFlash() {
  return (
    <div className="anim-crash pointer-events-none absolute inset-0 z-40">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(255,30,40,0.5) 100%)" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="anim-glitch font-display text-2xl font-black tracking-[0.4em] text-red-400">
          SIGNAL LOST
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- TOASTS -------------------------------- */

export interface ToastData {
  id: number;
  kind: "gate" | "miss" | "kill";
  text: string;
}

const TOAST_STYLES: Record<ToastData["kind"], string> = {
  gate: "border-emerald-400/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.25)]",
  miss: "border-amber-400/50 bg-amber-500/10 text-amber-300 shadow-[0_0_24px_rgba(255,180,84,0.25)]",
  kill: "border-red-400/60 bg-red-500/10 text-red-300 shadow-[0_0_28px_rgba(248,80,80,0.35)]",
};

export function Toast({ toast }: { toast: ToastData }) {
  return (
    <div
      key={toast.id}
      className={`anim-toast pointer-events-none absolute left-1/2 top-[22%] z-40 -translate-x-1/2 border px-5 py-1.5 font-tech text-[0.7rem] font-semibold tracking-[0.35em] ${TOAST_STYLES[toast.kind]}`}
    >
      {toast.text}
    </div>
  );
}

/* ------------------------------- MUTE BTN ------------------------------- */

export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="btn-ghost flex h-9 w-9 items-center justify-center rounded-md text-white/70"
      aria-label="toggle sound"
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}
