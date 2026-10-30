// Every model in the game, built from primitives in a cel-shaded "Inkwood Night" style.
// No DOM access, so scripts/export-models.mjs can run these in Node and write .glb files.
//
// Art direction:
// - Golden hour in a storybook valley: saturated greens, warm sand roads, low warm sun.
// - The village side (towers, heart) is warm brass, oiled wood and cool stone.
// - The Gloom (enemies) is violet and magenta ink with sickly yellow-green eyes, and it
//   stains the grass purple around the rift it crawls out of.
// - Only real light sources glow: lantern glass, flames, crystals, eyes. Everything else is toon-shaded.
// - Named groups ('aim', 'recoil', 'core', 'flames', 'wingL', ...) are animated by src/three/view.ts.
import * as THREE from 'three';
import { COLS, ROWS } from '../config';
import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import type { Branch, EnemyType, MapDef, TowerType } from '../types';

export const C = {
  // village
  stone: '#a4a7bb', stoneLight: '#c3c5d4', stoneDark: '#7a7e98',
  wood: '#9a6640', woodDark: '#6a4329', brass: '#e2b257', brassDark: '#a8762f', iron: '#454b63',
  roof: '#4f7fc9', cloth: '#d9483f', domeMetal: '#5a74b8',
  // ground
  grassA: '#62a352', grassB: '#80bd5f', grassEdge: '#4f8d4a', dirt: '#e3c58f', dirtB: '#d2ad73',
  cliff: '#a8734d', cliffDeep: '#6b4632', blight: '#6a4f8a', blightDeep: '#4a3566',
  leafA: '#4a9c58', leafB: '#7bbb5a', leafDark: '#357a4c', bark: '#7a5135', deadwood: '#4e3f57',
  // lights
  lamp: '#ffc35a', gem: '#ffd27a', flame: '#ffb347', flameCore: '#fff1b8', violet: '#9b6bff',
  // the Gloom
  inkCrawler: '#7b4bc4', inkCrawlerBelly: '#a985e6', inkFlitter: '#2c8f8c', wing: '#3fd6c2',
  inkLump: '#93406f', bone: '#e2d4b6', inkVeil: '#5f86e8', inkGiant: '#3d2266', horn: '#2a1838',
  eye: '#f2ff7a', eyeHot: '#ff4a4a', mouth: '#ff4f8b', pupil: '#120a1c',
};

// ---------- materials ----------

const cache = new Map<string, THREE.Material>();
const cached = <M extends THREE.Material>(key: string, make: () => M): M => {
  let m = cache.get(key) as M | undefined;
  if (!m) { m = make(); cache.set(key, m); }
  return m;
};

/** Three hard light steps: the core of the cel-shaded look. */
const TOON_STEPS = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 165, 165, 165, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

/** The default surface: cel-shaded, takes light and shadow. */
export const toon = (color: string) => cached(`t:${color}`, () => new THREE.MeshToonMaterial({ color, gradientMap: TOON_STEPS }));

/** Cel-shaded but faintly self-lit, for ice, gems and magic. */
export const gem = (color: string, emissive = 0.6) => cached(`gem:${color}:${emissive}`, () =>
  new THREE.MeshToonMaterial({ color, gradientMap: TOON_STEPS, emissive: color, emissiveIntensity: emissive }));

/** A light source. Colours above 1 feed the bloom pass; keep intensity modest so only cores bloom. */
export const glow = (color: string, intensity = 1.6, opacity = 1) => cached(`g:${color}:${intensity}:${opacity}`, () =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));

// ---------- geometry helpers ----------

const cyl = (rt: number, rb: number, h: number, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r: number, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);
const halfSph = (r: number, upper = true, ws = 20) =>
  new THREE.SphereGeometry(r, ws, 10, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2);
const cone = (r: number, h: number, seg = 12) => new THREE.ConeGeometry(r, h, seg);
const torus = (R: number, r: number, arc = Math.PI * 2, ts = 24) => new THREE.TorusGeometry(R, r, 8, ts, arc);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  const lightSource = mat instanceof THREE.MeshBasicMaterial;
  m.castShadow = !lightSource && !mat.transparent;
  m.receiveShadow = !lightSource;
  if (lightSource || mat.transparent) m.userData.noOutline = true;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

