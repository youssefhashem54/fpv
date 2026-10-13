import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildWorld, FOG_COLOR } from "./world";
import { GateSystem } from "./gates";
import { BurstPool, WindLines } from "./particles";
import { Drone, TUNE } from "./physics";
import { AudioEngine } from "./audio";
import { EnemyManager } from "./enemies";
import { BoltPool, type Bolt } from "./projectiles";
import { GATES, PYLONS, ROCKS, SPAWN, SPAWN_YAW, TOTAL_GATES, formatTime, mapProject } from "./track";

export type Phase = "menu" | "countdown" | "racing" | "paused" | "finished";

export interface RaceResult {
  timeMs: number;
  best: boolean;
  bestMs: number;
  topSpeed: number;
  avgSpeed: number;
}

export interface GameEvents {
  onPhase: (p: Phase) => void;
  onCountdown: (n: number) => void;
  onGatePassed: (cleared: number, total: number) => void;
  onGateMissed: () => void;
  onCrash: () => void;
  onKill: (kills: number, bonusSec: number) => void;
  onFinish: (r: RaceResult) => void;
}

export interface HudRefs {
  root?: HTMLElement | null;
  speed?: HTMLElement | null;
  alt?: HTMLElement | null;
  time?: HTMLElement | null;
  gates?: HTMLElement | null;
  dist?: HTMLElement | null;
  throttleFill?: HTMLElement | null;
  weaponFill?: HTMLElement | null;
  kills?: HTMLElement | null;
  hitmark?: HTMLElement | null;
  marker?: HTMLElement | null;
  markerArrow?: HTMLElement | null;
  mapDot?: SVGGElement | null;
  mapGate?: SVGCircleElement | null;
}

export interface Settings {
  sensitivity: number;
  invertY: boolean;
  bloom: boolean;
  muted: boolean;
}

const BEST_KEY = "neonline-best-ms";
/** throttle that roughly cancels gravity — the mobile left-stick neutral point */
const HOVER_THROTTLE = 0.46;

export class FlightEngine {
  private canvas: HTMLCanvasElement;
  private hud: HudRefs;
  private events: GameEvents;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private world: { update: (t: number) => void };
  private bursts: BurstPool;
  private gates: GateSystem;
  private wind: WindLines;
  private drone = new Drone();
  private audio = new AudioEngine();
  private enemies!: EnemyManager;
  private playerBolts!: BoltPool;

  // weapon state
  private firing = false;
  private fireCd = 0;
  private emptyT = 0;
  private energy = 1;
  private kills = 0;
  private hitmarkT = -10;
  private hitmarkKind: "hit" | "kill" = "hit";

  private rocks: { mesh: THREE.Mesh; edges: THREE.LineSegments; def: (typeof ROCKS)[number] }[] = [];

  phase: Phase = "menu";
  private stateBeforePause: Phase = "racing";
  private countdownT = 0;
  private lastCount = -1;
  private raceMs = 0;
  private topSpeed = 0;
  private crashT = 0;
  private invulnT = 0;
  private timeScale = 1;
  private running = true;
  private raf = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private touchMode = false;

  private settings: Settings = { sensitivity: 1, invertY: false, bloom: true, muted: false };

  // input state
  private keys = new Set<string>();
  private mdx = 0;
  private mdy = 0;
  private stickX = 0;
  private stickY = 0;
  private throttleTarget = 0.34;
  /** Virtual controller axes (mobile). Left stick = throttle/yaw, right stick = pitch/roll. */
  touch = { stickX: 0, stickY: 0, yaw: 0, throttleAxis: 0, firing: false };

  private shakeAmp = 0;
  private camTilt = new THREE.Quaternion();
  private _v = new THREE.Vector3();
  private _e = new THREE.Euler(0, 0, 0, "YXZ");
  private attractAngle = 0;
  private lastMapGate = -2;
  private camFrom = new THREE.Vector3();
  private camFromQ = new THREE.Quaternion();
  private camBlend = 1;

  constructor(canvas: HTMLCanvasElement, hud: HudRefs, events: GameEvents, touchMode: boolean) {
    this.canvas = canvas;
    this.hud = hud;
    this.events = events;
    this.touchMode = touchMode;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0042);
    this.camera = new THREE.PerspectiveCamera(78, 1, 0.05, 2600);
    this.scene.add(this.camera);
    this.camTilt.setFromEuler(new THREE.Euler(0.33, 0, 0));

