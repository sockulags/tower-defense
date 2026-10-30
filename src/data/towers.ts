import type { TowerDef, TowerType } from '../types';

// Display names and descriptions live in src/i18n. Tuned with `npm run balance` so a mixed build
// beats any single tower: Spark is cheap single-target damage, Rime's slow helps everyone near it,
// Ember clears crowds up close but cannot stop a giant, and Starfall splashes from afar.
export const TOWERS: Record<TowerType, TowerDef> = {
  spark: { cost: 50, range: 2.4, rate: 0.5, dmg: 7.5, color: '#ffd27a', kind: 'shot', speed: 15 },
  frost: { cost: 70, range: 2.4, rate: 0.9, dmg: 6, color: '#8fd3ff', kind: 'shot', speed: 10, slow: 0.55, slowDur: 2 },
  pulse: { cost: 85, range: 1.6, rate: 1.2, dmg: 18, color: '#ff6b3d', kind: 'pulse', unlock: 2 },
  star: { cost: 140, range: 3.4, rate: 2.4, dmg: 38, color: '#c7a6ff', kind: 'shell', speed: 7, splash: 1.2, unlock: 3 },
};

export const TOWER_ORDER: TowerType[] = ['spark', 'frost', 'pulse', 'star'];