function group(parent: THREE.Object3D, name = '', x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ---------- towers ----------

/** A brass lantern with a glowing core named 'core', centred on its glass. */
function lantern(parent: THREE.Object3D, color: string, s = 1) {
  const l = group(parent, 'lantern');
  l.scale.setScalar(s);
  mesh(cone(0.11, 0.09, 12), toon(C.brassDark), l, 0, 0.13, 0);
  mesh(torus(0.025, 0.008), toon(C.brass), l, 0, 0.19, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    mesh(cyl(0.009, 0.009, 0.17, 6), toon(C.brass), l, Math.cos(a) * 0.072, 0, Math.sin(a) * 0.072);
  }
  mesh(cyl(0.085, 0.07, 0.03, 12), toon(C.brassDark), l, 0, -0.1, 0);
  mesh(sph(0.055, 12, 10), glow(color, 2.2), l, 0, 0, 0, 'core');
  mesh(cyl(0.068, 0.068, 0.16, 12), glow(color, 0.9, 0.35), l, 0, 0, 0);
  return l;
}

/** Shared foundation: a round plinth ringed with cobbles, with one glowing stud per level facing the camera. */
function foundation(root: THREE.Group, level: number, branch: Branch, color: string) {
  mesh(cyl(0.39, 0.43, 0.1, 24), toon(C.stoneDark), root, 0, 0.05, 0);
  mesh(cyl(0.33, 0.37, 0.1, 24), toon(C.stone), root, 0, 0.15, 0);
  // A few flat, uneven stones tucked against the plinth, so the base reads as built rather than machined.
  const stones: [number, number][] = [[0.3, 0.075], [1.4, 0.06], [2.3, 0.085], [3.5, 0.065], [4.4, 0.08], [5.5, 0.06]];
  for (const [a, s] of stones) {
    const c = mesh(new THREE.DodecahedronGeometry(s, 1), toon(s > 0.07 ? C.stoneLight : C.stone), root,
      Math.cos(a) * 0.4, 0.02, Math.sin(a) * 0.4);
    c.scale.set(1.3, 0.4, 1);
    c.rotation.y = a;
  }
  const studs = group(root, 'studs', 0, 0.16, 0.36);
  for (let i = 0; i < level; i++) {
    mesh(sph(0.026, 10, 8), glow(i >= 3 && branch !== null ? color : C.gem, 1.4), studs, (i - (level - 1) / 2) * 0.075, 0, 0);
  }
}

type TowerBuilder = (root: THREE.Group, level: number, branch: Branch, color: string) => void;

/** Lantern Post: a lamplighter's post with a swinging lantern that spits sparks. */
const sparkTower: TowerBuilder = (root, level, branch, color) => {
  const tall = 0.5 + level * 0.05 + (branch === 1 ? 0.18 : 0);
  mesh(cyl(0.045, 0.065, tall, 10), toon(C.wood), root, 0, 0.2 + tall / 2, 0);
  if (level >= 2) for (const y of [0.34, 0.2 + tall - 0.12]) mesh(torus(0.058, 0.014), toon(C.brass), root, 0, y, 0).rotation.x = Math.PI / 2;
  const top = 0.2 + tall;
  if (level >= 3) mesh(cone(0.12, 0.12, 12), toon(C.roof), root, 0, top + 0.08, 0);
  mesh(sph(0.04, 10, 8), toon(C.brass), root, 0, top + (level >= 3 ? 0.16 : 0.02), 0);

  const aim = group(root, 'aim', 0, top - 0.04, 0);
  const arms = branch === 0 ? [-0.13, 0.13] : [0];
  for (const z of arms) {
    mesh(box(0.42, 0.04, 0.045), toon(C.woodDark), aim, 0.17, 0, z);
    const swing = group(aim, 'swing', 0.33, -0.02, z);
    mesh(torus(0.018, 0.006), toon(C.iron), swing, 0, -0.03, 0);
    mesh(torus(0.018, 0.006), toon(C.iron), swing, 0, -0.065, 0).rotation.y = Math.PI / 2;
    const l = lantern(swing, color, branch === 1 ? 1.15 : 1);
    l.position.y = -0.2;
    if (branch === 1) {
      // Marksman: a brass sighting barrel clamped under the lantern.
      const recoil = group(swing, 'recoil', 0, -0.2, 0);
      mesh(cyl(0.022, 0.03, 0.42, 12), toon(C.brass), recoil, 0.25, 0, 0).rotation.z = Math.PI / 2;
      mesh(torus(0.032, 0.01), toon(C.brassDark), recoil, 0.44, 0, 0).rotation.y = Math.PI / 2;
    }
  }
  if (level >= 4) {
    // Pennant on the post.
    const flag = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.22, -0.05), new THREE.Vector2(0, -0.12)]);
    const f = mesh(new THREE.ShapeGeometry(flag), toon(C.cloth), root, -0.04, top - 0.02, 0, 'flag');
    (f.material as THREE.Material).side = THREE.DoubleSide;
  }
};

/** Rime Spire: a rune obelisk with a floating crystal and orbiting shards. */
const frostTower: TowerBuilder = (root, level, branch, color) => {
  const h = 0.42 + level * 0.05;
  mesh(cyl(0.11, 0.19, h, 8), toon(C.stoneLight), root, 0, 0.2 + h / 2, 0);
  mesh(torus(0.15, 0.018, Math.PI * 2, 8), gem(color, 1.2), root, 0, 0.2 + h * 0.45, 0).rotation.x = Math.PI / 2;
  mesh(cyl(0.16, 0.12, 0.06, 8), toon(C.stoneDark), root, 0, 0.2 + h + 0.03, 0);
  const float = group(root, 'float', 0, 0.2 + h + 0.36, 0);
  const crystal = mesh(new THREE.OctahedronGeometry(0.13 + level * 0.01, 0), gem('#4fc8f5', 0.35), float, 0, 0, 0, 'core');
  crystal.scale.y = 2.1;
  const orbit = group(float, 'orbit');
  const shards = Math.min(8, 2 + level);
  for (let i = 0; i < shards; i++) {
    const a = (i / shards) * Math.PI * 2;
    const s = mesh(new THREE.OctahedronGeometry(0.045, 0), gem('#8fdcff', 0.3), orbit, Math.cos(a) * 0.27, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.27);
    s.scale.y = 1.8;
  }
  if (branch === 0) {
    // Ice Prison: a crown of icicles around the top of the obelisk.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ic = mesh(cone(0.04, 0.3, 6), gem('#bfefff', 0.5), root, Math.cos(a) * 0.19, 0.2 + h + 0.12, Math.sin(a) * 0.19);
      ic.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    }
  }
  if (branch === 1) {
    // Fog Bank: slow puffs of frost drifting around the spire.
    const mist = group(root, 'mist', 0, 0.45, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      mesh(sph(0.12 + (i % 2) * 0.04, 12, 10), glow('#d8f4ff', 0.7, 0.28), mist, Math.cos(a) * 0.36, (i % 2) * 0.08, Math.sin(a) * 0.36);
    }
  }
};

