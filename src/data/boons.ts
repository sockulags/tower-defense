// Boons: every fifth wave the run pauses on a choice of one of three, each pushing the run in a
// direction. Plain numbers only; names and descriptions live in src/i18n (`boons`), the rules in
// src/game/boons.ts. Each boon can be taken once per run. Tuned with `npm run balance` (greedy boon picks)
// so the greedy bots pick no boon far more often than the rest.
import type { TowerType } from '../types';

export type BoonId =
  | 'sparkPower' | 'sparkReach' | 'rimeReach' | 'rimeFrostbite' | 'emberKindle' | 'emberQuick' | 'starWide' | 'starPower'
  | 'thrift' | 'tithe' | 'bounty' | 'savings' | 'windfall'
  | 'wardenFocus' | 'wardenMight' | 'wardenReach'
  | 'hotBurn' | 'deepChill' | 'sunder' | 'hearth' | 'steady';

/** Which way a boon pushes the run; decides the card's colour and icon frame. */
export type BoonKind = 'tower' | 'economy' | 'warden' | 'status';

/** Changes one tower type gets, as shares (0.25 is +25 %). */
export interface TowerBoon { dmg: number; range: number; rate: number }

/** Everything boons change, summed over the boons a run has taken. All start at zero. */
export interface BoonMods {
  tower: Record<TowerType, TowerBoon>;
  /** Starfall blast radius, as a share. */
  splash: number;
  /** Rime: extra chill strength (points of slow) and a freeze chance on every hit. */
  slow: number;
  freeze: number;
  /** How much longer chills last, as a share. */
  chillTime: number;
  /** Ember: every hit leaves a burn of this share of its damage per second. */
  kindle: number;
  /** Every burn (towers and the Warden's Ember Charm) deals this share more. */
  burnDmg: number;
  /** Share of a shadow's armour that is ignored. */
  sunder: number;
  /** Every tower attacks this share faster. */
  allRate: number;
  /** Share off tower upgrade prices. */
  upgradeDiscount: number;
  /** Extra gold for every cleared wave. */
  waveGold: number;
  /** Extra gold per shadow, as a share of its reward. */
  bounty: number;
  /** Share of banked gold paid at every cleared wave, up to `interestCap`. */
  interest: number;
  interestCap: number;
  /** The Warden: damage and reach as shares, and how much faster the ability recharges (1 = twice as fast). */
  heroDmg: number;
  heroRange: number;
  heroHaste: number;
  /** The Warden attacks this share faster. */
  heroRate: number;
}

type Scalar = Exclude<keyof BoonMods, 'tower'>;

export interface BoonDef {
  kind: BoonKind;
  /** The tower a tower boon belongs to; it is only offered once that tower can be built. */
  tower?: TowerType;
  /** Changes to one tower type. */
  towerMods?: Partial<TowerBoon>;
  /** Changes to the run, added to its `BoonMods`. */
  add?: Partial<Record<Scalar, number>>;
  /** Paid once when taken: a sum, and a sum for every wave the run has held so far. */
  gold?: number;
  goldPerWave?: number;
  /** Lives added once when taken (the most lives grow too). */
  lives?: number;
  /** Card accent colour. */
  color: string;
}

export const BOONS: Record<BoonId, BoonDef> = {
  // Towers
  sparkPower: { kind: 'tower', tower: 'spark', towerMods: { dmg: 0.3 }, color: '#ffd27a' },
  sparkReach: { kind: 'tower', tower: 'spark', towerMods: { range: 0.25, rate: 0.1 }, color: '#ffd27a' },
  rimeReach: { kind: 'tower', tower: 'frost', towerMods: { range: 0.45, rate: 0.15 }, color: '#8fd3ff' },
  rimeFrostbite: { kind: 'tower', tower: 'frost', add: { freeze: 0.18 }, towerMods: { dmg: 0.2 }, color: '#8fd3ff' },
  emberKindle: { kind: 'tower', tower: 'pulse', add: { kindle: 0.5 }, color: '#ff6b3d' },
  emberQuick: { kind: 'tower', tower: 'pulse', towerMods: { rate: 0.2, range: 0.15 }, color: '#ff6b3d' },
  starWide: { kind: 'tower', tower: 'star', add: { splash: 0.35 }, color: '#c7a6ff' },
  starPower: { kind: 'tower', tower: 'star', towerMods: { dmg: 0.25 }, color: '#c7a6ff' },
  // Gold
  thrift: { kind: 'economy', add: { upgradeDiscount: 0.2 }, color: '#f0bf55' },
  tithe: { kind: 'economy', add: { waveGold: 20 }, color: '#f0bf55' },
  bounty: { kind: 'economy', add: { bounty: 0.2 }, color: '#f0bf55' },
  savings: { kind: 'economy', add: { interest: 0.1, interestCap: 75 }, color: '#f0bf55' },
  windfall: { kind: 'economy', gold: 40, goldPerWave: 12, color: '#f0bf55' },
  // The Warden
  wardenFocus: { kind: 'warden', add: { heroHaste: 1 }, color: '#7fc28a' },
  wardenMight: { kind: 'warden', add: { heroDmg: 0.35 }, color: '#7fc28a' },
  wardenReach: { kind: 'warden', add: { heroRange: 0.3, heroRate: 0.15 }, color: '#7fc28a' },
  // Statuses and the watch
  hotBurn: { kind: 'status', add: { burnDmg: 1, kindle: 0.2 }, color: '#e8735a' },
  deepChill: { kind: 'status', add: { slow: 0.08, chillTime: 0.5 }, color: '#6fb8e8' },
  sunder: { kind: 'status', add: { sunder: 0.5 }, color: '#b9a37a' },
  hearth: { kind: 'status', lives: 6, color: '#ff8f8f' },
  steady: { kind: 'status', add: { allRate: 0.1 }, color: '#d8b46a' },
};

export const BOON_ORDER = Object.keys(BOONS) as BoonId[];

/** A choice of boons comes after every wave that is a multiple of this. */
export const BOON_EVERY = 5;
/** How many boons each choice offers. */
export const BOON_CHOICES = 3;
