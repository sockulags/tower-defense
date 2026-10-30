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
import { CHARMS, CLOAKS, HATS, WEAPONS, type Loadout } from '../data/hero';
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
  inkBlot: '#6a3a9e', inkBlotBud: '#9c6ad8', inkDasher: '#b03f86', inkDasherBelly: '#e48cc2',
  // bosses
  inkStomper: '#4e2a6e', inkStomperBelly: '#8a5aa8', inkThief: '#7d3a8c', inkThiefCloak: '#4a2556', sack: '#c9a36a',
  inkMender: '#6b3f9e', inkMenderTrim: '#c25aa8', mendLight: '#d8ff7a',
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

// Every tower is built in stages instead of on a shared plinth. Levels 1-3 are three different
// buildings of the same kind (a camp, a proper structure, a finished one), and each branch at level 4
// is a new form of its own that gains detail at 5 and 6. The level shows in the shape, not in studs.

/** A worn, blotchy patch of ground under a tower (dirt, frost, ash), flat and without an outline so it reads as ground. */
function patch(root: THREE.Object3D, color: string, r: number) {
  const blots: [number, number, number][] = [[0, 0, 1], [0.5, 0.42, 0.62], [2.3, 0.5, 0.55], [3.9, 0.38, 0.7], [5.2, 0.48, 0.5]];
  blots.forEach(([a, d, s], i) => {
    const b = mesh(new THREE.CircleGeometry(r * s, 20), toon(color), root, Math.cos(a) * r * d, 0.012 + i * 0.002, Math.sin(a) * r * d);
    b.rotation.x = -Math.PI / 2;
    b.userData.noOutline = true;
    b.castShadow = false;
  });
}

/** A rounded field stone. */
function rock(parent: THREE.Object3D, x: number, z: number, s: number, color: string = C.stone, squash = 0.6) {
  const r = mesh(new THREE.DodecahedronGeometry(s, 1), toon(color), parent, x, s * squash * 0.55, z);
  r.scale.set(1.2, squash, 1);
  r.rotation.y = x * 7 + z * 3;
  return r;
}

function rockRing(parent: THREE.Object3D, n: number, r: number, s: number, offset = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + offset;
    rock(parent, Math.cos(a) * r, Math.sin(a) * r, s * (0.85 + (i % 3) * 0.12), i % 2 ? C.stone : C.stoneLight);
  }
}

/** A plank deck on four legs, top surface at height h. */
function deck(parent: THREE.Object3D, h: number, half: number, top: string = C.wood) {
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.026, 0.034, h, 8), toon(C.woodDark), parent, x * half, h / 2, z * half);
  mesh(box(half * 2 + 0.1, 0.05, half * 2 + 0.1), toon(top), parent, 0, h - 0.025, 0);
}

/** A little pennant named 'flag', which the view waves. */
function pennant(parent: THREE.Object3D, x: number, y: number, z: number, color: string = C.cloth) {
  mesh(cyl(0.009, 0.009, 0.24, 6), toon(C.iron), parent, x, y + 0.12, z);
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.2, -0.045), new THREE.Vector2(0, -0.1)]);
  const flag = group(parent, 'flag', x, y + 0.24, z);
  const f = mesh(new THREE.ShapeGeometry(shape), toon(color), flag, 0, 0, 0);
  (f.material as THREE.Material).side = THREE.DoubleSide;
}

type TowerBuilder = (root: THREE.Group, level: number, branch: Branch, color: string) => void;

// ---------- Spark: the lamplighter's post, a shooter ----------

/** The turning head of a lantern post: arms reaching out along +x with a swinging lantern on each. */
function lanternHead(parent: THREE.Object3D, y: number, color: string, arms: number[], reach: number, scale = 1, barrel = 0) {
  const aim = group(parent, 'aim', 0, y, 0);
  if (arms.length > 1) mesh(box(0.05, 0.04, Math.abs(arms[0] - arms[arms.length - 1]) + 0.05), toon(C.woodDark), aim, 0, 0, 0);
  for (const z of arms) {
    mesh(box(reach + 0.08, 0.04, 0.045), toon(C.woodDark), aim, reach / 2, 0, z);
    const swing = group(aim, 'swing', reach, -0.02, z);
    mesh(torus(0.018, 0.006), toon(C.iron), swing, 0, -0.03, 0);
    mesh(torus(0.018, 0.006), toon(C.iron), swing, 0, -0.065, 0).rotation.y = Math.PI / 2;
    const l = lantern(swing, color, scale);
    l.position.y = -0.2 * scale;
    const recoil = group(swing, 'recoil', 0, -0.2 * scale, 0);
    if (barrel) {
      // A brass sighting barrel clamped under the lantern.
      mesh(cyl(0.022, 0.03, barrel, 12), toon(C.brass), recoil, barrel / 2 + 0.04, 0, 0).rotation.z = Math.PI / 2;
      mesh(torus(0.032, 0.01), toon(C.brassDark), recoil, barrel + 0.04, 0, 0).rotation.y = Math.PI / 2;
      group(recoil, 'muzzle', barrel + 0.07, 0, 0);
    } else {
      // A flared brass spout on the lantern's side: the sparks leave through it.
      const s = scale;
      mesh(cyl(0.045 * s, 0.024 * s, 0.13 * s, 12), toon(C.brass), recoil, 0.12 * s, 0, 0).rotation.z = -Math.PI / 2;
      mesh(torus(0.045 * s, 0.01), toon(C.brassDark), recoil, 0.185 * s, 0, 0).rotation.y = Math.PI / 2;
      mesh(new THREE.CircleGeometry(0.038 * s, 12), glow(color, 1.6), recoil, 0.188 * s, 0, 0).rotation.y = Math.PI / 2;
      group(recoil, 'muzzle', 0.2 * s, 0, 0);
    }
  }
  return aim;
}