/** Ember Brazier: an iron cauldron on clawed legs with living flames. */
const pulseTower: TowerBuilder = (root, level, branch, color) => {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const leg = group(root, '', Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17);
    leg.rotation.y = -a;
    mesh(capsule(0.03, 0.3), toon(C.iron), leg, 0.04, 0.17, 0).rotation.z = 0.35;
    mesh(cone(0.035, 0.1, 8), toon(C.iron), leg, 0.1, 0.0, 0).rotation.z = -Math.PI / 2;
  }
  const r = 0.27 + level * 0.015;
  mesh(halfSph(r, false), toon(C.iron), root, 0, 0.62, 0);
  mesh(torus(r, 0.03), toon(C.brassDark), root, 0, 0.62, 0).rotation.x = Math.PI / 2;
  for (const z of [-1, 1]) mesh(torus(0.06, 0.014), toon(C.brassDark), root, 0, 0.55, z * (r + 0.02));
  const coals = mesh(new THREE.CircleGeometry(r - 0.02, 24), glow('#ff5a22', 1.3), root, 0, 0.61, 0);
  coals.rotation.x = -Math.PI / 2;
  if (level >= 3) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mesh(cone(0.025, 0.09, 6), toon(C.brass), root, Math.cos(a) * r, 0.66, Math.sin(a) * r);
    }
  }
  const flames = group(root, 'flames', 0, 0.62, 0);
  const s = 1 + level * 0.06 + (branch === 0 ? 0.2 : 0);
  mesh(cone(0.15 * s, 0.5 * s, 12), glow(C.flame, 1.7), flames, 0, 0.25 * s, 0);
  mesh(cone(0.08 * s, 0.32 * s, 10), glow(C.flameCore, 2.2), flames, 0.02, 0.16 * s, 0.01);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const t = mesh(cone(0.07 * s, 0.26 * s, 10), glow(color, 1.6), flames, Math.cos(a) * 0.1, 0.12 * s, Math.sin(a) * 0.1);
    t.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
  }
  const embers = group(root, 'embers', 0, 0.7, 0);
  for (let i = 0; i < 5; i++) mesh(sph(0.018, 6, 4), glow('#ffcf6a', 1.8), embers, 0, 0, 0);
  if (branch === 0) {
    // Heatwave: the cauldron itself cracks with glowing seams.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const seam = mesh(box(0.02, 0.16, 0.012), glow('#ff4a1c', 1.5), root, Math.cos(a) * (r - 0.05), 0.52, Math.sin(a) * (r - 0.05));
      seam.rotation.y = -a;
      seam.rotation.z = 0.4;
    }
  }
  if (branch === 1) {
    // Thunder Pulse: copper coils that crackle.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1;
      const x = Math.cos(a) * (r + 0.08), z = Math.sin(a) * (r + 0.08);
      mesh(cyl(0.018, 0.022, 0.55, 8), toon('#b8743a'), root, x, 0.5, z);
      for (let k = 0; k < 3; k++) mesh(torus(0.04, 0.01), toon('#d98a45'), root, x, 0.55 + k * 0.07, z).rotation.x = Math.PI / 2;
      mesh(sph(0.045, 10, 8), glow('#bfe4ff', 2), root, x, 0.8, z, 'arc');
    }
  }
};

/** Starfall Observatory: a little domed observatory whose telescope lobs falling stars. */
const starTower: TowerBuilder = (root, level, branch, color) => {
  mesh(cyl(0.25, 0.29, 0.42, 20), toon(C.stone), root, 0, 0.41, 0);
  mesh(torus(0.255, 0.02), toon(C.stoneDark), root, 0, 0.62, 0).rotation.x = Math.PI / 2;
  mesh(box(0.08, 0.12, 0.02), glow(C.lamp, 1.2), root, 0, 0.42, 0.28);
  mesh(box(0.11, 0.02, 0.03), toon(C.woodDark), root, 0, 0.35, 0.285);
  const aim = group(root, 'aim', 0, 0.62, 0);
  mesh(halfSph(0.26), toon(C.domeMetal), aim, 0, 0, 0);
  mesh(torus(0.26, 0.022), toon(C.brass), aim, 0, 0.01, 0).rotation.x = Math.PI / 2;
  mesh(box(0.44, 0.06, 0.1), toon('#1d2236'), aim, 0, 0.16, 0).rotation.z = 0.45;
  const pitch = group(aim, 'pitch', 0, 0.12, 0);
  pitch.rotation.z = 0.5;
  const recoil = group(pitch, 'recoil');
  const big = branch === 0 ? 1.3 : 1;
  const len = 0.5 + level * 0.03;
  mesh(cyl(0.055 * big, 0.08 * big, len, 16), toon(C.brass), recoil, len / 2, 0, 0).rotation.z = -Math.PI / 2;
  for (const x of [0.12, len - 0.06]) mesh(torus(0.075 * big, 0.014), toon(C.brassDark), recoil, x, 0, 0).rotation.y = Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.05 * big, 16), glow(color, 1.8), recoil, len + 0.002, 0, 0).rotation.y = Math.PI / 2;
  if (level >= 3) {
    mesh(cyl(0.008, 0.008, 0.25, 6), toon(C.iron), aim, -0.08, 0.36, 0);
    mesh(sph(0.025, 8, 6), glow(color, 1.8), aim, -0.08, 0.49, 0);
  }
  const spin = group(root, 'spin', 0, 1.2, 0);
  mesh(new THREE.OctahedronGeometry(0.08, 0), gem(color, 1), spin);
  mesh(torus(0.15, 0.01, Math.PI * 2, 32), gem(color, 0.8), spin).rotation.x = Math.PI / 2.5;
  if (branch === 1) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      mesh(sph(0.04, 10, 8), gem('#e8dcff', 0.7), spin, Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28);
    }
  }
};

