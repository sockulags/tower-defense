import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { COLS, ROWS, T } from '../config';
import { TOWERS } from '../data/towers';
import { canBuild, needsBranch, stats } from '../game/towers';
import { buildPath, heartOf } from '../game/path';
import { C, gem, glow, makeBoard, makeDaze, makeEnemy, makeHeart, makeHero, makePortal, makeTower, tileToWorld } from './models';
import { BOSS_COLORS } from '../game/bosses'; // bosses
// Terrain and rifts that move
import { WATER_LEVEL, groundHeight } from './models';
import { HILL_REACH, reachAt, riftCount, roadsOf, waveRift, woodsNear } from '../game/terrain';
import { BADGE_RADIUS, WEAPONS, type Loadout } from '../data/hero';
import { heroStats } from '../game/hero';
import { ENEMIES } from '../data/enemies';
import { COMBOS, WORD_LIFE } from '../game/combos';
import { L } from '../i18n';
import type { ComboWord, Enemy, EnemyType, Fx, Game, MapDef, Path, Shot, Tower, TowerType } from '../types';
// Economy buildings (lab experiment)
import { makeMill } from './models';
import { MILL } from '../data/mills';
import { canAffordMill, millStageOf } from '../game/mills';
import type { Mill } from '../types';

const FONT = '"Alegreya Sans", sans-serif';
/** Camera angle from straight down: steep enough to read the board, shallow enough to see the sides of models. */
const CAMERA_TILT = 0.68;
/** World units of breathing room kept around the playable board. */
const BOARD_PAD = 0.45;
const MAX_POINTS = 1600;
/** Enemies are drawn a little larger than their hit radius so they read at a distance. */
const ENEMY_SCALE = 1.45;
/** Towers likewise read better a touch larger than their footprint in the simulation. */
const TOWER_SCALE = 1.2;
/** The Warden is small next to towers; scale it up so it reads as the hero. */
const HERO_SCALE = 1.45;

/** Simulation pixels to world units: one tile is one unit, the board is centred on the origin. */
const wx = (x: number) => x / T - COLS / 2;
const wz = (y: number) => y / T - ROWS / 2;

const easeOutBack = (t: number) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** 1 right after an event, easing to 0 over `dur` seconds. */
const kick = (now: number, at: number, dur: number) => { const p = clamp01((now - at) / dur); return (1 - p) * (1 - p); };

// ---------- outlines ----------

/** Inverted-hull outline: a back-face copy of each mesh pushed out along its normals. */
const OUTLINE = new THREE.ShaderMaterial({
  uniforms: { thickness: { value: 0.014 }, color: { value: new THREE.Color('#2a1c2c') } },
  vertexShader: 'uniform float thickness; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * thickness, 1.0); }',
  fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
  side: THREE.BackSide,
});

function addOutlines(root: THREE.Object3D) {
  const targets: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.noOutline && m.material instanceof THREE.MeshToonMaterial && !m.material.transparent) targets.push(m);
  });
  for (const m of targets) {
    const hull = new THREE.Mesh(m.geometry, OUTLINE);
    hull.userData.noOutline = true;
    m.add(hull);
  }
}

/**
 * Collapses the static scenery of a board into one mesh per material, so a forest of small
 * props costs a handful of draw calls. Animated pieces (windmill blades, lamp posts) and the
 * vertex-coloured ground are left as they are.
 */
function mergeStatic(board: THREE.Group): THREE.Group {
  board.updateMatrixWorld(true);
  const keep = new Set(['blades', 'lamp-post', 'ground']);
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean; outline: boolean }>();
  const merged: THREE.Mesh[] = [];
  board.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let p: THREE.Object3D | null = m; p && p !== board; p = p.parent) if (keep.has(p.name)) return;
    const mat = m.material as THREE.Material;
    const key = `${mat.uuid}:${m.castShadow}:${!m.userData.noOutline}`;
    let entry = groups.get(key);
    if (!entry) { entry = { mat, geos: [], shadow: m.castShadow, outline: !m.userData.noOutline }; groups.set(key, entry); }
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    entry.geos.push(geo);
    merged.push(m);
  });
  for (const m of merged) { m.removeFromParent(); m.geometry.dispose(); }
  for (const { mat, geos, shadow, outline } of groups.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    if (!outline) mesh.userData.noOutline = true;
    board.add(mesh);
    geos.forEach((g) => g.dispose());
  }
  return board;
}

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
}

const byName = (root: THREE.Object3D, name: string) => {
  const out: THREE.Object3D[] = [];
  root.traverse((o) => { if (o.name === name) out.push(o); });
  return out;
};

/** The static world for a map: the island with its scenery, the heart at the road's end and the rift at its start. */
function buildWorld(map: MapDef, path: Path) {
  const board = mergeStatic(makeBoard(map));
  addOutlines(board);
  const end = heartOf(path);
  const heart = makeHeart();
  addOutlines(heart);
  heart.position.set(wx(end.x), 0, wz(end.y));
  // Rifts that move: one rift at the start of every road, gathered in one group.
  const portal = new THREE.Group();
  portal.name = 'rifts';
  for (const road of roadsOf(map)) {
    const [px, py] = road[0], [nx, ny] = road[1];
    const start = tileToWorld(px, py);
    const rift = makePortal();
    addOutlines(rift);
    rift.position.set(start.x, 0, start.z);
    rift.rotation.y = -Math.atan2(ny - py, nx - px);
    portal.add(rift);
  }
  return { board, heart, portal };
}

/** Golden-hour lights shared by the board and the offscreen portraits. */
function addSunlight(scene: THREE.Scene, shadows: boolean) {
  scene.add(new THREE.HemisphereLight('#d5e6ff', '#8a6b4c', 1.25));
  const sun = new THREE.DirectionalLight('#ffd7a0', 2.4);
  sun.position.set(-9, 8, 5);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12, near: 1, far: 45 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.025;
  }
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffc2d6', 0.9);
  rim.position.set(6, 5, -10);
  scene.add(rim);
}

/** Frames the playable board in an orthographic camera at the game's tilt, for a given aspect. */
function fitOrtho(camera: THREE.OrthographicCamera, aspect: number, pad = BOARD_PAD) {
  const cos = Math.cos(CAMERA_TILT);
  const hw = Math.max(COLS / 2 + pad, (ROWS / 2 + pad) * cos * aspect);
  const hh = hw / aspect;
  Object.assign(camera, { left: -hw, right: hw, top: hh, bottom: -hh });
  camera.position.set(0, Math.cos(CAMERA_TILT) * 40, Math.sin(CAMERA_TILT) * 40);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

const mapPortraitCache = new Map<string, string>();

/** A still of a whole map as it looks in game, for the menu's map cards. Cached per map. */
export function mapPortrait(map: MapDef, w = 480, h = 300): string {
  const cached = mapPortraitCache.get(map.id);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#3f7a45');
  addSunlight(scene, true);
  const world = buildWorld(map, buildPath(map));
  scene.add(world.board, world.heart, world.portal);
  const cam = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100);
  fitOrtho(cam, w / h, 0.9);
  renderer.render(scene, cam);
  const url = canvas.toDataURL('image/jpeg', 0.86);
  for (const o of [world.board, world.heart, world.portal]) disposeTree(o);
  renderer.dispose();
  renderer.forceContextLoss();
  mapPortraitCache.set(map.id, url);
  return url;
}

/** Renders one model to a data URL in the game's lighting and outline style, with a short-lived renderer. */
function portrait(objs: THREE.Object3D[], size: number, centerY: number, half: number): string[] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#d5e6ff', '#8a6b4c', 1.4));
  const sun = new THREE.DirectionalLight('#ffd7a0', 2.4);
  sun.position.set(-3, 4, 3);
  scene.add(sun);
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
  cam.position.set(2.4, 2.6 + centerY, 4.2);
  cam.lookAt(0, centerY, 0);
  const out: string[] = [];
  for (const obj of objs) {
    addOutlines(obj);
    scene.add(obj);
    renderer.render(scene, cam);
    out.push(canvas.toDataURL());
    scene.remove(obj);
    disposeTree(obj);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}

let portraitCache: Record<TowerType, string> | null = null;

/** Small 3D portraits of each tower for the build belt, tower cards and the codex. Cached. */
export function towerPortraits(): Record<TowerType, string> {
  if (portraitCache) return portraitCache;
  const types = Object.keys(TOWERS) as TowerType[];
  const urls = portrait(types.map((t) => makeTower(t, 2, null)), 128, 0.68, 0.82);
  portraitCache = Object.fromEntries(types.map((t, i) => [t, urls[i]])) as Record<TowerType, string>;
  return portraitCache;
}

// Economy buildings (lab experiment): portraits of the mill at each stage, for its medallion and card.
let millPortraitCache: string[] | null = null;
export function millPortrait(stage = 3): string {
  millPortraitCache ??= portrait([1, 2, 3].map((s) => makeMill(s)), 128, 0.6, 0.82);
  return millPortraitCache[Math.max(1, Math.min(3, stage)) - 1];
}

// In-game controls: how a tower will look after its branch upgrade (level 4), for the branch note.
const branchPortraitCache = new Map<string, string>();

/** A portrait of a tower at level 4 with the given branch. Rendered once per tower and branch, then cached. */
export function branchPortrait(type: TowerType, branch: 0 | 1): string {
  const key = `${type}:${branch}`;
  let url = branchPortraitCache.get(key);
  if (!url) {
    // Both branches of a tower are rendered together so one renderer serves the pair.
    const urls = portrait([makeTower(type, 4, 0), makeTower(type, 4, 1)], 128, 0.68, 0.82);
    branchPortraitCache.set(`${type}:0`, urls[0]);
    branchPortraitCache.set(`${type}:1`, urls[1]);
    url = urls[branch];
  }
  return url;
}

