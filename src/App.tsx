import { useEffect, useMemo, useRef, useState } from "react";
import { FlightEngine, type HudRefs, type Phase, type RaceResult, type Settings } from "./game/engine";
import { TOTAL_GATES, formatTime } from "./game/track";
import Hud from "./components/Hud";
import TouchControls from "./components/TouchControls";
import DeviceSelect, { type Device } from "./components/DeviceSelect";
import {
  CountdownOverlay,
  CrashFlash,
  FinishScreen,
  IntroScreen,
  MuteButton,
  PauseScreen,
  Toast,
  type ToastData,
} from "./components/Screens";

const SETTINGS_KEY = "neonline-settings";
const BEST_KEY = "neonline-best-ms";
const DEVICE_KEY = "neonline-device";

function readDevice(): Device | null {
  try {
    const v = localStorage.getItem(DEVICE_KEY);
    return v === "pc" || v === "mobile" ? v : null;
  } catch {
    return null;
  }
}

function readBest(): number | null {
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function readSettings(): Settings {
  const def: Settings = { sensitivity: 1, invertY: false, bloom: true, muted: false };
  try {
    const v = localStorage.getItem(SETTINGS_KEY);
    return v ? { ...def, ...JSON.parse(v) } : def;
  } catch {
    return def;
  }
}

let toastSeq = 1;

export default function App() {
  const hudRef = useRef<HudRefs>({});
  const engineRef = useRef<FlightEngine | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [cd, setCd] = useState<number | null>(null);
  const [gatesCleared, setGatesCleared] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [crashId, setCrashId] = useState(0);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [bestMs, setBestMs] = useState<number | null>(readBest);
  const [muted, setMuted] = useState(settings.muted);

  const suggested: Device = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window)
        ? "mobile"
        : "pc",
    []
  );
  const [device, setDevice] = useState<Device | null>(readDevice);
  const isTouch = device === "mobile";

  const showToast = (kind: ToastData["kind"], text: string) => {
    setToast({ id: toastSeq++, kind, text });
  };

  useEffect(() => {
    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const eng = new FlightEngine(
      canvas,
      hudRef.current,
      {
        onPhase: (p) => {
          setPhase(p);
          if (p === "countdown") {
            setGatesCleared(0);
            setResult(null);
            setToast(null);
          }
        },
        onCountdown: (n) => {
          setCd(n);
          if (n === 0) window.setTimeout(() => setCd(null), 750);
        },
        onGatePassed: (cleared, total) => {
          setGatesCleared(cleared);
          showToast("gate", `GATE ${String(cleared).padStart(2, "0")} / ${total} CLEARED`);
        },
        onGateMissed: () => showToast("miss", "GATE MISSED — CIRCLE BACK"),
        onCrash: () => setCrashId((i) => i + 1),
        onKill: (_kills, bonus) => showToast("kill", `TARGET DOWN // −${bonus.toFixed(2)}S`),
        onFinish: (r) => {
          setResult(r);
          setBestMs(r.bestMs);
          setGatesCleared(TOTAL_GATES);
        },
      },
      readDevice() === "mobile"
    );
    eng.setSettings(readSettings());
    engineRef.current = eng;
    return () => {
      eng.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the engine's control scheme in sync with the chosen device
  useEffect(() => {
    if (device) engineRef.current?.setTouchMode(device === "mobile");
  }, [device]);

  useEffect(() => {
    engineRef.current?.setSettings(settings);
    setMuted(settings.muted);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  // toast lifetime
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast((cur) => (cur && cur.id === toast.id ? null : cur)), 1150);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Enter to start
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Enter" && device !== null) {
        const eng = engineRef.current;
        if (eng && (eng.phase === "menu" || eng.phase === "finished")) eng.start();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [device]);

  const bestLabel = bestMs !== null ? formatTime(bestMs) : null;
  const inFlight = phase === "countdown" || phase === "racing" || phase === "paused";

  return (
    <div
      id="game-root"
      ref={(el) => {
        hudRef.current.root = el;
      }}
      className="fixed inset-0 overflow-hidden bg-[#05030d]"
    >
      <canvas id="game-canvas" className="absolute inset-0 block h-full w-full" />

      {/* atmosphere overlays */}
      <div className="vignette" style={{ opacity: "calc(0.45 + var(--speed, 0) * 0.45)" }} />
      <div className="scanlines" />
      <div className="grain" />

      <Hud hud={hudRef.current} visible={inFlight} gatesCleared={gatesCleared} bestLabel={bestLabel} />

      {toast && <Toast toast={toast} />}
      {crashId > 0 && <CrashFlash key={crashId} />}
      {(phase === "countdown" || cd === 0) && cd !== null && <CountdownOverlay n={cd} />}

      {phase === "menu" && device !== null && (
        <IntroScreen
          onStart={() => engineRef.current?.start()}
          settings={settings}
          onSettings={setSettings}
          bestLabel={bestLabel}
          device={device}
          onChangeDevice={() => setDevice(null)}
        />
      )}

      {device === null && (
        <DeviceSelect
          suggested={suggested}
          onPick={(d) => {
            setDevice(d);
            try {
              localStorage.setItem(DEVICE_KEY, d);
            } catch {
              /* ignore */
            }
            engineRef.current?.setTouchMode(d === "mobile");
            if (engineRef.current && engineRef.current.phase !== "menu") engineRef.current.exitToMenu();
          }}
        />
      )}

      {phase === "paused" && (
        <PauseScreen
          onResume={() => engineRef.current?.resume()}
          onRestart={() => engineRef.current?.start()}
          onExit={() => engineRef.current?.exitToMenu()}
        />
      )}

      {phase === "finished" && result && (
        <FinishScreen
          result={result}
          onAgain={() => engineRef.current?.start()}
          onExit={() => engineRef.current?.exitToMenu()}
        />
      )}

      {(inFlight || phase === "finished") && !isTouch && (
        <div className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2">
          <MuteButton
            muted={muted}
            onToggle={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
          />
        </div>
      )}

      {isTouch && (phase === "racing" || phase === "countdown") && (
        <TouchControls getEngine={() => engineRef.current} />
      )}
    </div>
  );
}