const TOWER_BUILDERS: Record<TowerType, TowerBuilder> = { spark: sparkTower, frost: frostTower, pulse: pulseTower, star: starTower };

export function makeTower(type: TowerType, level = 1, branch: Branch = null): THREE.Group {
  const root = new THREE.Group();
  root.name = `tower-${type}`;
  const color = TOWERS[type].color;
  foundation(root, level, branch, color);
  TOWER_BUILDERS[type](root, level, branch, color);
  const badge = group(root, 'badge', 0, 1.55, 0);
  mesh(new THREE.OctahedronGeometry(0.08, 0), glow(C.lamp, 1.8), badge);
  badge.visible = false;
  return root;
}

// ---------- enemies: the Gloom ----------

/** Cartoon eyes on the +x face: glowing whites with dark pupils. */
function eyes(body: THREE.Object3D, r: number, size: number, spread: number, height: number, color: string = C.eye) {
  for (const side of [1, -1]) {
    const x = Math.sqrt(Math.max(0, r * r - (spread * r) ** 2 - (height * r) ** 2)) * 0.92;
    mesh(sph(size * r, 14, 10), glow(color, 1.5), body, x, height * r, side * spread * r);
    mesh(sph(size * r * 0.48, 10, 8), toon(C.pupil), body, x + size * r * 0.62, height * r - size * r * 0.1, side * spread * r * 0.96);
  }
}

function statusMarkers(root: THREE.Group, r: number) {
  const slow = mesh(torus(r * 1.15, 0.02, Math.PI * 2, 32), glow('#8fd3ff', 1.3, 0.85), root, 0, -r + 0.03, 0, 'slow');
  slow.rotation.x = Math.PI / 2;
  slow.visible = false;
  const burn = group(root, 'burn', 0, r * 1.15, 0);
  mesh(cone(r * 0.26, r * 0.7, 10), glow('#ff7a3c', 1.8), burn);
  mesh(cone(r * 0.13, r * 0.45, 8), glow(C.flameCore, 2), burn, 0, -r * 0.08, 0);
  burn.visible = false;
  const stun = group(root, 'stun', 0, r * 1.35, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mesh(new THREE.OctahedronGeometry(0.035, 0), glow('#fff3a8', 1.8), stun, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8);
  }
  stun.visible = false;
}

type EnemyBuilder = (body: THREE.Group, r: number) => void;

/** Inkling: a round grinning blob on stubby feet. */
const crawler: EnemyBuilder = (body, r) => {
  mesh(sph(r, 22, 16), toon(C.inkCrawler), body, 0, 0, 0, 'skin').scale.set(1.05, 0.9, 1);
  mesh(sph(r * 0.62, 16, 12), toon(C.inkCrawlerBelly), body, r * 0.5, -r * 0.25, 0).scale.set(0.6, 0.8, 1);
  for (const side of [1, -1]) {
    const h = mesh(cone(r * 0.16, r * 0.5, 10), toon(C.horn), body, 0, r * 0.85, side * r * 0.42);
    h.rotation.x = side * 0.5;
  }
  eyes(body, r, 0.3, 0.34, 0.42);
  const grin = mesh(torus(r * 0.3, r * 0.05, Math.PI, 16), glow(C.mouth, 1.2), body, r * 0.88, -r * 0.18, 0);
  grin.rotation.set(0, Math.PI / 2, Math.PI);
  const tail = mesh(cone(r * 0.14, r * 0.55, 8), toon(C.horn), body, -r * 1.05, -r * 0.2, 0);
  tail.rotation.z = Math.PI / 2 + 0.4;
  const feet = group(body, 'feet');
  for (const side of [1, -1]) mesh(sph(r * 0.24, 12, 8), toon(C.horn), feet, r * 0.1, -r * 0.85, side * r * 0.45, side > 0 ? 'footL' : 'footR').scale.set(1.4, 0.6, 1);
};

/** Duskmoth: a small furry body on wide leathery wings. */
const flitter: EnemyBuilder = (body, r) => {
  mesh(sph(r, 18, 14), toon(C.inkFlitter), body, 0, 0, 0, 'skin').scale.set(1.3, 0.85, 0.85);
  for (const side of [1, -1]) {
    const ear = mesh(cone(r * 0.2, r * 0.6, 8), toon(C.inkFlitter), body, r * 0.35, r * 0.75, side * r * 0.32);
    ear.rotation.x = side * 0.35;
  }
  eyes(body, r, 0.3, 0.32, 0.38);
  const tail = mesh(cone(r * 0.1, r * 0.9, 8), toon(C.inkFlitter), body, -r * 1.4, 0, 0);
  tail.rotation.z = Math.PI / 2;
  // Bat wing outline in the pivot's local XY plane, then turned to stick out sideways.
  const wing = new THREE.Shape([
    new THREE.Vector2(0.15, 0), new THREE.Vector2(0.45, 0.9), new THREE.Vector2(0.1, 2.3), new THREE.Vector2(-0.25, 1.7),
    new THREE.Vector2(-0.45, 2.0), new THREE.Vector2(-0.6, 1.2), new THREE.Vector2(-0.85, 1.25), new THREE.Vector2(-0.55, 0),
  ].map((p) => p.multiplyScalar(r)));
  const membrane = cached('wing', () => new THREE.MeshToonMaterial({ color: C.wing, gradientMap: TOON_STEPS, side: THREE.DoubleSide, emissive: C.wing, emissiveIntensity: 0.25 }));
  for (const side of [1, -1]) {
    const pivot = group(body, side > 0 ? 'wingL' : 'wingR', 0, r * 0.2, side * r * 0.45);
    const geo = new THREE.ShapeGeometry(wing);
    geo.rotateX(side * Math.PI / 2);
    mesh(geo, membrane, pivot);
  }
};