const sparkTower: TowerBuilder = (root, level, branch, color) => {
  patch(root, C.dirtB, 0.34);
  if (branch === null && level === 1) {
    // A stake knocked into the dirt and a crate of spare wicks: the lamplighter has only just arrived.
    mesh(cyl(0.035, 0.05, 0.66, 7), toon(C.wood), root, 0, 0.33, 0);
    mesh(cone(0.04, 0.06, 7), toon(C.wood), root, 0, 0.69, 0);
    const crate = mesh(box(0.15, 0.12, 0.15), toon(C.wood), root, -0.17, 0.06, 0.13);
    crate.rotation.y = 0.5;
    mesh(box(0.16, 0.02, 0.05), toon(C.woodDark), root, -0.17, 0.125, 0.13).rotation.y = 0.5;
    lanternHead(root, 0.6, color, [0], 0.28, 0.9);
    return;
  }
  if (branch === null && level === 2) {
    // A proper lamp post, banded in brass and wedged in a cairn.
    rockRing(root, 6, 0.12, 0.07);
    mesh(cyl(0.042, 0.06, 0.8, 10), toon(C.wood), root, 0, 0.4, 0);
    for (const y of [0.24, 0.62]) mesh(torus(0.054, 0.013), toon(C.brass), root, 0, y, 0).rotation.x = Math.PI / 2;
    mesh(sph(0.045, 10, 8), toon(C.brass), root, 0, 0.82, 0);
    lanternHead(root, 0.72, color, [0], 0.34);
    return;
  }
  if (branch === null) {
    // Level 3: a watch booth with a roofed post and a ladder up to the deck.
    deck(root, 0.3, 0.16);
    mesh(cyl(0.04, 0.05, 0.62, 10), toon(C.wood), root, 0, 0.6, 0);
    mesh(cone(0.15, 0.14, 12), toon(C.roof), root, 0, 0.98, 0);
    mesh(sph(0.03, 8, 6), toon(C.brass), root, 0, 1.06, 0);
    for (const s of [-1, 1]) mesh(cyl(0.012, 0.012, 0.36, 6), toon(C.woodDark), root, s * 0.06, 0.15, 0.27).rotation.x = -0.25;
    for (let i = 0; i < 3; i++) mesh(box(0.13, 0.015, 0.015), toon(C.woodDark), root, 0, 0.06 + i * 0.1, 0.29 - i * 0.025);
    lanternHead(root, 0.82, color, [0], 0.36);
    return;
  }
  if (branch === 0) {
    // Twin Spark: a brass gantry turning two lanterns, dressed up more with every level.
    deck(root, 0.26, 0.17, C.woodDark);
    mesh(cyl(0.05, 0.07, 0.5, 10), toon(C.brassDark), root, 0, 0.5, 0);
    mesh(torus(0.07, 0.016), toon(C.brass), root, 0, 0.32, 0).rotation.x = Math.PI / 2;
    const aim = lanternHead(root, 0.78, color, [-0.15, 0.15], 0.32, 1 + (level - 4) * 0.06);
    mesh(halfSph(0.09), toon(level >= 5 ? C.brass : C.roof), aim, 0, 0.03, 0);
    if (level >= 5) mesh(cone(0.03, 0.12, 8), toon(C.brass), aim, 0, 0.17, 0);
    if (level >= 6) {
      // Bunting strung between the deck posts.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const f = mesh(cone(0.03, 0.06, 3), toon(i % 2 ? C.cloth : C.lamp), root, Math.cos(a) * 0.24, 0.2, Math.sin(a) * 0.24);
        f.rotation.x = Math.PI;
      }
      pennant(root, -0.19, 0.26, -0.19);
    }
    return;
  }
  // Marksman: a tall, narrow sniper's perch with a long brass barrel under its lantern.
  const h = 0.92 + (level - 4) * 0.05;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(cyl(0.022, 0.03, h + 0.02, 7), toon(C.woodDark), root, x * 0.14, h / 2, z * 0.14);
    leg.rotation.set(-z * 0.12, 0, x * 0.12);
  }
  for (const y of [0.3, 0.62]) {
    const w = 2 * (0.14 + (h / 2 - y) * 0.12);
    for (const s of [-1, 1]) {
      mesh(box(w, 0.02, 0.02), toon(C.wood), root, 0, y, s * (w / 2));
      mesh(box(0.02, 0.02, w), toon(C.wood), root, s * (w / 2), y, 0);
    }
  }
  mesh(cyl(0.13, 0.12, 0.05, 10), toon(C.wood), root, 0, h, 0);
  mesh(cyl(0.035, 0.035, 0.2, 8), toon(C.woodDark), root, 0, h + 0.1, 0);
  lanternHead(root, h + 0.16, color, [0], 0.16, 1.1, 0.42 + (level - 4) * 0.06);
  if (level >= 5) mesh(torus(0.13, 0.015), toon(C.brass), root, 0, h + 0.03, 0).rotation.x = Math.PI / 2;
  if (level >= 6) pennant(root, -0.1, h, -0.06);
};

// ---------- Rime: frost magic, a slower ----------

function crystal(parent: THREE.Object3D, size: number, name = 'core') {
  const c = mesh(new THREE.OctahedronGeometry(size, 0), gem('#4fc8f5', 0.35), parent, 0, 0, 0, name);
  c.scale.y = 2.1;
  return c;
}

function shardOrbit(parent: THREE.Object3D, n: number, r: number) {
  const orbit = group(parent, 'orbit');
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    mesh(new THREE.OctahedronGeometry(0.045, 0), gem('#8fdcff', 0.3), orbit, Math.cos(a) * r, Math.sin(a * 2) * 0.05, Math.sin(a) * r).scale.y = 1.8;
  }
}

/**
 * The Rime's weapon: a long ice lance resting in a cradle, turned toward the target like a ballista bolt.
 * It lies flat so it reads from the near top-down camera. Bolts leave from its glowing tip.
 */
function frostLens(parent: THREE.Object3D, y: number, reach: number, color: string, size = 1) {
  const aim = group(parent, 'aim', 0, y, 0);
  const recoil = group(aim, 'recoil');
  const len = reach + 0.16 * size;
  const lance = mesh(new THREE.OctahedronGeometry(0.06 * size, 0), gem('#8fdcff', 0.5), recoil, len / 2, 0, 0);
  lance.scale.set(len / (0.12 * size), 0.7, 0.7);
  for (const x of [len * 0.3, len * 0.62]) {
    // Frost rings binding the lance.
    mesh(torus(0.045 * size, 0.013), gem(color, 0.9), recoil, x, 0, 0).rotation.y = Math.PI / 2;
  }
  for (const sd of [-1, 1]) {
    const fin = mesh(cone(0.03 * size, 0.14 * size, 4), gem('#bfefff', 0.45), recoil, 0.04, 0, sd * 0.05 * size);
    fin.rotation.set(sd * -1.1, 0, Math.PI / 2);
  }
  mesh(sph(0.03 * size, 10, 8), glow('#d6f6ff', 1.8), recoil, len, 0, 0, 'core');
  group(recoil, 'muzzle', len + 0.02, 0, 0);
  return aim;
}

function icicle(parent: THREE.Object3D, x: number, z: number, h: number, r: number, lean: number, color = '#bfefff') {
  const a = Math.atan2(z, x);
  const ic = mesh(cone(r, h, 6), gem(color, 0.45), parent, x, h / 2, z);
  ic.rotation.set(-Math.sin(a) * lean, 0, Math.cos(a) * lean);
  return ic;
}

