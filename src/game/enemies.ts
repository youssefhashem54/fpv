import * as THREE from "three";
import { ENEMY_ANCHORS } from "./track";
import { BoltPool, type Bolt } from "./projectiles";
import type { BurstPool } from "./particles";
import type { AudioEngine } from "./audio";

/* ------------------------------------------------------------------ */
/*  EnemyManager — hostile sentry drones that patrol, aggro, shoot    */
/* ------------------------------------------------------------------ */

type EnemyState = "idle" | "aggro" | "dying";

const COL_IDLE = new THREE.Color(1.8, 0.7, 2.8); // violet
const COL_AGGRO = new THREE.Color(3.2, 0.35, 0.3); // red
const COL_WINDUP = new THREE.Color(3.4, 3.4, 3.4); // white flash
const COL_BOLT = new THREE.Color(3.2, 0.5, 0.35);
const COL_DEATH = new THREE.Color(3.0, 1.4, 0.35);

const AGGRO_R = 46;
const FIRE_R = 72;
const LEASH_R = 88;
const BOLT_SPEED = 36;

export interface EnemyCtx {
  playerPos: THREE.Vector3;
  playerVel: THREE.Vector3;
  /** racing, not crashed, not invulnerable */
  playerVulnerable: boolean;
  playerEngaged: boolean; // racing at all
  onPlayerHit: () => void;
}

interface Enemy {
  group: THREE.Group;
  body: THREE.Mesh;
  core: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  anchor: THREE.Vector3;
  state: EnemyState;
  hp: number;
  bobPhase: number;
  orbitA: number;
  fireT: number;
  chargeT: number;
  hitFlash: number;
  dyingT: number;
  vel: THREE.Vector3;
}

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();
const _w = new THREE.Color();

export class EnemyManager {
  readonly group = new THREE.Group();
  enemies: Enemy[] = [];
  bolts: BoltPool;
  private bodyMat = new THREE.MeshStandardMaterial({
    color: 0x14102a,
    roughness: 0.35,
    metalness: 0.85,
    flatShading: true,
  });