/** Brute: a hulking bone-plated lump that knuckle-walks. */
const lump: EnemyBuilder = (body, r) => {
  mesh(sph(r, 22, 16), toon(C.inkLump), body, 0, 0, 0, 'skin').scale.set(1.1, 0.95, 1.05);
  for (let i = 0; i < 3; i++) {
    const p = mesh(sph(r * 0.38, 12, 8), toon(C.bone), body, -r * 0.3 - i * r * 0.22, r * 0.72 - i * r * 0.2, (i - 1) * r * 0.25);
    p.scale.set(1, 0.45, 1.1);
    p.rotation.z = 0.5 + i * 0.25;
  }
  mesh(capsule(r * 0.1, r * 0.6), toon(C.horn), body, r * 0.62, r * 0.66, 0).rotation.x = Math.PI / 2;
  eyes(body, r, 0.16, 0.28, 0.4, '#ffb84a');
  for (const side of [1, -1]) {
    const tusk = mesh(cone(r * 0.08, r * 0.35, 8), toon(C.bone), body, r * 0.92, -r * 0.2, side * r * 0.22);
    tusk.rotation.z = -0.3;
    const arm = group(body, side > 0 ? 'armL' : 'armR', r * 0.15, r * 0.1, side * r * 0.95);
    mesh(capsule(r * 0.17, r * 0.55), toon(C.inkLump), arm, 0, -r * 0.4, 0);
    mesh(sph(r * 0.24, 12, 10), toon(C.horn), arm, 0.03, -r * 0.85, 0);
  }
};

/** Veil: a hooded ghost inside a crackling ward. */
const shimmer: EnemyBuilder = (body, r) => {
  const profile = [[0, r * 1.05], [r * 0.45, r * 0.95], [r * 0.62, r * 0.5], [r * 0.7, 0], [r * 0.85, -r * 0.6], [r * 1.0, -r * 0.95], [r * 0.85, -r * 0.9], [0.0, -r * 0.7]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const cloak = group(body, 'cloak');
  mesh(new THREE.LatheGeometry(profile, 20), toon(C.inkVeil), cloak, 0, 0, 0, 'skin');
  // A glowing trim along the hem and a dark hood opening facing forward and up.
  mesh(torus(r * 0.93, r * 0.05, Math.PI * 2, 28), gem('#8fd8ff', 0.9), cloak, 0, -r * 0.92, 0).rotation.x = Math.PI / 2;
  const hood = mesh(sph(r * 0.4, 16, 12), toon(C.pupil), body, r * 0.36, r * 0.62, 0);
  hood.scale.set(0.55, 0.9, 1);
  hood.rotation.z = -0.5;
  for (const side of [1, -1]) mesh(sph(r * 0.12, 10, 8), glow('#bff4ff', 2), body, r * 0.52, r * 0.72, side * r * 0.15);
  const shield = group(body, 'shield');
  const ward = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r * 1.55, 1)),
    new THREE.LineBasicMaterial({ color: new THREE.Color('#8fd8ff').multiplyScalar(1.3), transparent: true, opacity: 0.55 }));
  shield.add(ward);
  mesh(sph(r * 1.5, 18, 14), glow('#6fb6ff', 0.6, 0.12), shield);
};

/** Gloom Lord: the boss. Crowned, horned, with a burning maw. */
const giant: EnemyBuilder = (body, r) => {
  mesh(sph(r, 26, 18), toon(C.inkGiant), body, 0, 0, 0, 'skin').scale.set(1, 1.05, 1);
  mesh(sph(r * 0.6, 16, 12), toon(C.bone), body, r * 0.55, -r * 0.1, 0).scale.set(0.45, 0.9, 1.1);
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    const spike = mesh(cone(r * 0.11, r * 0.5, 8), toon(C.bone), body, -r * 0.1, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
    spike.rotation.x = a;
  }
  for (const side of [1, -1]) {
    const horn = mesh(torus(r * 0.35, r * 0.07, Math.PI * 0.9, 16), toon(C.horn), body, r * 0.2, r * 0.7, side * r * 0.55);
    horn.rotation.set(side * 0.3, side > 0 ? 0 : Math.PI, 0.6);
    const arm = group(body, side > 0 ? 'armL' : 'armR', 0, r * 0.1, side * r * 0.98);
    mesh(capsule(r * 0.16, r * 0.6), toon(C.inkGiant), arm, 0, -r * 0.42, 0);
    for (let k = 0; k < 3; k++) {
      const claw = mesh(cone(r * 0.05, r * 0.25, 6), toon(C.bone), arm, r * 0.1, -r * 0.9, (k - 1) * r * 0.08);
      claw.rotation.z = -Math.PI / 2 - 0.4;
    }
    mesh(cone(r * 0.12, r * 0.4, 8), toon(C.bone), body, 0, r * 0.55, side * r * 0.85).rotation.x = side * 0.9;
  }
  eyes(body, r, 0.15, 0.3, 0.45, C.eyeHot);
  mesh(box(r * 0.08, r * 0.1, r * 0.55), glow('#ff3b3b', 1.5), body, r * 0.97, -r * 0.2, 0);
  for (let k = 0; k < 4; k++) mesh(cone(r * 0.04, r * 0.12, 6), toon(C.bone), body, r * 1.0, -r * 0.13, (k - 1.5) * r * 0.13).rotation.z = Math.PI;
};

const ENEMY_BUILDERS: Record<EnemyType, EnemyBuilder> = { crawler, flitter, lump, shimmer, giant };

