import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Drone — angle-mode quad physics. Thrust along body up-axis,       */
/*  gravity, quadratic drag. Mouse stick = target attitude.           */
/* ------------------------------------------------------------------ */

export const TUNE = {
  maxThrust: 24, // m/s^2 at full throttle
  gravity: 9.8,
  linDrag: 0.12,
  quadDrag: 0.02,
  maxPitch: 1.0, // rad
  maxRoll: 1.1, // rad
  pitchRate: 8.5, // 1/s toward target
  rollRate: 10.5,
  yawKeyRate: 2.3, // rad/s
  coordTurn: 1.45, // auto-yaw from roll stick
  throttleRate: 0.85, // per second from W/S
};

export interface StepInput {
  stickX: number; // -1..1  (right positive)
  stickY: number; // -1..1  (pull-back positive)
  yawKey: number; // -1..1  (left positive)
  throttle: number; // 0..1 current target
  punch: boolean;
  brake: boolean;
  dt: number;
}

export class Drone {
  pos = new THREE.Vector3();
  prevPos = new THREE.Vector3();
  vel = new THREE.Vector3();
  quat = new THREE.Quaternion();
  up = new THREE.Vector3(0, 1, 0);
  fwd = new THREE.Vector3(0, 0, -1);
  pitch = 0;
  yaw = 0;
  roll = 0;
  throttle = 0;
  distFlown = 0;

  private eul = new THREE.Euler(0, 0, 0, "YXZ");
  private acc = new THREE.Vector3();

  reset(pos: THREE.Vector3, yaw: number) {
    this.pos.copy(pos);
    this.prevPos.copy(pos);
    this.vel.set(0, 0, 0);
    this.pitch = 0;
    this.roll = 0;
    this.yaw = yaw;
    this.throttle = 0.42;
    this.distFlown = 0;
    this.syncQuat();
  }

  private syncQuat() {
    this.eul.set(this.pitch, this.yaw, this.roll, "YXZ");
    this.quat.setFromEuler(this.eul);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quat);
  }

  step(inp: StepInput) {
    const dt = inp.dt;
    // attitude (angle mode: approach target tilt)
    const targetPitch = inp.stickY * TUNE.maxPitch;
    const targetRoll = -inp.stickX * TUNE.maxRoll;
    this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-TUNE.pitchRate * dt));
    this.roll += (targetRoll - this.roll) * (1 - Math.exp(-TUNE.rollRate * dt));
    this.yaw += (inp.yawKey * TUNE.yawKeyRate - inp.stickX * TUNE.coordTurn) * dt;

    // throttle target already resolved by caller; smooth response
    const tRate = inp.throttle > this.throttle ? 5.5 : 7.5;
    this.throttle += (inp.throttle - this.throttle) * (1 - Math.exp(-tRate * dt));
    let thr = THREE.MathUtils.clamp(this.throttle, 0, 1);
    if (inp.punch) thr = 1;

    this.syncQuat();

    // forces
    this.acc.copy(this.up).multiplyScalar(thr * TUNE.maxThrust);
    this.acc.y -= TUNE.gravity;
    const speed = this.vel.length();
    const brakeK = inp.brake ? 3.4 : 0;
    const k = TUNE.linDrag + TUNE.quadDrag * speed + brakeK;
    this.acc.addScaledVector(this.vel, -k);
    // extra soft cap above 40 m/s
    if (speed > 40) this.acc.addScaledVector(this.vel, -(speed - 40) * 0.06);

    this.prevPos.copy(this.pos);
    this.vel.addScaledVector(this.acc, dt);
    const stepLen = this.vel.length() * dt;
    this.distFlown += stepLen;
    this.pos.addScaledVector(this.vel, dt);

    // soft ceiling
    if (this.pos.y > 130) {
      this.pos.y = 130;
      if (this.vel.y > 0) this.vel.y = 0;
    }
  }

  /** tumbling ballistic integration used during crash slow-mo */
  tumble(dt: number) {
    this.prevPos.copy(this.pos);
    this.vel.y -= TUNE.gravity * dt;
    this.vel.multiplyScalar(Math.exp(-0.4 * dt));
    this.pos.addScaledVector(this.vel, dt);
    this.roll += 3.2 * dt;
    this.pitch += 1.7 * dt;
    this.syncQuat();
    if (this.pos.y < 0.4) {
      this.pos.y = 0.4;
      this.vel.multiplyScalar(0.2);
      this.vel.y = Math.abs(this.vel.y) * 0.25;
    }
  }

  get speed() {
    return this.vel.length();
  }
}
