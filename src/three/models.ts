// Low-poly models built from primitives. No DOM access, so scripts/export-models.mjs
// can run these in Node and write them out as .glb files.
import * as THREE from 'three';
import { COLS, ROWS } from '../config';
import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import type { Branch, EnemyType, MapDef, TowerType } from '../types';

export const C = {
  stone: '#5a5a72', stoneLight: '#71718c', stoneDark: '#3c3c52',
  wood: '#6e4b33', woodDark: '#4a3122', iron: '#363946',
  grassA: '#2d4b3a', grassB: '#3a5a40', grassEdge: '#26402f',
  dirt: '#a08a6a', dirtB: '#8e785b', cliff: '#3a2c33', cliffDeep: '#221a26',
  leaf: '#1f5a4a', leafAlt: '#2a6b4f', leafDark: '#18463c', leafRound: '#2f6a46',
  lamp: '#ffb547', gem: '#ffcf7a',
};

const cache = new Map<string, THREE.Material>();

/** Smooth-shaded by default; pass flat for things that should look faceted, like rocks. */
export function matte(color: string, roughness = 0.9, flat = false): THREE.MeshStandardMaterial {
  const key = `m:${color}:${roughness}:${flat}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: flat });
    cache.set(key, m);
  }
  return m;
}

/** Self-lit material; intensities above 1 feed the bloom pass. */
export function glow(color: string, intensity = 2.2, opacity = 1, flat = false): THREE.MeshStandardMaterial {
  const key = `g:${color}:${intensity}:${opacity}:${flat}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: intensity, flatShading: flat,
      transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
    });
    cache.set(key, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  const lit = (mat as THREE.MeshStandardMaterial).emissiveIntensity ?? 0;
  m.castShadow = lit < 0.5;
  m.receiveShadow = true;
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

/** A cylinder with a softened top edge, for bases and pedestals. */
function pedestal(parent: THREE.Object3D, r: number, h: number, y: number, mat: THREE.Material) {
  mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 24), mat, parent, 0, y + h / 2, 0);
  const lip = mesh(new THREE.TorusGeometry(r - 0.02, 0.025, 8, 24), mat, parent, 0, y + h, 0);
  lip.rotation.x = Math.PI / 2;
}

// ---------- towers ----------

type TowerBuilder = (root: THREE.Group, head: THREE.Group, level: number, branch: Branch, color: string) => void;

const sparkTower: TowerBuilder = (root, head, level, branch, color) => {
  const h = 0.42 + level * 0.04 + (branch === 1 ? 0.18 : 0);
  mesh(new THREE.CylinderGeometry(0.045, 0.065, h, 10), matte(C.wood), root, 0, 0.26 + h / 2, 0);
  head.position.y = 0.26 + h + 0.13;
  mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), matte(C.iron, 0.6), head, 0, -0.13, 0);
  mesh(new THREE.ConeGeometry(0.13, 0.12, 16), matte(C.iron, 0.6), head, 0, 0.17, 0);
  mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 12), matte(C.iron, 0.6), head, 0, 0.26, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), matte(C.iron, 0.6), head, Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11);
  }
  mesh(new THREE.SphereGeometry(0.08, 16, 12), glow(color, 3.2), head, 0, 0, 0, 'core');
  mesh(new THREE.SphereGeometry(0.13, 16, 12), glow(color, 0.8, 0.18), head, 0, 0, 0);
  const spoutLength = branch === 1 ? 0.36 : 0.2;
  const spouts = branch === 0 ? [-0.06, 0.06] : [0];
  for (const z of spouts) {
    const s = mesh(new THREE.CylinderGeometry(0.022, 0.032, spoutLength, 10), matte(C.iron, 0.6), head, 0.12 + spoutLength / 2, 0, z);
    s.rotation.z = Math.PI / 2;
  }
};

