import type { Loadout, TalentId } from './data/hero';
import type { BoonId, BoonMods } from './data/boons'; // boons between waves

export type TowerType = 'spark' | 'frost' | 'pulse' | 'star';
export type EnemyType = 'crawler' | 'flitter' | 'lump' | 'shimmer' | 'splitter' | 'speck' | 'dasher' | 'giant'
  // bosses
  | 'stomper' | 'thief' | 'mender';
export type MapId = 'mill' | 'marsh' | 'ring';

// ---------- shadow traits and tower attributes ----------

/** Something a shadow is or does that some towers answer better than others. Add new ones here. */
export type Trait = 'flying' | 'armoured' | 'mends' | 'splits' | 'sprints';

export interface TowerAttrs {
  /** Can hit flying shadows. */
  air: boolean;
  /** Can hit shadows on the ground. */
  ground: boolean;
  /** Extra damage against shadows with a trait, e.g. { armoured: 0.5 } for +50 %. */
  bonus: Partial<Record<Trait, number>>;
}

/** One group in a wave: this many shadows of a type, spawned this many seconds apart. */
export type WaveGroup = [type: EnemyType, count: number, gap: number];
export type WaveSpec = WaveGroup[];
// ---------- end shadow traits and tower attributes ----------

// ---------- combos between towers ----------
/** A combo: one tower's hit on a shadow that another tower has left in a state. Defined in game/combos.ts. */
export type ComboId = 'shatter' | 'steam' | 'conduct';

/** A combo that just went off, for the view to letter over the shadow. */
export interface ComboWord { id: ComboId; enemy: Enemy; x: number; y: number; at: number }

export interface ComboLog {
  /** How many times each combo has gone off this run. */
  counts: Record<ComboId, number>;
  /** Recent words to show; old ones are pruned when new ones arrive. */
  words: ComboWord[];
}
// ---------- end combos between towers ----------

// ---------- boons between waves ----------
export interface BoonState {
  /** Boons taken this run, in order. */
  taken: BoonId[];
  /** The choice waiting for the player; the next wave cannot start while it is open. */
  offer: BoonId[] | null;
  /** The taken boons added up; towers and the Warden hold the same object. */
  mods: BoonMods;
  /** False for the menu demo, which never stops for a choice. */
  enabled: boolean;
  /** Offer tower boons for every tower type, not only unlocked ones (bots). */
  anyTower: boolean;
}
// ---------- end boons between waves ----------

export interface MapDef {
  id: MapId;
  waves: number;
  /** The wave list, played in order; a survival map repeats it with more shadows each round. */
  waveList: WaveSpec[];
  hard: number;
  seed: number;
  survival?: boolean;
  /** Road waypoints in tile coordinates. The last point is the heart. */
  pts: [number, number][];
}

export interface TowerDef {
  cost: number;
  range: number;
  rate: number;
  dmg: number;
  color: string;
  kind: 'shot' | 'pulse' | 'shell';
  speed?: number;
  slow?: number;
  slowDur?: number;
  splash?: number;
  /** Watch level required to build it. */
  unlock?: number;
  /** What it can hit and what it is strong against. */
  attrs: TowerAttrs;
  /** Changes each branch makes to `attrs`. */
  branchAttrs?: [Partial<TowerAttrs> | null, Partial<TowerAttrs> | null];
}

export interface EnemyDef {
  hp: number;
  speed: number;
  reward: number;
  leak: number;
  r: number;
  color: string;
  eye: string;
  /** What this shadow is; the fields below tune each trait. */
  traits: Trait[];
  /** mends: share of max health regained per second while neither burning nor frozen. */
  regen?: number;
  /** armoured: flat damage blocked per hit, growing a little with the wave. */
  armour?: number;
  /** splits: what it breaks into when it dies. */
  split?: { type: EnemyType; count: number };
  /** sprints: speed multiplier during a burst, burst length and time between bursts in seconds. */
  sprint?: { mult: number; dur: number; every: number };
  /** Bosses: present on every boss, the Gloom Lord included; see BossDef. */
  boss?: BossDef;
}

// ---------- bosses ----------
/**
 * What a boss does, as data on its EnemyDef (src/data/enemies.ts). A boss with none of these is a
 * plain big shadow, like the Gloom Lord. The rules live in src/game/bosses.ts.
 */
export interface BossDef {
  /** Every `every` seconds, knocks out the towers within `radius` tiles for `knock` seconds. */
  stomp?: { every: number; radius: number; knock: number };
  /**
   * At share `at` of the road, takes `share` of the purse (at most `max` plus `perWave` per wave)
   * and runs back to the rift `flee` times as fast. Killing it returns the gold.
   */
  steal?: { at: number; share: number; max: number; perWave: number; flee: number };
  /** Every `every` seconds, while it mends, heals the shadows within `radius` tiles by `heal` of their max health. */
  mend?: { every: number; radius: number; heal: number };
}

