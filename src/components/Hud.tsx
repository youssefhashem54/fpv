import { MAP_PATH, MAP_SIZE, TOTAL_GATES } from "../game/track";
import type { HudRefs } from "../game/engine";

interface HudProps {
  hud: HudRefs;
  visible: boolean;
  gatesCleared: number;
  bestLabel: string | null;
}

export default function Hud({ hud, visible, gatesCleared, bestLabel }: HudProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none select-none transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* ---------- gate marker (positioned by engine) ---------- */}
      <div
        ref={(el) => {
          hud.marker = el;
        }}
        data-state="hidden"
        className="gate-marker absolute top-0 left-0 z-10 will-change-transform"
      >
        <div className="diamond h-5 w-5 rotate-45 border-2 border-fuchsia-400/90 shadow-[0_0_14px_rgba(255,43,214,0.8)]" />
        <div
          ref={(el) => {
            hud.markerArrow = el;
          }}
          className="arrow-wrap absolute inset-0 flex items-center justify-center"
        >
          <svg width="26" height="26" viewBox="0 0 26 26" className="-translate-y-0.5">
            <path d="M13 2 L20 20 L13 15 L6 20 Z" fill="rgba(255,43,214,0.25)" stroke="#ff2bd6" strokeWidth="1.6" />
          </svg>
        </div>
      </div>

      {/* ---------- center reticle ---------- */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70">
        <svg width="46" height="46" viewBox="0 0 46 46">
          <circle cx="23" cy="23" r="1.6" fill="#e6f6ff" />
          <circle cx="23" cy="23" r="9" fill="none" stroke="rgba(230,246,255,0.4)" strokeWidth="1" />
          <path d="M23 4v6M23 36v6M4 23h6M36 23h6" stroke="rgba(230,246,255,0.4)" strokeWidth="1" />
        </svg>
      </div>

      {/* ---------- hitmarker ---------- */}
      <div
        ref={(el) => {
          hud.hitmark = el;
        }}
        data-kind="hit"
        className="hitmark pointer-events-none absolute left-1/2 top-1/2"
        style={{ opacity: 0 }}
      >
        <svg width="30" height="30" viewBox="0 0 30 30">
          <path d="M8 8l14 14M22 8L8 22" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>

      {/* ---------- top left: gates + minimap ---------- */}
      <div className="absolute left-5 top-5 flex flex-col gap-2.5">
        <div>
          <div className="hud-label mb-1">Gates</div>
          <div className="font-display text-2xl font-bold text-cyan-300 glow-cyan">
            <span
              ref={(el) => {
                hud.gates = el;
              }}
            >
              00/{TOTAL_GATES}
            </span>
          </div>
          <div className="mt-1.5 flex gap-[3px]">
            {Array.from({ length: TOTAL_GATES }).map((_, i) => (
              <div
                key={i}
                className={`h-[3px] w-3 transition-colors duration-300 ${
                  i < gatesCleared
                    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                    : i === gatesCleared
                      ? "bg-fuchsia-500 shadow-[0_0_8px_rgba(255,43,214,0.9)] animate-pulse"
                      : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="minimap-frame mt-1 p-1.5">
          <svg width={MAP_SIZE * 0.82} height={MAP_SIZE * 0.82} viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}>
            <path d={MAP_PATH} fill="none" stroke="rgba(34,211,238,0.45)" strokeWidth="1.5" strokeLinejoin="round" />
            <circle
              ref={(el) => {
                hud.mapGate = el;
              }}
              cx="-10"
              cy="-10"
              r="5"
              fill="none"
              stroke="#ff2bd6"
              strokeWidth="2"
              className="animate-pulse"
            />
            <g
              ref={(el) => {
                hud.mapDot = el;
              }}
            >
              <circle r="3" fill="#e6f6ff" />
              <circle r="6.5" fill="none" stroke="rgba(230,246,255,0.4)" strokeWidth="1" />
            </g>
          </svg>
        </div>
      </div>

      {/* ---------- top center: timer ---------- */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 text-center">
        <div className="hud-label">Time</div>
        <div
          ref={(el) => {
            hud.time = el;
          }}
          className="font-mono2 text-3xl font-bold tracking-wider text-white glow-soft"
        >
          00:00.000
        </div>
        {bestLabel && (
          <div className="mt-0.5 font-mono2 text-[0.68rem] tracking-[0.18em] text-indigo-300/70">PB {bestLabel}</div>
        )}
      </div>

      {/* ---------- top right: speed / altitude ---------- */}
      <div className="absolute right-5 top-5 text-right">
        <div className="hud-label">Speed</div>
        <div className="font-display text-5xl font-black text-white leading-none">
          <span
            ref={(el) => {
              hud.speed = el;
            }}
          >
            0
          </span>
          <span className="ml-1.5 text-sm font-bold text-cyan-300/80">KM/H</span>
        </div>
        <div className="mt-2 font-mono2 text-xs text-indigo-300/80">
          ALT{" "}
          <span
            ref={(el) => {
              hud.alt = el;
            }}
            className="text-white"
          >
            0
          </span>{" "}
          M
        </div>
        <div className="mt-1 font-mono2 text-xs text-indigo-300/80">
          NEXT{" "}
          <span
            ref={(el) => {
              hud.dist = el;
            }}
            className="text-fuchsia-300"
          >
            —
          </span>
        </div>
        <div className="mt-1 font-mono2 text-xs text-indigo-300/80">
          KILLS{" "}
          <span
            ref={(el) => {
              hud.kills = el;
            }}
            className="text-red-400"
          >
            00
          </span>
        </div>
      </div>

      {/* ---------- bottom left: throttle + weapon ---------- */}
      <div className="absolute bottom-6 left-6 flex items-end gap-2.5">
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative h-28 w-2 overflow-hidden rounded-full border border-white/15 bg-white/5">
            <div
              ref={(el) => {
                hud.throttleFill = el;
              }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-400 to-fuchsia-500 data-[hot=true]:from-amber-400 data-[hot=true]:to-red-500 transition-[height] duration-75"
              style={{ height: "30%" }}
              data-hot="false"
            />
          </div>
          <div className="hud-label">THR</div>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative h-28 w-2 overflow-hidden rounded-full border border-white/15 bg-white/5">
            <div
              ref={(el) => {
                hud.weaponFill = el;
              }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-500 to-amber-300 data-[hot=false]:from-red-800 data-[hot=false]:to-red-600 transition-[height] duration-75"
              style={{ height: "100%" }}
              data-hot="true"
            />
          </div>
          <div className="hud-label">WPN</div>
        </div>
      </div>

      {/* ---------- bottom right: hints ---------- */}
      <div className="absolute bottom-6 right-6 text-right font-mono2 text-[0.62rem] leading-relaxed tracking-[0.14em] text-indigo-300/50">
        <div>[P] PAUSE · [R] RESTART</div>
        <div>[W/S] THROTTLE · [SPACE] PUNCH</div>
      </div>
    </div>
  );
}