  constructor(
    scene: THREE.Scene,
    private bursts: BurstPool,
    private audio: AudioEngine
  ) {
    const bodyGeo = new THREE.OctahedronGeometry(0.62, 0);
    const coreGeo = new THREE.SphereGeometry(0.26, 10, 10);
    const wingGeo = new THREE.BoxGeometry(1.7, 0.07, 0.32);
    const finGeo = new THREE.BoxGeometry(0.07, 0.55, 0.4);
    for (const a of ENEMY_ANCHORS) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, this.bodyMat);
      body.scale.set(1, 0.55, 1.45);
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: COL_IDLE.clone(), toneMapped: true }));
      core.position.set(0, 0, 0.62);
      const wings = new THREE.Mesh(wingGeo, this.bodyMat);
      const fin = new THREE.Mesh(finGeo, this.bodyMat);
      fin.position.set(0, 0.35, -0.5);
      group.add(body, core, wings, fin);
      const anchor = new THREE.Vector3(a[0], a[1], a[2]);
      group.position.copy(anchor);
      this.group.add(group);
      this.enemies.push({
        group,
        body,
        core,
        anchor,
        state: "idle",
        hp: 2,
        bobPhase: Math.random() * Math.PI * 2,
        orbitA: Math.random() * Math.PI * 2,
        fireT: 1 + Math.random() * 2,
        chargeT: 0,
        hitFlash: 0,
        dyingT: 0,
        vel: new THREE.Vector3(),
      });
    }
    scene.add(this.group);
    this.bolts = new BoltPool(scene, 72);
  }

  reset() {
    for (const e of this.enemies) {
      e.state = "idle";
      e.hp = 2;
      e.group.visible = true;
      e.group.position.copy(e.anchor);
      e.group.rotation.set(0, 0, 0);
      e.chargeT = 0;
      e.fireT = 1 + Math.random() * 2;
      e.hitFlash = 0;
    }
    this.bolts.clearAll();
  }

  /** sphere query used by player bolts. Returns 'hit' | 'kill' | null */
  damageAt(pos: THREE.Vector3, radius: number, dir: THREE.Vector3): { result: "hit" | "kill"; enemy: Enemy } | null {
    for (const e of this.enemies) {
      if (e.state === "dying") continue;
      const r = radius + 1.05;
      if (pos.distanceToSquared(e.group.position) < r * r) {
        e.hp -= 1;
        e.hitFlash = 0.14;
        if (e.state === "idle") e.state = "aggro";
        e.vel.addScaledVector(dir, 2.5);
        if (e.hp <= 0) {
          e.state = "dying";
          e.dyingT = 0.85;
          e.vel.addScaledVector(dir, 5).add(_v.set(0, 4, 0));
          this.bursts.spawn(e.group.position, COL_DEATH, 60, 12, 1.6);
          this.bursts.spawn(e.group.position, COL_AGGRO, 30, 7, 2.4);
          this.audio.explode();
          return { result: "kill", enemy: e };
        }
        this.audio.hit();
        return { result: "hit", enemy: e };
      }
    }
    return null;
  }

  /** body collision used by engine — flying into a sentry crashes you */
  playerCollide(pos: THREE.Vector3, radius: number): boolean {
    for (const e of this.enemies) {
      if (e.state === "dying") continue;
      const r = radius + 1.15;
      if (pos.distanceToSquared(e.group.position) < r * r) return true;
    }
    return false;
  }

  aliveCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.state !== "dying") n++;
    return n;
  }

  update(dt: number, t: number, ctx: EnemyCtx) {
    const { playerPos, playerVel, playerVulnerable, playerEngaged, onPlayerHit } = ctx;

    for (const e of this.enemies) {
      const p = e.group.position;
      const distSq = p.distanceToSquared(playerPos);

      if (e.state === "dying") {
        e.dyingT -= dt;
        e.vel.y -= 14 * dt;
        p.addScaledVector(e.vel, dt);
        e.group.rotation.x += 7 * dt;
        e.group.rotation.z += 5 * dt;
        e.core.material.color.copy(_w.set(4, 0.2, 0.1).multiplyScalar(Math.max(0.1, e.dyingT)));
        if (e.dyingT <= 0 || p.y < 0.3) {
          if (p.y < 0.3 && e.group.visible) {
            this.bursts.spawn(p, COL_DEATH, 26, 8, 1.2);
          }
          e.group.visible = false;
        }
        continue;
      }

      // state transitions
      if (e.state === "idle") {
        if (playerEngaged && distSq < AGGRO_R * AGGRO_R) e.state = "aggro";
      } else if (e.state === "aggro") {
        if (distSq > LEASH_R * LEASH_R || !playerEngaged) e.state = "idle";
      }

      const bobY = Math.sin(t * 1.6 + e.bobPhase) * 0.6;

      if (e.state === "idle") {
        _t.copy(e.anchor);
        _t.y += bobY;
        _t.x += Math.sin(t * 0.5 + e.bobPhase) * 1.4;
        p.lerp(_t, 1 - Math.exp(-1.6 * dt));
        e.group.rotation.y += dt * 0.5;
        e.group.rotation.z *= Math.exp(-2 * dt);
      } else {
        // aggro: strafe orbit around anchor, face player
        e.orbitA += dt * 0.85;
        _t.copy(e.anchor);
        _t.x += Math.cos(e.orbitA) * 6.5;
        _t.z += Math.sin(e.orbitA) * 6.5;
        _t.y += bobY + Math.sin(t * 2.2 + e.bobPhase) * 0.8;
        p.lerp(_t, 1 - Math.exp(-2.4 * dt));
        p.addScaledVector(e.vel, dt);
        e.vel.multiplyScalar(Math.exp(-3 * dt));
        e.group.lookAt(playerPos);

        // firing cycle: cooldown → windup (telegraph) → fire
        if (playerVulnerable) {
          if (e.chargeT > 0) {
            e.chargeT -= dt;
            if (e.chargeT <= 0 && distSq < FIRE_R * FIRE_R) {
              this.fireAt(e, playerPos, playerVel);
            }
          } else {
            e.fireT -= dt;
            if (e.fireT <= 0 && distSq < FIRE_R * FIRE_R) {
              e.fireT = 1.7 + Math.random() * 1.3;
              e.chargeT = 0.5;
            }
          }
        }
      }

      // core color: state base + windup flash + hit flash
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      let base = e.state === "idle" ? COL_IDLE : COL_AGGRO;
      if (e.chargeT > 0) {
        base = Math.sin(t * 40) > 0 ? COL_WINDUP : COL_AGGRO;
      }
      e.core.material.color.copy(base);
      if (e.hitFlash > 0) e.core.material.color.lerp(COL_WINDUP, Math.min(1, e.hitFlash * 9));
      const coreScale = 1 + (e.chargeT > 0 ? (0.5 - e.chargeT) * 0.9 : 0) + e.hitFlash * 2;
      e.core.scale.setScalar(coreScale);
      e.body.rotation.y += dt * (e.state === "aggro" ? 3.2 : 0.8);
    }

    // enemy bolts → player
    this.bolts.update(dt, (b: Bolt) => {
      if (!playerVulnerable) {
        return false;
      }
      const dSq = b.pos.distanceToSquared(playerPos);
      if (dSq < 1.55 * 1.55) {
        onPlayerHit();
        return true;
      }
      if (!b.whooshed && dSq < 6.5 * 6.5) {
        b.whooshed = true;
        this.audio.whoosh();
      }
      return false;
    });
  }

  private fireAt(e: Enemy, playerPos: THREE.Vector3, playerVel: THREE.Vector3) {
    const p = e.group.position;
    const dist = p.distanceTo(playerPos);
    // lead the shot, then add a little inaccuracy
    _t.copy(playerPos).addScaledVector(playerVel, (dist / BOLT_SPEED) * 0.8);
    _v.copy(_t).sub(p).normalize();
    _v.x += (Math.random() - 0.5) * 0.05;
    _v.y += (Math.random() - 0.5) * 0.05;
    _v.z += (Math.random() - 0.5) * 0.05;
    _v.normalize();
    const muzzle = _t.copy(p).addScaledVector(_v, 1.2);
    this.bolts.spawn(muzzle, _v.clone().multiplyScalar(BOLT_SPEED), COL_BOLT, "enemy", 2.4);
    this.bursts.spawn(muzzle, COL_BOLT, 5, 3, 0.4);
    this.audio.enemyShoot();
  }
}