const heroPortraitCache = new Map<string, string>();

/** A portrait of the Warden in a given loadout. Cached per loadout. */
export function heroPortrait(loadout: Loadout, size = 256): string {
  const key = `${size}:${loadout.weapon}:${loadout.charm}:${loadout.hat}:${loadout.cloak}`;
  let url = heroPortraitCache.get(key);
  if (!url) {
    // The Warden faces +x; turn them toward the portrait camera so the face shows.
    const hero = makeHero(loadout);
    hero.rotation.y = -1.05;
    url = portrait([hero], size, 0.5, 0.62)[0];
    heroPortraitCache.set(key, url);
  }
  return url;
}

// Shadow traits: small portraits of every shadow for the next-wave preview at the wave horn.
let enemyPortraitCache: Record<EnemyType, string> | null = null;

/** A portrait of each shadow, all drawn at about the same size and turned to show the face. Cached. */
export function enemyPortraits(): Record<EnemyType, string> {
  if (enemyPortraitCache) return enemyPortraitCache;
  const types = Object.keys(ENEMIES) as EnemyType[];
  const objs = types.map((type) => {
    const obj = makeEnemy(type), r = ENEMIES[type].r, s = 0.3 / r;
    obj.scale.setScalar(s);
    obj.position.y = r * s + (type === 'flitter' ? 0.12 : 0);
    obj.rotation.y = -1.05;
    return obj;
  });
  const urls = portrait(objs, 96, 0.36, 0.56);
  enemyPortraitCache = Object.fromEntries(types.map((t, i) => [t, urls[i]])) as Record<EnemyType, string>;
  return enemyPortraitCache;
}

// ---------- per-object view state ----------

interface TowerView {
  obj: THREE.Group; key: string; yaw: number; lastCd: number; fireAt: number; builtAt: number; phase: number;
  aim?: THREE.Object3D; recoil: THREE.Object3D[]; swings: THREE.Object3D[]; cores: THREE.Object3D[];
  flames?: THREE.Object3D; embers?: THREE.Object3D; float?: THREE.Object3D; orbit?: THREE.Object3D;
  mist?: THREE.Object3D; spin?: THREE.Object3D; arcs: THREE.Object3D[]; flag?: THREE.Object3D; badge?: THREE.Object3D;
  /** Where shots leave the weapon, and the outward jets of area towers. */
  muzzles: THREE.Object3D[]; jets: THREE.Object3D[]; nextMuzzle: number;
}

interface EnemyView {
  obj: THREE.Group; body: THREE.Object3D; lx: number; lz: number; yaw: number;
  lastHit: number; hitAt: number; bornAt: number; mats: THREE.MeshToonMaterial[]; color: THREE.Color;
  /** Hit points last frame, to tell a real blow from a burn tick. */
  lastHp: number;
  parts: Record<string, THREE.Object3D | undefined>;
}

interface Dying { obj: THREE.Group; at: number; kill: boolean; scale: number; mats: THREE.MeshToonMaterial[] }