const frostTower: TowerBuilder = (root, level, branch, color) => {
  patch(root, level >= 3 ? '#cfe6ec' : '#c4e0cf', 0.3 + level * 0.03);
  if (branch === null && level === 1) {
    // A frozen boulder with a crystal cracking out of it.
    rock(root, 0, 0, 0.2, C.stoneLight, 0.8);
    mesh(halfSph(0.16), toon('#f3faff'), root, -0.02, 0.15, 0).scale.y = 0.35;
    const c = crystal(root, 0.11);
    c.position.set(0.03, 0.44, 0.02);
    c.rotation.z = -0.2;
    for (const [x, z, h] of [[0.16, 0.08, 0.16], [-0.15, 0.12, 0.12], [0.06, -0.17, 0.1]]) icicle(root, x, z, h, 0.035, -0.3);
    frostLens(root, 0.44, 0.2, color, 0.9);
    return;
  }
  if (branch === null && level === 2) {
    // The boulder has split, and the crystal floats free between the halves.
    for (const s of [-1, 1]) {
      const r = rock(root, s * 0.15, 0, 0.17, C.stoneLight, 1);
      r.rotation.z = s * 0.35;
    }
    const float = group(root, 'float', 0, 0.55, 0);
    crystal(float, 0.11);
    shardOrbit(float, 3, 0.24);
    frostLens(root, 0.55, 0.26, color);
    return;
  }
  if (branch === null) {
    // Level 3: a carved rune obelisk holding the crystal aloft.
    const h = 0.5;
    mesh(cyl(0.11, 0.19, h, 8), toon(C.stoneLight), root, 0, h / 2, 0);
    mesh(torus(0.15, 0.018, Math.PI * 2, 8), gem(color, 1.2), root, 0, h * 0.45, 0).rotation.x = Math.PI / 2;
    mesh(cyl(0.16, 0.12, 0.06, 8), toon(C.stoneDark), root, 0, h + 0.03, 0);
    const float = group(root, 'float', 0, h + 0.36, 0);
    crystal(float, 0.14);
    shardOrbit(float, 5, 0.27);
    frostLens(root, h + 0.36, 0.3, color, 1.1);
    return;
  }
  if (branch === 0) {
    // Ice Prison: a cage of ice pillars grown up around a short obelisk, the crystal held inside.
    mesh(cyl(0.1, 0.16, 0.3, 8), toon(C.stoneLight), root, 0, 0.15, 0);
    const n = 5 + (level - 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      icicle(root, Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.62 + (i % 2) * 0.16, 0.06, 0.2);
    }
    const float = group(root, 'float', 0, 0.62, 0);
    crystal(float, 0.13 + (level - 4) * 0.01);
    shardOrbit(float, 2 + level, 0.17);
    frostLens(root, 0.62, 0.38, color, 1.1 + (level - 4) * 0.1);
    if (level >= 5) for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      icicle(root, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.22, 0.045, -0.35, '#e6f8ff');
    }
    if (level >= 6) {
      // A frozen crown closing over the cage.
      mesh(torus(0.22, 0.03, Math.PI * 2, 10), gem('#bfefff', 0.5), root, 0, 0.86, 0).rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = mesh(cone(0.035, 0.18, 6), gem('#e6f8ff', 0.5), root, Math.cos(a) * 0.22, 0.95, Math.sin(a) * 0.22);
        sp.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      }
    }
    return;
  }
  // Fog Bank: a wide frozen basin breathing mist, the crystal hanging low over the ice.
  mesh(cyl(0.3, 0.34, 0.16, 18), toon(C.stone), root, 0, 0.08, 0);
  mesh(torus(0.3, 0.045, Math.PI * 2, 18), toon(C.stoneLight), root, 0, 0.16, 0).rotation.x = Math.PI / 2;
  mesh(cyl(0.27, 0.27, 0.02, 18), gem('#bfe9ff', 0.4), root, 0, 0.16, 0);
  const float = group(root, 'float', 0, 0.48, 0);
  crystal(float, 0.12);
  shardOrbit(float, 3, 0.2);
  jets(root, 6, 0.3, 0.14, '#d8f4ff', level >= 5);
  const mist = group(root, 'mist', 0, 0.28, 0);
  const puffs = 4 + (level - 4) * 2;
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2;
    mesh(sph(0.11 + (i % 2) * 0.04, 12, 10), glow('#d8f4ff', 0.7, 0.28), mist, Math.cos(a) * 0.34, (i % 2) * 0.08, Math.sin(a) * 0.34);
  }
  if (level >= 6) {
    // Two rune arches over the basin.
    for (const r of [0, Math.PI / 2]) mesh(torus(0.3, 0.03, Math.PI, 14), toon(C.stoneLight), root, 0, 0.16, 0).rotation.y = r;
    mesh(sph(0.04, 8, 6), gem(color, 1.2), root, 0, 0.46, 0);
  }
};

// ---------- Ember Pulse: fire that bursts outward ----------

function flamesAt(root: THREE.Object3D, y: number, s: number, color: string) {
  const flames = group(root, 'flames', 0, y, 0);
  mesh(cone(0.15 * s, 0.5 * s, 12), glow(C.flame, 1.7), flames, 0, 0.25 * s, 0);
  mesh(cone(0.08 * s, 0.32 * s, 10), glow(C.flameCore, 2.2), flames, 0.02, 0.16 * s, 0.01);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const t = mesh(cone(0.07 * s, 0.26 * s, 10), glow(color, 1.6), flames, Math.cos(a) * 0.1 * s, 0.12 * s, Math.sin(a) * 0.1 * s);
    t.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
  }
  const embers = group(root, 'embers', 0, y + 0.08, 0);
  for (let i = 0; i < 5; i++) mesh(sph(0.018, 6, 4), glow('#ffcf6a', 1.8), embers, 0, 0, 0);
}

function coals(root: THREE.Object3D, r: number, y: number) {
  mesh(new THREE.CircleGeometry(r, 24), glow('#ff5a22', 1.3), root, 0, y, 0).rotation.x = -Math.PI / 2;
}

/**
 * The weapon of an area tower: spouts around it, each holding a 'jet' that points outward.
 * The view keeps jets small at rest and blasts them out every time the tower pulses.
 */
function jets(parent: THREE.Object3D, n: number, r: number, y: number, color: string, spouts = true, offset = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + offset;
    const holder = group(parent, '', Math.cos(a) * r, y, Math.sin(a) * r);
    holder.rotation.y = -a;
    if (spouts) {
      mesh(cyl(0.045, 0.028, 0.12, 10), toon(C.brass), holder, 0.03, 0, 0).rotation.z = -Math.PI / 2;
      mesh(torus(0.045, 0.01), toon(C.brassDark), holder, 0.09, 0, 0).rotation.y = Math.PI / 2;
    }
    const jet = group(holder, 'jet', spouts ? 0.09 : 0, 0, 0);
    mesh(cone(0.05, 0.24, 8), glow(color, 1.7), jet, 0.12, 0, 0).rotation.z = -Math.PI / 2;
    mesh(cone(0.025, 0.14, 8), glow(C.flameCore, 2), jet, 0.07, 0, 0).rotation.z = -Math.PI / 2;
  }
}