const frostTower: TowerBuilder = (root, head, level, branch, color) => {
  pedestal(root, 0.2, 0.12, 0.26, matte(C.stoneDark));
  const s = 1 + level * 0.06;
  // Ice keeps its facets on purpose.
  const ice = glow(color, 1.5, 0.92, true);
  const main = mesh(new THREE.OctahedronGeometry(0.15 * s, 0), ice, head, 0, 0.72 * s, 0, 'core');
  main.scale.y = 2.4;
  const shards = branch === 0 ? 5 : 3;
  for (let i = 0; i < shards; i++) {
    const a = (i / shards) * Math.PI * 2;
    const c = mesh(new THREE.OctahedronGeometry(0.075 * s, 0), ice, head, Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16);
    c.scale.y = 2;
    c.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
  }
  if (branch === 0) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      mesh(new THREE.IcosahedronGeometry(0.06, 0), glow('#d6f3ff', 1.1, 0.85, true), root, Math.cos(a) * 0.3, 0.32, Math.sin(a) * 0.3)
        .rotation.set(0.5, a, 0.3);
    }
  }
  if (branch === 1) {
    const mist = mesh(new THREE.TorusGeometry(0.34, 0.06, 10, 32), glow('#cfe9ff', 0.9, 0.35), root, 0, 0.45, 0, 'mist');
    mist.rotation.x = Math.PI / 2;
  }
};

const pulseTower: TowerBuilder = (root, head, level, branch, color) => {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 8), matte(C.iron, 0.6), root, Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15);
    leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
  }
  const bowlR = 0.27 + level * 0.015;
  mesh(new THREE.SphereGeometry(bowlR, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matte(C.iron, 0.5), root, 0, 0.7, 0);
  const rim = mesh(new THREE.TorusGeometry(bowlR, 0.025, 8, 24), matte('#4a4d5c', 0.5), root, 0, 0.7, 0);
  rim.rotation.x = Math.PI / 2;
  const coals = mesh(new THREE.CircleGeometry(bowlR - 0.02, 24), glow('#ff4a1c', 1.6), root, 0, 0.69, 0);
  coals.rotation.x = -Math.PI / 2;
  head.position.y = 0.7;
  const flame = group(head, 'flame');
  mesh(new THREE.ConeGeometry(0.13, 0.42, 12), glow('#ffb347', 3), flame, 0, 0.21, 0);
  mesh(new THREE.ConeGeometry(0.08, 0.3, 10), glow('#fff0b8', 3.4), flame, 0.03, 0.17, 0.02);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    mesh(new THREE.ConeGeometry(0.07, 0.24, 10), glow(color, 2.6), flame, Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1);
  }
  if (branch === 0) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(new THREE.SphereGeometry(0.035, 8, 6), glow('#ff3b1f', 2.5), root, Math.cos(a) * 0.24, 0.73, Math.sin(a) * 0.24);
    }
  }
  if (branch === 1) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1;
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), matte(C.iron, 0.6), root, Math.cos(a) * 0.3, 0.85, Math.sin(a) * 0.3);
      mesh(new THREE.SphereGeometry(0.05, 10, 8), glow('#bfe4ff', 3), root, Math.cos(a) * 0.3, 1.12, Math.sin(a) * 0.3, 'spark');
    }
  }
};

const starTower: TowerBuilder = (root, head, level, branch, color) => {
  mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.38, 20), matte(C.stoneLight), root, 0, 0.45, 0);
  mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), matte(C.stoneDark), root, 0, 0.64, 0);
  head.position.y = 0.76;
  const tube = group(head, 'tube');
  tube.rotation.z = 0.55;
  const big = branch === 0 ? 1.3 : 1;
  const barrel = mesh(new THREE.CylinderGeometry(0.06 * big, 0.1 * big, 0.6 + level * 0.03, 16), matte('#3d3b5c', 0.5), tube, 0.18, 0, 0);
  barrel.rotation.z = -Math.PI / 2;
  const lens = mesh(new THREE.CylinderGeometry(0.1 * big, 0.1 * big, 0.03, 16), glow(color, 1.8), tube, 0.5 + level * 0.015, 0, 0);
  lens.rotation.z = -Math.PI / 2;
  const spin = group(root, 'spin', 0, 1.25, 0);
  mesh(new THREE.OctahedronGeometry(0.1, 0), glow(color, 3.2, 1, true), spin);
  const ring = mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 32), glow(color, 1.6), spin);
  ring.rotation.x = Math.PI / 2.4;
  if (branch === 1) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      mesh(new THREE.OctahedronGeometry(0.04, 0), glow('#e8dcff', 3, 1, true), spin, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    }
  }
};

