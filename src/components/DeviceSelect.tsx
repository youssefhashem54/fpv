import { Gamepad2, Monitor, MousePointer2, Smartphone, Zap } from "lucide-react";

export type Device = "pc" | "mobile";

interface Props {
  onPick: (d: Device) => void;
  suggested: Device;
}

export default function DeviceSelect({ onPick, suggested }: Props) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-[#05030d]/92 px-6 py-10 backdrop-blur-sm">
      <div className="pointer-events-none absolute left-5 top-5 font-mono2 text-[0.62rem] tracking-[0.3em] text-cyan-300/50">
        INPUT DEVICE CONFIG
      </div>
      <div className="pointer-events-none absolute right-5 top-5 font-mono2 text-[0.62rem] tracking-[0.3em] text-fuchsia-300/50">
        STEP 1 / 1
      </div>

      <div className="text-center">
        <div className="mb-2 font-tech text-[0.66rem] font-medium tracking-[0.5em] text-cyan-300/80 glow-cyan">
          NEONLINE FPV
        </div>
        <h1 className="title-gradient font-display text-[clamp(1.6rem,5vw,2.8rem)] font-black tracking-[0.12em]">
          SELECT YOUR RIG
        </h1>
        <p className="mt-2 font-tech text-xs tracking-[0.2em] text-indigo-300/60">
          HOW ARE YOU FLYING TODAY?
        </p>
      </div>

      <div className="flex w-full max-w-3xl flex-col gap-4 sm:flex-row">
        {/* ------------------------------- PC ------------------------------- */}
        <button
          onClick={() => onPick("pc")}
          className="panel brackets group relative flex flex-1 flex-col items-center gap-3 px-6 py-7 text-center transition-all duration-200 hover:scale-[1.02] hover:border-cyan-400/60"
        >
          {suggested === "pc" && (
            <span className="absolute right-3 top-3 border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 font-mono2 text-[0.5rem] tracking-[0.2em] text-cyan-300">
              DETECTED
            </span>
          )}
          <Monitor
            size={42}
            className="text-cyan-300 transition-transform duration-200 group-hover:scale-110"
            strokeWidth={1.3}
          />
          <div>
            <div className="font-display text-lg font-bold tracking-[0.25em] text-white">PC</div>
            <div className="font-mono2 text-[0.58rem] tracking-[0.22em] text-indigo-300/60">KEYBOARD + MOUSE</div>
          </div>
          <div className="mt-1 flex w-full flex-col gap-1.5 border-t border-white/10 pt-3 text-[0.68rem] text-indigo-100/80">
            <Row icon={<MousePointer2 size={11} />} label="ATTITUDE" value="MOUSE" />
            <Row label="THROTTLE" value="W / S" />
            <Row label="YAW" value="A / D" />
            <Row label="FIRE" value="RIGHT-CLICK" accent />
          </div>
          <span className="mt-2 font-tech text-[0.62rem] tracking-[0.3em] text-cyan-300/70 group-hover:text-cyan-200">
            POINTER LOCK ENABLED →
          </span>
        </button>

        {/* ----------------------------- MOBILE ----------------------------- */}
        <button
          onClick={() => onPick("mobile")}
          className="panel brackets group relative flex flex-1 flex-col items-center gap-3 px-6 py-7 text-center transition-all duration-200 hover:scale-[1.02] hover:border-fuchsia-400/60"
        >
          {suggested === "mobile" && (
            <span className="absolute right-3 top-3 border border-fuchsia-400/50 bg-fuchsia-500/10 px-2 py-0.5 font-mono2 text-[0.5rem] tracking-[0.2em] text-fuchsia-300">
              DETECTED
            </span>
          )}
          <div className="relative">
            <Smartphone
              size={42}
              className="text-fuchsia-300 transition-transform duration-200 group-hover:scale-110"
              strokeWidth={1.3}
            />
            <Gamepad2
              size={18}
              className="absolute -bottom-1 -right-3 text-cyan-300"
              strokeWidth={1.6}
            />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-[0.25em] text-white">MOBILE</div>
            <div className="font-mono2 text-[0.58rem] tracking-[0.22em] text-indigo-300/60">TWIN-STICK TOUCH</div>
          </div>
          <div className="mt-1 flex w-full flex-col gap-1.5 border-t border-white/10 pt-3 text-[0.68rem] text-indigo-100/80">
            <Row label="LEFT STICK" value="THR + YAW" />
            <Row label="RIGHT STICK" value="PITCH + ROLL" />
            <Row label="FIRE" value="TRIGGER BTN" accent />
            <Row label="HOVER" value="STICKS CENTERED" />
          </div>
          <span className="mt-2 font-tech text-[0.62rem] tracking-[0.3em] text-fuchsia-300/70 group-hover:text-fuchsia-200">
            CONTROLLER OVERLAY →
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2 font-mono2 text-[0.6rem] tracking-[0.22em] text-indigo-300/40">
        <Zap size={11} /> YOU CAN SWITCH ANYTIME FROM THE MAIN MENU
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-indigo-300/60">
        {icon}
        {label}
      </span>
      <span className={`font-mono2 text-[0.6rem] ${accent ? "text-red-300" : "text-indigo-100/90"}`}>{value}</span>
    </div>
  );
}
