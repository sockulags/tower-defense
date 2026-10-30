import type { EnemyDef, EnemyType } from '../types';

// Tuned with `npm run balance`: crowds are tough enough that single-target-only builds leak them,
// and a giant costs 6 lives, so a missed giant hurts without ending the run on its own.
export const ENEMIES: Record<EnemyType, EnemyDef> = {
  crawler: { hp: 57, speed: 1.0, reward: 5, leak: 1, r: 0.24, color: '#7a62b8', eye: '#ffe9a8' },
  flitter: { hp: 31, speed: 1.9, reward: 4, leak: 1, r: 0.18, color: '#3fa79a', eye: '#f2fff4' },
  lump: { hp: 215, speed: 0.6, reward: 12, leak: 2, r: 0.34, color: '#9a4f78', eye: '#ffcf7a' },
  shimmer: { hp: 99, speed: 1.1, reward: 9, leak: 1, r: 0.25, color: '#5c7fd6', eye: '#e4f3ff', regen: 0.06 },
  giant: { hp: 860, speed: 0.42, reward: 80, leak: 6, r: 0.46, color: '#3b2a55', eye: '#ff5a3d' },
};