const TOWER_BUILDERS: Record<TowerType, TowerBuilder> = { spark: sparkTower, frost: frostTower, pulse: pulseTower, star: starTower };

export function makeTower(type: TowerType, level = 1, branch: Branch = null): THREE.Group {
  const root = new THREE.Group();
  root.name = `tower-${type}`;
  const color = TOWERS[type].color;
  pedestal(root, 0.36, 0.18, 0, matte(C.stone));
  mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 24), matte(C.stoneLight), root, 0, 0.21, 0);
  // One gem per level around the base; branch levels take the tower's colour.
  for (let i = 0; i < level; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.04, 10, 8), glow(i >= 3 && branch !== null ? color : C.gem, 2.4), root,
      Math.cos(a) * 0.4, 0.11, Math.sin(a) * 0.4);
  }
  const head = group(root, 'head');
  TOWER_BUILDERS[type](root, head, level, branch, color);
  const badge = mesh(new THREE.OctahedronGeometry(0.09, 0), glow(C.lamp, 3.4, 1, true), root, 0, 1.5, 0, 'badge');
  badge.visible = false;
  return root;
}

// ---------- enemies ----------

export function makeEnemy(type: EnemyType): THREE.Group {
  const d = ENEMIES[type], r = d.r;
  const root = new THREE.Group();
  root.name = `enemy-${type}`;
  const body = group(root, 'body');
  const skin = matte(d.color, 0.5);
  mesh(new THREE.SphereGeometry(r, 20, 14), skin, body, 0, 0, 0, 'blob');

  if (type === 'lump') {
    mesh(new THREE.SphereGeometry(r * 0.55, 16, 12), skin, body, -r * 0.5, r * 0.45, r * 0.3);
    mesh(new THREE.SphereGeometry(r * 0.45, 16, 12), skin, body, -r * 0.3, r * 0.3, -r * 0.55);
  }
  if (type === 'flitter') {
    for (const side of [1, -1]) {
      const pivot = group(body, side > 0 ? 'wingL' : 'wingR', 0, r * 0.2, side * r * 0.6);
      const wing = mesh(new THREE.CircleGeometry(r * 0.9, 16), glow('#58d1c0', 0.5, 0.75), pivot, -r * 0.1, 0, side * r * 0.8);
      wing.rotation.x = -Math.PI / 2;
      wing.scale.set(0.8, 1, 1);
      (wing.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    }
  }
  if (type === 'shimmer') {
    mesh(new THREE.SphereGeometry(r * 1.35, 20, 14), glow('#8fb4ff', 0.7, 0.22), body, 0, 0, 0, 'shell');
  }
  if (type === 'giant') {
    const dark = matte('#24183a', 0.6);
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      const spike = mesh(new THREE.ConeGeometry(r * 0.16, r * 0.7, 10), dark, body, -r * 0.35, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      spike.rotation.x = a;
    }
    for (const side of [1, -1]) {
      const horn = mesh(new THREE.ConeGeometry(r * 0.1, r * 0.55, 10), matte('#d8c7a8', 0.5), body, r * 0.45, r * 0.75, side * r * 0.45);
      horn.rotation.set(side * 0.5, 0, -0.5);
    }
  }
  // Eyes face +x, the direction of travel.
  const er = Math.max(0.03, r * 0.15);
  for (const side of [1, -1]) {
    mesh(new THREE.SphereGeometry(er, 10, 8), glow(d.eye, type === 'giant' ? 3.4 : 2.6), body, r * 0.82, r * 0.18, side * r * 0.34);
  }

  const slow = mesh(new THREE.TorusGeometry(r * 1.15, 0.025, 8, 24), glow('#8fd3ff', 2, 0.85), root, 0, 0, 0, 'slow');
  slow.rotation.x = Math.PI / 2;
  slow.visible = false;
  const burn = mesh(new THREE.ConeGeometry(r * 0.3, r * 0.8, 10), glow('#ff7a3c', 3), root, 0, r * 1.2, 0, 'burn');
  burn.visible = false;
  const stun = group(root, 'stun', 0, r * 1.4, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mesh(new THREE.OctahedronGeometry(0.04, 0), glow('#fff3a8', 3, 1, true), stun, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8);
  }
  stun.visible = false;
  return root;
}

// ---------- landmarks ----------

/** The heart the player defends. Its orb gets its own material so lives can tint it. */
export function makeHeart(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'heart';
  pedestal(root, 0.44, 0.16, 0, matte(C.stone));
  mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 20), matte(C.stoneLight), root, 0, 0.42, 0);
  const orbMat = new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ffb35c', emissiveIntensity: 3 });
  mesh(new THREE.SphereGeometry(0.2, 24, 16), orbMat, root, 0, 0.9, 0, 'orb');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const bar = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 8), matte(C.iron, 0.6), root, Math.cos(a) * 0.27, 0.9, Math.sin(a) * 0.27);
    bar.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
  }
  // An open crown instead of a roof, so the orb stays visible from above.
  const crown = mesh(new THREE.TorusGeometry(0.27, 0.03, 8, 24), matte(C.iron, 0.6), root, 0, 1.16, 0);
  crown.rotation.x = Math.PI / 2;
  return root;
}