const pulseTower: TowerBuilder = (root, level, branch, color) => {
  patch(root, '#8a7368', 0.34);
  if (branch === null && level === 1) {
    // A campfire in a ring of stones.
    rockRing(root, 8, 0.2, 0.065, 0.2);
    for (const r of [0.5, -0.6]) {
      const log = mesh(capsule(0.035, 0.26), toon(C.wood), root, 0, 0.06, 0);
      log.rotation.order = 'YXZ';
      log.rotation.set(Math.PI / 2, r, 0);
    }
    coals(root, 0.12, 0.04);
    flamesAt(root, 0.05, 0.8, color);
    jets(root, 6, 0.1, 0.07, color, false, 0.3);
    return;
  }
  if (branch === null && level === 2) {
    // An iron fire bowl on a squat stone stack.
    mesh(cyl(0.12, 0.2, 0.26, 10), toon(C.stone), root, 0, 0.13, 0);
    mesh(cyl(0.16, 0.14, 0.05, 10), toon(C.stoneDark), root, 0, 0.28, 0);
    mesh(halfSph(0.25, false), toon(C.iron), root, 0, 0.5, 0);
    mesh(torus(0.25, 0.026), toon(C.brassDark), root, 0, 0.5, 0).rotation.x = Math.PI / 2;
    coals(root, 0.23, 0.49);
    flamesAt(root, 0.5, 0.95, color);
    jets(root, 6, 0.25, 0.45, color);
    return;
  }
  if (branch === null) {
    // Level 3: a spiked cauldron striding on three clawed iron legs.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const leg = group(root, '', Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
      leg.rotation.y = -a;
      mesh(capsule(0.03, 0.4), toon(C.iron), leg, 0.05, 0.27, 0).rotation.z = 0.3;
      mesh(cone(0.04, 0.1, 8), toon(C.iron), leg, 0.12, 0.03, 0).rotation.z = -Math.PI / 2;
    }
    const r = 0.3;
    mesh(halfSph(r, false), toon(C.iron), root, 0, 0.62, 0);
    mesh(torus(r, 0.03), toon(C.brassDark), root, 0, 0.62, 0).rotation.x = Math.PI / 2;
    for (const z of [-1, 1]) mesh(torus(0.06, 0.014), toon(C.brassDark), root, 0, 0.55, z * (r + 0.02));
    jets(root, 8, r, 0.56, color);
    coals(root, r - 0.02, 0.61);
    flamesAt(root, 0.62, 1.15, color);
    return;
  }
  if (branch === 0) {
    // Heatwave: a stone kiln cracking with heat, a fire mouth in front and a chimney spitting flame.
    mesh(cyl(0.32, 0.35, 0.16, 18), toon(C.stoneDark), root, 0, 0.08, 0);
    mesh(halfSph(0.31), toon(C.stone), root, 0, 0.16, 0).scale.y = 1.1;
    const mouth = mesh(new THREE.CircleGeometry(0.11, 16, 0, Math.PI), glow('#ff6a22', 1.6), root, 0, 0.17, 0.315);
    mouth.rotation.x = -0.1;
    mesh(torus(0.11, 0.025, Math.PI, 12), toon(C.stoneDark), root, 0, 0.17, 0.31);
    const seams = 5 + (level - 4) * 2;
    for (let i = 0; i < seams; i++) {
      const a = (i / seams) * Math.PI * 2 + 0.5;
      const seam = mesh(box(0.02, 0.18, 0.012), glow('#ff4a1c', 1.5), root, Math.cos(a) * 0.27, 0.3, Math.sin(a) * 0.27);
      seam.rotation.y = -a;
      seam.rotation.z = 0.5;
    }
    mesh(cyl(0.1, 0.12, 0.26, 10), toon(C.stoneDark), root, 0, 0.55, 0);
    if (level >= 5) for (const y of [0.18, 0.02]) mesh(torus(0.335, 0.018, Math.PI * 2, 24), toon(C.brass), root, 0, y, 0).rotation.x = Math.PI / 2;
    if (level >= 6) {
      // A pair of bellows pumping the fire.
      const b = group(root, '', -0.34, 0.1, 0.14);
      b.rotation.y = 0.6;
      mesh(box(0.2, 0.06, 0.14), toon(C.wood), b, 0, 0, 0);
      mesh(cone(0.03, 0.12, 8), toon(C.brass), b, 0.15, 0, 0).rotation.z = -Math.PI / 2;
    }
    jets(root, 6 + (level - 4) * 2, 0.33, 0.12, color, true, 0.26);
    coals(root, 0.08, 0.685);
    flamesAt(root, 0.68, 0.85 + (level - 4) * 0.1, color);
    return;
  }
  // Thunder Pulse: a copper storm coil on a stone foot, ringed by lightning rods.
  mesh(cyl(0.22, 0.28, 0.16, 12), toon(C.stone), root, 0, 0.08, 0);
  mesh(cyl(0.07, 0.1, 0.5, 10), toon('#b8743a'), root, 0, 0.4, 0);
  for (let k = 0; k < 4; k++) mesh(torus(0.1 - k * 0.008, 0.016), toon('#d98a45'), root, 0, 0.26 + k * 0.1, 0).rotation.x = Math.PI / 2;
  mesh(torus(0.17, 0.02), toon('#b8743a'), root, 0, 0.7, 0).rotation.x = Math.PI / 2;
  mesh(sph(0.11, 14, 12), glow('#bfe4ff', 1.8), root, 0, 0.74, 0, 'core');
  const rods = level >= 5 ? 4 : 3;
  for (let i = 0; i < rods; i++) {
    const a = (i / rods) * Math.PI * 2 + 0.6;
    const x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
    mesh(cyl(0.015, 0.022, 0.6, 8), toon('#b8743a'), root, x, 0.3, z);
    mesh(cone(0.025, 0.07, 8), toon(C.brass), root, x, 0.63, z);
    mesh(sph(0.04, 10, 8), glow('#bfe4ff', 2), root, x, 0.7, z, 'arc');
  }
  jets(root, rods, 0.3, 0.7, '#bfe4ff', false, 0.6);
  if (level >= 6) {
    // A small storm cloud brewing over the coil.
    const mist = group(root, 'mist', 0, 1.2, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      mesh(sph(0.1 + (i % 2) * 0.03, 12, 10), toon('#7d86a8'), mist, Math.cos(a) * 0.12, (i % 2) * 0.04, Math.sin(a) * 0.12);
    }
  }
};

// ---------- Starfall: a stargazer's artillery ----------

/** The turning, tilting telescope: 'aim' turns, 'pitch' tilts, 'recoil' kicks back. */
function telescope(parent: THREE.Object3D, y: number, color: string, len: number, big = 1, barrels = 1) {
  const aim = group(parent, 'aim', 0, y, 0);
  const pitch = group(aim, 'pitch', 0, 0.06, 0);
  pitch.rotation.z = 0.5;
  const recoil = group(pitch, 'recoil');
  for (let b = 0; b < barrels; b++) {
    const z = (b - (barrels - 1) / 2) * 0.1;
    const r = barrels > 1 ? 0.75 : 1;
    mesh(cyl(0.055 * big * r, 0.08 * big * r, len, 16), toon(C.brass), recoil, len / 2, 0, z).rotation.z = -Math.PI / 2;
    for (const x of [0.12, len - 0.06]) mesh(torus(0.075 * big * r, 0.014), toon(C.brassDark), recoil, x, 0, z).rotation.y = Math.PI / 2;
    mesh(new THREE.CircleGeometry(0.05 * big * r, 16), glow(color, 1.8), recoil, len + 0.002, 0, z).rotation.y = Math.PI / 2;
  }
  group(recoil, 'muzzle', len + 0.04, 0, 0);
  return aim;
}

/** The round stone observatory of level 3 and both branches. */
function observatory(root: THREE.Object3D, r: number, h: number) {
  mesh(cyl(r, r + 0.04, h, 20), toon(C.stone), root, 0, h / 2, 0);
  mesh(torus(r + 0.005, 0.02), toon(C.stoneDark), root, 0, h, 0).rotation.x = Math.PI / 2;
  mesh(box(0.08, 0.12, 0.02), glow(C.lamp, 1.2), root, 0, h * 0.5, r + 0.03);
  mesh(box(0.11, 0.02, 0.03), toon(C.woodDark), root, 0, h * 0.5 - 0.07, r + 0.035);
}

function dome(aim: THREE.Object3D, r: number, color: string = C.domeMetal) {
  mesh(halfSph(r), toon(color), aim, 0, 0, 0);
  mesh(torus(r, 0.022), toon(C.brass), aim, 0, 0.01, 0).rotation.x = Math.PI / 2;
  mesh(box(r * 1.7, 0.06, 0.1), toon('#1d2236'), aim, 0, r * 0.6, 0).rotation.z = 0.45;
}

