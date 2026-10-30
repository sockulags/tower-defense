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
import type { ComboId, EnemyType, Game, MapId, Path, Tower, TowerType } from '../types';
import { COMBO_ORDER } from './combos';
// Boons between waves
import { BOONS, BOON_ORDER, type BoonId } from '../data/boons';
import { takeBoon } from './boons';
// Terrain and rifts that move: bots read the ground and cover every road
import { lineBlocked, reachAt, riftCount, roadOf, waveRift } from './terrain';
// Economy buildings (mills, lab experiment)
import { MILL } from '../data/mills';
import { millCount, placeMill } from './mills';
// The squad: bots bring four towers too
import { BASE_SQUAD, allSquads } from './squad';

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
  /** How the bot picks boons between waves; greedy by default. */
  boonPick?: BoonPicker;
  /** Simulation step in seconds. */
  dt?: number;
  /** The squad: the four towers the bot brings; 'auto' lets it pick for the map. Defaults to the first four. */
  squad?: TowerType[] | 'auto';
  /** Economy buildings: how the bot uses mills; none (the default) keeps them off. */
  mills?: MillProfile;
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
  /** Boons between waves: every boon offered (three per choice) and every boon taken. */
  boons: { offered: BoonId[]; taken: BoonId[] };
  /** Combos between towers: how many times each went off. */
  combos: Record<ComboId, number>;
  /** The squad the bot brought. */
  squad: TowerType[];
  /** Economy buildings: mills built and the gold they paid. */
  mills?: { profile?: MillProfile; built: number; paid: number; spent: number };
}

// ---------- economy buildings: how bots use mills ----------

/**
 * none: never; early: two mills once two towers stand, by wave 4; greedy: three mills as soon as
 * two towers stand; late: two mills between waves 8 and 12; safe: a mill only after a wave that
 * cost no lives, up to three by wave 10.
 */
export type MillProfile = 'none' | 'early' | 'greedy' | 'late' | 'safe';
export const MILL_PROFILES: MillProfile[] = ['none', 'early', 'greedy', 'late', 'safe'];

interface MillPlan {
  /** Mills wanted in all. */
  count: number;
  /** Build only before these upcoming waves (inclusive). */
  from: number; until: number;
  /** Towers that must stand first. */
  towers: number;
  /** Only after a wave that cost no lives. */
  safe: boolean;
}

export const MILL_PLANS: Record<Exclude<MillProfile, 'none'>, MillPlan> = {
  early: { count: 2, from: 1, until: 4, towers: 2, safe: false },
  greedy: { count: 3, from: 1, until: 99, towers: 2, safe: false },
  late: { count: 2, from: 8, until: 12, towers: 2, safe: false },
  safe: { count: 3, from: 2, until: 10, towers: 2, safe: true },
};
// ---------- end economy buildings ----------

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
function roadSamples(path: Path, share = 1) {
  const out: { x: number; y: number; w: number }[] = [];
  for (const s of path.segs) {
    const n = Math.max(1, Math.ceil(s.l / 6));
    for (let i = 0; i < n; i++) {
      const f = i / n;
      out.push({ x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f, w: (1.5 - (s.start + s.l * f) / path.len) * share });
    }
  }
  return out;
}

/** Rifts that move: the share of a map's waves that come from each rift, so busy roads count for more. */
function riftShares(g: Game): number[] {
  const n = riftCount(g.map), waves = Number.isFinite(g.map.waves) ? g.map.waves : 20;
  const out = new Array<number>(n).fill(0);
  for (let w = 1; w <= waves; w++) out[waveRift(g.map, w)] += n / waves;
  return out;
}

/**
 * Every buildable spot on an empty board (a quarter-tile lattice), ranked by how much road lies
 * within `range` tiles, weighted as above. Terrain: a hill stretches the range, and for a tower
 * with `straight` shots road hidden behind trees does not count. Cached per map, range and kind.
 */
function spotsFor(g: Game, range: number, straight = false): Spot[] {
  const key = `${g.map.id}:${range.toFixed(2)}:${straight}`;
  const hit = spotCache.get(key);
  if (hit) return hit;
  const empty = { ...g, towers: [], hero: null } as Game;
  const shares = riftShares(g);
  const road = g.paths.flatMap((p, i) => roadSamples(p, shares[i])), step = T / 4;
  const spots: Spot[] = [];
  for (let y = step; y < ROWS * T; y += step) {
    for (let x = step; x < COLS * T; x += step) {
      if (!canBuild(empty, x, y)) continue;
      let cover = 0;
      const r2 = (range * reachAt(g.map, x, y) * T) ** 2;
      for (const p of road) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2 && (!straight || !lineBlocked(g.map, x, y, p.x, p.y))) cover += p.w;
      if (cover) spots.push({ x, y, cover });
    }
  }
  spots.sort((a, b) => b.cover - a.cover);
  spotCache.set(key, spots);
  return spots;
}