export function makeEnemy(type: EnemyType): THREE.Group {
  const r = ENEMIES[type].r;
  const root = new THREE.Group();
  root.name = `enemy-${type}`;
  const body = group(root, 'body');
  ENEMY_BUILDERS[type](body, r);
  statusMarkers(root, r);
  return root;
}

// ---------- landmarks ----------

/** The Hearthstone: a great lantern on a stepped plinth. Its flame has its own material so lives can dim it. */
export function makeHeart(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'heart';
  mesh(cyl(0.46, 0.5, 0.1, 28), toon(C.stoneDark), root, 0, 0.05, 0);
  mesh(cyl(0.38, 0.42, 0.1, 28), toon(C.stone), root, 0, 0.15, 0);
  mesh(cyl(0.2, 0.26, 0.26, 20), toon(C.stoneLight), root, 0, 0.33, 0);
  const lamp = group(root, 'lamp', 0, 0.78, 0);
  mesh(cyl(0.27, 0.23, 0.05, 20), toon(C.brassDark), lamp, 0, -0.3, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(cyl(0.014, 0.014, 0.56, 6), toon(C.brass), lamp, Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
  }
  mesh(torus(0.23, 0.02), toon(C.brass), lamp, 0, 0.28, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const arch = mesh(torus(0.22, 0.016, Math.PI), toon(C.brassDark), lamp, 0, 0.28, 0);
    arch.rotation.y = (i / 3) * Math.PI;
  }
  mesh(sph(0.045, 12, 10), toon(C.brass), lamp, 0, 0.51, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.flame).multiplyScalar(1.8) });
  const flame = group(lamp, 'flame', 0, -0.25, 0);
  mesh(cone(0.13, 0.42, 14), flameMat, flame, 0, 0.21, 0, 'orb');
  mesh(cone(0.07, 0.26, 12), glow(C.flameCore, 2.2), flame, 0, 0.13, 0);
  mesh(cyl(0.2, 0.2, 0.52, 20), glow(C.lamp, 0.7, 0.2), lamp, 0, 0, 0);
  return root;
}

/** The Gloom Rift: two dead trunks bent into an arch around a violet vortex. */
export function makePortal(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'portal';
  for (const z of [-0.45, 0.45]) {
    mesh(cyl(0.08, 0.13, 0.5, 10), toon(C.deadwood), root, 0, 0.25, z);
    const bend = mesh(cyl(0.06, 0.08, 0.45, 10), toon(C.deadwood), root, 0, 0.65, z * 0.8);
    bend.rotation.x = -Math.sign(z) * 0.45;
    const twig = mesh(cone(0.03, 0.25, 6), toon(C.deadwood), root, 0, 0.7, z * 1.15);
    twig.rotation.x = Math.sign(z) * 0.9;
  }
  mesh(torus(0.32, 0.06, Math.PI, 18), toon(C.deadwood), root, 0, 0.82, 0).rotation.y = Math.PI / 2;
  const swirl = group(root, 'swirl', 0, 0.5, 0);
  swirl.rotation.y = Math.PI / 2;
  [0.3, 0.22, 0.14].forEach((rad, i) => {
    mesh(torus(rad, 0.02, Math.PI * 1.3, 24), glow(C.violet, 1.5 - i * 0.2), swirl).rotation.z = i * 2;
  });
  mesh(new THREE.CircleGeometry(0.34, 24), glow('#1a0830', 1, 0.9), swirl);
  return root;
}

// ---------- scenery ----------

export function makeTree(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'tree';
  const s = 0.8 + rnd() * 0.45;
  if (rnd() < 0.55) {
    // Round storybook tree with a slightly bent trunk.
    mesh(cyl(0.05 * s, 0.085 * s, 0.32 * s, 8), toon(C.bark), root, 0, 0.16 * s, 0);
    const upper = mesh(cyl(0.04 * s, 0.05 * s, 0.22 * s, 8), toon(C.bark), root, 0.03 * s, 0.4 * s, 0);
    upper.rotation.z = -0.25;
    const tone = rnd() < 0.5 ? C.leafA : C.leafB;
    const blobs: [number, number, number, number][] = [[0, 0.68, 0, 0.3], [0.2, 0.56, 0.08, 0.22], [-0.17, 0.58, -0.06, 0.21], [0.04, 0.55, -0.2, 0.2]];
    for (const [x, y, z, rr] of blobs) mesh(sph(rr * s, 16, 12), toon(tone), root, x * s, y * s, z * s);
  } else {
    // Fir with drooping tiers.
    mesh(cyl(0.04 * s, 0.07 * s, 0.25 * s, 8), toon(C.bark), root, 0, 0.12 * s, 0);
    for (let i = 0; i < 3; i++) {
      mesh(cone((0.34 - i * 0.08) * s, 0.36 * s, 14), toon(i % 2 ? C.leafDark : C.leafA), root, 0, (0.36 + i * 0.2) * s, 0);
    }
  }
  return root;
}

export function makeDeadTree(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'dead-tree';
  const s = 0.8 + rnd() * 0.4;
  mesh(cyl(0.04 * s, 0.08 * s, 0.7 * s, 8), toon(C.deadwood), root, 0, 0.35 * s, 0).rotation.z = 0.08;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd();
    const b = mesh(cyl(0.015 * s, 0.03 * s, 0.3 * s, 6), toon(C.deadwood), root, Math.cos(a) * 0.1 * s, (0.45 + i * 0.1) * s, Math.sin(a) * 0.1 * s);
    b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
  }
  return root;
}

export function makeGrave(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'grave';
  const w = 0.2 + rnd() * 0.06;
  const stone = toon(rnd() < 0.5 ? C.stone : C.stoneDark);
  mesh(box(w, 0.2, 0.06), stone, root, 0, 0.1, 0);
  mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.06, 16, 1, false, 0, Math.PI), stone, root, 0, 0.2, 0).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  root.rotation.z = (rnd() - 0.5) * 0.3;
  return root;
}