const starTower: TowerBuilder = (root, level, branch, color) => {
  patch(root, C.dirtB, 0.34);
  if (branch === null && level === 1) {
    // A stargazer's camp: a telescope on a tripod, a stool and a star chart on the grass.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const leg = mesh(cyl(0.016, 0.02, 0.5, 6), toon(C.woodDark), root, Math.cos(a) * 0.08, 0.24, Math.sin(a) * 0.08);
      leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    }
    telescope(root, 0.46, color, 0.4, 0.8);
    mesh(cyl(0.06, 0.06, 0.03, 10), toon(C.wood), root, -0.2, 0.14, 0.12);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      mesh(cyl(0.008, 0.008, 0.14, 5), toon(C.woodDark), root, -0.2 + Math.cos(a) * 0.04, 0.07, 0.12 + Math.sin(a) * 0.04);
    }
    const chart = mesh(box(0.16, 0.008, 0.12), toon('#efe2c4'), root, 0.16, 0.025, 0.18);
    chart.rotation.y = -0.4;
    mesh(cyl(0.012, 0.012, 0.13, 6), toon(C.woodDark), root, 0.16, 0.03, 0.12).rotation.set(0, -0.4, Math.PI / 2);
    return;
  }
  if (branch === null && level === 2) {
    // A wooden lookout hut with the telescope on its railed roof.
    mesh(box(0.42, 0.36, 0.42), toon(C.wood), root, 0, 0.18, 0);
    mesh(box(0.48, 0.04, 0.48), toon(C.woodDark), root, 0, 0.38, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.012, 0.012, 0.12, 6), toon(C.woodDark), root, x * 0.21, 0.46, z * 0.21);
    mesh(box(0.08, 0.12, 0.02), glow(C.lamp, 1.2), root, 0.1, 0.2, 0.215);
    mesh(box(0.1, 0.22, 0.015), toon(C.woodDark), root, -0.08, 0.11, 0.215);
    telescope(root, 0.42, color, 0.46, 0.9);
    const spin = group(root, 'spin', 0, 1.02, 0);
    mesh(new THREE.OctahedronGeometry(0.06, 0), gem(color, 1), spin);
    return;
  }
  if (branch === null) {
    // Level 3: the domed stone observatory.
    observatory(root, 0.25, 0.62);
    const aim = telescope(root, 0.62, color, 0.56);
    dome(aim, 0.26);
    const spin = group(root, 'spin', 0, 1.2, 0);
    mesh(new THREE.OctahedronGeometry(0.08, 0), gem(color, 1), spin);
    mesh(torus(0.15, 0.01, Math.PI * 2, 32), gem(color, 0.8), spin).rotation.x = Math.PI / 2.5;
    return;
  }
  if (branch === 0) {
    // Meteor: a squat, buttressed bastion with a wide dome and a mortar of a telescope.
    observatory(root, 0.3, 0.46);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = mesh(box(0.1, 0.36, 0.14), toon(C.stoneDark), root, Math.cos(a) * 0.33, 0.18, Math.sin(a) * 0.33);
      b.rotation.y = -a;
    }
    const aim = telescope(root, 0.46, color, 0.5 + (level - 4) * 0.04, 1.4);
    dome(aim, 0.31, '#9a5a3c');
    if (level >= 5) for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mesh(sph(0.018, 6, 4), toon(C.brass), root, Math.cos(a) * 0.305, 0.4, Math.sin(a) * 0.305);
    }
    if (level >= 6) {
      // A captive meteor smouldering over the dome.
      const spin = group(root, 'spin', 0, 1.15, 0);
      rock(spin, 0, 0, 0.1, '#4a3a4f', 0.9).position.y = 0;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        mesh(sph(0.03, 8, 6), glow('#ff8a3d', 1.6), spin, Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08);
      }
    }
    return;
  }
  // Shrapnel: a slim tower crowned by a whirling orrery, with a cluster of short barrels.
  observatory(root, 0.22, 0.66);
  const aim = telescope(root, 0.66, color, 0.44, 1, 3);
  dome(aim, 0.23);
  const spin = group(root, 'spin', 0, 1.22, 0);
  mesh(sph(0.07, 12, 10), gem(color, 1), spin);
  const rings = level >= 5 ? 3 : 2;
  for (let i = 0; i < rings; i++) {
    const ring = mesh(torus(0.2 + i * 0.05, 0.012, Math.PI * 2, 32), toon(C.brass), spin, 0, 0, 0);
    ring.rotation.set(Math.PI / 2 + (i - 1) * 0.5, i * 0.8, 0);
  }
  const stones = 3 + (level - 4);
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2;
    mesh(sph(0.04, 10, 8), gem('#e8dcff', 0.7), spin, Math.cos(a) * 0.28, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.28);
  }
};

const TOWER_BUILDERS: Record<TowerType, TowerBuilder> = { spark: sparkTower, frost: frostTower, pulse: pulseTower, star: starTower };

export function makeTower(type: TowerType, level = 1, branch: Branch = null): THREE.Group {
  const root = new THREE.Group();
  root.name = `tower-${type}`;
  const color = TOWERS[type].color;
  const frame = group(root, 'frame');
  frame.scale.setScalar(level === 1 ? 1.2 : level === 2 ? 1.1 : 1);
  TOWER_BUILDERS[type](frame, level, branch, color);
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
    .map(([x, y]) => new THREE.Vector2(x, y)).reverse();
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

/**
 * Inkblot: a wobbling ink blob with three smaller blobs clinging to it, the Droplets it bursts
 * into. The clinging blobs sit in 'buds', which the view jiggles.
 */
const splitter: EnemyBuilder = (body, r) => {
  mesh(sph(r, 22, 16), toon(C.inkBlot), body, 0, 0, 0, 'skin').scale.set(1.05, 0.92, 1.05);
  // A drip running down the back and a wavy cap of ink on top.
  mesh(sph(r * 0.32, 12, 10), toon(C.inkBlot), body, -r * 0.55, r * 0.68, 0).scale.set(1, 0.7, 1);
  mesh(sph(r * 0.2, 10, 8), toon(C.inkBlot), body, -r * 0.2, r * 0.95, r * 0.15);
  const buds = group(body, 'buds');
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * 0.85 + (i - 1) * 0.95;
    const bud = group(buds, '', Math.cos(a) * r * 0.82, -r * 0.18 + (i === 1 ? r * 0.25 : 0), Math.sin(a) * r * 0.82);
    mesh(sph(r * 0.36, 14, 10), toon(C.inkBlotBud), bud);
    // Each Droplet-to-be already peeks out with one sleepy eye.
    const ex = Math.cos(a) * r * 0.3, ez = Math.sin(a) * r * 0.3;
    mesh(sph(r * 0.09, 8, 6), glow(C.eye, 1.3), bud, ex, r * 0.12, ez);
    mesh(sph(r * 0.045, 6, 6), toon(C.pupil), bud, ex * 1.25, r * 0.12, ez * 1.25);
  }
  eyes(body, r, 0.27, 0.32, 0.4);
  const grin = mesh(torus(r * 0.26, r * 0.05, Math.PI, 16), glow(C.mouth, 1.2), body, r * 0.9, -r * 0.12, 0);
  grin.rotation.set(0, Math.PI / 2, Math.PI);
  const feet = group(body, 'feet');
  for (const side of [1, -1]) mesh(sph(r * 0.22, 12, 8), toon(C.horn), feet, r * 0.15, -r * 0.86, side * r * 0.42, side > 0 ? 'footL' : 'footR').scale.set(1.4, 0.55, 1);
};

/** Droplet: a tiny hopping drop of ink, what an Inkblot bursts into. */
const speck: EnemyBuilder = (body, r) => {
  // A teardrop: a ball with a pointed tip curling back over the top.
  mesh(sph(r, 18, 14), toon(C.inkBlotBud), body, 0, 0, 0, 'skin').scale.set(1.05, 0.95, 1);
  const tip = mesh(cone(r * 0.45, r * 0.9, 12), toon(C.inkBlotBud), body, -r * 0.25, r * 1.05, 0);
  tip.rotation.z = 0.55;
  eyes(body, r, 0.34, 0.36, 0.3);
  const grin = mesh(torus(r * 0.24, r * 0.06, Math.PI, 12), glow(C.mouth, 1.2), body, r * 0.9, -r * 0.25, 0);
  grin.rotation.set(0, Math.PI / 2, Math.PI);
  const feet = group(body, 'feet');
  for (const side of [1, -1]) mesh(sph(r * 0.26, 10, 8), toon(C.horn), feet, r * 0.1, -r * 0.88, side * r * 0.45, side > 0 ? 'footL' : 'footR').scale.set(1.4, 0.6, 1);
};

/**
 * Scurrier: a long, low ink runner with swept-back ears and a streaming tail. It crouches between
 * bursts and stretches out when it sprints. Legs are 'footL'/'footR' (front and back pairs), the
 * ears are 'armL'/'armR' and flatten when it runs.
 */
