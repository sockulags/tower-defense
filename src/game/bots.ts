// Headless bot players for balance testing. A bot plays a whole run through the simulation with
// no view: it places the Warden and towers on legal free spots along the road, pays for upgrades
// and branches, starts waves and casts the Warden's ability. Runs are seeded, so the same seed
// gives the same run. Used by `npm run balance` (scripts/balance.mjs) and the lab's Balance tab.
import { COLS, MAX_LEVEL, ROWS, T } from '../config';
import { DEFAULT_LOADOUT, HERO_MAX_LEVEL, WEAPONS, heroUpgradeCost, type Loadout } from '../data/hero';
import { ENEMY_ORDER } from '../data/enemies';
import { MAPS } from '../data/maps';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { save } from '../save';
import { castAbility, placeHero, upgradeHero } from './hero';
import { createGame, startWave, update } from './run';
import { canBuild, chooseBranch, needsBranch, placeTower, upgrade, upgradeCost } from './towers';
import type { EnemyType, Game, MapId, Path, Tower, TowerType } from '../types';

/** mixed: a sensible default; spread: every tower, no upgrades; spark/frost/pulse: only that tower;
 *  star: rush Starfall and build nothing else; warden: a few towers, then all gold into the Warden. */
export type StrategyId = 'mixed' | 'spread' | 'spark' | 'frost' | 'pulse' | 'star' | 'warden';
export const STRATEGIES: StrategyId[] = ['mixed', 'spread', 'spark', 'frost', 'pulse', 'star', 'warden'];

/** Damage and kills are tallied per tower type and for the Warden. */
export type SourceKey = TowerType | 'hero';
export const SOURCE_KEYS: SourceKey[] = [...TOWER_ORDER, 'hero'];

interface Plan {
  /** Build rotation; the bot builds these in order, round and round. */
  rotation: TowerType[];
  /** Pour gold into the Warden's levels before anything else. */
  wardenFirst: boolean;
  /** Build a new tower whenever a spot is free instead of upgrading. */
  spread: boolean;
  /** Upgrade instead of building once the cheapest upgrade costs at most this many new towers. */
  upgradeBias: number;
  /** Towers wanted on the board before upgrades are considered: 2 plus this many per wave. */
  perWave: number;
}

/** Exported so tuning scripts can try other bot behaviour. */
export const PLANS: Record<StrategyId, Plan> = {
  mixed: { rotation: ['spark', 'pulse', 'frost', 'star', 'spark', 'star', 'pulse', 'frost', 'star', 'spark'], wardenFirst: false, spread: false, upgradeBias: 1, perWave: 1 },
  spread: { rotation: ['spark', 'frost', 'pulse', 'star'], wardenFirst: false, spread: true, upgradeBias: 0, perWave: 0 },
  spark: { rotation: ['spark'], wardenFirst: false, spread: false, upgradeBias: 1, perWave: 1 },
  frost: { rotation: ['frost'], wardenFirst: false, spread: false, upgradeBias: 1, perWave: 1 },
  pulse: { rotation: ['pulse'], wardenFirst: false, spread: false, upgradeBias: 1, perWave: 1 },
  star: { rotation: ['star'], wardenFirst: false, spread: false, upgradeBias: 1, perWave: 1 },
  warden: { rotation: ['spark', 'pulse', 'frost', 'star', 'spark', 'star', 'pulse', 'frost', 'star', 'spark'], wardenFirst: true, spread: false, upgradeBias: 1, perWave: 1 },
};

export interface BotOptions {
  map: MapId;
  strategy: StrategyId;
  seed: number;
  /** The Warden's kit for the run; defaults to the starting kit. */
  loadout?: Loadout;
  /** Waves to play on a survival map, where the run would otherwise never end. */
  survivalWaves?: number;
  /** Simulation step in seconds. */
  dt?: number;
}

export interface RunResult {
  map: MapId;
  strategy: StrategyId;
  win: boolean;
  /** Waves fully cleared. */
  cleared: number;
  livesLost: number;
  /** Shadows that reached the heart, by type. */
  leaks: Record<EnemyType, number>;
  /** Total gold the run has earned (spent plus banked) after each cleared wave, starting gold included. */
  worth: number[];
  damage: Record<SourceKey, number>;
  kills: Record<SourceKey, number>;
  /** What stood on the board at the end: type, level and branch of every tower. */
  towers: { type: TowerType; level: number; branch: 0 | 1 | null }[];
  heroLevel: number;
}

// ---------- seeded randomness ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- placement ----------

