import * as THREE from "three";
import { GATES, COURSE_CURVE, GATE_RADIUS, PASS_RADIUS, TOTAL_GATES, type GateDef } from "./track";
import type { BurstPool } from "./particles";
import type { AudioEngine } from "./audio";

/* ------------------------------------------------------------------ */
/*  GateSystem — neon rings, beacon beam, pass/miss detection          */
/* ------------------------------------------------------------------ */

const COL_DIM = new THREE.Color(0.14, 0.4, 0.55);
const COL_NEXT = new THREE.Color(2.6, 0.35, 2.2);
const COL_FINAL = new THREE.Color(0.3, 2.2, 2.8);
const COL_PASSED = new THREE.Color(0.2, 1.6, 1.1);

interface GateNode {
  def: GateDef;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  passed: boolean;
  punch: number;
}

export class GateSystem {
  private group = new THREE.Group();
  private nodes: GateNode[] = [];
  activeIdx = -1;
  private beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private light: THREE.PointLight;
  private lineMat: THREE.LineDashedMaterial;

  constructor(
    scene: THREE.Scene,
    private bursts: BurstPool,
    private audio: AudioEngine
  ) {
    const ringGeo = new THREE.TorusGeometry(GATE_RADIUS, 0.2, 10, 42);
    const haloGeo = new THREE.TorusGeometry(GATE_RADIUS, 0.62, 8, 42);
    for (const def of GATES) {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COL_DIM.clone(), toneMapped: true }));
      ring.position.copy(def.pos);
      ring.quaternion.copy(def.quat);
      const halo = new THREE.Mesh(
        haloGeo,
        new THREE.MeshBasicMaterial({
          color: COL_NEXT.clone(),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      halo.position.copy(def.pos);
      halo.quaternion.copy(def.quat);
      this.group.add(ring, halo);
      this.nodes.push({ def, ring, halo, passed: false, punch: 0 });
    }

    // beacon beam on the active gate
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 130, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: COL_NEXT.clone(),
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.beam.position.set(0, -500, 0);
    this.group.add(this.beam);

    this.light = new THREE.PointLight(0xff2bd6, 0, 60, 1.6);
    this.group.add(this.light);

    // faint racing line
    const pts = COURSE_CURVE.getSpacedPoints(300);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    this.lineMat = new THREE.LineDashedMaterial({
      color: new THREE.Color(0.5, 1.6, 2.0),
      dashSize: 1.6,
      gapSize: 2.6,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(lineGeo, this.lineMat);
    line.computeLineDistances();
    this.group.add(line);

    scene.add(this.group);
  }

  setActive(idx: number) {
    this.activeIdx = idx;
    if (idx < 0 || idx >= TOTAL_GATES) {
      this.beam.position.set(0, -500, 0);
      this.light.intensity = 0;
      return;
    }
    const n = this.nodes[idx];
    const last = idx === TOTAL_GATES - 1;
    n.ring.material.color.copy(last ? COL_FINAL : COL_NEXT);
    n.halo.material.color.copy(last ? COL_FINAL : COL_NEXT);
    n.halo.material.opacity = 0.16;
    this.beam.material.color.copy(last ? COL_FINAL : COL_NEXT);
    this.beam.position.copy(n.def.pos);
    this.beam.position.y += 55;
    this.light.color.setHex(last ? 0x22d3ee : 0xff2bd6);
    this.light.position.copy(n.def.pos);
    this.light.intensity = 260;
  }

  /** returns 'pass' | 'miss' | null based on segment crossing the active gate plane */
  check(prev: THREE.Vector3, cur: THREE.Vector3): "pass" | "miss" | null {
    if (this.activeIdx < 0 || this.activeIdx >= TOTAL_GATES) return null;
    const { def } = this.nodes[this.activeIdx];
    const rel0 = _v0.copy(prev).sub(def.pos);
    const rel1 = _v1.copy(cur).sub(def.pos);
    const d0 = rel0.dot(def.normal);
    const d1 = rel1.dot(def.normal);
    if (d0 < 0 && d1 >= 0) {
      const t = d0 / (d0 - d1);
      _v2.copy(prev).lerp(cur, t).sub(def.pos);
      const r = _v2.length();
      // only count if reasonably near the gate vertically/axis-wise
      return r <= PASS_RADIUS ? "pass" : r <= GATE_RADIUS * 3 ? "miss" : null;
    }
    return null;
  }

  onPassed(): { final: boolean } {
    const n = this.nodes[this.activeIdx];
    const final = this.activeIdx === TOTAL_GATES - 1;
    n.passed = true;
    n.punch = 1;
    n.ring.material.color.copy(COL_PASSED);
    n.halo.material.opacity = 0;
    this.bursts.spawn(n.def.pos, final ? COL_FINAL : COL_NEXT, final ? 90 : 48, final ? 13 : 9, 2.4);
    this.audio.passGate();
    if (!final) this.setActive(this.activeIdx + 1);
    else this.setActive(-1);
    return { final };
  }

  onMissed() {
    const n = this.nodes[this.activeIdx];
    if (n) n.punch = 0.6;
    this.audio.missGate();
  }

  nextPos(): THREE.Vector3 | null {
    if (this.activeIdx < 0 || this.activeIdx >= TOTAL_GATES) return null;
    return this.nodes[this.activeIdx].def.pos;
  }

  reset() {
    for (const n of this.nodes) {
      n.passed = false;
      n.punch = 0;
      n.ring.material.color.copy(COL_DIM);
      n.halo.material.opacity = 0;
      n.ring.scale.setScalar(1);
    }
    this.setActive(0);
  }

  update(t: number, dt: number, racing: boolean) {
    this.lineMat.opacity = racing ? 0.18 : 0.34;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const isActive = i === this.activeIdx;
      n.punch = Math.max(0, n.punch - dt * 2.6);
      let s = 1 + n.punch * 0.28;
      if (isActive) s *= 1 + Math.sin(t * 5.2) * 0.035;
      else if (!racing) s *= 1 + Math.sin(t * 1.6 + i * 0.7) * 0.02;
      n.ring.scale.setScalar(s);
      n.halo.scale.setScalar(s);
      if (isActive) {
        n.halo.rotation.z += dt * 1.4;
        n.halo.material.opacity = 0.13 + Math.sin(t * 5.2) * 0.05;
      }
      if (n.passed) {
        _col.set(0.1, 0.5, 0.4).lerp(COL_PASSED, n.punch);
        n.ring.material.color.copy(_col);
      } else if (!isActive && racing) {
        n.ring.material.color.copy(COL_DIM);
      }
    }
    if (this.activeIdx >= 0 && this.activeIdx < TOTAL_GATES) {
      this.light.intensity = 230 + Math.sin(t * 7.3) * 60;
      this.beam.material.opacity = 0.16 + Math.sin(t * 4.1) * 0.06;
    }
  }
}

const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _col = new THREE.Color();