const dasher: EnemyBuilder = (body, r) => {
  mesh(capsule(r * 0.72, r * 1.3), toon(C.inkDasher), body, 0, 0, 0, 'skin').rotation.z = Math.PI / 2;
  mesh(sph(r * 0.6, 14, 10), toon(C.inkDasherBelly), body, r * 0.2, -r * 0.3, 0).scale.set(1.6, 0.6, 0.9);
  // The head sits forward and a little high so the face reads from above.
  const head = group(body, '', r * 1.05, r * 0.38, 0);
  mesh(sph(r * 0.62, 18, 14), toon(C.inkDasher), head).scale.set(1.1, 0.95, 1);
  mesh(cone(r * 0.22, r * 0.5, 10), toon(C.inkDasher), head, r * 0.62, -r * 0.08, 0).rotation.z = -Math.PI / 2;
  mesh(sph(r * 0.1, 8, 6), toon(C.pupil), head, r * 0.88, -r * 0.06, 0);
  eyes(head, r * 0.62, 0.3, 0.38, 0.38);
  for (const side of [1, -1]) {
    const ear = group(head, side > 0 ? 'armL' : 'armR', -r * 0.1, r * 0.45, side * r * 0.28);
    const e = mesh(cone(r * 0.17, r * 0.8, 8), toon(C.horn), ear, -r * 0.2, r * 0.3, 0);
    e.rotation.z = 0.9;
  }
  // A streaming tail of ink with a bright magenta tip.
  const tail = mesh(cone(r * 0.3, r * 1.3, 10), toon(C.inkDasher), body, -r * 1.55, r * 0.2, 0);
  tail.rotation.z = Math.PI / 2 + 0.35;
  mesh(sph(r * 0.16, 10, 8), glow(C.mouth, 1.1), body, -r * 2.15, r * 0.42, 0);
  for (const [name, x] of [['footL', r * 0.6], ['footR', -r * 0.55]] as const) {
    const pair = group(body, name, x, -r * 0.55, 0);
    for (const side of [1, -1]) mesh(capsule(r * 0.13, r * 0.35), toon(C.horn), pair, 0, -r * 0.2, side * r * 0.36);
  }
};

// ---------- bosses ----------
// Each boss is a big Gloom shadow with one mechanic the view animates (src/three/view.ts):
// the Stomper lifts a leg and slams it down, the Thief carries a 'sack' that fills with gold, and
// the Mender raises its arms and flares its lantern 'core' and its ring of light ('shield').

/**
 * Stomper: a squat, armour-plated hulk on two pillar legs ('footL'/'footR') that it lifts and
 * slams down. Small arms ('armL'/'armR'), a heavy underbite ('jaw') and eyes high on the front.
 */
const stomper: EnemyBuilder = (body, r) => {
  mesh(sph(r, 26, 18), toon(C.inkStomper), body, 0, r * 0.05, 0, 'skin').scale.set(1.1, 0.88, 1.08);
  mesh(sph(r * 0.7, 18, 12), toon(C.inkStomperBelly), body, r * 0.45, -r * 0.18, 0).scale.set(0.55, 0.75, 1.1);
  // Armour: a ridge of bone plates down the back, and a brow plate over the eyes.
  for (let i = 0; i < 4; i++) {
    const p = mesh(sph(r * 0.36, 12, 8), toon(C.bone), body, -r * 0.15 - i * r * 0.24, r * 0.78 - i * r * 0.2, 0);
    p.scale.set(1.1, 0.42, 1.25);
    p.rotation.z = 0.35 + i * 0.25;
  }
  const brow = mesh(box(r * 0.3, r * 0.14, r * 0.95), toon(C.bone), body, r * 0.66, r * 0.62, 0);
  brow.rotation.z = -0.35;
  eyes(body, r, 0.15, 0.26, 0.44);
  const jaw = group(body, 'jaw', r * 0.82, -r * 0.12, 0);
  mesh(box(r * 0.3, r * 0.2, r * 0.72), toon(C.horn), jaw);
  for (let k = 0; k < 2; k++) {
    const tusk = mesh(cone(r * 0.07, r * 0.3, 8), toon(C.bone), jaw, r * 0.08, r * 0.2, (k ? 1 : -1) * r * 0.26);
    tusk.rotation.z = -0.15;
  }
  for (const side of [1, -1]) {
    const arm = group(body, side > 0 ? 'armL' : 'armR', r * 0.2, r * 0.05, side * r * 0.98);
    mesh(capsule(r * 0.14, r * 0.35), toon(C.inkStomper), arm, 0, -r * 0.28, 0);
    mesh(sph(r * 0.2, 12, 10), toon(C.horn), arm, 0.02, -r * 0.6, 0);
    // Pillar legs, each with a wide flat foot and three toenails.
    const leg = group(body, side > 0 ? 'footL' : 'footR', 0, -r * 0.62, side * r * 0.5);
    mesh(cyl(r * 0.26, r * 0.3, r * 0.5, 14), toon(C.inkStomper), leg, 0, -r * 0.1, 0);
    mesh(cyl(r * 0.36, r * 0.38, r * 0.16, 16), toon(C.horn), leg, r * 0.04, -r * 0.36, 0);
    for (let k = 0; k < 3; k++) mesh(sph(r * 0.07, 8, 6), toon(C.bone), leg, r * 0.36, -r * 0.36, (k - 1) * r * 0.16);
  }
};

/**
 * Thief: a lean, hunched shadow in a hood ('cloak') with a bandit's mask, long grabbing arms
 * ('armL'/'armR') and quick feet. Its 'sack' sits on its back, hidden until it has stolen gold.
 */
const thief: EnemyBuilder = (body, r) => {
  mesh(capsule(r * 0.62, r * 0.55), toon(C.inkThief), body, 0, 0, 0, 'skin').scale.set(1, 1, 0.9);
  const cloak = group(body, 'cloak');
  // A pointed hood flopping back over the head, open at the face.
  const hood = mesh(cone(r * 0.62, r * 1.05, 16), toon(C.inkThiefCloak), cloak, -r * 0.2, r * 0.92, 0);
  hood.rotation.z = 0.55;
  mesh(sph(r * 0.66, 18, 12), toon(C.inkThiefCloak), cloak, -r * 0.08, r * 0.35, 0).scale.set(0.95, 0.85, 1.05);
  // The mask: a dark band across the face with two bright, shifty eyes.
  mesh(cyl(r * 0.64, r * 0.64, r * 0.2, 20), toon(C.pupil), body, 0, r * 0.35, 0);
  eyes(body, r * 0.7, 0.24, 0.36, 0.5);
  const grin = mesh(torus(r * 0.2, r * 0.04, Math.PI, 14), glow(C.mouth, 1.2), body, r * 0.6, r * 0.02, 0);
  grin.rotation.set(0, Math.PI / 2, Math.PI);
  for (const side of [1, -1]) {
    const arm = group(body, side > 0 ? 'armL' : 'armR', r * 0.15, r * 0.2, side * r * 0.62);
    mesh(capsule(r * 0.1, r * 0.6), toon(C.inkThief), arm, r * 0.05, -r * 0.4, 0);
    for (let k = 0; k < 3; k++) {
      const finger = mesh(cone(r * 0.04, r * 0.18, 6), toon(C.horn), arm, r * 0.14, -r * 0.82, (k - 1) * r * 0.06);
      finger.rotation.z = -Math.PI / 2 - 0.5;
    }
    mesh(sph(r * 0.2, 12, 8), toon(C.horn), body, r * 0.12, -r * 0.82, side * r * 0.3, side > 0 ? 'footL' : 'footR').scale.set(1.5, 0.55, 0.9);
  }
  // The loot sack: a lumpy bag tied with brass, coins peeking out of its neck.
  const sack = group(body, 'sack', -r * 0.75, r * 0.3, 0);
  mesh(sph(r * 0.48, 16, 12), toon(C.sack), sack).scale.set(0.95, 1, 1.05);
  mesh(cyl(r * 0.12, r * 0.18, r * 0.2, 10), toon(C.sack), sack, r * 0.05, r * 0.5, 0);
  mesh(torus(r * 0.15, r * 0.035), toon(C.brass), sack, r * 0.05, r * 0.45, 0).rotation.x = Math.PI / 2;
  for (let k = 0; k < 3; k++) {
    const coin = mesh(cyl(r * 0.1, r * 0.1, r * 0.03, 12), gem(C.gem, 0.5), sack, r * (0.02 + k * 0.05), r * (0.64 + k * 0.03), (k - 1) * r * 0.1);
    coin.rotation.x = 0.6 + k * 0.5;
  }
  sack.visible = false;
};

