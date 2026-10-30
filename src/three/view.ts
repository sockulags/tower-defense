import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { COLS, ROWS, T } from '../config';
import { TOWERS } from '../data/towers';
import { canBuild, needsBranch, stats } from '../game/towers';
import { heartOf } from '../game/path';
import { glow, makeBoard, makeEnemy, makeHeart, makePortal, makeTower, tileToWorld } from './models';
import type { Enemy, Fx, Game, Shot, Tower, TowerType } from '../types';

const SKY = '#161735';
const FONT = '"Alegreya Sans", sans-serif';
const MAX_PARTICLES = 1200;
/** Enemies are drawn a little larger than their hit radius so they read at a distance. */
const ENEMY_SCALE = 1.25;

/** Simulation pixels to world units: one tile is one unit, the board is centred on the origin. */
const wx = (x: number) => x / T - COLS / 2;
const wz = (y: number) => y / T - ROWS / 2;

interface TowerView { obj: THREE.Group; key: string; pool: THREE.Mesh; yaw: number }
interface EnemyView { obj: THREE.Group; lx: number; lz: number; yaw: number }

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
}

/** A soft round texture for ground light pools, made once. */
function makePoolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class GameView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 16 / 10, 0.1, 100);
  private cameraBase = new THREE.Vector3(0, 15.4, 10.9);
  private cameraTarget = new THREE.Vector3(0, 0, 0.7);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private overlay: CanvasRenderingContext2D;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private world = new THREE.Group();
  private game: Game | null = null;
  private towers = new Map<Tower, TowerView>();
  private enemies = new Map<Enemy, EnemyView>();
  private shots = new Map<Shot, THREE.Mesh>();
  private rings = new Map<Fx, THREE.Mesh>();
  private heart: THREE.Group | null = null;
  private heartLight = new THREE.PointLight('#ffae5c', 6, 7, 1.6);
  private portal: THREE.Group | null = null;
  private mills: THREE.Object3D[] = [];

  private poolTexture = makePoolTexture();
  private particles: THREE.Points;
  private pPos = new Float32Array(MAX_PARTICLES * 3);
  private pCol = new Float32Array(MAX_PARTICLES * 3);
  private lines: THREE.LineSegments;
  private fireflies: THREE.Points;
  private fireflySeeds: { x: number; z: number; p: number; s: number }[] = [];

  private hoverTile: THREE.Mesh;
  private buildRing: THREE.Mesh;
  private selectRing: THREE.Mesh;
  private ghost: { type: TowerType; obj: THREE.Group } | null = null;
  private shotGeo = new THREE.IcosahedronGeometry(1, 0);
  private ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  private tmp = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.overlay = overlayCanvas.getContext('2d')!;

    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 20, 38);
    this.scene.add(this.world);

    this.scene.add(new THREE.HemisphereLight('#7f86d6', '#2d2333', 1.15));
    const moon = new THREE.DirectionalLight('#b9c2ff', 1.6);
    moon.position.set(-7, 14, -5);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 40 });
    moon.shadow.bias = -0.0008;
    moon.shadow.normalBias = 0.02;
    this.scene.add(moon);
    this.scene.add(this.heartLight);

    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(this.cameraTarget);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(960, 600), 0.75, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 6), 3));
    this.lines = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ color: '#d9c8ff', transparent: true, opacity: 0.8 }));
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);

    const fGeo = new THREE.BufferGeometry();
    const fPos = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i++) {
      this.fireflySeeds.push({ x: (Math.random() - 0.5) * (COLS + 1), z: (Math.random() - 0.5) * (ROWS + 1), p: Math.random() * 10, s: 0.3 + Math.random() * 0.5 });
    }
    fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    this.fireflies = new THREE.Points(fGeo, new THREE.PointsMaterial({
      size: 0.07, color: '#d8ff9a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);

    this.hoverTile = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25, depthWrite: false }));
    this.hoverTile.rotation.x = -Math.PI / 2;
    this.hoverTile.position.y = 0.01;
    this.buildRing = this.makeRangeRing();
    this.selectRing = this.makeRangeRing();
    this.scene.add(this.hoverTile, this.buildRing, this.selectRing);

    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  private rangeGeo = new THREE.RingGeometry(0.975, 1, 72);

  private makeRangeRing() {
    // Kept dim so the bloom pass leaves it a thin line.
    const ring = new THREE.Mesh(this.rangeGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.scale.set(1, 1, 1);
    ring.visible = false;
    return ring;
  }

  private resize() {
    const w = this.canvas.clientWidth || 960;
    const h = Math.round((w * 10) / 16);
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
    for (const v of this.towers.values()) { this.scene.remove(v.obj, v.pool); disposeTree(v.obj); }
    for (const v of this.enemies.values()) { this.scene.remove(v.obj); disposeTree(v.obj); }
    for (const m of this.shots.values()) this.scene.remove(m);
    for (const m of this.rings.values()) { this.scene.remove(m); (m.material as THREE.Material).dispose(); }
    this.towers.clear(); this.enemies.clear(); this.shots.clear(); this.rings.clear();
    this.world.children.slice().forEach((c) => { this.world.remove(c); disposeTree(c); });
    this.mills = [];
    this.setGhost(null);
    this.game = g;
    if (!g) return;

    const board = makeBoard(g.map);
    board.traverse((o) => { if (o.name === 'blades') this.mills.push(o); });
    this.world.add(board);

    const heart = heartOf(g.path);
    this.heart = makeHeart();
    this.heart.position.set(wx(heart.x), 0, wz(heart.y));
    this.world.add(this.heart);
    this.heartLight.position.set(wx(heart.x), 1.2, wz(heart.y));

    const [px, py] = g.map.pts[0], [nx, ny] = g.map.pts[1];
    const start = tileToWorld(px, py);
    this.portal = makePortal();
    this.portal.position.set(start.x, 0, start.z);
    this.portal.rotation.y = -Math.atan2(ny - py, nx - px);
    this.world.add(this.portal);
  }

  /** Converts a pointer position to a board tile, or null when it misses the board plane. */
  pickTile(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.tmp);
    if (!hit) return null;
    return { tx: Math.floor(hit.x + COLS / 2), ty: Math.floor(hit.z + ROWS / 2) };
  }

  render(g: Game) {
    const time = performance.now() / 1000;
    this.syncTowers(g, time);
    this.syncEnemies(g);
    this.syncShots(g);
    this.syncFx(g);
    this.updateCursor(g);
    this.animateWorld(g, time);

    const shake = g.shake * 0.25;
    this.camera.position.set(
      this.cameraBase.x + (Math.random() - 0.5) * shake,
      this.cameraBase.y + (Math.random() - 0.5) * shake,
      this.cameraBase.z,
    );
    this.camera.lookAt(this.cameraTarget);
    this.composer.render();
    this.drawOverlay(g);
  }

  private syncTowers(g: Game, time: number) {
    const seen = new Set<Tower>();
    for (const t of g.towers) {
      seen.add(t);
      const key = `${t.level}:${t.branch}`;
      let v = this.towers.get(t);
      if (!v || v.key !== key) {
        const yaw = v?.yaw ?? -t.angle;
        if (v) { this.scene.remove(v.obj, v.pool); disposeTree(v.obj); }
        const obj = makeTower(t.type, t.level, t.branch);
        obj.position.set(wx(t.x), 0, wz(t.y));
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
          map: this.poolTexture, color: TOWERS[t.type].color, transparent: true, opacity: 0.32,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(wx(t.x), 0.015, wz(t.y));
        pool.scale.setScalar(2.4);
        this.scene.add(obj, pool);
        v = { obj, key, pool, yaw };
        this.towers.set(t, v);
      }
      const head = v.obj.getObjectByName('head');
      if (head) {
        if (t.type === 'frost') head.rotation.y = time * 0.5;
        else {
          // Ease toward the aim angle so turning reads smoothly.
          const target = -t.angle;
          let diff = target - v.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          v.yaw += diff * 0.25;
          head.rotation.y = v.yaw;
        }
      }
      const flame = v.obj.getObjectByName('flame');
      if (flame) flame.scale.set(1 + 0.08 * Math.sin(time * 13 + t.tx), 1 + 0.18 * Math.sin(time * 9 + t.ty), 1);
      const spin = v.obj.getObjectByName('spin');
      if (spin) { spin.rotation.y = time * 1.4; spin.position.y = 1.25 + Math.sin(time * 2 + t.tx) * 0.05; }
      const mist = v.obj.getObjectByName('mist');
      if (mist) mist.rotation.z = time * 0.8;
      const badge = v.obj.getObjectByName('badge');
      if (badge) {
        badge.visible = needsBranch(t);
        badge.position.y = 1.5 + Math.sin(time * 4) * 0.07;
        badge.rotation.y = time * 2;
      }
      const pop = 1 + 0.18 * t.flash;
      v.obj.scale.setScalar(pop);
      (v.pool.material as THREE.MeshBasicMaterial).opacity = 0.28 + 0.04 * Math.sin(time * 3 + t.tx) + 0.3 * t.flash;
    }
    for (const [t, v] of this.towers) {
      if (!seen.has(t)) { this.scene.remove(v.obj, v.pool); disposeTree(v.obj); this.towers.delete(t); }
    }
  }

  private syncEnemies(g: Game) {
    const seen = new Set<Enemy>();
    for (const e of g.enemies) {
      seen.add(e);
      const x = wx(e.x), z = wz(e.y);
      let v = this.enemies.get(e);
      if (!v) {
        const obj = makeEnemy(e.type);
        obj.scale.setScalar(ENEMY_SCALE);
        this.scene.add(obj);
        v = { obj, lx: x, lz: z, yaw: 0 };
        this.enemies.set(e, v);
      }
      const r = e.def.r, t = g.t * 6 + e.seed;
      const dx = x - v.lx, dz = z - v.lz;
      if (dx * dx + dz * dz > 1e-6) {
        const target = Math.atan2(-dz, dx);
        const diff = Math.atan2(Math.sin(target - v.yaw), Math.cos(target - v.yaw));
        v.yaw += diff * 0.3;
      }
      v.lx = x; v.lz = z;
      const hop = e.type === 'flitter' ? 0.35 + Math.sin(t * 1.3) * 0.06 : Math.abs(Math.sin(t * 0.9)) * 0.06;
      v.obj.position.set(x, (r + hop) * ENEMY_SCALE, z);
      const body = v.obj.getObjectByName('body')!;
      body.rotation.y = v.yaw;
      const sq = Math.sin(t) * 0.07;
      body.scale.set(1 + sq, 1 - sq, 1 + sq);
      if (e.type === 'flitter') {
        const flap = Math.sin(g.t * 22 + e.seed) * 0.7;
        body.getObjectByName('wingL')!.rotation.x = -flap;
        body.getObjectByName('wingR')!.rotation.x = flap;
      }
      const shell = body.getObjectByName('shell');
      if (shell) shell.scale.setScalar(1 + Math.sin(t * 1.5) * 0.06);
      const slow = v.obj.getObjectByName('slow')!;
      slow.visible = e.slowUntil > g.t;
      slow.position.y = -r + 0.04;
      v.obj.getObjectByName('burn')!.visible = e.burnUntil > g.t;
      const stun = v.obj.getObjectByName('stun')!;
      stun.visible = e.stun > g.t;
      stun.rotation.y = g.t * 6;
    }
    for (const [e, v] of this.enemies) {
      if (!seen.has(e)) { this.scene.remove(v.obj); disposeTree(v.obj); this.enemies.delete(e); }
    }
  }

  private syncShots(g: Game) {
    const seen = new Set<Shot>();
    for (const s of g.shots) {
      seen.add(s);
      let m = this.shots.get(s);
      if (!m) {
        m = new THREE.Mesh(this.shotGeo, glow(s.color, 3.4));
        m.scale.setScalar(s.kind === 'shell' ? 0.1 : 0.055);
        this.scene.add(m);
        this.shots.set(s, m);
      }
      // Shells arc; other shots fly level at lantern height.
      let y = 0.85;
      if (s.kind === 'shell') {
        const total = Math.hypot(s.tx - s.tw.x, s.ty - s.tw.y) || 1;
        const left = Math.hypot(s.tx - s.x, s.ty - s.y);
        const f = 1 - Math.min(1, left / total);
        y = 0.9 + Math.sin(f * Math.PI) * 1.4 - f * 0.6;
      }
      m.position.set(wx(s.x), y, wz(s.y));
    }
    for (const [s, m] of this.shots) if (!seen.has(s)) { this.scene.remove(m); this.shots.delete(s); }
  }

  private syncFx(g: Game) {
    let pc = 0, lc = 0;
    const lpos = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const seen = new Set<Fx>();
    const col = new THREE.Color();
    for (const f of g.fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.k === 'p' && pc < MAX_PARTICLES) {
        this.pPos.set([wx(f.x), 0.3 + (1 - a) * 0.7, wz(f.y)], pc * 3);
        col.set(f.color).multiplyScalar(a * 1.6);
        this.pCol.set([col.r, col.g, col.b], pc * 3);
        pc++;
      } else if (f.k === 'ring') {
        seen.add(f);
        let m = this.rings.get(f);
        if (!m) {
          m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
            color: f.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
          }));
          m.rotation.x = -Math.PI / 2;
          this.scene.add(m);
          this.rings.set(f, m);
        }
        const r = (f.r0 + (f.r1 - f.r0) * (1 - a)) / T;
        m.scale.setScalar(Math.max(0.01, r));
        m.position.set(wx(f.x), 0.06, wz(f.y));
        (m.material as THREE.MeshBasicMaterial).opacity = a * 0.9;
      } else if (f.k === 'line' && lc < 400) {
        lpos.setXYZ(lc * 2, wx(f.x), 0.4, wz(f.y));
        lpos.setXYZ(lc * 2 + 1, wx(f.x2), 0.4, wz(f.y2));
        lc++;
      }
    }
    for (const [f, m] of this.rings) {
      if (!seen.has(f)) { this.scene.remove(m); (m.material as THREE.Material).dispose(); this.rings.delete(f); }
    }
    const pg = this.particles.geometry;
    pg.setDrawRange(0, pc);
    (pg.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (pg.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.lines.geometry.setDrawRange(0, lc * 2);
    lpos.needsUpdate = true;
  }

  private setGhost(type: TowerType | null) {
    if (this.ghost && this.ghost.type === type) return;
    if (this.ghost) { this.scene.remove(this.ghost.obj); disposeTree(this.ghost.obj); this.ghost = null; }
    if (!type) return;
    const obj = makeTower(type, 1, null);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = (m.material as THREE.Material).clone();
        mat.transparent = true;
        mat.opacity = 0.5;
        mat.depthWrite = false;
        m.material = mat;
        m.castShadow = false;
      }
    });
    this.ghost = { type, obj };
    this.scene.add(obj);
  }

  private updateCursor(g: Game) {
    const hover = g.build && g.hover && g.hover.tx >= 0 && g.hover.ty >= 0 && g.hover.tx < COLS && g.hover.ty < ROWS ? g.hover : null;
    this.setGhost(hover ? g.build : null);
    if (hover && g.build) {
      const ok = canBuild(g, hover.tx, hover.ty) && g.gold >= TOWERS[g.build].cost;
      const { x, z } = tileToWorld(hover.tx, hover.ty);
      this.hoverTile.visible = true;
      this.hoverTile.position.set(x, 0.012, z);
      (this.hoverTile.material as THREE.MeshBasicMaterial).color.set(ok ? '#7fc28a' : '#ff5f6d');
      this.buildRing.visible = true;
      this.buildRing.position.set(x, 0.02, z);
      this.buildRing.scale.setScalar(TOWERS[g.build].range);
      (this.buildRing.material as THREE.MeshBasicMaterial).color.set(ok ? '#5f9a6a' : '#b8444f');
      this.ghost!.obj.position.set(x, 0, z);
      this.ghost!.obj.visible = ok;
    } else {
      this.hoverTile.visible = false;
      this.buildRing.visible = false;
    }
    if (g.selected) {
      this.selectRing.visible = true;
      this.selectRing.position.set(wx(g.selected.x), 0.02, wz(g.selected.y));
      this.selectRing.scale.setScalar(stats(g.selected).range);
      (this.selectRing.material as THREE.MeshBasicMaterial).color.set('#9d97a8');
    } else this.selectRing.visible = false;
  }

  private animateWorld(g: Game, time: number) {
    if (this.heart) {
      const beat = 1 + 0.08 * Math.sin(time * 2.4);
      const orb = this.heart.getObjectByName('orb') as THREE.Mesh;
      orb.scale.setScalar(beat);
      orb.rotation.y = time * 0.4;
      const health = Math.max(0, g.lives / g.maxLives);
      const mat = orb.material as THREE.MeshStandardMaterial;
      mat.emissive.setHSL(0.02 + 0.07 * health, 1, 0.55);
      mat.color.copy(mat.emissive);
      mat.emissiveIntensity = 1.5 + 2 * health;
      this.heartLight.intensity = (2 + 4 * health) * beat;
    }
    const swirl = this.portal?.getObjectByName('swirl');
    if (swirl) swirl.rotation.z = time * 1.5;
    for (const m of this.mills) m.rotation.z = time * 0.6;

    const fp = this.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.fireflySeeds.forEach((f, i) => {
      fp.setXYZ(i,
        f.x + Math.sin(time * f.s + f.p) * 0.6,
        0.5 + Math.sin(time * f.s * 1.7 + f.p * 2) * 0.3,
        f.z + Math.cos(time * f.s * 0.8 + f.p) * 0.6);
    });
    fp.needsUpdate = true;
    (this.fireflies.material as THREE.PointsMaterial).opacity = 0.6 + 0.3 * Math.sin(time * 3);
  }

  /** Projects a world point to overlay pixels. */
  private toScreen(x: number, y: number, z: number) {
    const p = this.tmp.set(x, y, z).project(this.camera);
    const c = this.overlay.canvas, dpr = c.width / (this.canvas.clientWidth || 1);
    return { sx: ((p.x + 1) / 2) * (c.width / dpr), sy: ((1 - p.y) / 2) * (c.height / dpr) };
  }

  private drawOverlay(g: Game) {
    const ctx = this.overlay, c = ctx.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    const scale = (this.canvas.clientWidth || 960) / 960;

    for (const e of g.enemies) {
      if (e.hp >= e.maxHp) continue;
      const v = this.enemies.get(e);
      if (!v) continue;
      const r = e.def.r;
      const { sx, sy } = this.toScreen(v.obj.position.x, v.obj.position.y + r + 0.25, v.obj.position.z);
      const w = Math.max(20, r * 90) * scale;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(sx - w / 2, sy, w, 4);
      ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#7fc28a' : '#ff5f6d';
      ctx.fillRect(sx - w / 2, sy, w * Math.max(0, e.hp / e.maxHp), 4);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of g.fx) {
      if (f.k !== 'txt') continue;
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      ctx.font = `700 ${Math.round(f.size * Math.max(0.75, scale))}px ${FONT}`;
      const { sx, sy } = this.toScreen(wx(f.x), 1.3, wz(f.y));
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(f.text, sx + 1, sy + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}