interface Spot { x: number; y: number; cover: number }
const spotCache = new Map<string, Spot[]>();

/**
 * Points along the road every few pixels, for measuring how much road a spot can reach. Early road
 * counts for more (1.5 at the rift down to 0.5 at the heart): shadows killed early never reach
 * towers further on, so a player covers the first stretches before the last.
 */
function roadSamples(path: Path) {
  const out: { x: number; y: number; w: number }[] = [];
  for (const s of path.segs) {
    const n = Math.max(1, Math.ceil(s.l / 6));
    for (let i = 0; i < n; i++) {
      const f = i / n;
      out.push({ x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f, w: 1.5 - (s.start + s.l * f) / path.len });
    }
  }
  return out;
}

/**
 * Every buildable spot on an empty board (a quarter-tile lattice), ranked by how much road lies
 * within `range` tiles, weighted as above. Cached per map and range.
 */
function spotsFor(g: Game, range: number): Spot[] {
  const key = `${g.map.id}:${range.toFixed(2)}`;
  const hit = spotCache.get(key);
  if (hit) return hit;
  const empty = { ...g, towers: [], hero: null } as Game;
  const road = roadSamples(g.path), r2 = (range * T) ** 2, step = T / 4;
  const spots: Spot[] = [];
  for (let y = step; y < ROWS * T; y += step) {
    for (let x = step; x < COLS * T; x += step) {
      if (!canBuild(empty, x, y)) continue;
      let cover = 0;
      for (const p of road) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2) cover += p.w;
      if (cover) spots.push({ x, y, cover });
    }
  }
  spots.sort((a, b) => b.cover - a.cover);
  spotCache.set(key, spots);
  return spots;
}

/** The legal spot that reaches the most road for this range, given what is already built. */
const bestSpot = (g: Game, range: number) => spotsFor(g, range).find((s) => canBuild(g, s.x, s.y)) ?? null;

// ---------- the bot ----------

const MAX_TOWERS = 18;

class Bot {
  next = 0;
  constructor(readonly g: Game, readonly plan: Plan, readonly rnd: () => number) {}

  get nextType() { return this.plan.rotation[this.next % this.plan.rotation.length]; }

  build(): boolean {
    const type = this.nextType;
    if (this.g.gold < TOWERS[type].cost || this.g.towers.length >= MAX_TOWERS) return false;
    const spot = bestSpot(this.g, TOWERS[type].range);
    if (!spot || !placeTower(this.g, type, spot.x, spot.y, true)) return false;
    this.next++;
    return true;
  }

  /** The cheapest next level among the towers, and the Warden when `withHero` is set. */
  cheapestUpgrade(withHero: boolean): { cost: number; run: () => void } | null {
    const g = this.g;
    let best: { cost: number; run: () => void } | null = null;
    for (const t of g.towers) {
      if (t.level >= MAX_LEVEL) continue;
      const cost = upgradeCost(t);
      if (!best || cost < best.cost) best = { cost, run: () => this.levelTower(t) };
    }
    const h = g.hero;
    if (withHero && h && h.level < HERO_MAX_LEVEL) {
      const cost = heroUpgradeCost(h.level);
      if (!best || cost < best.cost) best = { cost, run: () => upgradeHero(g) };
    }
    return best;
  }

  levelTower(t: Tower) {
    if (needsBranch(t)) chooseBranch(this.g, t, this.rnd() < 0.5 ? 0 : 1);
    else upgrade(this.g, t);
  }

  /** Spends gold until the next thing it wants is too expensive, then saves up. */
  think() {
    const g = this.g, plan = this.plan;
    if (!g.hero) {
      const spot = bestSpot(g, WEAPONS[g.loadout.weapon].range);
      if (spot) placeHero(g, spot.x, spot.y);
    }
    for (let guard = 0; guard < 40; guard++) {
      const h = g.hero;
      // Warden first: once a small tower base stands, every coin goes to the Warden until it is maxed.
      if (plan.wardenFirst && h && h.level < HERO_MAX_LEVEL && g.towers.length >= 2 + Math.floor(g.wave / 3)) {
        if (g.gold < heroUpgradeCost(h.level)) return;
        upgradeHero(g);
        continue;
      }
      if (plan.spread) {
        if (this.build()) continue;
        if (g.gold >= TOWERS[this.nextType].cost && g.towers.length < MAX_TOWERS) {
          this.next++; // no spot for this type; try the next one
          continue;
        }
        if (g.towers.length < MAX_TOWERS && bestSpot(g, 1)) return;
        const up = this.cheapestUpgrade(true);
        if (!up || g.gold < up.cost) return;
        up.run();
        continue;
      }
      // A sensible player: keep enough towers for the wave, then weigh upgrades against new towers.
      const want = Math.min(MAX_TOWERS, 2 + Math.floor(g.wave * plan.perWave));
      const up = this.cheapestUpgrade(true);
      const cost = TOWERS[this.nextType].cost;
      const canPlace = g.towers.length < MAX_TOWERS && !!bestSpot(g, TOWERS[this.nextType].range);
      const doBuild = canPlace && (g.towers.length < want || !up || up.cost > plan.upgradeBias * cost);
      if (doBuild) { if (!this.build()) return; continue; }
      if (!up || g.gold < up.cost) return;
      up.run();
    }
  }