/** The legal spot that reaches the most road for this range, given what is already built. */
const bestSpot = (g: Game, range: number, straight = false) => spotsFor(g, range, straight).find((s) => canBuild(g, s.x, s.y)) ?? null;
/** Terrain: whether a tower type's shots fly straight, so trees block them. */
const straightShots = (type: TowerType) => TOWERS[type].kind === 'shot';

// ---------- the bot ----------

const MAX_TOWERS = 18;

class Bot {
  next = 0;
  /** Economy buildings: the mill plan, and the lives lost in the last wave. */
  millPlan: MillPlan | null = null;
  lostLast = 0;
  constructor(readonly g: Game, readonly plan: Plan, readonly rnd: () => number) {}

  /**
   * Economy buildings: builds a mill when the plan wants one now. Returns 'built', 'save' (wants
   * one but cannot pay yet, so spend nothing) or 'skip'. Mills go on the legal spot that reaches
   * the least road, since good tower spots are worth more as towers.
   */
  mill(): 'built' | 'save' | 'skip' {
    const g = this.g, p = this.millPlan, next = g.wave + 1;
    if (!p || millCount(g) >= Math.min(p.count, MILL.max) || next < p.from || next > p.until) return 'skip';
    if (g.towers.length < p.towers || (p.safe && (g.wave === 0 || this.lostLast > 0))) return 'skip';
    if (g.gold < MILL.cost) return 'save';
    const spots = spotsFor(g, 2.4);
    for (let i = spots.length - 1; i >= 0; i--) {
      if (canBuild(g, spots[i].x, spots[i].y)) return placeMill(g, spots[i].x, spots[i].y) ? 'built' : 'skip';
    }
    return 'skip';
  }

  /** The squad: the plan's rotation with towers outside the squad swapped for the squad's others. */
  squadRotation: TowerType[] | null = null;

  get nextType() { const r = this.squadRotation ?? this.plan.rotation; return r[this.next % r.length]; }

  build(): boolean {
    const type = this.nextType;
    if (this.g.gold < TOWERS[type].cost || this.g.towers.length >= MAX_TOWERS) return false;
    const spot = bestSpot(this.g, TOWERS[type].range, straightShots(type));
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
      const spot = bestSpot(g, WEAPONS[g.loadout.weapon].range, WEAPONS[g.loadout.weapon].kind !== 'wave');
      if (spot) placeHero(g, spot.x, spot.y);
    }
    for (let guard = 0; guard < 40; guard++) {
      const h = g.hero;
      // Economy buildings: a wanted mill comes before anything else.
      const m = this.mill();
      if (m === 'built') continue;
      if (m === 'save') return;
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
      const canPlace = g.towers.length < MAX_TOWERS && !!bestSpot(g, TOWERS[this.nextType].range, straightShots(this.nextType));
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
      if (near.length >= 3 || near.some((e) => e.def.boss)) castAbility(g);
    } else if (w === 'bell') {
      if (g.enemies.length >= 8 || g.enemies.some((e) => e.def.boss)) castAbility(g);
    } else if (g.enemies.some((e) => e.d > roadOf(g, e).len * 0.6 || e.def.boss || e.type === 'lump')) castAbility(g);
  }
}

// ---------- boons between waves ----------

/** random: any of the three; greedy: the one worth the most gold to this board right now; or a custom picker for tuning scripts. */
export type BoonPicker = 'random' | 'greedy' | ((g: Game, offer: BoonId[], rnd: () => number) => BoonId);
export const BOON_PICKERS = ['greedy', 'random'] as const;

/**
 * What a boon is worth to this run in gold, roughly: a share more damage from a tower type is worth
 * that share of the gold sitting in those towers, weighted by how much of the damage they deal;
 * gold boons are worth the gold they will pay over the waves left; lives are worth more the more
 * the run has lost.
 */