    this.world = buildWorld(this.scene);
    this.bursts = new BurstPool(this.scene);
    this.gates = new GateSystem(this.scene, this.bursts, this.audio);
    this.wind = new WindLines(this.camera);
    this.enemies = new EnemyManager(this.scene, this.bursts, this.audio);
    this.playerBolts = new BoltPool(this.scene, 48);

    // floating rocks
    const rockGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x120b28, roughness: 0.6, metalness: 0.4, flatShading: true });
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.9, 0.5, 2.2),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const def of ROCKS) {
      const mesh = new THREE.Mesh(rockGeo, rockMat);
      mesh.scale.set(def.r, def.r * def.squish, def.r);
      mesh.position.copy(def.base);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(rockGeo, 12), edgeMat);
      edges.scale.copy(mesh.scale);
      edges.position.copy(mesh.position);
      this.scene.add(mesh, edges);
      this.rocks.push({ mesh, edges, def });
    }

    this.drone.reset(SPAWN, SPAWN_YAW);
    this.resetRunVisuals();
    this.attachInput();
    this.setupComposer();
    this.onResize();
    window.addEventListener("resize", this.onResize);
    this.clock.start();
    this.loop();
  }

  /* ----------------------------- setup ----------------------------- */

  private setupComposer() {
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.9, 0.65, 0.72);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  setSettings(s: Settings) {
    this.settings = s;
    this.audio.setMuted(s.muted);
    if (this.bloomPass) this.bloomPass.enabled = s.bloom;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, s.bloom ? 1.5 : 2));
    this.onResize();
  }

  /** Switch control scheme: true = touch/virtual controller, false = mouse + keyboard. */
  setTouchMode(m: boolean) {
    if (this.touchMode === m) return;
    this.touchMode = m;
    this.touch.stickX = 0;
    this.touch.stickY = 0;
    this.touch.yaw = 0;
    this.touch.throttleAxis = 0;
    this.touch.firing = false;
    this.firing = false;
    this.stickX = 0;
    this.stickY = 0;
    if (m && document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  get isTouchMode() {
    return this.touchMode;
  }

  /* ----------------------------- input ----------------------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const c = e.code;
    this.keys.add(c);
    if (c === "KeyR" && (this.phase === "racing" || this.phase === "paused")) this.start();
    if (c === "KeyP" && this.phase !== "menu") this.togglePause();
    if (c === "Space") e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onDocClick = () => {
    if (!this.touchMode && this.phase === "racing" && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 2 && (this.touchMode || document.pointerLockElement === this.canvas)) {
      this.firing = true;
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) this.firing = false;
  };
  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };
  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.mdx += e.movementX;
    this.mdy += e.movementY;
  };
  private onPointerLock = () => {
    if (document.pointerLockElement !== this.canvas) {
      if (this.phase === "racing" || this.phase === "countdown") this.pause();
    } else if (this.phase === "paused") {
      this.resumeInternal();
    }
  };
  private onVis = () => {
    if (document.hidden && (this.phase === "racing" || this.phase === "countdown")) this.pause();
  };
  private onResize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  };

  private attachInput() {
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLock);
    document.addEventListener("visibilitychange", this.onVis);
    document.addEventListener("click", this.onDocClick);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("contextmenu", this.onContextMenu);
  }

  /* --------------------------- flow control ------------------------ */

  start() {
    this.audio.start();
    this.audio.ui();
    if (this.phase === "menu" || this.phase === "finished") {
      this.camFrom.copy(this.camera.position);
      this.camFromQ.copy(this.camera.quaternion);
      this.camBlend = 0;
    } else {
      this.camBlend = 1;
    }
    this.resetRunVisuals();
    this.drone.reset(SPAWN, SPAWN_YAW);
    this.throttleTarget = 0.45;
    this.stickX = 0;
    this.stickY = 0;
    this.touch.stickX = 0;
    this.touch.stickY = 0;
    this.touch.yaw = 0;
    this.touch.throttleAxis = 0;
    this.enemies.reset();
    this.playerBolts.clearAll();
    this.firing = false;
    this.touch.firing = false;
    this.fireCd = 0;
    this.energy = 1;
    this.kills = 0;
    this.hitmarkT = -10;
    this.raceMs = 0;
    this.topSpeed = 0;
    this.invulnT = 0;
    this.timeScale = 1;
    this.countdownT = 3.2;
    this.lastCount = -1;
    this.setPhase("countdown");
    if (!this.touchMode) {
      this.canvas.requestPointerLock?.();
    }
  }

  private resetRunVisuals() {
    this.gates.reset();
    this.lastMapGate = -2;
  }

  pause() {
    if (this.phase !== "racing" && this.phase !== "countdown") return;
    this.stateBeforePause = this.phase;
    this.audio.setFlight(0, 0, false);
    this.setPhase("paused");
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  resume() {
    if (this.phase !== "paused") return;
    if (!this.touchMode) {
      this.canvas.requestPointerLock?.();
      // resumeInternal happens on pointerlockchange
      setTimeout(() => {
        if (this.phase === "paused" && document.pointerLockElement !== this.canvas) this.resumeInternal();
      }, 350);
    } else {
      this.resumeInternal();
    }
  }

  private resumeInternal() {
    if (this.phase !== "paused") return;
    this.setPhase(this.stateBeforePause);
  }

  togglePause() {
    if (this.phase === "paused") this.resume();
    else this.pause();
  }

  exitToMenu() {
    this.setPhase("menu");
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.events.onPhase(p);
  }

  getBest(): number | null {
    try {
      const v = localStorage.getItem(BEST_KEY);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  }

  /* ------------------------------ loop ----------------------------- */

  private loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);

    if (this.phase !== "paused") {
      this.elapsed += rawDt;
      this.update(rawDt);
    }
    if (this.settings.bloom && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  private update(rawDt: number) {
    const t = this.elapsed;
    // timescale easing
    const tsTarget =
      this.phase === "menu" ? 1 : this.phase === "finished" ? 0.5 : this.crashT > 0 ? 0.3 : 1;
    this.timeScale += (tsTarget - this.timeScale) * (1 - Math.exp(-3 * rawDt));
    const dt = rawDt * this.timeScale;

    // virtual stick integration
    const sens = 0.0026 * this.settings.sensitivity;
    this.stickX = THREE.MathUtils.clamp(this.stickX + this.mdx * sens, -1, 1);
    this.stickY = THREE.MathUtils.clamp(
      this.stickY + (this.settings.invertY ? -this.mdy : this.mdy) * sens,
      -1,
      1
    );
    this.mdx = 0;
    this.mdy = 0;
    const decay = Math.exp(-0.8 * rawDt);
    this.stickX *= decay;
    this.stickY *= decay;

    const k = this.keys;
    const keyStickX = (k.has("ArrowRight") ? 1 : 0) - (k.has("ArrowLeft") ? 1 : 0);
    const keyStickY = (k.has("ArrowDown") ? 1 : 0) - (k.has("ArrowUp") ? 1 : 0);
    const sx = THREE.MathUtils.clamp(this.stickX + keyStickX * 0.9 + this.touch.stickX, -1, 1);
    const sy = THREE.MathUtils.clamp(this.stickY + keyStickY * 0.9 + this.touch.stickY, -1, 1);
    const yawKey = THREE.MathUtils.clamp(
      (k.has("KeyA") ? 1 : 0) - (k.has("KeyD") ? 1 : 0) - this.touch.yaw,
      -1,
      1
    );

    if (this.touchMode) {
      // left stick vertical: centered = hover, up = climb, down = descend
      this.throttleTarget = THREE.MathUtils.clamp(HOVER_THROTTLE + this.touch.throttleAxis * 0.54, 0, 1);
    } else {
      if (k.has("KeyW")) this.throttleTarget = Math.min(1, this.throttleTarget + TUNE.throttleRate * rawDt);
      if (k.has("KeyS")) this.throttleTarget = Math.max(0, this.throttleTarget - TUNE.throttleRate * 1.4 * rawDt);
    }

    const racingLike = this.phase === "racing";
    const crashed = this.phase === "racing" && this.crashT > 0;

    /* ----------------------------- countdown ---------------------------- */
    if (this.phase === "countdown") {
      this.countdownT -= rawDt;
      const n = Math.ceil(this.countdownT);
      if (n !== this.lastCount && n > 0 && n <= 3) {
        this.lastCount = n;
        this.events.onCountdown(n);
        this.audio.countBeep(false);
      }
      if (this.countdownT <= 0) {
        this.audio.countBeep(true);
        this.events.onCountdown(0);
        this.setPhase("racing");
      }
    }

    /* ------------------------------ physics ----------------------------- */
    const flying = racingLike && !crashed;
    if (flying) {
      this.drone.step({
        stickX: sx,
        stickY: sy,
        yawKey,
        throttle: this.throttleTarget,
        punch: k.has("Space"),
        brake: k.has("ShiftLeft") || k.has("ShiftRight"),
        dt,
      });
      this.raceMs += rawDt * 1000;
      this.topSpeed = Math.max(this.topSpeed, this.drone.speed);
      this.invulnT = Math.max(0, this.invulnT - rawDt);
    } else if (crashed) {
      this.raceMs += rawDt * 1000;
      this.drone.tumble(dt);
      this.crashT -= rawDt;
      if (this.crashT <= 0) this.respawn();
    } else if (this.phase === "finished") {
      // gentle auto-hover
      this.drone.step({ stickX: 0, stickY: 0, yawKey: 0, throttle: 0.42, punch: false, brake: false, dt });
    }

    /* ---------------------------- gate logic ---------------------------- */
    if (racingLike && !crashed) {
      const res = this.gates.check(this.drone.prevPos, this.drone.pos);
      if (res === "pass") {
        const { final } = this.gates.onPassed();
        if (!final) {
          this.events.onGatePassed(this.gates.activeIdx, TOTAL_GATES);
        } else {
          this.finishRace();
        }
      } else if (res === "miss") {
        this.gates.onMissed();
        this.events.onGateMissed();
      }
    }

    /* ------------------------------ weapon ------------------------------ */
    this.fireCd -= dt;
    this.emptyT -= dt;
    const wantFire = this.firing || k.has("KeyF") || this.touch.firing;
    if (flying && wantFire) {
      if (this.energy >= 0.07 && this.fireCd <= 0) {
        this.fireBolt();
      } else if (this.energy < 0.07 && this.fireCd <= 0) {
        if (this.emptyT <= 0) {
          this.audio.dry();
          this.emptyT = 0.35;
        }
        this.fireCd = 0.12;
      }
    }
    this.energy = Math.min(1, this.energy + (wantFire ? 0.1 : 0.42) * dt);

    // player bolts → sentries
    this.playerBolts.update(dt, (b: Bolt) => {
      const hit = this.enemies.damageAt(b.pos, 1.1, _dirCopy.copy(b.vel).normalize());
      if (hit) {
        this.hitmarkT = this.elapsed;
        this.hitmarkKind = hit.result;
        if (hit.result === "kill") {
          this.kills += 1;
          this.raceMs = Math.max(0, this.raceMs - 2000);
          this.events.onKill(this.kills, 2);
        }
        return true;
      }
      return false;
    });

    // sentries (patrol / aggro / fire) — always animated
    this.enemies.update(dt, t, {
      playerPos: this.drone.pos,
      playerVel: this.drone.vel,
      playerVulnerable: racingLike && !crashed && this.invulnT <= 0,
      playerEngaged: racingLike,
      onPlayerHit: () => {
        this.bursts.spawn(this.drone.pos, new THREE.Color(2.6, 1.2, 0.4), 40, 8, 1.2);
        this.crash();
      },
    });

    /* ---------------------------- collisions ---------------------------- */
    if (racingLike && !crashed && this.invulnT <= 0) {
      this.checkCollisions();
    }

    /* ------------------------------ visuals ----------------------------- */
    this.world.update(t);
    this.gates.update(t, dt, this.phase === "racing");
    this.bursts.update(dt);
    for (const r of this.rocks) {
      r.mesh.position.y = r.def.base.y + Math.sin(t * 0.5 + r.def.phase) * 1.3;
      r.mesh.rotation.y += dt * r.def.spin;
      r.edges.position.copy(r.mesh.position);
      r.edges.rotation.copy(r.mesh.rotation);
    }
    const speedNorm = THREE.MathUtils.clamp(this.drone.speed / 32, 0, 1);
    this.wind.update(dt, this.phase === "menu" ? 6 : this.drone.speed);
    this.audio.setFlight(this.drone.throttle, speedNorm, this.phase !== "menu" && this.phase !== "finished");

    if (this.phase === "menu") this.attractCam(rawDt, t);
    else this.fpvCam(rawDt, speedNorm);

    this.writeHud(speedNorm);
  }

  /* ----------------------------- camera ------------------------------ */

  private attractCam(dt: number, t: number) {
    this.attractAngle += dt * 0.055;
    const cx = -12 + Math.cos(this.attractAngle) * 105;
    const cz = -14 + Math.sin(this.attractAngle) * 105;
    const cy = 26 + Math.sin(t * 0.14) * 7;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(-12, 9, -14);
    this.camera.fov += (62 - this.camera.fov) * 0.03;
    this.camera.updateProjectionMatrix();
  }

  private fpvCam(dt: number, speedNorm: number) {
    const d = this.drone;
    this.camera.position.copy(d.pos);
    this.camera.position.addScaledVector(d.up, 0.1);
    this.camBlend = Math.min(1, this.camBlend + dt / 1.1);
    // shake
    this.shakeAmp +=
      ((0.12 + d.throttle * 0.5 + speedNorm * 0.5) * (this.crashT > 0 ? 5 : 1) - this.shakeAmp) *
      (1 - Math.exp(-4 * dt));
    const t = this.elapsed * 31;
    this._e.set(
      Math.sin(t * 0.9) * 0.0022 * this.shakeAmp,
      Math.sin(t * 1.17 + 2) * 0.0022 * this.shakeAmp,
      Math.sin(t * 0.73 + 4) * 0.003 * this.shakeAmp
    );
    const qShake = _qShake.setFromEuler(this._e);
    this.camera.quaternion.copy(d.quat).multiply(this.camTilt).multiply(qShake);
    if (this.camBlend < 1) {
      const e = this.camBlend * this.camBlend * (3 - 2 * this.camBlend);
      this.camera.position.lerpVectors(this.camFrom, this.camera.position, e);
      this.camera.quaternion.slerpQuaternions(this.camFromQ, this.camera.quaternion, e);
    }
    const targetFov = 74 + speedNorm * 26 + (this.keys.has("Space") ? 5 : 0);
    const nf = this.camera.fov + (targetFov - this.camera.fov) * (1 - Math.exp(-5 * dt));
    if (Math.abs(nf - this.camera.fov) > 0.01) {
      this.camera.fov = nf;
      this.camera.updateProjectionMatrix();
    }
  }

  /* ----------------------------- weapon ------------------------------ */

  private fireBolt() {
    const dir = this.camera.getWorldDirection(_dirCopy);
    const pos = this._v.copy(this.drone.pos).addScaledVector(dir, 1.0).addScaledVector(this.drone.up, -0.22);
    const vel = _velCopy.copy(dir).multiplyScalar(145).addScaledVector(this.drone.vel, 0.35);
    this.playerBolts.spawn(pos, vel, _boltColor, "player", 1.15);
    this.fireCd = 0.125;
    this.energy -= 0.07;
    this.shakeAmp += 0.55;
    this.audio.shoot();
  }

  /* --------------------------- collisions ---------------------------- */

  private checkCollisions() {
    const p = this.drone.pos;
    if (p.y < 0.75) return this.crash();
    if (this.enemies.playerCollide(p, 0.85)) return this.crash();
    for (const pl of PYLONS) {
      const dx = p.x - pl.x;
      const dz = p.z - pl.z;
      if (dx * dx + dz * dz < (pl.r + 0.5) * (pl.r + 0.5) && p.y < pl.h + 0.3) return this.crash();
    }
    for (const r of this.rocks) {
      if (p.distanceToSquared(r.mesh.position) < (r.def.r + 0.55) * (r.def.r + 0.55)) return this.crash();
    }
  }

  private crash() {
    if (this.crashT > 0) return;
    this.crashT = 1.35;
    this.audio.crash();
    this.events.onCrash();
    this.bursts.spawn(this.drone.pos, new THREE.Color(2.6, 0.6, 0.4), 70, 11, 1.5);
  }

  private respawn() {
    const idx = THREE.MathUtils.clamp(this.gates.activeIdx, 0, TOTAL_GATES - 1);
    const g = GATES[idx];
    this._v.copy(g.pos).addScaledVector(g.normal, -10);
    this._v.y = Math.max(this._v.y + 1, 4);
    const yaw = Math.atan2(-g.normal.x, -g.normal.z);
    this.drone.reset(this._v, yaw);
    this.drone.vel.addScaledVector(g.normal, 3);
    this.throttleTarget = 0.4;
    this.stickX = 0;
    this.stickY = 0;
    this.invulnT = 1.0;
    this.crashT = 0;
  }

  private finishRace() {
    const timeMs = this.raceMs;
    let best = true;
    try {
      const prev = localStorage.getItem(BEST_KEY);
      if (prev && Number(prev) <= timeMs) best = false;
      if (best) localStorage.setItem(BEST_KEY, String(Math.round(timeMs)));
    } catch {
      /* ignore */
    }
    const bestMs = this.getBest() ?? timeMs;
    this.audio.finish();
    this.setPhase("finished");
    this.events.onFinish({
      timeMs,
      best,
      bestMs,
      topSpeed: this.topSpeed * 3.6,
      avgSpeed: (this.drone.distFlown / Math.max(0.001, timeMs / 1000)) * 3.6,
    });
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /* ------------------------------ HUD -------------------------------- */

  private writeHud(speedNorm: number) {
    const h = this.hud;
    if (h.root) {
      h.root.style.setProperty("--speed", speedNorm.toFixed(3));
    }
    if (h.speed) h.speed.textContent = String(Math.round(this.drone.speed * 3.6));
    if (h.alt) h.alt.textContent = String(Math.max(0, Math.round(this.drone.pos.y - 0.8)));
    if (h.time) h.time.textContent = formatTime(this.raceMs);
    if (h.gates) {
      const cleared = this.phase === "finished" ? TOTAL_GATES : this.gates.activeIdx;
      h.gates.textContent = `${String(Math.min(cleared, TOTAL_GATES)).padStart(2, "0")}/${TOTAL_GATES}`;
    }
    if (h.throttleFill) {
      const th = Math.round(this.drone.throttle * 100);
      h.throttleFill.style.height = `${th}%`;
      h.throttleFill.dataset.hot = th > 82 ? "true" : "false";
    }
    if (h.weaponFill) {
      h.weaponFill.style.height = `${Math.round(this.energy * 100)}%`;
      h.weaponFill.dataset.hot = this.energy > 0.35 ? "true" : "false";
    }
    if (h.kills) h.kills.textContent = String(this.kills).padStart(2, "0");
    if (h.hitmark) {
      const age = (this.elapsed - this.hitmarkT) / (this.hitmarkKind === "kill" ? 0.5 : 0.28);
      const o = Math.max(0, 1 - age);
      h.hitmark.style.opacity = o.toFixed(3);
      h.hitmark.style.transform = `translate(-50%, -50%) scale(${(1.35 - o * 0.45).toFixed(3)})`;
      h.hitmark.dataset.kind = this.hitmarkKind;
    }
    const next = this.gates.nextPos();
    if (h.dist) {
      h.dist.textContent = next ? `${Math.round(this.drone.pos.distanceTo(next))}m` : "—";
    }
    // gate marker
    if (h.marker && next) {
      const w = this.canvas.clientWidth;
      const hh = this.canvas.clientHeight;
      this._v.copy(next).project(this.camera);
      let x = this._v.x;
      let y = this._v.y;
      const behind = this._v.z > 1;
      if (behind) {
        x = -x;
        y = -y;
      }
      let px = (x * 0.5 + 0.5) * w;
      let py = (-y * 0.5 + 0.5) * hh;
      const margin = 54;
      const off = behind || px < margin || px > w - margin || py < margin || py > hh - margin;
      if (off) {
        px = THREE.MathUtils.clamp(px, margin, w - margin);
        py = THREE.MathUtils.clamp(py, margin, hh - margin);
      }
      h.marker.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%)`;
      h.marker.dataset.state = off ? "off" : "on";
      if (h.markerArrow) {
        const ang = Math.atan2(py - hh / 2, px - w / 2);
        h.markerArrow.style.transform = `rotate(${(ang + Math.PI / 2).toFixed(3)}rad)`;
      }
    } else if (h.marker) {
      h.marker.dataset.state = "hidden";
    }
    // minimap
    if (h.mapDot) {
      const [mx, my] = mapProject(this.drone.pos.x, this.drone.pos.z);
      h.mapDot.setAttribute("transform", `translate(${mx.toFixed(1)} ${my.toFixed(1)})`);
    }
    if (h.mapGate && this.gates.activeIdx !== this.lastMapGate) {
      this.lastMapGate = this.gates.activeIdx;
      const g = GATES[THREE.MathUtils.clamp(this.gates.activeIdx, 0, TOTAL_GATES - 1)];
      if (g) {
        const [gx, gy] = mapProject(g.pos.x, g.pos.z);
        h.mapGate.setAttribute("cx", gx.toFixed(1));
        h.mapGate.setAttribute("cy", gy.toFixed(1));
      }
    }
  }

  /* ----------------------------- dispose ----------------------------- */

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    document.removeEventListener("visibilitychange", this.onVis);
    document.removeEventListener("click", this.onDocClick);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("resize", this.onResize);
    this.composer?.dispose();
    this.renderer.dispose();
  }
}

const _qShake = new THREE.Quaternion();
const _dirCopy = new THREE.Vector3();
const _velCopy = new THREE.Vector3();
const _boltColor = new THREE.Color(0.6, 3.0, 2.6);
