// Low-poly models built from primitives. No DOM access, so scripts/export-models.mjs
// can run these in Node and write them out as .glb files.
import * as THREE from 'three';
import { COLS, ROWS } from '../config';
import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import type { Branch, EnemyType, MapDef, TowerType } from '../types';

export const C = {
  stone: '#56566e', stoneLight: '#6c6c88', stoneDark: '#3a3a50',
  wood: '#6e4b33', woodDark: '#4a3122', iron: '#363946',
  grass: '#2c4a3a', grassAlt: '#2f4e3c', grassEdge: '#22392d',
  dirt: '#8a6a50', dirtDark: '#3c2d27', cliff: '#2a2130',
  leaf: '#1f5a4a', leafAlt: '#2a6b4f', leafDark: '#18463c',
  lamp: '#ffb547', gem: '#ffcf7a', shadow: '#2b1d40',
};

const cache = new Map<string, THREE.Material>();

export function matte(color: string, roughness = 0.9): THREE.MeshStandardMaterial {
  const key = `m:${color}:${roughness}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    cache.set(key, m);
  }
  return m;
}

/** Self-lit material; intensities above 1 feed the bloom pass. */
export function glow(color: string, intensity = 2.2, opacity = 1): THREE.MeshStandardMaterial {
  const key = `g:${color}:${intensity}:${opacity}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: intensity, flatShading: true,
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

// ---------- towers ----------

type TowerBuilder = (root: THREE.Group, head: THREE.Group, level: number, branch: Branch, color: string) => void;

const sparkTower: TowerBuilder = (root, head, level, branch, color) => {
  const h = 0.42 + level * 0.04 + (branch === 1 ? 0.18 : 0);
  mesh(new THREE.CylinderGeometry(0.045, 0.065, h, 6), matte(C.wood), root, 0, 0.26 + h / 2, 0);
  mesh(new THREE.BoxGeometry(0.26, 0.03, 0.04), matte(C.woodDark), root, 0, 0.26 + h - 0.04, 0);
  head.position.y = 0.26 + h + 0.13;
  mesh(new THREE.BoxGeometry(0.22, 0.04, 0.22), matte(C.iron), head, 0, -0.13, 0);
  const roof = mesh(new THREE.ConeGeometry(0.19, 0.16, 4), matte(C.iron), head, 0, 0.16, 0);
  roof.rotation.y = Math.PI / 4;
  mesh(new THREE.TorusGeometry(0.035, 0.012, 4, 8), matte(C.iron), head, 0, 0.26, 0);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    mesh(new THREE.BoxGeometry(0.025, 0.24, 0.025), matte(C.iron), head, x * 0.095, 0, z * 0.095);
  }
  mesh(new THREE.IcosahedronGeometry(0.08, 0), glow(color, 3.2), head, 0, 0, 0, 'core');
  mesh(new THREE.IcosahedronGeometry(0.13, 1), glow(color, 0.8, 0.18), head, 0, 0, 0);
  const spoutLength = branch === 1 ? 0.36 : 0.2;
  const spouts = branch === 0 ? [-0.06, 0.06] : [0];
  for (const z of spouts) {
    const s = mesh(new THREE.CylinderGeometry(0.022, 0.032, spoutLength, 6), matte(C.iron), head, 0.11 + spoutLength / 2, 0, z);
    s.rotation.z = Math.PI / 2;
  }
};

const frostTower: TowerBuilder = (root, head, level, branch, color) => {
  mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.14, 6), matte(C.stoneDark), root, 0, 0.3, 0);
  const s = 1 + level * 0.06;
  const ice = glow(color, 1.5, 0.92);
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
      mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), glow('#d6f3ff', 1.1, 0.85), root, Math.cos(a) * 0.3, 0.32, Math.sin(a) * 0.3)
        .rotation.set(0.5, a, 0.3);
    }
  }
  if (branch === 1) {
    const mist = mesh(new THREE.TorusGeometry(0.34, 0.06, 6, 18), glow('#cfe9ff', 0.9, 0.35), root, 0, 0.45, 0, 'mist');
    mist.rotation.x = Math.PI / 2;
  }
};

