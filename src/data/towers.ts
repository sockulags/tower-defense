import type { TowerDef, TowerType } from '../types';

// Display names and descriptions live in src/i18n.
export const TOWERS: Record<TowerType, TowerDef> = {
  spark: { cost: 50, range: 2.4, rate: 0.5, dmg: 9, color: '#ffd27a', kind: 'shot', speed: 15 },
  frost: { cost: 70, range: 2.1, rate: 0.9, dmg: 4, color: '#8fd3ff', kind: 'shot', speed: 10, slow: 0.45, slowDur: 1.6 },
  pulse: { cost: 85, range: 1.6, rate: 1.2, dmg: 12, color: '#ff6b3d', kind: 'pulse', unlock: 2 },
  star: { cost: 130, range: 3.4, rate: 2.2, dmg: 38, color: '#c7a6ff', kind: 'shell', speed: 7, splash: 1.0, unlock: 3 },
};

export const TOWER_ORDER: TowerType[] = ['spark', 'frost', 'pulse', 'star'];