export function makePortal(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'portal';
  // A stone arch: half a torus standing on two stumps.
  const arch = mesh(new THREE.TorusGeometry(0.42, 0.09, 10, 24, Math.PI), matte(C.stoneDark), root, 0, 0.45, 0);
  arch.rotation.y = Math.PI / 2;
  for (const z of [-0.42, 0.42]) mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.45, 12), matte(C.stoneDark), root, 0, 0.225, z);
  const swirl = mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 32), glow('#8a5cff', 2.2), root, 0, 0.45, 0, 'swirl');
  swirl.rotation.y = Math.PI / 2;
  const fill = mesh(new THREE.CircleGeometry(0.3, 24), glow('#2a1050', 0.8, 0.85), root, 0, 0.45, 0);
  fill.rotation.y = Math.PI / 2;
  return root;
}

// ---------- scenery ----------

export function makeTree(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'tree';
  const s = 0.75 + rnd() * 0.5;
  mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.4 * s, 8), matte(C.woodDark), root, 0, 0.2 * s, 0);
  if (rnd() < 0.5) {
    // Round leafy tree.
    const tone = [C.leafRound, C.leafAlt, C.leaf][Math.floor(rnd() * 3)];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rnd();
      const r = (0.22 + rnd() * 0.08) * s;
      mesh(new THREE.SphereGeometry(r, 14, 10), matte(tone, 0.95), root, Math.cos(a) * 0.12 * s, (0.5 + rnd() * 0.1) * s, Math.sin(a) * 0.12 * s);
    }
    mesh(new THREE.SphereGeometry(0.24 * s, 14, 10), matte(tone, 0.95), root, 0, 0.7 * s, 0);
  } else {
    // Fir, softened with more segments and stacked tiers.
    const tones = [C.leaf, C.leafAlt, C.leafDark];
    for (let i = 0; i < 3; i++) {
      mesh(new THREE.ConeGeometry((0.36 - i * 0.09) * s, 0.42 * s, 14), matte(tones[(i + Math.floor(rnd() * 3)) % 3], 0.95), root,
        0, (0.4 + i * 0.22) * s, 0);
    }
  }
  return root;
}

export function makeRock(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'rock';
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.1 + rnd() * 0.14;
    const rock = mesh(new THREE.DodecahedronGeometry(s, 1), matte(i % 2 ? C.stone : C.stoneDark, 0.95), root, (rnd() - 0.5) * 0.4, s * 0.5, (rnd() - 0.5) * 0.4);
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
    mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 8), matte('#d8cfc0'), root, x, h / 2, z);
    mesh(new THREE.SphereGeometry(0.045, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), glow('#5fe0c8', 1.6), root, x, h, z);
  }
  return root;
}