const pulseTower: TowerBuilder = (root, head, level, branch, color) => {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 5), matte(C.iron), root, Math.cos(a) * 0.15, 0.4, Math.sin(a) * 0.15);
    leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
  }
  const bowlR = 0.27 + level * 0.015;
  mesh(new THREE.CylinderGeometry(bowlR, 0.14, 0.2, 8), matte(C.iron, 0.6), root, 0, 0.6, 0);
  const rim = mesh(new THREE.TorusGeometry(bowlR, 0.025, 4, 8), matte('#4a4d5c', 0.6), root, 0, 0.7, 0);
  rim.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(bowlR - 0.03, bowlR - 0.03, 0.03, 8), glow('#ff4a1c', 1.6), root, 0, 0.69, 0);
  head.position.y = 0.7;
  const flame = group(head, 'flame');
  mesh(new THREE.ConeGeometry(0.13, 0.42, 6), glow('#ffb347', 3), flame, 0, 0.21, 0);
  mesh(new THREE.ConeGeometry(0.08, 0.3, 5), glow('#fff0b8', 3.4), flame, 0.03, 0.17, 0.02);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    mesh(new THREE.ConeGeometry(0.07, 0.24, 5), glow(color, 2.6), flame, Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1);
  }
  if (branch === 0) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(new THREE.IcosahedronGeometry(0.035, 0), glow('#ff3b1f', 2.5), root, Math.cos(a) * 0.24, 0.73, Math.sin(a) * 0.24);
    }
  }
  if (branch === 1) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 1;
      mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 5), matte(C.iron), root, Math.cos(a) * 0.3, 0.85, Math.sin(a) * 0.3);
      mesh(new THREE.OctahedronGeometry(0.05, 0), glow('#bfe4ff', 3), root, Math.cos(a) * 0.3, 1.12, Math.sin(a) * 0.3, 'spark');
    }
  }
};

const starTower: TowerBuilder = (root, head, level, branch, color) => {
  mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.38, 8), matte(C.stoneLight), root, 0, 0.45, 0);
  mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.08, 8), matte(C.stoneDark), root, 0, 0.66, 0);
  head.position.y = 0.76;
  const tube = group(head, 'tube');
  tube.rotation.z = 0.55;
  const big = branch === 0 ? 1.3 : 1;
  const barrel = mesh(new THREE.CylinderGeometry(0.06 * big, 0.1 * big, 0.6 + level * 0.03, 8), matte('#3d3b5c', 0.5), tube, 0.18, 0, 0);
  barrel.rotation.z = -Math.PI / 2;
  const lens = mesh(new THREE.CylinderGeometry(0.1 * big, 0.1 * big, 0.03, 8), glow(color, 1.8), tube, 0.5 + level * 0.015, 0, 0);
  lens.rotation.z = -Math.PI / 2;
  const spin = group(root, 'spin', 0, 1.25, 0);
  mesh(new THREE.OctahedronGeometry(0.1, 0), glow(color, 3.2), spin);
  const ring = mesh(new THREE.TorusGeometry(0.17, 0.012, 4, 16), glow(color, 1.6), spin);
  ring.rotation.x = Math.PI / 2.4;
  if (branch === 1) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      mesh(new THREE.OctahedronGeometry(0.04, 0), glow('#e8dcff', 3), spin, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    }
  }
};

const TOWER_BUILDERS: Record<TowerType, TowerBuilder> = { spark: sparkTower, frost: frostTower, pulse: pulseTower, star: starTower };

export function makeTower(type: TowerType, level = 1, branch: Branch = null): THREE.Group {
  const root = new THREE.Group();
  root.name = `tower-${type}`;
  const color = TOWERS[type].color;
  mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.2, 6), matte(C.stone), root, 0, 0.1, 0);
  mesh(new THREE.CylinderGeometry(0.29, 0.34, 0.06, 6), matte(C.stoneLight), root, 0, 0.23, 0);
  // One gem per level around the base; branch levels take the tower's colour.
  for (let i = 0; i < level; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
    mesh(new THREE.OctahedronGeometry(0.04, 0), glow(i >= 3 && branch !== null ? color : C.gem, 2.4), root,
      Math.cos(a) * 0.38, 0.12, Math.sin(a) * 0.38);
  }
  const head = group(root, 'head');
  TOWER_BUILDERS[type](root, head, level, branch, color);
  const badge = mesh(new THREE.OctahedronGeometry(0.09, 0), glow(C.lamp, 3.4), root, 0, 1.5, 0, 'badge');
  badge.visible = false;
  return root;
}