interface Mote { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: THREE.Color; gravity: number }

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#7fb2e5');
  grad.addColorStop(0.55, '#c9d7e8');
  grad.addColorStop(0.8, '#f8d9b0');
  grad.addColorStop(1, '#f5b98a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GameView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  /** Fixed orthographic camera tilted toward the player, so the board keeps its shape and models show their sides. */
  private camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100);
  private size = { w: 960, h: 600 };
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private overlay: CanvasRenderingContext2D;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private tmp = new THREE.Vector3();

  private world = new THREE.Group();
  private towers = new Map<Tower, TowerView>();
  private hero: { obj: THREE.Group; key: string; yaw: number; lastCd: number; fireAt: number; castSeen: number; castAt: number; builtAt: number; muzzle?: THREE.Object3D } | null = null;
  // Game feel: hit-stop holds the picture still for a few frames on heavy impacts. The simulation keeps running.
  private hitStopUntil = 0;
  private lastHitStop = -9;
  /** Gold ring around the Warden when the Badge charm is boosting nearby towers. */
  private aura = (() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: '#f0bf55', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    return m;
  })();
  private enemies = new Map<Enemy, EnemyView>();
  private dying: Dying[] = [];
  private shots = new Map<Shot, { mesh: THREE.Mesh; lx: number; lz: number; off: THREE.Vector3 }>();
  private rings = new Map<Fx, THREE.Mesh>();
  private heart: THREE.Group | null = null;
  private heartFlame: THREE.MeshBasicMaterial | null = null;
  private heartLight = new THREE.PointLight('#ffb35c', 4, 6, 1.6);
  private portal: THREE.Group | null = null;
  /** Terrain: ground height at a world point for the current board (hills and water beds). */
  private ground: ((x: number, z: number) => number) | null = null;
  /** Rifts that move: how much each rift is opened up, eased toward 1 for the next wave's rift. */
  private riftOpen: number[] = [];
  private mills: THREE.Object3D[] = [];
  private flickers: THREE.Object3D[] = [];

  private motes: Mote[] = [];
  private points: THREE.Points;
  private pPos = new Float32Array(MAX_POINTS * 3);
  private pCol = new Float32Array(MAX_POINTS * 3);
  private lines: THREE.LineSegments;
  private pollen: THREE.Points;
  private pollenSeeds: { x: number; z: number; p: number; s: number }[] = [];

  private footprint: THREE.Mesh;
  private buildRing: THREE.Mesh;
  private selectRing: THREE.Mesh;
  private ghost: { type: TowerType | 'hero'; obj: THREE.Group } | null = null;
  private rangeGeo = new THREE.RingGeometry(0.975, 1, 72);
  // In-game controls: range ring preview state (see setRangeFocus).
  private rangeFocus: { t: Tower; range: number } | null = null;
  private ringFor: Tower | null = null;
  private ringScale = 1;
  private ringT = 0;
  private ringGeo = new THREE.RingGeometry(0.88, 1, 48);
  private boltGeo = new THREE.SphereGeometry(1, 10, 8);
  private shardGeo = new THREE.OctahedronGeometry(1, 0);

  constructor(private canvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.overlay = overlayCanvas.getContext('2d')!;

    // Golden hour: a low warm sun casting long shadows, a cool sky fill, and a soft rim from behind.
    this.scene.background = skyTexture();
    this.scene.add(this.world);
    addSunlight(this.scene, true);
    this.scene.add(this.heartLight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 600), 0.35, 0.4, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null }, strength: { value: 0.22 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
        void main() { vec4 c = texture2D(tDiffuse, vUv); float v = smoothstep(0.9, 0.3, length(vUv - 0.5) * 1.3);
        c.rgb *= mix(1.0 - strength, 1.0, v); gl_FragColor = c; }`,
    }));
    this.composer.addPass(new OutputPass());

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.075, vertexColors: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 6), 3));
    this.lines = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(TOWERS.star.color).multiplyScalar(1.4) }));
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);

    const fGeo = new THREE.BufferGeometry();
    for (let i = 0; i < 50; i++) {
      this.pollenSeeds.push({ x: (Math.random() - 0.5) * (COLS + 2), z: (Math.random() - 0.5) * (ROWS + 2), p: Math.random() * 10, s: 0.2 + Math.random() * 0.4 });
    }
    fGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(50 * 3), 3));
    this.pollen = new THREE.Points(fGeo, new THREE.PointsMaterial({ size: 0.05, color: '#fff3cf', transparent: true, opacity: 0.8, depthWrite: false }));
    this.pollen.frustumCulled = false;
    this.scene.add(this.pollen);

    this.footprint = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.43, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }));
    this.footprint.rotation.x = -Math.PI / 2;
    this.buildRing = this.makeRangeRing();
    this.selectRing = this.makeRangeRing();
    this.scene.add(this.footprint, this.buildRing, this.selectRing, this.aura);

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /**
   * Frames the whole playable board for the current screen shape. The camera looks down at
   * CAMERA_TILT from vertical; the visible ground is then 2*hw wide and 2*hh/cos(tilt) deep, so we
   * pick the smallest frustum that contains the board. Wider or taller screens show more of the
   * scenery around it rather than empty sky.
   */
  private focus: { x: number; y: number; halfWidth: number } | null = null;

  /** Frames a part of the board instead of the whole of it (the lab gallery); null restores the normal view. */
  setFocus(f: { x: number; y: number; halfWidth: number } | null) {
    this.focus = f;
    this.fitCamera();
  }

  private fitCamera() {
    const aspect = this.size.w / this.size.h;
    if (!this.focus) { fitOrtho(this.camera, aspect); return; }
    const hw = this.focus.halfWidth, hh = hw / aspect, tx = wx(this.focus.x), tz = wz(this.focus.y);
    Object.assign(this.camera, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.camera.position.set(tx, Math.cos(CAMERA_TILT) * 40, tz + Math.sin(CAMERA_TILT) * 40);
    this.camera.lookAt(tx, 0, tz);
    this.camera.updateProjectionMatrix();
  }

  private makeRangeRing() {
    const ring = new THREE.Mesh(this.rangeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.visible = false;
    return ring;
  }

  private resize() {
    const w = this.canvas.clientWidth || 960;
    const h = this.canvas.clientHeight || 600;
    this.size = { w, h };
    this.fitCamera();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    const dpr = Math.min(window.devicePixelRatio, 2);
    const oc = this.overlay.canvas;
    oc.width = Math.round(w * dpr);
    oc.height = Math.round(h * dpr);
    this.overlay.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setGame(g: Game | null) {
    for (const v of this.towers.values()) { this.scene.remove(v.obj); disposeTree(v.obj); }
    if (this.hero) { this.scene.remove(this.hero.obj); disposeTree(this.hero.obj); this.hero = null; }
    for (const v of this.enemies.values()) this.removeEnemy(v.obj, v.mats);
    for (const d of this.dying) this.removeEnemy(d.obj, d.mats);
    for (const s of this.shots.values()) this.scene.remove(s.mesh);
    for (const m of this.rings.values()) { this.scene.remove(m); (m.material as THREE.Material).dispose(); }
    this.towers.clear(); this.enemies.clear(); this.shots.clear(); this.rings.clear();
    this.dying = []; this.motes = [];
    this.world.children.slice().forEach((c) => { this.world.remove(c); disposeTree(c); });
    this.mills = []; this.flickers = [];
    this.clearMills(); // economy buildings
    this.setGhost(null);
    if (!g) return;

    const w = buildWorld(g.map, g.path);
    w.board.traverse((o) => {
      if (o.name === 'blades') this.mills.push(o);
      if (o.name === 'core' && o.parent?.name === 'lantern') this.flickers.push(o);
    });
    this.world.add(w.board, w.heart, w.portal);
    this.heart = w.heart;
    this.portal = w.portal;
    this.ground = groundHeight(g.map); // terrain
    this.riftOpen = w.portal.children.map(() => 1);
    this.heartFlame = (w.heart.getObjectByName('orb') as THREE.Mesh).material as THREE.MeshBasicMaterial;
    this.heartLight.position.set(w.heart.position.x, 1.1, w.heart.position.z);
  }

  /**
   * Shows the range ring around a tower that is not necessarily selected, at a range in tiles.
   * Passing a larger range than the tower has now previews an upgrade: the ring eases out to it.
   * Null falls back to the selected tower's own ring.
   */
  setRangeFocus(t: Tower | null, range?: number) {
    this.rangeFocus = t ? { t, range: range ?? stats(t).range } : null;
  }

  /** Where a board point (simulation pixels, at a height in world units) appears on screen, in CSS pixels. */
  screenOf(x: number, y: number, height = 0) {
    this.syncSize();
    return this.toScreen(wx(x), height, wz(y));
  }

  /** Converts a pointer position to a board point in simulation pixels, or null when it misses the ground. */
  pickPoint(clientX: number, clientY: number) {
    this.syncSize();
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.tmp);
    if (!hit) return null;
    return { x: (hit.x + COLS / 2) * T, y: (hit.z + ROWS / 2) * T };
  }

  /** Resize observers can lag (for example in a background tab), so check the canvas size directly too. */
  private syncSize() {
    if (this.canvas.clientWidth && (this.canvas.clientWidth !== this.size.w || this.canvas.clientHeight !== this.size.h)) this.resize();
  }

  render(g: Game) {
    this.syncSize();
    const now = performance.now() / 1000;
    if (now < this.hitStopUntil) {
      // Hold the frame: only the cursor keeps up, so input never feels stuck.
      this.updateCursor(g);
      this.composer.render();
      this.drawOverlay(g);
      return;
    }
    this.syncTowers(g, now);
    this.syncMills(g, now); // economy buildings (lab experiment)
    this.syncHero(g, now);
    this.syncEnemies(g, now);
    this.animateDying(now);
    this.syncShots(g);
    this.syncFx(g);
    this.updateCursor(g);
    this.animateWorld(g, now);
    this.drawPoints(g);

    // No screen shake: the user rejected it. Heavy impacts get a hit-stop instead (see hitStop).
    this.composer.render();
    this.drawOverlay(g);
  }

  // ---------- towers ----------

  /** The world position of a tower's next muzzle; towers with several barrels take turns. */
  private muzzleOf(v: TowerView, advance: boolean) {
    if (!v.muzzles.length) return null;
    const m = v.muzzles[v.nextMuzzle % v.muzzles.length];
    if (advance) v.nextMuzzle++;
    v.obj.updateMatrixWorld(true);
    return m.getWorldPosition(new THREE.Vector3());
  }

  /** A puff at the weapon when a tower fires: a muzzle flash, or a spray out of every jet. */
  private weaponFlash(t: Tower, v: TowerView) {
    const c = new THREE.Color(TOWERS[t.type].color).multiplyScalar(1.3);
    v.obj.updateMatrixWorld(true);
    for (const m of v.muzzles) {
      const p = m.getWorldPosition(new THREE.Vector3());
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        this.motes.push({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * 0.6, vy: 0.3 + Math.random() * 0.5, vz: Math.sin(a) * 0.6, life: 0.25, max: 0.25, color: c, gravity: 0 });
      }
    }
    const dir = new THREE.Vector3();
    for (const j of v.jets) {
      const p = j.getWorldPosition(new THREE.Vector3());
      dir.set(1, 0, 0).transformDirection(j.matrixWorld);
      for (let i = 0; i < 3; i++) {
        const sp = 2.2 + Math.random() * 1.6;
        this.motes.push({ x: p.x, y: p.y, z: p.z, vx: dir.x * sp + (Math.random() - 0.5) * 0.5, vy: 0.2 + Math.random() * 0.4, vz: dir.z * sp + (Math.random() - 0.5) * 0.5, life: 0.4, max: 0.4, color: c, gravity: 0.6 });
      }
    }
  }

  private syncTowers(g: Game, now: number) {
    const seen = new Set<Tower>();
    for (const t of g.towers) {
      seen.add(t);
      const key = `${t.level}:${t.branch}`;
      let v = this.towers.get(t);
      if (!v || v.key !== key) {
        const upgraded = !!v;
        const yaw = v?.yaw ?? -t.angle;
        if (v) { this.scene.remove(v.obj); disposeTree(v.obj); }
        const obj = makeTower(t.type, t.level, t.branch);
        addOutlines(obj);
        obj.position.set(wx(t.x), this.standY(t.x, t.y), wz(t.y)); // terrain: towers stand on hills
        this.scene.add(obj);
        v = {
          obj, key, yaw, lastCd: t.cd, fireAt: -9, builtAt: upgraded ? now - 0.12 : now, phase: (t.x * 13 + t.y * 7) % 6.28,
          aim: obj.getObjectByName('aim'), recoil: byName(obj, 'recoil'), swings: byName(obj, 'swing'), cores: byName(obj, 'core'),
          flames: obj.getObjectByName('flames'), embers: obj.getObjectByName('embers'), float: obj.getObjectByName('float'),
          orbit: obj.getObjectByName('orbit'), mist: obj.getObjectByName('mist'), spin: obj.getObjectByName('spin'),
          arcs: byName(obj, 'arc'), flag: obj.getObjectByName('flag'), badge: obj.getObjectByName('badge'),
          muzzles: byName(obj, 'muzzle'), jets: byName(obj, 'jet'), nextMuzzle: 0,
        };
        this.towers.set(t, v);
        this.puff(wx(t.x), 0.1, wz(t.y), '#efe2c4', upgraded ? 10 : 16, 1.2);
      }
      this.animateTower(t, v, now);
    }
    for (const [t, v] of this.towers) {
      if (!seen.has(t)) {
        this.puff(v.obj.position.x, 0.2, v.obj.position.z, '#cfc3ad', 18, 1.5);
        this.scene.remove(v.obj); disposeTree(v.obj); this.towers.delete(t);
      }
    }
  }

  private animateTower(t: Tower, v: TowerView, now: number) {
    // Bosses: a stomp raises the cooldown too, but that is a knock-out, not a shot.
    const knock = this.knockStarted(t);
    const fired = t.cd > v.lastCd + 1e-4 && !knock;
    if (fired) v.fireAt = now;
    v.lastCd = t.cd;
    const fire = kick(now, v.fireAt, 0.3);
    const ph = v.phase;

    // Build and upgrade pop.
    const grow = clamp01((now - v.builtAt) / 0.45);
    const s = TOWER_SCALE * easeOutBack(grow) * (1 + 0.15 * t.flash);
    v.obj.scale.set(s, s * (1 + 0.08 * fire * (t.type === 'pulse' ? -1 : 0)), s);

    if (v.aim) {
      const diff = Math.atan2(Math.sin(-t.angle - v.yaw), Math.cos(-t.angle - v.yaw));
      v.yaw += diff * 0.2;
      v.aim.rotation.y = v.yaw;
    }
    for (const sw of v.swings) sw.rotation.z = Math.sin(now * 1.8 + ph) * 0.07 + fire * 0.45;
    for (const r of v.recoil) r.position.x = -0.09 * fire;
    for (const c of v.cores) c.scale.setScalar(1 + 0.9 * fire + 0.05 * Math.sin(now * 6 + ph));
    if (v.float) {
      v.float.position.y = v.float.userData.y0 ??= v.float.position.y;
      v.float.position.y = v.float.userData.y0 + Math.sin(now * 1.6 + ph) * 0.05 + fire * 0.06;
      v.float.rotation.y = now * 0.6;
    }
    if (v.orbit) v.orbit.rotation.y = now * 1.1 + fire * 1.5;
    if (v.mist) v.mist.rotation.y = now * 0.4;
    if (v.flames) {
      v.flames.children.forEach((f, i) => {
        f.scale.set(1 + 0.07 * Math.sin(now * 9 + i) + 0.3 * fire, 1 + 0.16 * Math.sin(now * 11 + i * 1.7 + ph) + 0.9 * fire, 1 + 0.07 * Math.cos(now * 8 + i) + 0.3 * fire);
      });
    }
    if (v.embers) {
      v.embers.children.forEach((e, i) => {
        const p = (now * 0.7 + i / v.embers!.children.length + ph) % 1;
        e.position.set(Math.sin(i * 2.4 + now * 1.3) * 0.12 * p, p * 0.75, Math.cos(i * 1.7 + now) * 0.12 * p);
        e.scale.setScalar(1 - p);
      });
    }
    for (const a of v.arcs) a.scale.setScalar(0.8 + Math.random() * 0.5 + fire);
    if (v.spin) { v.spin.rotation.y = now * 1.5; v.spin.position.y = (v.spin.userData.y0 ??= v.spin.position.y) + Math.sin(now * 2 + ph) * 0.05; }
    if (v.flag) v.flag.rotation.y = Math.sin(now * 3 + ph) * 0.35;
    // Area towers blast flame (or frost, or lightning) out of every spout when they pulse.
    for (const j of v.jets) j.scale.set(0.3 + 2.4 * fire + 0.06 * Math.sin(now * 12 + j.id), 0.7 + 0.6 * fire, 0.7 + 0.6 * fire);
    if (fired) this.weaponFlash(t, v);
    this.animateKnocked(t, v, now); // bosses
    if (v.badge) {
      v.badge.visible = needsBranch(t);
      v.badge.position.y = 1.55 + Math.sin(now * 4) * 0.07;
      v.badge.rotation.y = now * 2;
    }
  }

  // ---------- the Warden ----------

  private syncHero(g: Game, now: number) {
    const h = g.hero;
    this.aura.visible = !!h && h.loadout.charm === 'badge';
    if (!h) {
      if (this.hero) { this.scene.remove(this.hero.obj); disposeTree(this.hero.obj); this.hero = null; }
      return;
    }
    const l = h.loadout, key = `${l.weapon}:${l.charm}:${l.hat}:${l.cloak}:${h.level}`;
    let v = this.hero;
    if (!v || v.key !== key) {
      const upgraded = !!v;
      if (v) { this.scene.remove(v.obj); disposeTree(v.obj); }
      const obj = makeHero(l);
      // One stud per level on the post, like the towers.
      for (let i = 0; i < h.level; i++) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), glow(C.gem, 1.4));
        stud.position.set((i - (h.level - 1) / 2) * 0.06, 0.05, 0.3);
        obj.add(stud);
      }
      addOutlines(obj);
      obj.position.set(wx(h.x), this.standY(h.x, h.y), wz(h.y)); // terrain: the Warden stands on hills
      this.scene.add(obj);
      v = { obj, key, yaw: v?.yaw ?? -h.angle, lastCd: h.cd, fireAt: -9, castSeen: h.castAt, castAt: -9, builtAt: upgraded ? now - 0.12 : now, muzzle: obj.getObjectByName('muzzle') };
      this.hero = v;
      if (!upgraded) this.puff(wx(h.x), 0.1, wz(h.y), '#efe2c4', 16, 1.2);
    }
    if (h.cd > v.lastCd + 1e-4) v.fireAt = now;
    v.lastCd = h.cd;
    if (h.castAt !== v.castSeen) {
      v.castSeen = h.castAt; v.castAt = now;
      // The Shooting Star lands like a Starfall star.
      if (l.weapon === 'sling') this.hitStop(now, 0.07);
    }
    const fire = kick(now, v.fireAt, 0.3), cast = kick(now, v.castAt, 0.8);
    const s = HERO_SCALE * easeOutBack(clamp01((now - v.builtAt) / 0.45)) * (1 + 0.12 * h.flash);
    v.obj.scale.setScalar(s);
    const diff = Math.atan2(Math.sin(-h.angle - v.yaw), Math.cos(-h.angle - v.yaw));
    v.yaw += diff * 0.15;
    const aim = v.obj.getObjectByName('aim');
    if (aim) aim.rotation.y = v.yaw;
    const body = v.obj.getObjectByName('body');
    if (body) { body.position.y = Math.abs(Math.sin(now * 2.2)) * 0.015 + cast * 0.08; body.scale.y = 1 + Math.sin(now * 2.2) * 0.015; }
    const cloak = v.obj.getObjectByName('cloak');
    if (cloak) cloak.rotation.z = Math.sin(now * 1.7) * 0.04 - fire * 0.08;
    const arm = v.obj.getObjectByName('arm');
    // Swing forward on an attack; raise the weapon high on an ability.
    if (arm) arm.rotation.z = -fire * 0.9 + cast * 1.6;
    v.obj.traverse((o) => { if (o.name === 'core') o.scale.setScalar(1 + fire * 0.8 + cast * 1.4 + Math.sin(now * 6) * 0.05); });
    if (this.aura.visible) {
      this.aura.position.set(wx(h.x), this.standY(h.x, h.y) + 0.035, wz(h.y));
      this.aura.scale.setScalar(BADGE_RADIUS * (1 + Math.sin(now * 2) * 0.01));
    }
  }

  // ---------- enemies ----------

  private syncEnemies(g: Game, now: number) {
    const seen = new Set<Enemy>();
    for (const e of g.enemies) {
      seen.add(e);
      const x = wx(e.x), z = wz(e.y);
      let v = this.enemies.get(e);
      if (!v) {
        const obj = makeEnemy(e.type);
        const mats: THREE.MeshToonMaterial[] = [];
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.material instanceof THREE.MeshToonMaterial && !m.material.transparent) {
            m.material = m.material.clone();
            mats.push(m.material as THREE.MeshToonMaterial);
          }
        });
        addOutlines(obj);
        this.scene.add(obj);
        const skin = obj.getObjectByName('skin') as THREE.Mesh | undefined;
        const parts: EnemyView['parts'] = {};
        for (const n of ['footL', 'footR', 'wingL', 'wingR', 'armL', 'armR', 'cloak', 'shield', 'buds', 'slow', 'burn', 'stun', 'sack', 'core', 'jaw']) parts[n] = obj.getObjectByName(n);
        v = {
          obj, body: obj.getObjectByName('body')!, lx: x, lz: z, yaw: 0, lastHit: e.lastHit, hitAt: -9, bornAt: now, mats, lastHp: e.hp,
          color: skin ? (skin.material as THREE.MeshToonMaterial).color.clone() : new THREE.Color(e.def.color), parts,
        };
        this.enemies.set(e, v);
      }
      this.animateEnemy(g, e, v, x, z, now);
    }
    for (const [e, v] of this.enemies) {
      if (seen.has(e)) continue;
      this.enemies.delete(e);
      const kill = e.hp <= 0;
      this.dying.push({ obj: v.obj, at: now, kill, scale: v.obj.scale.x, mats: v.mats });
      if (kill) {
        this.puff(v.obj.position.x, v.obj.position.y, v.obj.position.z, '#' + v.color.getHexString(), e.def.boss ? 40 : 14, 2.2, 3);
        if (e.def.boss) this.giantFalls(v.obj.position, now);
        this.motes.push({ x: v.obj.position.x, y: v.obj.position.y + 0.2, z: v.obj.position.z, vx: 0, vy: 0.9, vz: 0, life: 0.9, max: 0.9, color: new THREE.Color(C.eye).multiplyScalar(1.6), gravity: 0 });
      }
    }
  }

  private animateEnemy(g: Game, e: Enemy, v: EnemyView, x: number, z: number, now: number) {
    const r = e.def.r, p = v.parts;
    const dx = x - v.lx, dz = z - v.lz;
    const moving = dx * dx + dz * dz > 1e-7;
    if (moving) {
      const target = Math.atan2(-dz, dx);
      v.yaw += Math.atan2(Math.sin(target - v.yaw), Math.cos(target - v.yaw)) * 0.25;
    }
    v.lx = x; v.lz = z;
    const pace = { crawler: 2.4, flitter: 1, lump: 1.3, shimmer: 1, splitter: 1.6, speck: 3, dasher: e.dashing ? 4.5 : 1.6, giant: 0.9,
      stomper: 0.8, thief: e.dashing || e.boss?.fleeing ? 3.2 : 1.8, mender: 0.7 }[e.type]; // bosses
    const t = g.t * pace * 4 + e.seed;
    const frozen = e.stun > g.t;
    const step = frozen ? 0 : 1;

    let lift = 0;
    if (e.type === 'crawler') {
      lift = Math.abs(Math.sin(t)) * 0.07 * step;
      v.body.rotation.x = Math.sin(t) * 0.14 * step;
      if (p.footL) p.footL.position.x = r * 0.1 + Math.sin(t) * r * 0.3 * step;
      if (p.footR) p.footR.position.x = r * 0.1 - Math.sin(t) * r * 0.3 * step;
    } else if (e.type === 'flitter') {
      lift = 0.32 + Math.sin(t * 0.8) * 0.06;
      const flap = Math.sin(g.t * 20 + e.seed) * 0.85 * step;
      if (p.wingL) p.wingL.rotation.x = -flap;
      if (p.wingR) p.wingR.rotation.x = flap;
      v.body.rotation.z = Math.sin(t * 0.8) * 0.12;
    } else if (e.type === 'lump' || e.type === 'giant') {
      lift = Math.abs(Math.sin(t)) * (e.type === 'giant' ? 0.05 : 0.035) * step;
      v.body.rotation.x = Math.sin(t) * 0.06 * step;
      if (p.armL) p.armL.rotation.z = Math.sin(t) * 0.55 * step;
      if (p.armR) p.armR.rotation.z = -Math.sin(t) * 0.55 * step;
    } else if (e.type === 'shimmer') {
      lift = 0.12 + Math.sin(t * 0.7) * 0.06;
      if (p.cloak) p.cloak.rotation.z = Math.sin(t * 1.3) * 0.08;
      // Shadow traits: the ward shows while the Veil mends and breaks while it burns or is frozen.
      if (p.shield) {
        p.shield.visible = e.mending;
        p.shield.rotation.y = g.t * 0.8;
        p.shield.scale.setScalar(1 + Math.sin(g.t * 3 + e.seed) * 0.04 + (e.mending && e.hp < e.maxHp ? 0.06 : 0));
      }
    } else if (e.type === 'splitter') {
      // A heavy wobble, with the clinging Droplets jiggling a beat behind.
      lift = Math.abs(Math.sin(t)) * 0.04 * step;
      v.body.rotation.x = Math.sin(t) * 0.1 * step;
      if (p.footL) p.footL.position.x = r * 0.15 + Math.sin(t) * r * 0.25 * step;
      if (p.footR) p.footR.position.x = r * 0.15 - Math.sin(t) * r * 0.25 * step;
      if (p.buds) { const j = 1 + Math.sin(t * 2 - 1.2) * 0.07 * step; p.buds.scale.set(j, 2 - j, j); p.buds.rotation.y = Math.sin(t) * 0.12 * step; }
    } else if (e.type === 'speck') {
      // Little hops.
      lift = Math.abs(Math.sin(t)) * 0.11 * step;
      v.body.rotation.z = -Math.sin(t) * 0.12 * step;
      if (p.footL) p.footL.position.x = r * 0.1 + Math.sin(t) * r * 0.35 * step;
      if (p.footR) p.footR.position.x = r * 0.1 - Math.sin(t) * r * 0.35 * step;
    } else if (e.type === 'dasher') {
      // Trots between bursts; during a burst it gallops low with its ears flat.
      const run = e.dashing ? 1 : 0;
      lift = Math.abs(Math.sin(t)) * (0.025 + 0.03 * run) * step;
      v.body.rotation.z = (-Math.sin(t) * 0.08 - 0.12 * run) * step;
      if (p.footL) p.footL.rotation.z = Math.sin(t) * (0.6 + 0.5 * run) * step;
      if (p.footR) p.footR.rotation.z = -Math.sin(t) * (0.6 + 0.5 * run) * step;
      for (const ear of [p.armL, p.armR]) if (ear) ear.rotation.z = -0.9 * run + Math.sin(t * 0.5) * 0.1;
    } else if (e.def.boss) {
      lift = this.animateBoss(g, e, v, t, step, now); // bosses
    }
    const squash = Math.sin(t * 2) * 0.05 * step;
    v.body.scale.set(1 + squash, 1 - squash, 1 + squash);
    // Shadow traits: a sprinting Scurrier stretches out along its run.
    if (e.type === 'dasher' && e.dashing) v.body.scale.set(1.18, 0.88, 0.95);
    if (e.def.boss && e.type !== 'giant') this.bossBody(e, v, now); // bosses: a stomp squashes, a grab stretches
    v.body.rotation.y = v.yaw;

    const born = easeOutBack(clamp01((now - v.bornAt) / 0.35));
    const s = ENEMY_SCALE * born;
    v.obj.position.set(x, (r + lift) * s + this.wade(e, x, z), z); // terrain: shadows wade through water

    if (e.lastHit !== v.lastHit) {
      v.lastHit = e.lastHit;
      // Burning shadows lose a sliver of health every frame; only a real blow (or the lab's nudge,
      // which deals no damage) flashes and squashes, so burning shadows do not glow constantly.
      const drop = v.lastHp - e.hp;
      if (Math.abs(drop) < 1e-9 || drop > 2.5) v.hitAt = now;
    }
    v.lastHp = e.hp;
    // A short squash when a blow lands.
    const hit = kick(now, v.hitAt, 0.16);
    v.obj.scale.set(s * (1 + 0.14 * hit), s * (1 - 0.2 * hit), s * (1 + 0.14 * hit));
    const flash = kick(now, v.hitAt, 0.14);
    for (const m of v.mats) m.emissive.setScalar(flash * 0.85);

    if (p.slow) p.slow.visible = e.slowUntil > g.t;
    if (p.burn) { p.burn.visible = e.burnUntil > g.t; p.burn.scale.y = 1 + Math.sin(now * 20) * 0.15; }
    if (p.stun) { p.stun.visible = frozen; p.stun.rotation.y = now * 6; }
  }

  // ---------- bosses ----------

  /** Each boss's last stomp, grab or mend: the simulation time it happened, and when the view first saw it. */
  private bossEvents = new WeakMap<Enemy, { seen: number; at: number }>();
  /** Each tower's knock-out time last frame, to tell a fresh stomp from a shot. */
  private knockSeen = new WeakMap<Tower, number>();

  /** Real time of a boss's last ability. A new one is caught here, and gets its puff of dust, gold or light. */
  private bossEventAt(e: Enemy, v: EnemyView, now: number) {
    const simAt = e.boss?.at ?? -9;
    let ev = this.bossEvents.get(e);
    if (!ev) { ev = { seen: simAt, at: -9 }; this.bossEvents.set(e, ev); }
    if (simAt !== ev.seen) {
      ev.seen = simAt;
      ev.at = now;
      const o = v.obj.position, b = e.def.boss!;
      if (b.stomp) this.puff(o.x, 0.05, o.z, '#cfc3ad', 26, 2.4, 2.5);
      else if (b.steal) this.puff(o.x, o.y + 0.3, o.z, BOSS_COLORS.steal, 22, 1.6, 2);
      else if (b.mend) this.puff(o.x, o.y + 0.3, o.z, BOSS_COLORS.mend, 14, 1, -0.6);
    }
    return ev.at;
  }

  /**
   * Bosses move like what they are. The Stomper plods on pillar legs, rears up on one leg before a
   * stomp and slams it down; the Thief scuttles hunched over and, once it has the gold, clutches
   * its sack and runs; the Mender floats, and raises its arms and lantern when it mends.
   * Returns how high the body lifts.
   */
  private animateBoss(g: Game, e: Enemy, v: EnemyView, t: number, step: number, now: number) {
    const p = v.parts, r = e.def.r, b = e.boss, def = e.def.boss!;
    const at = this.bossEventAt(e, v, now);
    if (def.stomp) {
      const windup = step * clamp01(1 - (b?.next ?? 9) / 0.6), slam = kick(now, at, 0.45);
      const walk = step * (1 - windup);
      if (p.footL) p.footL.position.y = -r * 0.62 + r * (Math.max(0, Math.sin(t)) * 0.16 * walk + 0.42 * windup);
      if (p.footR) p.footR.position.y = -r * 0.62 + r * Math.max(0, -Math.sin(t)) * 0.16 * walk;
      v.body.rotation.x = Math.sin(t) * 0.05 * walk;
      v.body.rotation.z = 0.22 * windup - 0.1 * slam;
      if (p.armL) p.armL.rotation.z = Math.sin(t) * 0.4 * walk + 1.4 * windup;
      if (p.armR) p.armR.rotation.z = -Math.sin(t) * 0.4 * walk + 1.4 * windup;
      if (p.jaw) p.jaw.rotation.z = -0.35 * slam - 0.15 * windup;
      return Math.abs(Math.sin(t)) * 0.03 * walk + 0.1 * windup;
    }
    if (def.steal) {
      const loot = b?.loot ?? 0, carrying = !!b?.fleeing;
      const grab = kick(now, at, 0.5), run = e.dashing || carrying ? 1 : 0;
      v.body.rotation.z = (-0.15 - 0.15 * run) * (step || 0.5);
      v.body.rotation.x = Math.sin(t) * 0.07 * step;
      if (p.footL) p.footL.position.x = r * 0.12 + Math.sin(t) * r * (0.3 + 0.15 * run) * step;
      if (p.footR) p.footR.position.x = r * 0.12 - Math.sin(t) * r * (0.3 + 0.15 * run) * step;
      // Grabbing hands reach forward; afterwards they hug the sack on its back.
      const arms = carrying ? -0.9 + 2.2 * grab : Math.sin(t) * 0.5 * step;
      if (p.armL) p.armL.rotation.z = arms;
      if (p.armR) p.armR.rotation.z = carrying ? arms : -Math.sin(t) * 0.5 * step;
      if (p.sack) {
        p.sack.visible = carrying;
        const fill = (0.7 + 0.45 * Math.min(1, loot / 150)) * easeOutBack(clamp01((now - at) / 0.4));
        p.sack.scale.setScalar(Math.max(0.01, fill));
        p.sack.rotation.x = Math.sin(t) * 0.15 * step;
      }
      if (p.cloak) p.cloak.rotation.z = -0.1 * run + Math.sin(t) * 0.05 * step;
      return Math.abs(Math.sin(t)) * (0.04 + 0.03 * run) * step;
    }
    // The Mender.
    const glowUp = kick(now, at, 0.9);
    if (p.cloak) p.cloak.rotation.z = Math.sin(t * 1.1) * 0.06;
    if (p.armL) p.armL.rotation.x = -0.15 - 1.1 * glowUp;
    if (p.armR) p.armR.rotation.x = 0.15 + 0.7 * glowUp;
    if (p.core) p.core.scale.setScalar(1 + 0.7 * glowUp + 0.08 * Math.sin(now * 5 + e.seed));
    if (p.shield) {
      // The ring of mending light shows while it can mend, and blooms out with each mend.
      p.shield.visible = e.mending;
      p.shield.rotation.y = g.t * 0.6;
      p.shield.scale.setScalar(0.9 + 0.35 * glowUp + Math.sin(g.t * 2.5 + e.seed) * 0.03);
    }
    return 0.16 + Math.sin(t * 0.6) * 0.05 + 0.06 * glowUp;
  }

  /** Bosses: a stomp squashes the Stomper, a grab stretches the Thief, a mend swells the Mender. */
  private bossBody(e: Enemy, v: EnemyView, now: number) {
    const at = this.bossEvents.get(e)?.at ?? -9, def = e.def.boss!;
    if (def.stomp) { const k = kick(now, at, 0.35); v.body.scale.set(1 + 0.16 * k, 1 - 0.2 * k, 1 + 0.16 * k); }
    else if (def.steal) { const k = kick(now, at, 0.3); v.body.scale.set(1 + 0.12 * k, 1 + 0.1 * k, 1 - 0.08 * k); }
    else if (def.mend) { const k = kick(now, at, 0.6); v.body.scale.setScalar(1 + 0.08 * k); }
  }

  /** Whether a tower was knocked out since last frame. */
  private knockStarted(t: Tower) {
    const k = t.knocked ?? 0, last = this.knockSeen.get(t) ?? 0;
    this.knockSeen.set(t, k);
    return k > last + 1e-4;
  }

  /** A knocked-out tower wobbles with stars circling over it until it comes round. */
  private animateKnocked(t: Tower, v: TowerView, now: number) {
    const k = t.knocked ?? 0;
    let daze = v.obj.userData.daze as THREE.Group | undefined;
    if (k <= 0) {
      if (daze?.visible) { daze.visible = false; v.obj.rotation.set(0, 0, 0); }
      return;
    }
    if (!daze) {
      daze = makeDaze();
      addOutlines(daze);
      v.obj.add(daze);
      v.obj.userData.daze = daze;
    }
    daze.visible = true;
    daze.rotation.y = now * 4;
    daze.position.y = 1.5 + Math.sin(now * 3) * 0.04;
    daze.scale.setScalar(easeOutBack(clamp01((now - (v.obj.userData.dazeAt ??= now)) / 0.3)));
    // The wobble settles in the last moments, as the tower comes round.
    const sway = Math.min(1, k / 0.5);
    v.obj.rotation.set(Math.cos(now * 6) * 0.05 * sway, 0, Math.sin(now * 6) * 0.07 * sway);
    if (k < 0.05) v.obj.userData.dazeAt = undefined;
  }
  // ---------- end bosses ----------

  private animateDying(now: number) {
    this.dying = this.dying.filter((d) => {
      const dur = d.kill ? 0.28 : 0.3;
      const p = clamp01((now - d.at) / dur);
      if (d.kill) {
        // Squash, swell, pop.
        const s = d.scale * (p < 0.4 ? 1 + p * 0.8 : (1 - p) * 2.2);
        d.obj.scale.set(s * (1 + p * 0.4), s * (1 - p * 0.5), s * (1 + p * 0.4));
        for (const m of d.mats) m.emissive.setScalar(0.6 * (1 - p));
      } else {
        // Slips into the heart.
        d.obj.scale.setScalar(d.scale * (1 - p));
        d.obj.position.y -= 0.01;
      }
      if (p >= 1) { this.removeEnemy(d.obj, d.mats); return false; }
      return true;
    });
  }

  private removeEnemy(obj: THREE.Group, mats: THREE.Material[]) {
    this.scene.remove(obj);
    disposeTree(obj);
    for (const m of mats) m.dispose();
  }

  // ---------- shots and effects ----------

  private syncShots(g: Game) {
    const seen = new Set<Shot>();
    for (const s of g.shots) {
      seen.add(s);
      let v = this.shots.get(s);
      const type = s.look;
      if (!v) {
        const mesh = type === 'frost'
          ? new THREE.Mesh(this.shardGeo, gem('#d6f6ff', 1))
          : new THREE.Mesh(type === 'star' ? this.shardGeo : this.boltGeo, glow(s.color, 2));
        mesh.scale.setScalar(type === 'star' ? 0.11 : type === 'frost' ? 0.06 : 0.045);
        this.scene.add(mesh);
        // The simulation launches from the tower's centre; the view starts the shot at the weapon's muzzle
        // and lets that offset fade out over the flight.
        const tv = this.towers.get(s.src as Tower);
        let from = tv ? this.muzzleOf(tv, true) : null;
        // The Warden's shots leave from the weapon in hand, like the towers' leave their muzzles.
        if (!from && s.src === g.hero && this.hero?.muzzle) {
          this.hero.obj.updateMatrixWorld(true);
          from = this.hero.muzzle.getWorldPosition(new THREE.Vector3());
        }
        const off = from ? from.sub(new THREE.Vector3(wx(s.src.x), s.kind === 'shell' ? 1.1 : 0.85, wz(s.src.y))) : new THREE.Vector3();
        v = { mesh, lx: wx(s.x), lz: wz(s.y), off };
        this.shots.set(s, v);
      }
      const total = Math.hypot(s.tx - s.src.x, s.ty - s.src.y) || 1;
      const f = 1 - Math.min(1, Math.hypot(s.tx - s.x, s.ty - s.y) / total);
      // Shells arc; bolts and shards fly level at lantern height.
      let y = 0.85;
      if (s.kind === 'shell') {
        y = 1.1 + Math.sin(f * Math.PI) * 1.5 - f * 0.9;
      }
      const fade = (1 - f) * (1 - f);
      const x = wx(s.x) + v.off.x * fade, z = wz(s.y) + v.off.z * fade;
      y += v.off.y * fade;
      v.mesh.position.set(x, y, z);
      const heading = Math.atan2(-(z - v.lz), x - v.lx);
      if (type === 'spark') { v.mesh.rotation.set(0, heading, 0); v.mesh.scale.set(0.11, 0.04, 0.04); }
      else if (type === 'kite') { v.mesh.rotation.set(0, heading, 0); v.mesh.scale.set(0.17, 0.025, 0.025); } // the fifth tower: a long harpoon, flying straight
      else v.mesh.rotation.set(performance.now() / 120, heading, 0);
      if (type === 'star' || type === 'spark') {
        const c = new THREE.Color(s.color).multiplyScalar(1.3);
        this.motes.push({ x, y, z, vx: 0, vy: 0.05, vz: 0, life: type === 'star' ? 0.45 : 0.18, max: type === 'star' ? 0.45 : 0.18, color: c, gravity: 0 });
      }
      v.lx = x; v.lz = z;
    }
    for (const [s, v] of this.shots) {
      if (seen.has(s)) continue;
      // A Starfall star landing is a heavy impact.
      if (s.kind === 'shell') this.hitStop(performance.now() / 1000, 0.05);
      this.scene.remove(v.mesh); this.shots.delete(s);
    }
  }

  /**
   * Game feel: holds the picture still for `dur` seconds on a heavy impact. View only; the
   * simulation keeps its pace. Spaced out so a row of Starfalls never makes the board stutter.
   */
  private hitStop(now: number, dur: number) {
    if (now - this.lastHitStop < 0.4) return;
    this.lastHitStop = now;
    this.hitStopUntil = now + dur;
  }

  /** Game feel: a giant (the Gloom Lord) falls with a held beat and a big splash of Gloom ink. */
  private giantFalls(at: THREE.Vector3, now: number) {
    this.hitStop(now, 0.09);
    // Ink thrown up and out, then a low spread of droplets across the ground. Ink colours, no light.
    this.puff(at.x, at.y, at.z, C.violet, 36, 3.2, 3.4);
    const c = new THREE.Color(C.inkLump);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + Math.random() * 0.2, sp = 2.4 + Math.random() * 1.2;
      this.motes.push({ x: at.x, y: 0.08, z: at.z, vx: Math.cos(a) * sp, vy: 0.25, vz: Math.sin(a) * sp, life: 0.7, max: 0.7, color: c, gravity: 0.6 });
    }
  }

  /** A burst of small motes, e.g. dust when a tower lands or ink when an enemy pops. */
  private puff(x: number, y: number, z: number, color: string, n: number, speed: number, gravity = 1.5) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      this.motes.push({ x, y, z, vx: Math.cos(a) * v, vy: 0.6 + Math.random() * speed * 0.8, vz: Math.sin(a) * v, life: 0.5 + Math.random() * 0.3, max: 0.8, color: c, gravity });
    }
  }

  private syncFx(g: Game) {
    let lc = 0;
    const lpos = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const seen = new Set<Fx>();
    for (const f of g.fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === 'ring') {
        seen.add(f);
        let m = this.rings.get(f);
        if (!m) {
          m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: f.color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
          m.rotation.x = -Math.PI / 2;
          this.scene.add(m);
          this.rings.set(f, m);
        }
        m.scale.setScalar(Math.max(0.01, (f.r0 + (f.r1 - f.r0) * (1 - a * a)) / T));
        m.position.set(wx(f.x), this.standY(f.x, f.y) + 0.06, wz(f.y));
        (m.material as THREE.MeshBasicMaterial).opacity = a * 0.55;
      } else if (f.k === 'line' && lc < 400) {
        lpos.setXYZ(lc * 2, wx(f.x), 0.5, wz(f.y));
        lpos.setXYZ(lc * 2 + 1, wx(f.x2), 0.5, wz(f.y2));
        lc++;
      }
    }
    for (const [f, m] of this.rings) {
      if (!seen.has(f)) { this.scene.remove(m); (m.material as THREE.Material).dispose(); this.rings.delete(f); }
    }
    this.lines.geometry.setDrawRange(0, lc * 2);
    lpos.needsUpdate = true;
  }

  /** Simulation sparks plus the view's own motes, drawn as one point cloud. */
  private drawPoints(g: Game) {
    const dt = 1 / 60;
    let n = 0;
    const col = new THREE.Color();
    for (const f of g.fx) {
      if (f.k !== 'p' || n >= MAX_POINTS || f.life / f.max < 0.15) continue;
      this.pPos.set([wx(f.x), 0.35 + (1 - f.life / f.max) * 0.6, wz(f.y)], n * 3);
      col.set(f.color);
      this.pCol.set([col.r, col.g, col.b], n * 3);
      n++;
    }
    this.motes = this.motes.filter((m) => {
      m.life -= dt;
      if (m.life <= 0) return false;
      m.vy -= m.gravity * dt;
      m.x += m.vx * dt; m.y = Math.max(0.02, m.y + m.vy * dt); m.z += m.vz * dt;
      m.vx *= 0.94; m.vz *= 0.94;
      if (n < MAX_POINTS && m.life / m.max > 0.12) {
        this.pPos.set([m.x, m.y, m.z], n * 3);
        this.pCol.set([m.color.r, m.color.g, m.color.b], n * 3);
        n++;
      }
      return true;
    });
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  // ---------- cursor ----------

  private setGhost(type: TowerType | 'hero' | null, loadout?: Loadout) {
    if (this.ghost && this.ghost.type === type) return;
    if (this.ghost) { this.scene.remove(this.ghost.obj); disposeTree(this.ghost.obj); this.ghost = null; }
    if (!type) return;
    const obj = type === 'hero' ? makeHero(loadout!) : makeTower(type, 1, null);
    if (type === 'hero') obj.scale.setScalar(HERO_SCALE);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = (m.material as THREE.Material).clone();
        mat.transparent = true;
        mat.opacity = 0.55;
        mat.depthWrite = false;
        m.material = mat;
        m.castShadow = false;
      }
    });
    this.ghost = { type, obj };
    this.scene.add(obj);
  }

  private updateCursor(g: Game) {
    const hover = g.build ? g.hover : null;
    this.setGhost(hover ? g.build : null, g.loadout);
    if (hover && g.build) {
      const isHero = g.build === 'hero';
      const ok = canBuild(g, hover.x, hover.y) && (isHero ? !g.hero : g.gold >= TOWERS[g.build as TowerType].cost);
      // Terrain: the ring shows a hill's longer reach before building.
      const range = (isHero ? WEAPONS[g.loadout.weapon].range * (1 + 0.08 * g.heroTalents.reach) : TOWERS[g.build as TowerType].range) * reachAt(g.map, hover.x, hover.y);
      const x = wx(hover.x), z = wz(hover.y), y = this.standY(hover.x, hover.y);
      this.footprint.visible = true;
      this.footprint.position.set(x, y + 0.03, z);
      (this.footprint.material as THREE.MeshBasicMaterial).color.set(ok ? '#ffffff' : '#ff4f5e');
      this.buildRing.visible = true;
      this.buildRing.position.set(x, y + 0.03, z);
      this.buildRing.scale.setScalar(range);
      (this.buildRing.material as THREE.MeshBasicMaterial).color.set(ok ? (reachAt(g.map, hover.x, hover.y) > 1 ? '#ffe7a8' : '#ffffff') : '#ff4f5e'); // terrain: golden on a hill
      this.ghost!.obj.position.set(x, y, z);
      this.ghost!.obj.visible = ok;
    } else {
      this.footprint.visible = false;
      this.buildRing.visible = false;
    }
    // In-game controls: a hovered or tapped tower shows its ring, and while an upgrade is being
    // previewed the ring eases out to the next level's range.
    const focus = this.rangeFocus ?? (g.selected ? { t: g.selected, range: stats(g.selected).range } : null);
    if (focus && !g.towers.includes(focus.t)) this.rangeFocus = null;
    if (focus && g.towers.includes(focus.t)) {
      const now = performance.now() / 1000, dt = Math.min(0.1, now - this.ringT);
      if (this.ringFor !== focus.t || !this.selectRing.visible) this.ringScale = stats(focus.t).range;
      this.ringScale += (focus.range - this.ringScale) * (1 - Math.exp(-dt * 14));
      this.ringT = now;
      this.ringFor = focus.t;
      this.selectRing.visible = true;
      this.selectRing.position.set(wx(focus.t.x), this.standY(focus.t.x, focus.t.y) + 0.03, wz(focus.t.y));
      this.selectRing.scale.setScalar(this.ringScale);
      (this.selectRing.material as THREE.MeshBasicMaterial).color.set(focus.range > stats(focus.t).range + 1e-3 ? '#ffe7a8' : '#fff6dc');
    } else if (g.heroSelected && g.hero) {
      this.ringFor = null;
      this.selectRing.visible = true;
      this.selectRing.position.set(wx(g.hero.x), this.standY(g.hero.x, g.hero.y) + 0.03, wz(g.hero.y));
      this.selectRing.scale.setScalar(heroStats(g.hero).range);
      (this.selectRing.material as THREE.MeshBasicMaterial).color.set('#ffe7a8');
    } else this.selectRing.visible = false;
  }

  // ---------- economy buildings: mills (lab experiment) ----------

  private millViews = new Map<Mill, { obj: THREE.Group; stage: number; builtAt: number; payAt: number; payKick: number; phase: number }>();
  private millGhost: THREE.Group | null = null;
  private millFoot: THREE.Mesh | null = null;

  private clearMills() {
    for (const v of this.millViews.values()) { this.scene.remove(v.obj); disposeTree(v.obj); }
    this.millViews.clear();
    if (this.millGhost) { this.scene.remove(this.millGhost); disposeTree(this.millGhost); this.millGhost = null; }
    if (this.millFoot) this.millFoot.visible = false;
  }

  /** Keeps one model per mill in sync: a pop when built or grown, turning sails, and a hop and coins when it pays. */
  private syncMills(g: Game, now: number) {
    const seen = new Set<Mill>();
    for (const m of g.mills ?? []) {
      seen.add(m);
      const stage = millStageOf(m);
      let v = this.millViews.get(m);
      if (!v || v.stage !== stage) {
        const grown = !!v;
        if (v) { this.scene.remove(v.obj); disposeTree(v.obj); }
        const obj = makeMill(stage);
        addOutlines(obj);
        obj.position.set(wx(m.x), 0, wz(m.y));
        this.scene.add(obj);
        v = { obj, stage, builtAt: grown ? now - 0.12 : now, payAt: m.payAt, payKick: -9, phase: (m.x * 13 + m.y * 7) % 6.28 };
        this.millViews.set(m, v);
        this.puff(wx(m.x), 0.1, wz(m.y), '#efe2c4', grown ? 10 : 16, 1.2);
      }
      if (m.payAt !== v.payAt) {
        v.payAt = m.payAt;
        v.payKick = now;
        this.puff(wx(m.x), 0.9, wz(m.y), MILL.color, 12, 0.9, 2.5);
      }
      const pay = kick(now, v.payKick, 0.6), ph = v.phase;
      const s = TOWER_SCALE * easeOutBack(clamp01((now - v.builtAt) / 0.45));
      v.obj.scale.set(s * (1 + 0.06 * pay), s * (1 + 0.12 * pay), s * (1 + 0.06 * pay));
      const sails = v.obj.getObjectByName('spin');
      if (sails) sails.rotation.z = -(now * (0.5 + 0.25 * stage) + ph + pay * 2.5);
      const flag = v.obj.getObjectByName('flag');
      if (flag) flag.rotation.y = Math.sin(now * 3 + ph) * 0.35;
      const sw = v.obj.getObjectByName('swing');
      if (sw) sw.rotation.z = Math.sin(now * 1.8 + ph) * 0.07;
      const coin = v.obj.getObjectByName('float');
      if (coin) {
        coin.position.y = (coin.userData.y0 ??= coin.position.y) + Math.sin(now * 1.6 + ph) * 0.03 + pay * 0.1;
        coin.rotation.y = now * 1.2 + pay * 6;
      }
    }
    for (const [m, v] of this.millViews) {
      if (!seen.has(m)) {
        this.puff(v.obj.position.x, 0.2, v.obj.position.z, '#cfc3ad', 18, 1.5);
        this.scene.remove(v.obj); disposeTree(v.obj); this.millViews.delete(m);
      }
    }
    this.millCursor(g);
  }

  /** The see-through mill under the pointer while placing one, and a ring under the selected mill. */
  private millCursor(g: Game) {
    if (!this.millFoot) {
      this.millFoot = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.43, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }));
      this.millFoot.rotation.x = -Math.PI / 2;
      this.scene.add(this.millFoot);
    }
    const foot = this.millFoot, mat = foot.material as THREE.MeshBasicMaterial;
    const hover = g.millBuild && !g.build ? g.hover : null;
    if (hover && !this.millGhost) {
      const obj = makeMill(1);
      obj.scale.setScalar(TOWER_SCALE);
      obj.traverse((o) => {
        const me = o as THREE.Mesh;
        if (!me.isMesh) return;
        const mm = (me.material as THREE.Material).clone();
        mm.transparent = true; mm.opacity = 0.55; mm.depthWrite = false;
        me.material = mm; me.castShadow = false;
      });
      this.millGhost = obj;
      this.scene.add(obj);
    } else if (!hover && this.millGhost) {
      this.scene.remove(this.millGhost); disposeTree(this.millGhost); this.millGhost = null;
    }
    if (hover) {
      const ok = canBuild(g, hover.x, hover.y) && canAffordMill(g);
      foot.visible = true;
      foot.position.set(wx(hover.x), 0.03, wz(hover.y));
      mat.color.set(ok ? '#ffffff' : '#ff4f5e');
      this.millGhost!.position.set(wx(hover.x), 0, wz(hover.y));
      this.millGhost!.visible = ok;
    } else if (g.millSelected && g.mills?.includes(g.millSelected)) {
      foot.visible = true;
      foot.position.set(wx(g.millSelected.x), 0.03, wz(g.millSelected.y));
      mat.color.set('#ffe7a8');
    } else foot.visible = false;
  }
  // ---------- end economy buildings ----------

  // ---------- world ----------

  private animateWorld(g: Game, now: number) {
    if (this.heart && this.heartFlame) {
      const health = clamp01(g.lives / g.maxLives);
      const beat = 1 + 0.06 * Math.sin(now * 2.4);
      const flame = this.heart.getObjectByName('flame')!;
      flame.scale.set(beat * (0.6 + 0.4 * health), (1 + 0.12 * Math.sin(now * 9)) * (0.5 + 0.5 * health), beat * (0.6 + 0.4 * health));
      this.heartFlame.color.set(C.flame).lerp(new THREE.Color('#c2412a'), 1 - health).multiplyScalar(1.2 + 0.8 * health);
      this.heartLight.intensity = (1.5 + 3 * health) * beat;
    }
    this.animateRifts(g, now);
    for (const m of this.mills) m.rotation.z = now * 0.6;
    for (const f of this.flickers) f.scale.setScalar(1 + Math.sin(now * 13 + f.id) * 0.06);

    const fp = this.pollen.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.pollenSeeds.forEach((f, i) => {
      fp.setXYZ(i, f.x + Math.sin(now * f.s + f.p) * 0.8, 0.6 + Math.sin(now * f.s * 1.7 + f.p * 2) * 0.35, f.z + Math.cos(now * f.s * 0.8 + f.p) * 0.8);
    });
    fp.needsUpdate = true;
  }

  // ---------- 2D overlay ----------

  /** Projects a world point to overlay pixels. */
  private toScreen(x: number, y: number, z: number) {
    const p = this.tmp.set(x + this.scene.position.x, y, z + this.scene.position.z).project(this.camera);
    return { sx: ((p.x + 1) / 2) * this.size.w, sy: ((1 - p.y) / 2) * this.size.h };
  }

  private drawOverlay(g: Game) {
    const ctx = this.overlay, c = ctx.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    // One tile's width on screen, so bars and text scale with the board.
    const scale = Math.min(1.6, this.size.w / (this.camera.right - this.camera.left) / 60);

    for (const e of g.enemies) {
      if (e.hp >= e.maxHp) continue;
      const v = this.enemies.get(e);
      if (!v) continue;
      const r = e.def.r * ENEMY_SCALE;
      const { sx, sy } = this.toScreen(v.obj.position.x, v.obj.position.y + r + 0.3, v.obj.position.z);
      const w = Math.max(22, e.def.r * 110) * scale, h = 5;
      const f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(30,20,35,0.85)';
      ctx.beginPath(); ctx.roundRect(sx - w / 2 - 1.5, sy - 1.5, w + 3, h + 3, 3); ctx.fill();
      ctx.fillStyle = f > 0.5 ? '#8ee06a' : f > 0.25 ? '#ffc94a' : '#ff5a5a';
      ctx.beginPath(); ctx.roundRect(sx - w / 2, sy, w * f, h, 2); ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of g.fx) {
      if (f.k !== 'txt') continue;
      const life = f.life / f.max;
      ctx.globalAlpha = Math.min(1, life * 2.5);
      const pop = 1 + 0.25 * Math.max(0, (life - 0.85) / 0.15);
      ctx.font = `800 ${Math.round(f.size * pop * Math.max(0.8, scale))}px ${FONT}`;
      const { sx, sy } = this.toScreen(wx(f.x), 1.4, wz(f.y));
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40,24,40,0.9)';
      ctx.strokeText(f.text, sx, sy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
    this.drawComboWords(g, scale);
    this.drawTerrainHint(g, scale);
  }

  // ---------- terrain and rifts that move ----------

  /** Ground height under a simulation point, never below the grass: towers stand on hills, not in hollows. */
  private standY(x: number, y: number) {
    return this.ground ? Math.max(0, this.ground(wx(x), wz(y))) : 0;
  }

  /** How far a walking shadow sinks where the road wades through water (flyers stay up). */
  private wade(e: Enemy, x: number, z: number) {
    if (!this.ground || e.def.traits.includes('flying')) return 0;
    const h = this.ground(x, z);
    return h < -0.06 ? Math.max(WATER_LEVEL - 0.08, h + 0.05) : 0;
  }

  /**
   * Every rift's swirl turns; on a map with several rifts the one the next (or current) wave comes
   * from opens wide and bright, while the others close to a slow ember.
   */
  private animateRifts(g: Game, now: number) {
    const rifts = this.portal?.children ?? [];
    const many = riftCount(g.map) > 1;
    const next = g.active ? g.rift : waveRift(g.map, g.wave + 1);
    const dt = Math.min(0.1, now - (this.riftT || now));
    this.riftT = now;
    rifts.forEach((rift, i) => {
      const want = !many || i === next ? 1 : 0.35;
      this.riftOpen[i] = (this.riftOpen[i] ?? 1) + (want - (this.riftOpen[i] ?? 1)) * (1 - Math.exp(-dt * 4));
      const open = this.riftOpen[i];
      const swirl = rift.getObjectByName('swirl');
      if (swirl) { swirl.rotation.z = now * (0.5 + 1.1 * open); swirl.scale.setScalar((0.55 + 0.45 * open) * (1 + Math.sin(now * 3 + i) * 0.05 * open)); }
    });
  }
  private riftT = 0;

  /** While placing a tower or the Warden, a short line over the ghost says what the ground there does. */
  private drawTerrainHint(g: Game, scale: number) {
    const hover = g.build ? g.hover : null;
    if (!hover || !canBuild(g, hover.x, hover.y)) return;
    const s = L().terrain, lines: string[] = [];
    const isHero = g.build === 'hero';
    if (reachAt(g.map, hover.x, hover.y) > 1) lines.push(s.hill(Math.round((HILL_REACH - 1) * 100)));
    const range = (isHero ? WEAPONS[g.loadout.weapon].range : TOWERS[g.build as TowerType].range) * reachAt(g.map, hover.x, hover.y) * T;
    if (woodsNear(g.map, hover.x, hover.y, range)) {
      const kind = isHero ? (WEAPONS[g.loadout.weapon].kind === 'wave' ? 'wave' : 'shot') : TOWERS[g.build as TowerType].kind;
      if (kind === 'shot') lines.push(s.woods);
      else if (kind === 'shell') lines.push(s.arcs);
    }
    if (!lines.length) return;
    const ctx = this.overlay;
    const { sx, sy } = this.toScreen(wx(hover.x), this.standY(hover.x, hover.y) + 1.5, wz(hover.y));
    ctx.font = `800 ${Math.round(14 * Math.max(0.8, scale))}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    lines.forEach((text, i) => {
      const y = sy - (lines.length - 1 - i) * 18 * Math.max(0.8, scale);
      ctx.strokeStyle = 'rgba(40,24,40,0.9)';
      ctx.strokeText(text, sx, y);
      ctx.fillStyle = '#ffe7a8';
      ctx.fillText(text, sx, y);
    });
  }
  // ---------- end terrain and rifts that move ----------

  // ---------- combos between towers ----------

  /** When the view first drew each combo word, in seconds of real time. */
  private comboSeen = new WeakMap<ComboWord, number>();

  /** Letters each combo's word over the shadow it hit: a quick pop, a short rise, then a fade. */
  private drawComboWords(g: Game, scale: number) {
    const words = g.combo?.words;
    if (!words?.length) return;
    const ctx = this.overlay, names = L().combos.words;
    ctx.save();
    // The overlay's own transform (device pixel ratio); each word is drawn around its own origin on top of it.
    const m = ctx.getTransform();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const now = performance.now() / 1000;
    for (const w of words) {
      // Aged in real time from the frame the view first sees it, so a word reads the same at any
      // game speed and still plays out while the lab gallery is paused.
      let seen = this.comboSeen.get(w);
      if (seen === undefined) {
        if (g.t - w.at >= WORD_LIFE) continue;
        seen = now;
        this.comboSeen.set(w, seen);
      }
      const age = now - seen;
      if (age >= WORD_LIFE) continue;
      // Follow the shadow while it lives; stay where it fell once it is gone.
      const v = !w.enemy.dead ? this.enemies.get(w.enemy) : undefined;
      if (!w.enemy.dead) { w.x = w.enemy.x; w.y = w.enemy.y; }
      const r = w.enemy.def.r * ENEMY_SCALE;
      const base = v ? v.obj.position : { x: wx(w.x), y: 0, z: wz(w.y) };
      const p = age / WORD_LIFE;
      const { sx, sy } = this.toScreen(base.x, base.y + r + 0.55 + 0.35 * p, base.z);
      const pop = easeOutBack(clamp01(age / 0.16));
      ctx.globalAlpha = clamp01((1 - p) / 0.35);
      ctx.font = `italic 800 ${Math.round(21 * Math.max(0.8, scale) * Math.max(0.3, pop))}px ${FONT}`;
      ctx.setTransform(m.a, 0, 0, m.d, m.a * sx + m.e, m.d * sy + m.f);
      ctx.rotate(w.id === 'steam' ? 0.06 : -0.07);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(40,24,40,0.92)';
      ctx.strokeText(names[w.id], 0, 0);
      ctx.fillStyle = COMBOS[w.id].color;
      ctx.fillText(names[w.id], 0, 0);
    }
    ctx.restore();
  }
  // ---------- end combos between towers ----------
}