/**
 * Mender: a tall robed shadow that floats over the road, holding up a lantern of yellow-green
 * Gloom light ('core'). The robe sways ('cloak'), the arms ('armL'/'armR') rise when it mends,
 * and a ring of light ('shield') blooms out around it.
 */
const mender: EnemyBuilder = (body, r) => {
  const profile = [[0, r * 1.1], [r * 0.4, r * 1.0], [r * 0.55, r * 0.55], [r * 0.62, 0], [r * 0.8, -r * 0.6], [r * 0.98, -r * 1.0], [r * 0.8, -r * 0.95], [0, -r * 0.8]]
    .map(([x, y]) => new THREE.Vector2(x, y)).reverse();
  const cloak = group(body, 'cloak');
  mesh(new THREE.LatheGeometry(profile, 22), toon(C.inkMender), cloak, 0, 0, 0, 'skin');
  // Stitched hem and a sash: the Mender sews the Gloom back together.
  mesh(torus(r * 0.9, r * 0.05, Math.PI * 2, 28), toon(C.inkMenderTrim), cloak, 0, -r * 0.94, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const st = mesh(box(r * 0.04, r * 0.16, r * 0.04), toon(C.bone), cloak, Math.cos(a) * r * 0.66, -r * 0.2, Math.sin(a) * r * 0.66);
    st.rotation.y = -a;
  }
  mesh(torus(r * 0.6, r * 0.06, Math.PI * 2, 24), toon(C.inkMenderTrim), cloak, 0, r * 0.05, 0).rotation.x = Math.PI / 2;
  // A deep hood with a calm face: half-closed glowing eyes and a small mouth.
  const hood = mesh(sph(r * 0.42, 16, 12), toon(C.pupil), body, r * 0.32, r * 0.7, 0);
  hood.scale.set(0.55, 0.9, 1);
  hood.rotation.z = -0.45;
  for (const side of [1, -1]) mesh(sph(r * 0.1, 10, 8), glow(C.mendLight, 1.6), body, r * 0.5, r * 0.78, side * r * 0.15).scale.set(1, 0.55, 1);
  // Arms in sleeves; the right holds a crook with the lantern hanging from it.
  for (const side of [1, -1]) {
    const arm = group(body, side > 0 ? 'armL' : 'armR', r * 0.1, r * 0.35, side * r * 0.62);
    mesh(cone(r * 0.2, r * 0.7, 10), toon(C.inkMender), arm, r * 0.1, -r * 0.3, 0).rotation.z = 0.3;
    mesh(sph(r * 0.1, 10, 8), toon(C.horn), arm, r * 0.22, -r * 0.62, 0);
    if (side < 0) {
      const crook = mesh(cyl(r * 0.035, r * 0.035, r * 1.7, 8), toon(C.deadwood), arm, r * 0.25, r * 0.05, 0);
      crook.rotation.z = -0.1;
      mesh(torus(r * 0.16, r * 0.035, Math.PI, 12), toon(C.deadwood), arm, r * 0.38, r * 0.88, 0);
      const lamp = group(arm, '', r * 0.54, r * 0.66, 0);
      mesh(cyl(r * 0.08, r * 0.12, r * 0.06, 10), toon(C.horn), lamp, 0, r * 0.12, 0);
      mesh(sph(r * 0.13, 12, 10), glow(C.mendLight, 1.5), lamp, 0, 0, 0, 'core');
      mesh(cyl(r * 0.12, r * 0.08, r * 0.06, 10), toon(C.horn), lamp, 0, -r * 0.12, 0);
    }
  }
  const shield = group(body, 'shield');
  const ring = mesh(torus(r * 1.5, r * 0.05, Math.PI * 2, 40), gem(C.mendLight, 0.9), shield, 0, -r * 0.9, 0);
  ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(new THREE.OctahedronGeometry(r * 0.09, 0), gem(C.mendLight, 1), shield, Math.cos(a) * r * 1.5, -r * 0.7, Math.sin(a) * r * 1.5);
  }
  shield.visible = false;
};

/**
 * What circles over a tower the Stomper has knocked out: a ring of little stars and a curl of
 * Gloom ink. The view spins it and wobbles the tower underneath.
 */
export function makeDaze(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'daze';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const star = mesh(new THREE.OctahedronGeometry(0.06, 0), glow('#fff3a8', 1.4), root, Math.cos(a) * 0.24, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.24);
    star.scale.set(1, 1.4, 1);
  }
  const curl = mesh(torus(0.17, 0.022, Math.PI * 1.5, 20), gem(C.violet, 0.5), root, 0, 0.02, 0);
  curl.rotation.x = Math.PI / 2;
  return root;
}
// ---------- end bosses ----------

const ENEMY_BUILDERS: Record<EnemyType, EnemyBuilder> = { crawler, flitter, lump, shimmer, splitter, speck, dasher, giant, stomper, thief, mender };

export function makeEnemy(type: EnemyType): THREE.Group {
  const r = ENEMIES[type].r;
  const root = new THREE.Group();
  root.name = `enemy-${type}`;
  const body = group(root, 'body');
  ENEMY_BUILDERS[type](body, r);
  statusMarkers(root, r);
  return root;
}

// ---------- the Warden ----------

const SKIN = '#f2c7a0';
// Lathe profiles run top to bottom for readability and are reversed so the faces point outward.

/** A hood over the back half of the head, open at the face. */
const hoodMat = (color: string) => cached(`hood:${color}`, () =>
  new THREE.MeshToonMaterial({ color, gradientMap: TOON_STEPS, side: THREE.DoubleSide }));

function hat(head: THREE.Object3D, loadout: Loadout) {
  const cloak = CLOAKS[loadout.cloak].color, color = HATS[loadout.hat].color;
  if (loadout.hat === 'hood') {
    mesh(new THREE.SphereGeometry(0.165, 20, 14, Math.PI * 1.5, Math.PI, 0, Math.PI * 0.72), hoodMat(cloak), head, 0.01, 0.01, 0);
    const tip = mesh(cone(0.07, 0.22, 10), toon(cloak), head, -0.16, -0.02, 0);
    tip.rotation.z = Math.PI / 2 + 0.6;
  } else if (loadout.hat === 'tricorn') {
    mesh(cyl(0.21, 0.21, 0.025, 3), toon(color), head, 0, 0.11, 0).rotation.y = Math.PI;
    mesh(cyl(0.1, 0.12, 0.1, 16), toon(color), head, -0.01, 0.17, 0);
    mesh(torus(0.115, 0.012), toon(C.brass), head, -0.01, 0.13, 0).rotation.x = Math.PI / 2;
  } else if (loadout.hat === 'wizard') {
    mesh(cyl(0.23, 0.23, 0.02, 24), toon(color), head, 0, 0.1, 0);
    const tall = mesh(cone(0.13, 0.42, 16), toon(color), head, -0.04, 0.31, 0);
    tall.rotation.z = 0.25;
    mesh(new THREE.OctahedronGeometry(0.035, 0), gem(C.lamp, 0.9), head, 0.09, 0.22, 0);
  } else {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const leaf = mesh(sph(0.05, 10, 8), toon(i % 2 ? color : '#7cc46a'), head, Math.cos(a) * 0.13, 0.1, Math.sin(a) * 0.13);
      leaf.scale.set(1.4, 0.45, 0.8);
      leaf.rotation.y = -a;
    }
    mesh(sph(0.03, 8, 6), glow('#ffd7f0', 1.2), head, 0.12, 0.12, 0.06);
  }
}