  /** Casts the Warden's ability when it would do real work. */
  cast() {
    const g = this.g, h = g.hero;
    if (!h || h.abilityCd > 0 || !g.enemies.length) return;
    const w = h.loadout.weapon;
    if (w === 'staff') {
      const near = g.enemies.filter((e) => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) <= 2 * T);
      if (near.length >= 3 || near.some((e) => e.type === 'giant')) castAbility(g);
    } else if (w === 'bell') {
      if (g.enemies.length >= 8 || g.enemies.some((e) => e.type === 'giant')) castAbility(g);
    } else if (g.enemies.some((e) => e.d > g.path.len * 0.6 || e.type === 'giant' || e.type === 'lump')) castAbility(g);
  }
}

const zero = (): Record<SourceKey, number> => ({ spark: 0, frost: 0, pulse: 0, star: 0, hero: 0 });

/** Plays one whole run headless and returns what happened. */
export function playRun(o: BotOptions): RunResult {
  const rnd = mulberry32(o.seed * 2654435761 + 1);
  const realRandom = Math.random;
  // Meta progress from the player's save must not skew the numbers.
  const savedUp = { ...save.up };
  for (const k of Object.keys(save.up) as (keyof typeof save.up)[]) save.up[k] = 0;
  Math.random = rnd;
  // Sound effects throttle by wall-clock time and draw random pitches, which would make runs depend
  // on how fast the machine is. A frozen clock keeps every throttled sound silent and the run seeded.
  const realNow = performance.now;
  performance.now = () => 0;
  try {
    let ended = false, won = false;
    const g = createGame(o.map, { towerChanged: () => {}, ended: (w) => { ended = true; won = w; } });
    g.loadout = { ...(o.loadout ?? DEFAULT_LOADOUT) };
    g.heroTalents = { might: 0, reach: 0, focus: 0, veteran: 0 };
    const bot = new Bot(g, PLANS[o.strategy], rnd);
    const dt = o.dt ?? 1 / 30;
    const lastWave = Number.isFinite(g.map.waves) ? g.map.waves : (o.survivalWaves ?? 40);
    const worthNow = () => g.gold + g.towers.reduce((s, t) => s + t.invested, 0) + (g.hero?.invested ?? 0);
    const worth: number[] = [];
    const leaks = Object.fromEntries(ENEMY_ORDER.map((t) => [t, 0])) as Record<EnemyType, number>;
    let thinkT = 0;
    for (let steps = 0; !ended && steps < 3_000_000; steps++) {
      if (!g.active) {
        if (g.cleared > worth.length) worth.push(worthNow());
        if (g.cleared >= lastWave) { won = true; break; }
        bot.think();
        startWave(g);
      }
      thinkT -= dt;
      if (thinkT <= 0) { thinkT = 0.5; bot.think(); bot.cast(); }
      const before = g.enemies;
      update(g, dt);
      g.fx.length = 0;
      // An enemy that leaves the board alive reached the heart.
      for (const e of before) if (e.dead && e.hp > 0) leaks[e.type]++;
    }
    if (g.cleared > worth.length) worth.push(worthNow());
    const damage = zero(), kills = zero();
    for (const t of g.towers) { damage[t.type] += t.dealt; kills[t.type] += t.kills; }
    if (g.hero) { damage.hero += g.hero.dealt; kills.hero += g.hero.kills; }
    return {
      map: o.map, strategy: o.strategy, win: won, cleared: g.cleared, livesLost: g.maxLives - g.lives,
      leaks, worth, damage, kills, towers: g.towers.map((t) => ({ type: t.type, level: t.level, branch: t.branch })), heroLevel: g.hero?.level ?? 0,
    };
  } finally {
    Math.random = realRandom;
    performance.now = realNow;
    Object.assign(save.up, savedUp);
  }
}

// ---------- reports ----------

