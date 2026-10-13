import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  BoltPool — instanced tracer bolts shared schema for player/enemy  */
/* ------------------------------------------------------------------ */

export interface Bolt {
  active: boolean;
  from: "player" | "enemy";
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  whooshed: boolean;
}

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();

export class BoltPool {
  readonly mesh: THREE.InstancedMesh;
  items: Bolt[] = [];
  private cap: number;

  constructor(scene: THREE.Scene, cap = 80) {
    this.cap = cap;
    const geo = new THREE.SphereGeometry(0.14, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 24;
    for (let i = 0; i < cap; i++) {
      this.items.push({
        active: false,
        from: "player",
        pos: new THREE.Vector3(0, -1000, 0),
        vel: new THREE.Vector3(),
        life: 0,
        whooshed: false,
      });
      this.mesh.setColorAt(i, _c.setRGB(0, 0, 0));
      _m.compose(this.items[i].pos, _q.identity(), _s.set(0, 0, 0));
      this.mesh.setMatrixAt(i, _m);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }

  /** Find a free slot and spawn. color in HDR (e.g. (0.5, 3, 3)). */
  spawn(pos: THREE.Vector3, vel: THREE.Vector3, color: THREE.Color, from: "player" | "enemy", life: number): Bolt | null {
    for (let i = 0; i < this.cap; i++) {
      const b = this.items[i];
      if (b.active) continue;
      b.active = true;
      b.from = from;
      b.pos.copy(pos);
      b.vel.copy(vel);
      b.life = life;
      b.whooshed = false;
      this.mesh.setColorAt(i, color);
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      return b;
    }
    return null;
  }

  clearAll() {
    for (const b of this.items) {
      b.active = false;
      b.life = 0;
    }
  }

  /**
   * Integrate + write matrices. `collide` runs per active bolt;
   * return true to consume the bolt.
   */
  update(dt: number, collide: (b: Bolt) => boolean) {
    for (let i = 0; i < this.cap; i++) {
      const b = this.items[i];
      if (b.active) {
        b.life -= dt;
        b.pos.addScaledVector(b.vel, dt);
        if (b.life <= 0 || b.pos.y < 0.15 || collide(b)) {
          b.active = false;
        }
      }
      if (b.active) {
        _q.setFromUnitVectors(_z, b.vel.lengthSq() > 0 ? b.vel.clone().normalize() : _z);
        const sp = b.vel.length();
        _m.compose(b.pos, _q, _s.set(1, 1, 2.2 + sp * 0.02));
        this.mesh.setMatrixAt(i, _m);
      } else {
        _m.compose(b.pos, _q.identity(), _s.set(0, 0, 0));
        this.mesh.setMatrixAt(i, _m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