export function makeLampPost(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'lamp-post';
  mesh(cyl(0.07, 0.09, 0.08, 12), toon(C.stoneDark), root, 0, 0.04, 0);
  mesh(cyl(0.025, 0.035, 0.85, 8), toon(C.iron), root, 0, 0.47, 0);
  mesh(box(0.2, 0.025, 0.025), toon(C.iron), root, 0.08, 0.86, 0);
  const l = lantern(root, C.lamp, 0.8);
  l.position.set(0.17, 0.7, 0);
  return root;
}

export function makeRock(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'rock';
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.1 + rnd() * 0.14;
    const rock = mesh(new THREE.DodecahedronGeometry(s, 0), toon(i % 2 ? C.stone : C.stoneDark), root, (rnd() - 0.5) * 0.4, s * 0.5, (rnd() - 0.5) * 0.4);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.scale.set(1, 0.65, 1.1);
  }
  return root;
}

export function makeMushrooms(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'mushrooms';
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * 0.4, z = (rnd() - 0.5) * 0.4, h = 0.06 + rnd() * 0.08;
    mesh(cyl(0.015, 0.02, h, 8), toon('#d8cfc0'), root, x, h / 2, z);
    mesh(halfSph(0.045, true, 12), gem('#5fe0c8', 0.9), root, x, h, z);
  }
  return root;
}

export function makeWindmill(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'windmill';
  mesh(cyl(0.32, 0.46, 1.25, 20), toon('#8a7f74'), root, 0, 0.63, 0);
  mesh(cone(0.44, 0.5, 20), toon('#5a3330'), root, 0, 1.5, 0);
  mesh(box(0.18, 0.26, 0.04), glow(C.lamp, 1.2), root, 0, 0.5, 0.45);
  mesh(box(0.16, 0.36, 0.05), toon(C.woodDark), root, 0, 0.18, 0.46);
  const blades = group(root, 'blades', 0, 1.2, 0.42);
  mesh(sph(0.06, 10, 8), toon(C.woodDark), blades);
  for (let i = 0; i < 4; i++) {
    const arm = group(blades, '');
    arm.rotation.z = (i / 4) * Math.PI * 2;
    mesh(box(0.05, 0.95, 0.03), toon(C.wood), arm, 0, 0.48, 0);
    mesh(box(0.2, 0.6, 0.015), toon('#c9b99b'), arm, 0.12, 0.58, 0);
  }
  return root;
}

// ---------- board ----------

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 2D value noise in roughly [-1, 1]. */
function makeNoise(seed: number) {
  const rnd = mulberry(seed);
  const table = Array.from({ length: 512 }, () => rnd() * 2 - 1);
  const at = (x: number, z: number) => table[((Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0) % 512];
  return (x: number, z: number) => {
    const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = at(x0, z0), b = at(x0 + 1, z0), c = at(x0, z0 + 1), d = at(x0 + 1, z0 + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const MARGIN = 1;
/** Tile (tx, ty) centre in world units. One tile is one unit; the board is centred on the origin. */
export const tileToWorld = (tx: number, ty: number) => ({ x: tx + 0.5 - COLS / 2, z: ty + 0.5 - ROWS / 2 });

/** Road centreline in world units, with each corner rounded into a short curve. */
export function roadCurve(map: MapDef, radius = 0.45): THREE.Vector2[] {
  const pts = map.pts.map(([tx, ty]) => { const w = tileToWorld(tx, ty); return new THREE.Vector2(w.x, w.z); });
  const out: THREE.Vector2[] = [pts[0].clone()];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const p0 = p.clone().addScaledVector(p.clone().sub(a).normalize(), -radius);
    const p2 = p.clone().addScaledVector(b.clone().sub(p).normalize(), radius);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, u = 1 - t;
      out.push(new THREE.Vector2(u * u * p0.x + 2 * u * t * p.x + t * t * p2.x, u * u * p0.y + 2 * u * t * p.y + t * t * p2.y));
    }
  }
  out.push(pts[pts.length - 1].clone());
  return out;
}

function distToCurve(curve: THREE.Vector2[], x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1];
    const dx = b.x - a.x, dz = b.y - a.y, len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / len2));
    best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.y - dz * t));
  }
  return best;
}