export interface Report {
  map: MapId;
  strategy: StrategyId;
  runs: number;
  /** Share of runs won; on a survival map, share that reached the wave cap. */
  winRate: number;
  cleared: number;
  livesLost: number;
  /** Average shadows that reached the heart per run, by type. */
  leaks: Record<EnemyType, number>;
  /** Average total gold earned after each wave. */
  worth: number[];
  /** Shares of all damage and all kills, 0 to 1. */
  damage: Record<SourceKey, number>;
  kills: Record<SourceKey, number>;
  survival: boolean;
}

export function summarize(results: RunResult[]): Report {
  const n = results.length, r0 = results[0];
  const avg = (f: (r: RunResult) => number) => results.reduce((s, r) => s + f(r), 0) / n;
  const share = (pick: (r: RunResult) => Record<SourceKey, number>) => {
    const sum = zero();
    for (const r of results) for (const k of SOURCE_KEYS) sum[k] += pick(r)[k];
    const total = SOURCE_KEYS.reduce((s, k) => s + sum[k], 0) || 1;
    for (const k of SOURCE_KEYS) sum[k] /= total;
    return sum;
  };
  const longest = Math.max(...results.map((r) => r.worth.length));
  const worth: number[] = [];
  for (let i = 0; i < longest; i++) {
    const have = results.filter((r) => r.worth.length > i);
    worth.push(have.reduce((s, r) => s + r.worth[i], 0) / have.length);
  }
  return {
    map: r0.map, strategy: r0.strategy, runs: n,
    winRate: avg((r) => (r.win ? 1 : 0)), cleared: avg((r) => r.cleared), livesLost: avg((r) => r.livesLost),
    leaks: Object.fromEntries(Object.keys(r0.leaks).map((k) => [k, avg((r) => r.leaks[k as EnemyType])])) as Record<EnemyType, number>,
    worth, damage: share((r) => r.damage), kills: share((r) => r.kills), survival: !Number.isFinite(MAPS[r0.map].waves),
  };
}

export interface BatchOptions {
  maps: MapId[];
  strategies: StrategyId[];
  runs: number;
  seed?: number;
  loadout?: Loadout;
  survivalWaves?: number;
}

/** Every run in a batch, in order, so a caller can spread them over frames. */
export function batchJobs(o: BatchOptions): BotOptions[][] {
  const out: BotOptions[][] = [];
  for (const map of o.maps) for (const strategy of o.strategies) {
    const jobs: BotOptions[] = [];
    for (let i = 0; i < o.runs; i++) jobs.push({ map, strategy, seed: (o.seed ?? 1) + i, loadout: o.loadout, survivalWaves: o.survivalWaves });
    out.push(jobs);
  }
  return out;
}

export const runBatch = (o: BatchOptions): Report[] => batchJobs(o).map((jobs) => summarize(jobs.map(playRun)));

const SPARK = '▁▂▃▄▅▆▇█';
/** A tiny text line chart. */
export function sparkline(values: number[], width = 20): string {
  if (!values.length) return '';
  const step = Math.max(1, values.length / width), pts: number[] = [];
  for (let i = 0; i < values.length; i += step) pts.push(values[Math.floor(i)]);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  return pts.map((v) => SPARK[Math.round(((v - lo) / span) * (SPARK.length - 1))]).join('');
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** A compact plain-text table, one block per map. Column labels use the internal ids. */
export function formatTable(reports: Report[]): string {
  const head = ['strategy', 'win', 'waves', 'lives', ...SOURCE_KEYS.map((k) => `dmg:${k}`), ...SOURCE_KEYS.map((k) => `kill:${k}`), 'gold earned'];
  const lines: string[] = [];
  for (const map of [...new Set(reports.map((r) => r.map))]) {
    const rows = reports.filter((r) => r.map === map).map((r) => [
      r.strategy, r.survival ? '-' : pct(r.winRate), r.cleared.toFixed(1), r.livesLost.toFixed(1),
      ...SOURCE_KEYS.map((k) => pct(r.damage[k])), ...SOURCE_KEYS.map((k) => pct(r.kills[k])),
      `${sparkline(r.worth)} ${Math.round(r.worth[r.worth.length - 1] ?? 0)}`,
    ]);
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const fmt = (cells: string[]) => cells.map((c, i) => (i === 0 || i === cells.length - 1 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
    const runs = reports.find((r) => r.map === map)!.runs;
    lines.push(`${map} (${runs} runs each)`, fmt(head), ...rows.map(fmt), '');
  }
  return lines.join('\n');
}