export interface BossState {
  /** Simulation time of the last stomp, grab or mend, for the view to animate; -9 before the first. */
  at: number;
  /** Seconds until the next stomp or mend. */
  next: number;
  /** Gold the Thief carries. */
  loot: number;
  /** The Thief has grabbed its gold and runs back to the rift. */
  fleeing: boolean;
}
// ---------- end bosses ----------

export interface Pt { x: number; y: number }

export interface Path {
  pts: Pt[];
  segs: { a: Pt; b: Pt; l: number; start: number }[];
  len: number;
  tiles: Set<string>;
}

export type Branch = 0 | 1 | null;

export interface Tower {
  type: TowerType;
  /** Free position in simulation pixels; towers are not tied to a grid. */
  x: number; y: number;
  level: number;
  branch: Branch;
  cd: number;
  invested: number;
  angle: number;
  kills: number;
  dealt: number;
  /** Index into the locale's nickname list, revealed at level 4. */
  nick: number;
  flash: number;
  /** Damage bonus from the Warden's Badge charm, refreshed every tick. */
  boost: number;
  /** Boons between waves: the run's boons, shared with the game (set when placed). */
  mods?: BoonMods;
  /** Bosses: seconds left knocked out by a Stomper's stomp; it cannot fire meanwhile. */
  knocked?: number;
}

/** Anything that deals damage and keeps a tally: a tower or the Warden. */
export type Source = Tower | Hero;

export interface Hero {
  isHero: true;
  /** Position in simulation pixels; the Warden is placed once and stays put. */
  x: number; y: number;
  level: number;
  loadout: Loadout;
  talents: Record<TalentId, number>;
  cd: number;
  abilityCd: number;
  /** Simulation time of the last ability cast, for the view to animate. */
  castAt: number;
  angle: number;
  kills: number;
  dealt: number;
  invested: number;
  flash: number;
  /** Boons between waves: the run's boons, shared with the game (set when placed). */
  mods?: BoonMods;
}

export interface Enemy {
  type: EnemyType;
  def: EnemyDef;
  hp: number; maxHp: number;
  reward: number;
  d: number;
  x: number; y: number;
  slowUntil: number; slowAmt: number;
  stun: number;
  burnUntil: number; burnDps: number; burnSrc: Source | null;
  lastHit: number;
  seed: number;
  dead: boolean;
  /** Developer lab only: holds the enemy in place. */
  pinned?: boolean;
  /** Shadow traits: armour per hit at this wave, and whether it is sprinting or mending right now. */
  armour: number;
  dashing: boolean;
  mending: boolean;
  /** Bosses: what this boss is doing; created by game/bosses.ts on its first tick. */
  boss?: BossState;
}

export interface Stats {
  range: number;
  rate: number;
  dmg: number;
  splash: number;
  slow: number;
  slowDur: number;
  targets: number;
  freeze?: number;
  area?: boolean;
  burn?: number;
  stun?: number;
  shards?: number;
  /** What the source can hit and its trait bonuses; absent means it hits everything (the Warden). */
  attrs?: TowerAttrs;
}

export interface Shot {
  x: number; y: number;
  target: Enemy;
  tx: number; ty: number;
  speed: number;
  dmg: number;
  src: Source;
  /** Which model and colour the view should use for the projectile. */
  look: TowerType | 'hero';
  s: Stats;
  kind: 'shot' | 'shell';
  color: string;
  done?: boolean;
}

export type Fx =
  | { k: 'p'; x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
  | { k: 'ring'; x: number; y: number; r0: number; r1: number; life: number; max: number; color: string }
  | { k: 'line'; x: number; y: number; x2: number; y2: number; life: number; max: number; color: string }
  | { k: 'txt'; x: number; y: number; text: string; color: string; life: number; max: number; size: number };

export interface QueueItem { type: EnemyType; gap: number }

export interface Hooks {
  towerChanged(t: Tower): void;
  ended(win: boolean): void;
}

export interface Game {
  map: MapDef;
  path: Path;
  gold: number;
  lives: number;
  maxLives: number;
  wave: number;
  cleared: number;
  towers: Tower[];
  enemies: Enemy[];
  shots: Shot[];
  fx: Fx[];
  queue: QueueItem[];
  spawnT: number;
  active: boolean;
  auto: boolean;
  autoT: number;
  speed: number;
  paused: boolean;
  over: boolean;
  selected: Tower | null;
  build: TowerType | 'hero' | null;
  /** The Warden once placed; null before that. */
  hero: Hero | null;
  heroSelected: boolean;
  /** The kit the Warden brings to this run, taken from the save. */
  loadout: Loadout;
  heroTalents: Record<TalentId, number>;
  /** Developer lab switches. */
  dev?: { god: boolean; freeGold: boolean; allTowers: boolean };
  /** Pointer position on the board in simulation pixels. */
  hover: { x: number; y: number } | null;
  t: number;
  shake: number;
  kills: number;
  hooks: Hooks;
  /** Combos between towers: counts and words to show. Created by game/combos.ts on the first combo. */
  combo?: ComboLog;
  /** Boons between waves: what the run has taken and the choice on offer (game/boons.ts). */
  boons: BoonState;
}
