// The Warden, the player's own defender. Display names and descriptions live in src/i18n.
//
// The loadout is the build: the weapon decides how the Warden attacks and which ability the
// player can cast, the charm adds a passive, and the hat and cloak are purely looks. Everything
// except the starting kit is unlocked with stardust in the Warden's Lodge.

export type WeaponId = 'staff' | 'bell' | 'sling';
export type CharmId = 'none' | 'ember' | 'badge' | 'jar';
export type HatId = 'hood' | 'tricorn' | 'wizard' | 'leaves';
export type CloakId = 'moss' | 'crimson' | 'midnight' | 'saffron';
export type TalentId = 'might' | 'reach' | 'focus' | 'veteran';

export interface Loadout { weapon: WeaponId; charm: CharmId; hat: HatId; cloak: CloakId }

export interface WeaponDef {
  cost: number;
  /** Attack range in tiles, seconds between attacks, damage per hit. */
  range: number; rate: number; dmg: number;
  /** bolt: one target; wave: everything around the Warden; shot: one target from far away. */
  kind: 'bolt' | 'wave' | 'shot';
  color: string;
  /** Seconds between casts of the weapon's ability. */
  cooldown: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  staff: { cost: 0, range: 2.2, rate: 0.65, dmg: 20, kind: 'bolt', color: '#ffc35a', cooldown: 18 },
  bell: { cost: 40, range: 1.7, rate: 1.1, dmg: 10, kind: 'wave', color: '#9fd8ff', cooldown: 22 },
  sling: { cost: 60, range: 3.6, rate: 1.4, dmg: 30, kind: 'shot', color: '#c7a6ff', cooldown: 16 },
};

export const CHARMS: Record<CharmId, { cost: number; color: string }> = {
  none: { cost: 0, color: '#c9b99b' },
  ember: { cost: 30, color: '#ff6b3d' },
  badge: { cost: 50, color: '#f0bf55' },
  jar: { cost: 40, color: '#d8ff9a' },
};

export const HATS: Record<HatId, { cost: number; color: string }> = {
  hood: { cost: 0, color: '' },
  tricorn: { cost: 15, color: '#4a3226' },
  wizard: { cost: 25, color: '#3b4f9a' },
  leaves: { cost: 20, color: '#5aa35a' },
};

export const CLOAKS: Record<CloakId, { cost: number; color: string }> = {
  moss: { cost: 0, color: '#4f8a5a' },
  crimson: { cost: 12, color: '#b8433f' },
  midnight: { cost: 12, color: '#3d4a8a' },
  saffron: { cost: 18, color: '#e0a23a' },
};

export const TALENTS: { id: TalentId; max: number }[] = [
  { id: 'might', max: 3 },
  { id: 'reach', max: 3 },
  { id: 'focus', max: 3 },
  { id: 'veteran', max: 2 },
];
export const talentCost = (level: number) => 15 + level * 15;

export const DEFAULT_LOADOUT: Loadout = { weapon: 'staff', charm: 'none', hat: 'hood', cloak: 'moss' };
export const STARTING_ITEMS = ['weapon:staff', 'charm:none', 'hat:hood', 'cloak:moss'];

export const HERO_MAX_LEVEL = 5;
/** Gold to raise the Warden from `level` to the next level during a run. */
export const heroUpgradeCost = (level: number) => 50 * level;

/** Charm tuning. */
export const BADGE_RADIUS = 2.2;
export const BADGE_BONUS = 0.15;
export const JAR_GOLD = 2;
export const EMBER_BURN = 0.5;