export function boonValue(g: Game, id: BoonId, lastWave: number): number {
  const d = BOONS[id], left = Math.max(0, lastWave - g.wave);
  const inv = Object.fromEntries(TOWER_ORDER.map((t) => [t, 0])) as Record<TowerType, number>;
  const dealt = Object.fromEntries(TOWER_ORDER.map((t) => [t, 0])) as Record<TowerType, number>;
  for (const t of g.towers) { inv[t.type] += t.invested; dealt[t.type] += t.dealt; }
  const h = g.hero;
  const towerGold = TOWER_ORDER.reduce((s, t) => s + inv[t], 0);
  const totalDealt = TOWER_ORDER.reduce((s, t) => s + dealt[t], 0) + (h?.dealt ?? 0) || 1;
  const board = towerGold + (h ? 150 + h.invested : 0);
  // A tower type's weight: the board's worth times its share of the damage, but at least its own gold.
  const weight = (t: TowerType) => Math.max(inv[t], board * dealt[t] / totalDealt);
  const heroW = h ? Math.max(150 + h.invested, board * h.dealt / totalDealt) : 0;
  // Gold still to come: about what the run has earned per wave so far, counted at 60 % since gold
  // in hand now does more than gold later.
  const earned = g.gold + towerGold + (h?.invested ?? 0);
  const perWave = earned / Math.max(1, g.wave);
  const a = d.add ?? {};
  let v = 0;
  if (d.tower && d.towerMods) {
    const w = weight(d.tower), m = d.towerMods;
    v += w * ((m.dmg ?? 0) + (m.rate ?? 0) + 0.8 * (m.range ?? 0));
  }
  v += weight('star') * 0.6 * (a.splash ?? 0);
  v += weight('frost') * (2 * (a.freeze ?? 0) + 1.2 * (a.slow ?? 0) + 0.3 * (a.chillTime ?? 0)) + board * 0.4 * (a.slow ?? 0);
  v += weight('pulse') * (a.kindle ?? 0) * 0.8;
  const burners = g.towers.filter((t) => t.type === 'pulse' && (t.branch === 0 || t.mods?.kindle)).reduce((s, t) => s + t.invested, 0)
    + (h?.loadout.charm === 'ember' ? heroW : 0);
  v += burners * 0.4 * (a.burnDmg ?? 0);
  v += towerGold * (a.allRate ?? 0);
  v += board * 0.15 * (a.sunder ?? 0);
  v += heroW * ((a.heroDmg ?? 0) + (a.heroRate ?? 0) + 0.5 * (a.heroRange ?? 0) + 0.3 * (a.heroHaste ?? 0));
  v += 0.6 * left * perWave * (0.5 * (a.upgradeDiscount ?? 0) + 0.6 * (a.bounty ?? 0));
  v += 0.6 * left * ((a.waveGold ?? 0) + Math.min(a.interestCap ?? 0, (a.interest ?? 0) * 150));
  v += (d.gold ?? 0) + (d.goldPerWave ?? 0) * g.cleared;
  if (d.lives) v += d.lives * 12 * (1 + 4 * (1 - g.lives / g.maxLives));
  return v;
}

function pickBoon(g: Game, offer: BoonId[], how: BoonPicker, rnd: () => number, lastWave: number): BoonId {
  if (typeof how === 'function') return how(g, offer, rnd);
  if (how === 'random') return offer[Math.floor(rnd() * offer.length)];
  return offer.reduce((best, id) => (boonValue(g, id, lastWave) > boonValue(g, best, lastWave) ? id : best));
}

const noBoons = () => Object.fromEntries(BOON_ORDER.map((id) => [id, { offered: 0, picked: 0 }])) as Record<BoonId, { offered: number; picked: number }>;
// ---------- end boons between waves ----------

const zero = (): Record<SourceKey, number> => Object.fromEntries(SOURCE_KEYS.map((k) => [k, 0])) as Record<SourceKey, number>;

// ---------- the squad ----------

/** A plan's build rotation for a squad: towers outside the squad become the squad's other towers, in turn. */
export function squadRotation(rotation: readonly TowerType[], squad: readonly TowerType[]): TowerType[] {
  const extra = squad.filter((t) => !rotation.includes(t));
  let k = 0;
  const out = rotation.flatMap((t) => (squad.includes(t) ? [t] : extra.length ? [extra[k++ % extra.length]] : []));
  return out.length ? out : [...squad];
}

const squadPicks = new Map<string, TowerType[]>();

/**
 * The squad a bot brings with 'auto': like a player learning a map, it tries every squad of four
 * once (one seeded run each, survival capped at 30 waves) and keeps the one that cleared the most
 * waves for the fewest lives. Remembered per map, strategy, Warden kit, boon picks and mill profile.
 */
