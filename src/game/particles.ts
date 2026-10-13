import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  BurstPool — recycled particle explosions for gate passes/crashes  */
/* ------------------------------------------------------------------ */

export class BurstPool {
  readonly points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private baseCol: Float32Array;
  private life: Float32Array;
  private decay: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene, max = 360) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.baseCol = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.decay = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({
        size: 0.32,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);
  }

  spawn(center: THREE.Vector3, color: THREE.Color, count = 44, speed = 9, spread = 1) {
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const i3 = i * 3;
      // random direction on sphere
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.3 + Math.random() * 0.9);
      this.pos[i3] = center.x + (Math.random() - 0.5) * spread;
      this.pos[i3 + 1] = center.y + (Math.random() - 0.5) * spread;
      this.pos[i3 + 2] = center.z + (Math.random() - 0.5) * spread;
      this.vel[i3] = Math.cos(a) * s * sp;
      this.vel[i3 + 1] = u * sp + 1.5;
      this.vel[i3 + 2] = Math.sin(a) * s * sp;
      this.baseCol[i3] = color.r * (1.4 + Math.random());
      this.baseCol[i3 + 1] = color.g * (1.4 + Math.random());
      this.baseCol[i3 + 2] = color.b * (1.4 + Math.random());
      this.life[i] = 1;
      this.decay[i] = 0.9 + Math.random() * 0.9;
    }
  }

  update(dt: number) {
    const drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      const i3 = i * 3;
      this.life[i] -= this.decay[i] * dt;
      const l = Math.max(0, this.life[i]);
      this.vel[i3] *= drag;
      this.vel[i3 + 1] = this.vel[i3 + 1] * drag - 4.2 * dt;
      this.vel[i3 + 2] *= drag;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.col[i3] = this.baseCol[i3] * l;
      this.col[i3 + 1] = this.baseCol[i3 + 1] * l;
      this.col[i3 + 2] = this.baseCol[i3 + 2] * l;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
/*  WindLines — speed streaks parented to the FPV camera              */
/* ------------------------------------------------------------------ */

export class WindLines {
  readonly obj: THREE.LineSegments;
  private N = 72;
  private pos: Float32Array;
  private data: { x: number; y: number; z: number }[] = [];
  private mat: THREE.LineBasicMaterial;
  private geo: THREE.BufferGeometry;

  constructor(parent: THREE.Object3D) {
    this.pos = new Float32Array(this.N * 6);
    for (let i = 0; i < this.N; i++) {
      this.data.push(this.fresh(-70, 8));
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({
      color: 0xaee6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.obj = new THREE.LineSegments(this.geo, this.mat);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = 30;
    parent.add(this.obj);
  }

  private fresh(zMin: number, zMax: number) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.6 + Math.random() * 7;
    return {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.7,
      z: zMin + Math.random() * (zMax - zMin),
    };
  }

  update(dt: number, speed: number) {
    const show = THREE.MathUtils.clamp((speed - 9) / 26, 0, 1);
    this.mat.opacity = show * 0.5;
    if (show <= 0.001) return;
    const len = 0.6 + speed * 0.06;
    const dz = (speed * 1.35 + 3) * dt;
    for (let i = 0; i < this.N; i++) {
      const d = this.data[i];
      d.z += dz;
      if (d.z > 7) {
        Object.assign(d, this.fresh(-75, -25));
      }
      const i6 = i * 6;
      this.pos[i6] = d.x;
      this.pos[i6 + 1] = d.y;
      this.pos[i6 + 2] = d.z;
      this.pos[i6 + 3] = d.x;
      this.pos[i6 + 4] = d.y;
      this.pos[i6 + 5] = d.z + len;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