function weapon(hand: THREE.Object3D, loadout: Loadout) {
  const color = WEAPONS[loadout.weapon].color;
  if (loadout.weapon === 'staff') {
    mesh(cyl(0.018, 0.022, 0.78, 8), toon(C.wood), hand, 0, 0.22, 0);
    mesh(torus(0.04, 0.01), toon(C.brass), hand, 0, 0.58, 0).rotation.x = Math.PI / 2;
    const l = lantern(hand, color, 0.7);
    l.position.y = 0.72;
    // Bolts leave from the lantern at the staff's head.
    group(hand, 'muzzle', 0, 0.72, 0);
  } else if (loadout.weapon === 'bell') {
    mesh(cyl(0.018, 0.018, 0.16, 8), toon(C.wood), hand, 0, 0.06, 0);
    const profile = [[0.01, 0.16], [0.05, 0.15], [0.07, 0.08], [0.09, 0.0], [0.11, -0.02], [0.0, -0.01]].map(([x, y]) => new THREE.Vector2(x, y)).reverse();
    mesh(new THREE.LatheGeometry(profile, 20), toon(C.brass), hand, 0, -0.14, 0);
    mesh(sph(0.025, 8, 6), glow(color, 1.8), hand, 0, -0.17, 0, 'core');
    group(hand, 'muzzle', 0, -0.17, 0);
  } else {
    mesh(cyl(0.018, 0.02, 0.22, 8), toon(C.wood), hand, 0, 0.08, 0);
    for (const z of [-1, 1]) {
      const prong = mesh(cyl(0.014, 0.016, 0.14, 8), toon(C.wood), hand, 0, 0.24, z * 0.035);
      prong.rotation.x = z * 0.35;
    }
    mesh(box(0.012, 0.012, 0.11), toon(C.cloth), hand, 0, 0.3, 0);
    mesh(sph(0.03, 10, 8), gem(color, 0.8), hand, 0.03, 0.3, 0, 'core');
    // Stones leave from the sling's pouch.
    group(hand, 'muzzle', 0.03, 0.3, 0);
  }
}

function charm(body: THREE.Object3D, loadout: Loadout) {
  const color = CHARMS[loadout.charm].color;
  if (loadout.charm === 'ember') mesh(new THREE.OctahedronGeometry(0.035, 0), glow(color, 1.6), body, 0.17, 0.3, -0.05);
  else if (loadout.charm === 'badge') {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.02 : 0.045, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const s = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.012, bevelEnabled: false }), toon(color), body, 0.19, 0.42, -0.07);
    s.rotation.y = Math.PI / 2;
  } else if (loadout.charm === 'jar') {
    mesh(cyl(0.035, 0.035, 0.07, 12), glow('#d8f4ff', 0.6, 0.45), body, 0.15, 0.27, -0.09);
    mesh(cyl(0.03, 0.03, 0.015, 12), toon(C.wood), body, 0.15, 0.31, -0.09);
    mesh(sph(0.014, 8, 6), glow(color, 2), body, 0.15, 0.27, -0.09, 'core');
  }
}

/**
 * The Warden in a given loadout: a small cloaked figure facing +x on a stone post marker.
 * Named parts for the view: 'aim' turns to the target, 'body' bobs, 'cloak' sways, 'arm' swings
 * on attack and lifts on an ability, 'core' flares, and shots leave from the weapon's 'muzzle'.
 */
export function makeHero(loadout: Loadout): THREE.Group {
  const root = new THREE.Group();
  root.name = 'hero';
  patch(root, C.dirtB, 0.28);
  const aim = group(root, 'aim', 0, 0.05, 0);
  const body = group(aim, 'body');
  const cloakColor = CLOAKS[loadout.cloak].color;
  for (const z of [-0.06, 0.06]) mesh(capsule(0.04, 0.08), toon(C.woodDark), body, 0.01, 0.07, z);
  const cloak = group(body, 'cloak', 0, 0, 0);
  const profile = [[0.0, 0.48], [0.09, 0.47], [0.14, 0.4], [0.16, 0.26], [0.2, 0.12], [0.23, 0.08], [0.0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y)).reverse();
  mesh(new THREE.LatheGeometry(profile, 24), toon(cloakColor), cloak);
  mesh(torus(0.155, 0.018), toon(C.woodDark), body, 0, 0.29, 0).rotation.x = Math.PI / 2;
  mesh(box(0.03, 0.04, 0.04), toon(C.brass), body, 0.155, 0.29, 0);
  charm(body, loadout);
  const head = group(body, 'head', 0.02, 0.6, 0);
  mesh(sph(0.13, 20, 16), toon(SKIN), head);
  for (const z of [-0.045, 0.045]) mesh(sph(0.018, 8, 6), toon('#2a1c2c'), head, 0.118, 0.015, z);
  mesh(sph(0.022, 8, 6), toon('#e8a98a'), head, 0.13, -0.02, 0);
  hat(head, loadout);
  const arm = group(body, 'arm', 0.02, 0.42, 0.15);
  mesh(capsule(0.035, 0.14), toon(cloakColor), arm, 0.03, -0.08, 0).rotation.z = -0.4;
  const hand = group(arm, 'hand', 0.08, -0.17, 0.01);
  mesh(sph(0.035, 10, 8), toon(SKIN), hand);
  weapon(hand, loadout);
  const other = mesh(capsule(0.035, 0.14), toon(cloakColor), body, 0.02, 0.34, -0.16);
  other.rotation.x = -0.2;
  return root;
}

// ---------- landmarks ----------

/** The Hearthstone: a great lantern on a stepped plinth. Its flame has its own material so lives can dim it. */
export function makeHeart(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'heart';
  // A stone column standing in trodden village ground, ringed with cobbles.
  patch(root, C.dirtB, 0.5);
  rockRing(root, 9, 0.36, 0.08, 0.3);
  mesh(cyl(0.2, 0.28, 0.46, 12), toon(C.stoneLight), root, 0, 0.23, 0);
  mesh(cyl(0.24, 0.22, 0.05, 12), toon(C.stone), root, 0, 0.46, 0);
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

/** Tiles of scenery around the playable board, so any screen shape is filled with land, not sky. */
export const MARGIN = 3;
/** Tile (tx, ty) centre in world units. One tile is one unit; the board is centred on the origin. */
export const tileToWorld = (tx: number, ty: number) => ({ x: tx + 0.5 - COLS / 2, z: ty + 0.5 - ROWS / 2 });

/** Road centreline in world units, with each corner rounded into a short curve. */
export function roadCurve(map: MapDef, radius = 0.45): THREE.Vector2[] {
  const pts = map.pts.map(([tx, ty]) => { const w = tileToWorld(tx, ty); return new THREE.Vector2(w.x, w.z); });
  // The road visibly runs on behind the rift to the edge of the island.
  const back = pts[0].clone().sub(pts[1]).normalize();
  const out: THREE.Vector2[] = [pts[0].clone().addScaledVector(back, MARGIN + 2), pts[0].clone()];
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
