export type TowerType = 'spark' | 'frost' | 'pulse' | 'star';
export type EnemyType = 'crawler' | 'flitter' | 'lump' | 'shimmer' | 'giant';
export type MapId = 'mill' | 'marsh' | 'ring';

export interface MapDef {
  id: MapId;
  waves: number;
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
}

export interface EnemyDef {
  hp: number;
  speed: number;
  reward: number;
  leak: number;
  r: number;
  color: string;
  eye: string;
  regen?: number;
}

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
  burnUntil: number; burnDps: number; burnTw: Tower | null;
  lastHit: number;
  seed: number;
  dead: boolean;
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
}

export interface Shot {
  x: number; y: number;
  target: Enemy;
  tx: number; ty: number;
  speed: number;
  dmg: number;
  tw: Tower;
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
  build: TowerType | null;
  /** Pointer position on the board in simulation pixels. */
  hover: { x: number; y: number } | null;
  t: number;
  shake: number;
  kills: number;
  hooks: Hooks;
}