// ---------- enemies ----------

export function makeEnemy(type: EnemyType): THREE.Group {
  const d = ENEMIES[type], r = d.r;
  const root = new THREE.Group();
  root.name = `enemy-${type}`;
  const body = group(root, 'body');
  const skin = matte(d.color, 0.55);
  mesh(new THREE.IcosahedronGeometry(r, 1), skin, body, 0, 0, 0, 'blob');

  if (type === 'lump') {
    mesh(new THREE.IcosahedronGeometry(r * 0.55, 1), skin, body, -r * 0.5, r * 0.45, r * 0.3);
    mesh(new THREE.IcosahedronGeometry(r * 0.45, 1), skin, body, -r * 0.3, r * 0.3, -r * 0.55);
  }
  if (type === 'flitter') {
    for (const side of [1, -1]) {
      const pivot = group(body, side > 0 ? 'wingL' : 'wingR', 0, r * 0.2, side * r * 0.6);
      const wing = mesh(new THREE.BoxGeometry(r * 1.4, 0.015, r * 1.6), glow('#58d1c0', 0.5, 0.75), pivot, -r * 0.1, 0, side * r * 0.8);
      wing.rotation.y = side * 0.3;
    }
  }
  if (type === 'shimmer') {
    mesh(new THREE.IcosahedronGeometry(r * 1.35, 1), glow('#8fb4ff', 0.7, 0.22), body, 0, 0, 0, 'shell');
  }
  if (type === 'giant') {
    const dark = matte('#24183a', 0.6);
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      const spike = mesh(new THREE.ConeGeometry(r * 0.16, r * 0.7, 5), dark, body, -r * 0.35, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      spike.rotation.x = a;
    }
    for (const side of [1, -1]) {
      const horn = mesh(new THREE.ConeGeometry(r * 0.1, r * 0.55, 5), matte('#d8c7a8', 0.5), body, r * 0.45, r * 0.75, side * r * 0.45);
      horn.rotation.set(side * 0.5, 0, -0.5);
    }
  }
  // Eyes face +x, the direction of travel.
  const er = Math.max(0.03, r * 0.15);
  for (const side of [1, -1]) {
    mesh(new THREE.SphereGeometry(er, 8, 6), glow(d.eye, type === 'giant' ? 3.4 : 2.6), body, r * 0.82, r * 0.18, side * r * 0.34);
  }

  const slow = mesh(new THREE.TorusGeometry(r * 1.15, 0.025, 4, 16), glow('#8fd3ff', 2, 0.85), root, 0, 0, 0, 'slow');
  slow.rotation.x = Math.PI / 2;
  slow.visible = false;
  const burn = mesh(new THREE.ConeGeometry(r * 0.3, r * 0.8, 5), glow('#ff7a3c', 3), root, 0, r * 1.2, 0, 'burn');
  burn.visible = false;
  const stun = group(root, 'stun', 0, r * 1.4, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    mesh(new THREE.OctahedronGeometry(0.04, 0), glow('#fff3a8', 3), stun, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8);
  }
  stun.visible = false;
  return root;
}

// ---------- landmarks ----------

/** The heart the player defends. Its orb gets its own material so lives can tint it. */
export function makeHeart(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'heart';
  mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.18, 8), matte(C.stone), root, 0, 0.09, 0);
  mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 8), matte(C.stoneLight), root, 0, 0.42, 0);
  const orbMat = new THREE.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ffb35c', emissiveIntensity: 3, flatShading: true });
  mesh(new THREE.IcosahedronGeometry(0.2, 1), orbMat, root, 0, 0.9, 0, 'orb');
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const bar = mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), matte(C.iron), root, Math.cos(a) * 0.27, 0.9, Math.sin(a) * 0.27);
    bar.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
  }
  const roof = mesh(new THREE.ConeGeometry(0.34, 0.26, 8), matte(C.iron), root, 0, 1.26, 0);
  roof.rotation.y = Math.PI / 8;
  return root;
}

