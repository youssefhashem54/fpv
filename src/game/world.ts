import * as THREE from "three";
import { PYLONS, SPAWN } from "./track";

/* ------------------------------------------------------------------ */
/*  Environment: sky dome, striped sun, grid ground, stars, ridges,   */
/*  pylon field, lights. Returns an update fn for animated uniforms.  */
/* ------------------------------------------------------------------ */

export const SUN_DIR = new THREE.Vector3(0.18, 0.16, -1).normalize();
export const FOG_COLOR = new THREE.Color(0x0a0416);

function makeSunTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  grad.addColorStop(0, "rgba(255,247,214,1)");
  grad.addColorStop(0.25, "rgba(255,209,102,1)");
  grad.addColorStop(0.55, "rgba(255,94,120,0.95)");
  grad.addColorStop(0.8, "rgba(255,43,150,0.55)");
  grad.addColorStop(1, "rgba(255,43,150,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // synthwave stripes cut out of lower half
  g.globalCompositeOperation = "destination-out";
  let y = S * 0.52;
  let h = 3;
  while (y < S) {
    g.fillRect(0, y, S, h);
    y += h + Math.max(10, 26 - (y - S * 0.5) * 0.12);
    h += 2.2;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene: THREE.Scene): { update: (t: number) => void } {
  /* ------------------------------ sky ------------------------------ */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uSun;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 top = vec3(0.012, 0.008, 0.045);
        vec3 mid = vec3(0.075, 0.02, 0.16);
        vec3 hor = vec3(0.45, 0.06, 0.34);
        vec3 col = mix(mid, top, smoothstep(0.04, 0.65, h));
        col = mix(hor, col, smoothstep(-0.015, 0.22, h));
        float sunAmt = pow(max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0), 7.0)
                     * exp(-abs(h - 0.045) * 9.0);
        col += vec3(1.15, 0.38, 0.22) * sunAmt * 0.85;
        col += vec3(0.35, 0.05, 0.4) * exp(-abs(h - 0.01) * 14.0) * 0.5;
        if (h < 0.0) col = mix(col, vec3(0.01, 0.005, 0.03), smoothstep(0.0, -0.25, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(980, 32, 18), skyMat);
  sky.renderOrder = -100;
  scene.add(sky);

  /* ------------------------------ sun ------------------------------ */
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshBasicMaterial({
      map: makeSunTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    })
  );
  sun.position.copy(SUN_DIR).multiplyScalar(860);
  sun.position.y = 130;
  sun.lookAt(0, 40, 0);
  sun.renderOrder = -99;
  scene.add(sun);

  /* ----------------------------- stars ----------------------------- */
  {
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const y = 0.06 + Math.random() * 0.94;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      pos[i * 3] = Math.cos(theta) * r * 920;
      pos[i * 3 + 1] = y * 920;
      pos[i * 3 + 2] = Math.sin(theta) * r * 920;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xbfd4ff,
        size: 1.7,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        fog: false,
      })
    );
    scene.add(stars);
  }

  /* -------------------------- grid ground -------------------------- */
  const gridMat = new THREE.ShaderMaterial({
    fog: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vDist;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vDist;
      uniform float uTime;
      float gridLine(vec2 p, float spacing, float widthMul) {
        vec2 gp = p / spacing;
        vec2 w = fwidth(gp) * widthMul + 1e-5;
        vec2 g = abs(fract(gp - 0.5) - 0.5) / w;
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        vec2 p = vWorld.xz;
        float minor = gridLine(p, 4.0, 1.4);
        float major = gridLine(p, 20.0, 1.6);
        float fade = exp(-vDist * 0.0085);
        float pulse = 0.82 + 0.18 * sin(uTime * 1.7 + (p.x - p.y) * 0.012);
        vec3 col = vec3(0.05, 0.75, 1.05) * minor * 0.34;
        col += vec3(1.1, 0.14, 0.85) * major * 0.62 * pulse;
        // spawn glow
        float d0 = distance(p, vec2(${SPAWN.x.toFixed(1)}, ${SPAWN.z.toFixed(1)}));
        col += vec3(0.1, 0.5, 0.7) * exp(-d0 * 0.05) * 0.8;
        col *= fade;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1), gridMat);
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = -50;
  scene.add(ground);

  /* --------------------------- mountains --------------------------- */
  {
    const ridge = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0620, roughness: 1, metalness: 0, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.22;
      const dist = 470 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 220;
      const h = 50 + (Math.sin(i * 41.7) * 0.5 + 0.5) * 130;
      const r = 55 + (Math.sin(i * 9.3) * 0.5 + 0.5) * 95;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mat);
      cone.position.set(Math.cos(a) * dist, h * 0.32, Math.sin(a) * dist - 20);
      cone.rotation.y = i * 1.7;
      ridge.add(cone);
    }
    scene.add(ridge);
  }

  /* ---------------------------- pylons ----------------------------- */
  {
    const palette = [new THREE.Color(1.4, 2.4, 2.8), new THREE.Color(2.8, 1.2, 2.5), new THREE.Color(2.2, 1.5, 3.0)];
    const body = new THREE.MeshStandardMaterial({
      color: 0x0d0820,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0x150a2e,
      flatShading: true,
    });
    for (const p of PYLONS) {
      const geo = new THREE.ConeGeometry(p.r, p.h, 5);
      const mesh = new THREE.Mesh(geo, body);
      mesh.position.set(p.x, p.h / 2 - 0.4, p.z);
      mesh.rotation.z = p.tilt;
      scene.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 22),
        new THREE.LineBasicMaterial({
          color: palette[p.hue % 3],
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      scene.add(edges);
    }
  }

  /* ----------------------------- lights ---------------------------- */
  scene.add(new THREE.HemisphereLight(0x4a2380, 0x0a0620, 0.75));
  const dir = new THREE.DirectionalLight(0xff8a50, 1.1);
  dir.position.copy(SUN_DIR).multiplyScalar(400);
  dir.position.y = 180;
  scene.add(dir);

  return {
    update: (t: number) => {
      gridMat.uniforms.uTime.value = t;
    },
  };
}