/** Signed distance to a rounded rectangle centred on the origin; negative inside. */
function roundRect(x: number, z: number, hx: number, hz: number, r: number) {
  const qx = Math.abs(x) - hx + r, qz = Math.abs(z) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

const ROAD_HALF = 0.36;

/**
 * Samples the island at a world point: height, how much road and how much cliff edge it is.
 * The playable board stays flat so towers stand level; hills only rise in the margin.
 */
function makeTerrain(map: MapDef) {
  const noise = makeNoise(map.seed * 31 + 7);
  const curve = roadCurve(map);
  // The island reaches a little past the margin tiles so scenery there sits on flat ground.
  const hx = COLS / 2 + MARGIN + 0.4, hz = ROWS / 2 + MARGIN + 0.4;
  return (x: number, z: number) => {
    const road = distToCurve(curve, x, z);
    const roadMix = 1 - smoothstep(ROAD_HALF - 0.04, ROAD_HALF + 0.12, road);
    const outside = Math.hypot(Math.max(Math.abs(x) - COLS / 2, 0), Math.max(Math.abs(z) - ROWS / 2, 0));
    const hills = Math.max(0, noise(x * 0.5, z * 0.5)) * 0.32 * smoothstep(0, 0.7, outside);
    let h = hills * (1 - roadMix) - 0.05 * roadMix;
    const edge = smoothstep(-0.55, 0.3, roundRect(x, z, hx, hz, 1.4));
    h = h * (1 - edge) - 1.3 * edge;
    return { h, road, roadMix, edge, outside, n: noise(x * 0.35 + 40, z * 0.35) };
  };
}

/** The diorama island: one smooth terrain mesh with the road painted in, plus scenery. */
export function makeBoard(map: MapDef): THREE.Group {
  const root = new THREE.Group();
  root.name = `board-${map.id}`;
  const rnd = mulberry(map.seed * 7919 + 13);
  const sample = makeTerrain(map);
  const start = tileToWorld(map.pts[0][0], map.pts[0][1]);
  const end = tileToWorld(map.pts[map.pts.length - 1][0], map.pts[map.pts.length - 1][1]);

  const W = COLS + MARGIN * 2 + 1.4, D = ROWS + MARGIN * 2 + 1.4, RES = 9;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W * RES), Math.round(D * RES));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color(C.grassA), grassB = new THREE.Color(C.grassB), edgeGrass = new THREE.Color(C.grassEdge);
  const dirt = new THREE.Color(C.dirt), dirtB = new THREE.Color(C.dirtB), cliff = new THREE.Color(C.cliff), deep = new THREE.Color(C.cliffDeep);
  const blight = new THREE.Color(C.blight), blightDeep = new THREE.Color(C.blightDeep);
  const col = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const s = sample(x, z);
    pos.setY(i, s.h);
    col.copy(grassA).lerp(grassB, s.n * 0.5 + 0.5);
    col.lerp(edgeGrass, smoothstep(0, 0.8, s.outside) * 0.6);
    // The Gloom stains the ground around the rift, with a ragged edge.
    const stain = 1 - smoothstep(1.4, 3.2, Math.hypot(x - start.x, z - start.z) + s.n * 0.6);
    tmp.copy(blight).lerp(blightDeep, stain);
    col.lerp(tmp, stain * 0.9);
    tmp.copy(dirt).lerp(dirtB, s.n * 0.5 + 0.5);
    col.lerp(tmp, s.roadMix);
    tmp.copy(cliff).lerp(deep, smoothstep(0.4, 1, s.edge));
    col.lerp(tmp, smoothstep(0.05, 0.4, s.edge));
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: TOON_STEPS }));
  ground.name = 'ground';
  ground.receiveShadow = true;
  ground.userData.noOutline = true;
  root.add(ground);
  const under = mesh(cyl(1, 1, 0.2, 32), toon(C.cliffDeep), root, 0, -1.35, 0);
  under.scale.set(W / 2 - 0.6, 1, D / 2 - 0.6);
  under.castShadow = false;
  under.userData.noOutline = true;

  // Pebbles along the road edges.
  const curve = roadCurve(map);
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1], len = a.distanceTo(b);
    for (let d = 0; d < len; d += 0.45) {
      if (rnd() < 0.4) continue;
      const t = d / len, side = (rnd() < 0.5 ? -1 : 1) * (ROAD_HALF - 0.02 + rnd() * 0.06);
      const px = a.x + (b.x - a.x) * t - ((b.y - a.y) / len) * side, pz = a.y + (b.y - a.y) * t + ((b.x - a.x) / len) * side;
      const p = mesh(new THREE.DodecahedronGeometry(0.03 + rnd() * 0.035, 0), toon(rnd() < 0.5 ? C.stone : C.stoneDark), root, px, sample(px, pz).h + 0.01, pz);
      p.castShadow = false;
      p.userData.noOutline = true;
    }
  }

  // Scenery: graves and dead trees near the rift, lamp posts near the heart, forest elsewhere.
  const millTile = map.id === 'mill' ? `${COLS - 1},${-1}` : '';
  let lamps = 0;
  for (let ty = -MARGIN; ty < ROWS + MARGIN; ty++) {
    for (let tx = -MARGIN; tx < COLS + MARGIN; tx++) {
      const { x, z } = tileToWorld(tx, ty);
      const s = sample(x, z);
      if (s.road < 0.75 || s.edge > 0.02) continue;
      const inside = tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
      const nearRift = Math.hypot(x - start.x, z - start.z) < 2.6;
      const nearHeart = Math.hypot(x - end.x, z - end.z) < 1.8;
      if (tx + ',' + ty === millTile) {
        const mill = makeWindmill();
        mill.position.set(x, s.h, z);
        mill.rotation.y = -0.6;
        root.add(mill);
        continue;
      }
      let obj: THREE.Object3D | null = null;
      if (!inside) {
        const v = rnd();
        if (nearHeart && lamps < 2) { obj = makeLampPost(); lamps++; }
        else if (nearRift) obj = v < 0.45 ? makeGrave(rnd) : v < 0.75 ? makeDeadTree(rnd) : makeRock(rnd);
        else if (v < 0.58) obj = makeTree(rnd);
        else if (v < 0.75) obj = makeRock(rnd);
        else if (v < 0.84) obj = makeMushrooms(rnd);
      } else if (rnd() < (nearRift ? 0.25 : 0.06)) {
        // Keep small things to the tile corner so towers can still stand there.
        obj = nearRift ? makeGrave(rnd) : makeMushrooms(rnd);
        obj.scale.setScalar(0.7);
        obj.position.set(x + 0.36, 0, z + 0.36);
        root.add(obj);
        continue;
      }
      if (obj) {
        const ox = x + (rnd() - 0.5) * 0.3, oz = z + (rnd() - 0.5) * 0.3;
        obj.position.set(ox, sample(ox, oz).h, oz);
        if (obj.name !== 'lamp-post') obj.rotation.y = rnd() * Math.PI * 2;
        root.add(obj);
      }
    }
  }
  return root;
}