export function botSquad(o: BotOptions): TowerType[] {
  const key = JSON.stringify([o.map, o.strategy, o.loadout ?? null, o.mills ?? null, typeof o.boonPick === 'string' ? o.boonPick : null]);
  let pick = squadPicks.get(key);
  if (!pick) {
    let best = -Infinity;
    for (const sq of allSquads()) {
      const r = playRun({ ...o, seed: 9001, squad: sq, survivalWaves: Math.min(o.survivalWaves ?? 40, 30) });
      const score = r.cleared * 100 - r.livesLost;
      if (score > best) { best = score; pick = sq; }
    }
    squadPicks.set(key, pick!);
  }
  return [...pick!];
}

/** A squad's short label for tables, e.g. "spark+frost+pulse+kite". */
export const squadLabel = (squad: readonly TowerType[]) => squad.join('+');
// ---------- end the squad ----------

/** Plays one whole run headless and returns what happened. */
export function playRun(o: BotOptions): RunResult {
  // The squad: picked before this run seeds the randomness, since 'auto' plays trial runs of its own.
  const squad = o.squad === 'auto' ? botSquad(o) : o.squad ? [...o.squad] : [...BASE_SQUAD];
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
    // The squad: the bot brings four towers, its own pick for the map with 'auto'.
    g.squad = squad;
    bot.squadRotation = squadRotation(PLANS[o.strategy].rotation, g.squad);
    // Economy buildings: the lab switch, on only for this bot run.
    if (o.mills && o.mills !== 'none') {
      g.dev = { god: false, freeGold: false, allTowers: false, mills: true };
      bot.millPlan = MILL_PLANS[o.mills];
    }
    let livesAtStart = g.lives;
    g.boons.anyTower = true; // boons between waves: the same pool whatever the player's save
    const offered: BoonId[] = [];
    const dt = o.dt ?? 1 / 30;
    const lastWave = Number.isFinite(g.map.waves) ? g.map.waves : (o.survivalWaves ?? 40);
    const worthNow = () => g.gold + g.towers.reduce((s, t) => s + t.invested, 0) + (g.hero?.invested ?? 0)
      + (g.mills ?? []).reduce((s, m) => s + m.invested, 0); // economy buildings
    const worth: number[] = [];
    const leaks = Object.fromEntries(ENEMY_ORDER.map((t) => [t, 0])) as Record<EnemyType, number>;
    let thinkT = 0;
    for (let steps = 0; !ended && steps < 3_000_000; steps++) {
      if (!g.active) {
        if (g.cleared > worth.length) worth.push(worthNow());
        if (g.cleared >= lastWave) { won = true; break; }
        // Boons between waves: choose before spending, since the boon may change what is worth buying.
        if (g.boons.offer) { offered.push(...g.boons.offer); takeBoon(g, pickBoon(g, g.boons.offer, o.boonPick ?? 'greedy', rnd, lastWave)); }
        bot.lostLast = livesAtStart - g.lives; // economy buildings
        bot.think();
        livesAtStart = g.lives;
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
      combos: Object.fromEntries(COMBO_ORDER.map((id) => [id, g.combo?.counts[id] ?? 0])) as Record<ComboId, number>,
      boons: { offered, taken: [...g.boons.taken] },
      squad: [...g.squad], // the squad
      // Economy buildings
      mills: { profile: o.mills, built: millCount(g), paid: (g.mills ?? []).reduce((s, m) => s + m.paid, 0), spent: millCount(g) * MILL.cost },
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
  /** Boons between waves: how often each boon was offered and taken over all runs. */
  boons: Record<BoonId, { offered: number; picked: number }>;
  /** Combos between towers: average times each went off per run. */
  combos: Record<ComboId, number>;
  /** Economy buildings: the bots' mill profile, and per run on average the mills built and the gold they paid. */
  mills?: MillProfile;
  millsBuilt?: number;
  millGold?: number;
  /** The squad: the squad the bots brought, when every run in the report brought the same one. */
  squad?: TowerType[];
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
    combos: Object.fromEntries(COMBO_ORDER.map((id) => [id, avg((r) => r.combos[id])])) as Record<ComboId, number>,
    boons: tallyBoons(results),
    // The squad
    squad: results.every((r) => squadLabel(r.squad) === squadLabel(r0.squad)) ? [...r0.squad] : undefined,
    // Economy buildings
    mills: r0.mills?.profile, millsBuilt: avg((r) => r.mills?.built ?? 0), millGold: avg((r) => r.mills?.paid ?? 0),
  };
}

export interface BatchOptions {
  maps: MapId[];
  strategies: StrategyId[];
  runs: number;
  seed?: number;
  loadout?: Loadout;
  survivalWaves?: number;
  boonPick?: BoonPicker;
  /** Economy buildings: mill profiles to compare; each gets its own rows. */
  mills?: MillProfile[];
  /**
   * The squad: the towers the bots bring. A squad, 'auto' (each bot picks for the map), or 'each'
   * (every possible squad of four, each with its own rows, to find the best squad per map).
   */
  squad?: TowerType[] | 'auto' | 'each';
}

/** Every run in a batch, in order, so a caller can spread them over frames. */
export function batchJobs(o: BatchOptions): BotOptions[][] {
  const out: BotOptions[][] = [];
  // The squad: 'each' runs every squad of four as its own rows.
  const squads: (TowerType[] | 'auto' | undefined)[] = o.squad === 'each' ? allSquads() : [o.squad];
  for (const map of o.maps) for (const strategy of o.strategies) for (const mills of o.mills ?? [undefined]) for (const squad of squads) {
    const jobs: BotOptions[] = [];
    for (let i = 0; i < o.runs; i++) jobs.push({ map, strategy, seed: (o.seed ?? 1) + i, loadout: o.loadout, survivalWaves: o.survivalWaves, boonPick: o.boonPick, mills, squad });
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

/** The squad: rows for a squad other than the first four name it. */
const squadTag = (r: Report) => (r.squad && squadLabel(r.squad) !== squadLabel(BASE_SQUAD) ? ` [${squadLabel(r.squad)}]` : '');

/** A compact plain-text table, one block per map. Column labels use the internal ids. */
export function formatTable(reports: Report[]): string {
  // Economy buildings: with mill profiles the rows are strategy+profile and show mills built and their gold.
  const withMills = reports.some((r) => r.mills);
  const head = ['strategy', 'win', 'waves', 'lives', ...SOURCE_KEYS.map((k) => `dmg:${k}`), ...SOURCE_KEYS.map((k) => `kill:${k}`), ...COMBO_ORDER.map((id) => `combo:${id}`),
    ...(withMills ? ['mills', 'mill gold'] : []), 'gold earned'];
  const lines: string[] = [];
  for (const map of [...new Set(reports.map((r) => r.map))]) {
    const rows = reports.filter((r) => r.map === map).map((r) => [
      (r.mills ? `${r.strategy}+${r.mills}` : r.strategy) + squadTag(r), r.survival ? '-' : pct(r.winRate), r.cleared.toFixed(1), r.livesLost.toFixed(1),
      ...SOURCE_KEYS.map((k) => pct(r.damage[k])), ...SOURCE_KEYS.map((k) => pct(r.kills[k])),
      ...COMBO_ORDER.map((id) => String(Math.round(r.combos[id]))),
      ...(withMills ? [(r.millsBuilt ?? 0).toFixed(1), String(Math.round(r.millGold ?? 0))] : []),
      `${sparkline(r.worth)} ${Math.round(r.worth[r.worth.length - 1] ?? 0)}`,
    ]);
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const fmt = (cells: string[]) => cells.map((c, i) => (i === 0 || i === cells.length - 1 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
    const runs = reports.find((r) => r.map === map)!.runs;
    lines.push(`${map} (${runs} runs each)`, fmt(head), ...rows.map(fmt), '');
  }
  return lines.join('\n');
}

// ---------- boons between waves: pick rates ----------

function tallyBoons(results: RunResult[]) {
  const out = noBoons();
  for (const r of results) {
    for (const id of r.boons.offered) out[id].offered++;
    for (const id of r.boons.taken) out[id].picked++;
  }
  return out;
}

/** Pick rates over a set of reports, most picked first: how often each boon was taken when offered. */
export function boonRates(reports: Report[]): { id: BoonId; offered: number; picked: number; rate: number }[] {
  const sum = noBoons();
  for (const r of reports) for (const id of BOON_ORDER) { sum[id].offered += r.boons[id].offered; sum[id].picked += r.boons[id].picked; }
  return BOON_ORDER.map((id) => ({ id, ...sum[id], rate: sum[id].offered ? sum[id].picked / sum[id].offered : 0 }))
    .sort((a, b) => b.rate - a.rate);
}

/** A plain-text table of boon pick rates. With three boons per choice, an even pick rate is about 33 %. */
export function formatBoonTable(reports: Report[]): string {
  const rows = boonRates(reports).map((b) => [b.id, String(b.offered), String(b.picked), pct(b.rate), '█'.repeat(Math.round(b.rate * 20))]);
  const head = ['boon', 'offered', 'picked', 'rate', ''];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const fmt = (cells: string[]) => cells.map((c, i) => (i === 0 || i === 4 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');
  return ['boon pick rates (even is about 33%)', fmt(head), ...rows.map(fmt), ''].join('\n');
}
// ---------- end boons between waves: pick rates ----------
