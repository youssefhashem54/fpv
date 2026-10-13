import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Track definition — gates, obstacles, course spline, minimap data  */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [x, y, z] gate centers, y = altitude in meters */
const GATE_RAW: [number, number, number][] = [
  [0, 7, 60],
  [10, 8, 32],
  [25, 10, 6],
  [31, 12, -24],
  [22, 18, -52],
  [2, 25, -72],
  [-24, 23, -84],
  [-44, 15, -68],
  [-54, 7, -45],
  [-50, 6, -16],
  [-36, 7, 6],
  [-18, 9, 20],
  [-7, 8, 38],
  [2, 8, 44.5],
];

export const GATE_RADIUS = 3.4;
export const PASS_RADIUS = 2.95;

export interface GateDef {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  quat: THREE.Quaternion;
  index: number;
}

export const GATES: GateDef[] = GATE_RAW.map((g, i) => {
  const pos = new THREE.Vector3(g[0], g[1], g[2]);
  const prev = GATE_RAW[Math.max(0, i - 1)];
  const next = GATE_RAW[Math.min(GATE_RAW.length - 1, i + 1)];
  const normal = new THREE.Vector3(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  return { pos, normal, quat, index: i };
});

export const TOTAL_GATES = GATES.length;

/** Spawn point: behind gate 0, aimed at it */
const g0 = GATES[0];
export const SPAWN = g0.pos.clone().addScaledVector(g0.normal, -15);
SPAWN.y = Math.max(SPAWN.y, 6);
export const SPAWN_YAW = Math.atan2(-g0.normal.x, -g0.normal.z);

/** Course spline (for racing line + obstacle avoidance sampling) */
export const COURSE_CURVE = new THREE.CatmullRomCurve3(
  GATES.map((g) => g.pos.clone()),
  false,
  "centripetal",
  0.5
);

const filterPts = [SPAWN.clone(), ...COURSE_CURVE.getSpacedPoints(260)];

function distToCourse(p: THREE.Vector3): number {
  let best = Infinity;
  for (const q of filterPts) {
    const d = p.distanceTo(q);
    if (d < best) best = d;
  }
  return best;
}

/* ----------------------------- pylons ----------------------------- */
export interface PylonDef {
  x: number;
  z: number;
  r: number;
  h: number;
  hue: number; // 0 cyan, 1 magenta, 2 violet
  tilt: number;
}

export const PYLONS: PylonDef[] = [];
{
  const rand = mulberry32(1337);
  const v = new THREE.Vector3();
  let attempts = 0;
  while (PYLONS.length < 44 && attempts < 900) {
    attempts++;
    const x = -130 + rand() * 240; // -130..110
    const z = -160 + rand() * 300; // -160..140
    v.set(x, 0, z);
    // sample at character height
    const vc = v.clone();
    vc.y = 10;
    if (distToCourse(vc) < 14) continue;
    let nearGate = false;
    for (const g of GATES) {
      const dx = g.pos.x - x;
      const dz = g.pos.z - z;
      if (dx * dx + dz * dz < 14 * 14) nearGate = true;
    }
    if (nearGate) continue;
    PYLONS.push({
      x,
      z,
      r: 2.4 + rand() * 3.0,
      h: 15 + rand() * 46,
      hue: Math.floor(rand() * 3),
      tilt: (rand() - 0.5) * 0.06,
    });
  }
  // intentional flankers near a few gates for spice
  for (const gi of [3, 8, 11]) {
    const g = GATES[gi];
    const side = new THREE.Vector3().crossVectors(g.normal, new THREE.Vector3(0, 1, 0)).normalize();
    for (const s of [-1, 1]) {
      const px = g.pos.x + side.x * 7.5 * s;
      const pz = g.pos.z + side.z * 7.5 * s;
      PYLONS.push({ x: px, z: pz, r: 1.9, h: g.pos.y + 14 + rand() * 8, hue: gi % 3, tilt: 0 });
    }
  }
}

/* -------------------------- floating rocks ------------------------- */
export interface RockDef {
  base: THREE.Vector3;
  r: number;
  phase: number;
  spin: number;
  squish: number;
}

export const ROCKS: RockDef[] = [];
{
  const rand = mulberry32(777);
  const v = new THREE.Vector3();
  let attempts = 0;
  while (ROCKS.length < 13 && attempts < 500) {
    attempts++;
    v.set(-110 + rand() * 220, 14 + rand() * 34, -150 + rand() * 270);
    if (distToCourse(v) < 13) continue;
    if (v.distanceTo(SPAWN) < 16) continue;
    ROCKS.push({
      base: v.clone(),
      r: 1.8 + rand() * 3.4,
      phase: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 0.5,
      squish: 0.7 + rand() * 0.5,
    });
  }
  // dive-section obstacle field (gates 6-8)
  for (let i = 0; i < 6; i++) {
    const t = 0.42 + rand() * 0.15;
    const p = COURSE_CURVE.getPoint(t);
    const off = new THREE.Vector3((rand() - 0.5) * 22, (rand() - 0.3) * 10, (rand() - 0.5) * 22);
    if (off.length() < 7) off.setLength(7);
    p.add(off);
    ROCKS.push({
      base: p,
      r: 1.3 + rand() * 2.0,
      phase: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 0.8,
      squish: 0.7 + rand() * 0.6,
    });
  }
}

/* --------------------------- enemy sentries ------------------------- */
/** Hostile sentry drone anchor points [x, y, z] — offset from the racing line */
export const ENEMY_ANCHORS: [number, number, number][] = [
  [-2, 11, 18],
  [20, 10, 30],
  [40, 14, -30],
  [10, 23, -44],
  [-8, 30, -80],
  [-36, 27, -94],
  [-52, 18, -62],
  [-62, 10, -32],
  [-45, 9, -8],
  [-30, 10, 14],
  [-14, 12, -18],
  [-38, 16, -80],
];

/* ----------------------------- minimap ----------------------------- */
const PAD = 26;
export const MAP_SIZE = 124;
const xs = GATES.map((g) => g.pos.x);
const zs = GATES.map((g) => g.pos.z);
const MIN_X = Math.min(...xs) - PAD;
const MAX_X = Math.max(...xs) + PAD;
const MIN_Z = Math.min(...zs) - PAD;
const MAX_Z = Math.max(...zs) + PAD;
const MAP_SCALE = Math.min(MAP_SIZE / (MAX_X - MIN_X), MAP_SIZE / (MAX_Z - MIN_Z));

export function mapProject(x: number, z: number): [number, number] {
  const mx = (x - MIN_X) * MAP_SCALE + (MAP_SIZE - (MAX_X - MIN_X) * MAP_SCALE) / 2;
  const my = (z - MIN_Z) * MAP_SCALE + (MAP_SIZE - (MAX_Z - MIN_Z) * MAP_SCALE) / 2;
  return [mx, my];
}

export const MAP_PATH = (() => {
  const pts = GATES.map((g) => mapProject(g.pos.x, g.pos.z));
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
})();

/* ----------------------------- helpers ----------------------------- */
export function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = Math.floor(ms % 1000);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${mm.toString().padStart(3, "0")}`;
}