export function makePortal(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'portal';
  for (const [x, z] of [[0, -0.42], [0, 0.42]]) {
    mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), matte(C.stoneDark), root, x, 0.4, z);
  }
  mesh(new THREE.BoxGeometry(0.2, 0.14, 1.0), matte(C.stoneDark), root, 0, 0.86, 0);
  const swirl = mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 20), glow('#8a5cff', 2.2), root, 0, 0.42, 0, 'swirl');
  swirl.rotation.y = Math.PI / 2;
  const fill = mesh(new THREE.CircleGeometry(0.3, 16), glow('#2a1050', 0.8, 0.85), root, 0, 0.42, 0);
  fill.rotation.y = Math.PI / 2;
  return root;
}

// ---------- scenery ----------

export function makeTree(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'tree';
  const s = 0.75 + rnd() * 0.5;
  mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.35 * s, 5), matte(C.woodDark), root, 0, 0.17 * s, 0);
  const tones = [C.leaf, C.leafAlt, C.leafDark];
  for (let i = 0; i < 3; i++) {
    const cone = mesh(new THREE.ConeGeometry((0.38 - i * 0.09) * s, 0.42 * s, 6), matte(tones[(i + Math.floor(rnd() * 3)) % 3], 0.95), root,
      0, (0.38 + i * 0.24) * s, 0);
    cone.rotation.y = rnd() * Math.PI;
  }
  return root;
}

export function makeRock(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'rock';
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const s = 0.1 + rnd() * 0.14;
    const rock = mesh(new THREE.DodecahedronGeometry(s, 0), matte(i % 2 ? C.stone : C.stoneDark), root, (rnd() - 0.5) * 0.4, s * 0.6, (rnd() - 0.5) * 0.4);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    rock.scale.y = 0.7;
  }
  return root;
}

export function makeMushrooms(rnd: () => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'mushrooms';
  const n = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * 0.4, z = (rnd() - 0.5) * 0.4, h = 0.06 + rnd() * 0.08;
    mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 5), matte('#d8cfc0'), root, x, h / 2, z);
    mesh(new THREE.SphereGeometry(0.045, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), glow('#5fe0c8', 1.6), root, x, h, z);
  }
  return root;
}

export function makeWindmill(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'windmill';
  mesh(new THREE.CylinderGeometry(0.32, 0.48, 1.3, 8), matte('#7a6f68'), root, 0, 0.65, 0);
  mesh(new THREE.ConeGeometry(0.42, 0.45, 8), matte('#4b2f2a'), root, 0, 1.52, 0);
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

export function makeFencePost(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'fence';
  mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), matte(C.wood), root, 0, 0.15, 0);
  mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), matte(C.woodDark), root, 0, 0.22, 0.4);
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

/** Tiles the road covers, including the one-tile margin around the board. */
export function roadTiles(map: MapDef): Set<string> {
  const tiles = new Set<string>();
  for (let i = 0; i < map.pts.length - 1; i++) {
    const [x0, y0] = map.pts[i], [x1, y1] = map.pts[i + 1];
    const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    for (;;) {
      tiles.add(x + ',' + y);
      if (x === x1 && y === y1) break;
      x += sx; y += sy;
    }
  }
  return tiles;
}

export const MARGIN = 1;
/** Tile (tx, ty) centre in world units. One tile is one unit; the board is centred on the origin. */
export const tileToWorld = (tx: number, ty: number) => ({ x: tx + 0.5 - COLS / 2, z: ty + 0.5 - ROWS / 2 });