export function makeWindmill(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'windmill';
  mesh(new THREE.CylinderGeometry(0.32, 0.48, 1.3, 20), matte('#7a6f68'), root, 0, 0.65, 0);
  mesh(new THREE.ConeGeometry(0.42, 0.45, 20), matte('#4b2f2a'), root, 0, 1.52, 0);
  mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), glow(C.lamp, 1.8), root, 0, 0.5, 0.47);
  const blades = group(root, 'blades', 0, 1.2, 0.42);
  for (let i = 0; i < 4; i++) {
    const arm = group(blades, '');
    arm.rotation.z = (i / 4) * Math.PI * 2;
    mesh(new THREE.BoxGeometry(0.06, 0.95, 0.03), matte(C.wood), arm, 0, 0.48, 0);
    mesh(new THREE.BoxGeometry(0.2, 0.6, 0.015), matte('#b9a98f'), arm, 0.12, 0.58, 0);
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
    const roadMix = 1 - smoothstep(ROAD_HALF, ROAD_HALF + 0.14, road);
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

  const W = COLS + MARGIN * 2 + 1.4, D = ROWS + MARGIN * 2 + 1.4, RES = 6;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W * RES), Math.round(D * RES));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color(C.grassA), grassB = new THREE.Color(C.grassB), edgeGrass = new THREE.Color(C.grassEdge);
  const dirt = new THREE.Color(C.dirt), dirtB = new THREE.Color(C.dirtB), cliff = new THREE.Color(C.cliff), deep = new THREE.Color(C.cliffDeep);
  const col = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const s = sample(x, z);
    pos.setY(i, s.h);
    col.copy(grassA).lerp(grassB, s.n * 0.5 + 0.5);
    col.lerp(edgeGrass, smoothstep(0, 0.8, s.outside) * 0.6);
    tmp.copy(dirt).lerp(dirtB, s.n * 0.5 + 0.5);
    col.lerp(tmp, s.roadMix);
    tmp.copy(cliff).lerp(deep, smoothstep(0.4, 1, s.edge));
    col.lerp(tmp, smoothstep(0.05, 0.4, s.edge));
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.name = 'ground';
  ground.receiveShadow = true;
  root.add(ground);
  // A dark underside so the island never shows a hole from low angles.
  const under = mesh(new THREE.CylinderGeometry(1, 1, 0.2, 32), matte(C.cliffDeep), root, 0, -1.35, 0);
  under.scale.set(W / 2 - 0.6, 1, D / 2 - 0.6);
  under.castShadow = false;

  // Pebbles scattered along the road.
  const curve = roadCurve(map);
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1], len = a.distanceTo(b);
    for (let d = 0; d < len; d += 0.5) {
      if (rnd() < 0.45) continue;
      const t = d / len, side = (rnd() - 0.5) * ROAD_HALF * 2;
      const px = a.x + (b.x - a.x) * t - ((b.y - a.y) / len) * side, pz = a.y + (b.y - a.y) * t + ((b.x - a.x) / len) * side;
      const p = mesh(new THREE.DodecahedronGeometry(0.025 + rnd() * 0.03, 0), matte(C.stone, 0.95, true), root, px, sample(px, pz).h + 0.01, pz);
      p.castShadow = false;
    }
  }

  // Scenery in the margin, plus a few mushrooms on open tiles inside the board.
  const millTile = map.id === 'mill' ? `${COLS - 1},${-1}` : '';
  for (let ty = -MARGIN; ty < ROWS + MARGIN; ty++) {
    for (let tx = -MARGIN; tx < COLS + MARGIN; tx++) {
      const { x, z } = tileToWorld(tx, ty);
      const s = sample(x, z);
      if (s.road < 0.75 || s.edge > 0.02) continue;
      const inside = tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
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
        if (v < 0.55) obj = makeTree(rnd);
        else if (v < 0.75) obj = makeRock(rnd);
        else if (v < 0.85) obj = makeMushrooms(rnd);
      } else if (rnd() < 0.08) {
        // Keep plants to the tile corner so towers can still stand there.
        obj = makeMushrooms(rnd);
        obj.scale.setScalar(0.7);
        obj.position.set(x + 0.36, 0, z + 0.36);
        root.add(obj);
        continue;
      }
      if (obj) {
        const ox = x + (rnd() - 0.5) * 0.3, oz = z + (rnd() - 0.5) * 0.3;
        obj.position.set(ox, sample(ox, oz).h, oz);
        obj.rotation.y = rnd() * Math.PI * 2;
        root.add(obj);
      }
    }
  }
  return root;
}