/** The diorama slab: grass tiles, the sunken road, a cliff edge and scenery in the margin. */
export function makeBoard(map: MapDef): THREE.Group {
  const root = new THREE.Group();
  root.name = `board-${map.id}`;
  const rnd = mulberry(map.seed * 7919 + 13);
  const road = roadTiles(map);
  const w = COLS + MARGIN * 2, d = ROWS + MARGIN * 2;

  const slab = mesh(new THREE.BoxGeometry(w + 0.2, 1.2, d + 0.2), matte(C.cliff), root, 0, -0.66, 0);
  slab.castShadow = false;
  mesh(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), matte(C.dirtDark), root, 0, -0.1, 0).castShadow = false;

  const tileGeo = new THREE.BoxGeometry(0.97, 0.12, 0.97);
  const grassTiles: THREE.Matrix4[] = [], grassColors: THREE.Color[] = [];
  const roadMats: THREE.Matrix4[] = [], roadColors: THREE.Color[] = [];
  const m4 = new THREE.Matrix4();
  for (let ty = -MARGIN; ty < ROWS + MARGIN; ty++) {
    for (let tx = -MARGIN; tx < COLS + MARGIN; tx++) {
      const { x, z } = tileToWorld(tx, ty);
      const inside = tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
      const v = rnd();
      if (road.has(tx + ',' + ty)) {
        roadMats.push(m4.clone().makeTranslation(x, -0.1, z));
        roadColors.push(new THREE.Color(C.dirt).offsetHSL(0, 0, (v - 0.5) * 0.06));
      } else {
        grassTiles.push(m4.clone().makeTranslation(x, -0.06, z));
        const base = inside ? ((tx + ty) % 2 ? C.grass : C.grassAlt) : C.grassEdge;
        grassColors.push(new THREE.Color(base).offsetHSL(0, 0, (v - 0.5) * 0.035));
      }
    }
  }
  const instanced = (mats: THREE.Matrix4[], colors: THREE.Color[], name: string) => {
    const im = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), mats.length);
    im.name = name;
    mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, colors[i]); });
    im.receiveShadow = true;
    root.add(im);
  };
  instanced(grassTiles, grassColors, 'grass');
  instanced(roadMats, roadColors, 'road');

  // Pebbles along the road.
  for (const key of road) {
    const [tx, ty] = key.split(',').map(Number);
    const { x, z } = tileToWorld(tx, ty);
    if (rnd() < 0.5) {
      const p = mesh(new THREE.DodecahedronGeometry(0.03 + rnd() * 0.03, 0), matte(C.stone), root, x + (rnd() - 0.5) * 0.8, -0.03, z + (rnd() - 0.5) * 0.8);
      p.castShadow = false;
    }
  }

  // Scenery in the margin, plus small plants on open tiles inside the board.
  const place = (obj: THREE.Object3D, tx: number, ty: number, jitter = 0.2) => {
    const { x, z } = tileToWorld(tx, ty);
    obj.position.set(x + (rnd() - 0.5) * jitter, 0, z + (rnd() - 0.5) * jitter);
    obj.rotation.y = rnd() * Math.PI * 2;
    root.add(obj);
  };
  const millSpot = map.id === 'mill' ? `${COLS},${-1}` : '';
  for (let ty = -MARGIN; ty < ROWS + MARGIN; ty++) {
    for (let tx = -MARGIN; tx < COLS + MARGIN; tx++) {
      const key = tx + ',' + ty;
      if (road.has(key)) continue;
      const inside = tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
      if (key === millSpot) {
        const mill = makeWindmill();
        const { x, z } = tileToWorld(tx, ty);
        mill.position.set(x, 0, z);
        mill.rotation.y = -0.6;
        root.add(mill);
        continue;
      }
      if (!inside) {
        const v = rnd();
        if (v < 0.55) place(makeTree(rnd), tx, ty, 0.3);
        else if (v < 0.75) place(makeRock(rnd), tx, ty);
        else if (v < 0.85) place(makeMushrooms(rnd), tx, ty);
      } else if (rnd() < 0.08) {
        // Keep plants to the tile corner so towers can still stand there.
        const plant = makeMushrooms(rnd);
        plant.scale.setScalar(0.7);
        const { x, z } = tileToWorld(tx, ty);
        plant.position.set(x + 0.36, 0, z + 0.36);
        root.add(plant);
      }
    }
  }
  return root;
}
