import type { EnemyDef, EnemyType } from '../types';

// Tuned with `npm run balance`. Each shadow has at most one trait, which one or two towers answer
// well (see docs/plans/gameplay.md, phase 3):
// - flying (Duskmoth): only towers with `air` can hit it, so not Ember Pulse or Starfall.
// - armoured (Brute): `armour` is blocked from every hit, so big hits answer it.
// - mends (Veil): regains health fast unless it is burning or frozen.
// - splits (Inkblot): breaks into three Droplets when it dies; splash answers it.
// - sprints (Scurrier): runs in bursts unless it is chilled.
// A giant costs 6 lives, so a missed giant hurts without ending the run on its own.
export const ENEMIES: Record<EnemyType, EnemyDef> = {
  crawler: { hp: 57, speed: 1.0, reward: 5, leak: 1, r: 0.24, color: '#7a62b8', eye: '#ffe9a8', traits: [] },
  flitter: { hp: 26, speed: 1.6, reward: 4, leak: 1, r: 0.18, color: '#3fa79a', eye: '#f2fff4', traits: ['flying'] },
  lump: { hp: 200, speed: 0.6, reward: 12, leak: 2, r: 0.34, color: '#9a4f78', eye: '#ffcf7a', traits: ['armoured'], armour: 4 },
  shimmer: { hp: 90, speed: 1.1, reward: 9, leak: 1, r: 0.25, color: '#5c7fd6', eye: '#e4f3ff', traits: ['mends'], regen: 0.035 },
  splitter: { hp: 95, speed: 0.85, reward: 6, leak: 2, r: 0.3, color: '#6d3fa0', eye: '#f2ff7a', traits: ['splits'], split: { type: 'speck', count: 3 } },
  speck: { hp: 22, speed: 1.1, reward: 1, leak: 1, r: 0.15, color: '#8a5cc8', eye: '#f2ff7a', traits: [] },
  dasher: { hp: 62, speed: 0.75, reward: 7, leak: 1, r: 0.22, color: '#b0447e', eye: '#f2ff7a', traits: ['sprints'], sprint: { mult: 3.4, dur: 0.8, every: 2.4 } },
  giant: { hp: 860, speed: 0.42, reward: 80, leak: 6, r: 0.46, color: '#3b2a55', eye: '#ff5a3d', traits: [], boss: {} },

  // ---------- bosses ----------
  // One boss per story map replaces the giant on its boss waves (src/data/maps.ts). Each has one
  // mechanic (src/game/bosses.ts) and one shadow trait, so the trait's answer helps against it:
  // - Stomper: armoured. Every few steps it stomps and knocks the towers near it out for a while,
  //   so towers placed further from the road, or out of its reach, keep firing.
  // - Thief: sprints. Halfway along the road it grabs gold from the purse and runs back to the
  //   rift; killing it returns the gold, letting it escape loses the gold and lives.
  // - Mender: mends. It heals every shadow around it (other bosses excepted) unless it is burning, so it must be focused
  //   down (or set alight) before its escort.
  // Bosses take half the slow and cannot be frozen, like the giant.
  stomper: { hp: 1100, speed: 0.4, reward: 90, leak: 6, r: 0.5, color: '#5a2f6e', eye: '#f2ff7a', traits: ['armoured'], armour: 7,
    boss: { stomp: { every: 4, radius: 2, knock: 3.3 } } },
  thief: { hp: 680, speed: 0.6, reward: 70, leak: 4, r: 0.4, color: '#7d3a8c', eye: '#f2ff7a', traits: ['sprints'], sprint: { mult: 2.4, dur: 0.9, every: 3 },
    boss: { steal: { at: 0.5, share: 0.6, max: 60, perWave: 8, flee: 1.7 } } },
  mender: { hp: 820, speed: 0.45, reward: 80, leak: 6, r: 0.44, color: '#6b3f9e', eye: '#f2ff7a', traits: ['mends'], regen: 0.01,
    boss: { mend: { every: 2.6, radius: 2.4, heal: 0.12 } } },
  // ---------- end bosses ----------
};

/** Gallery and preview order. */
export const ENEMY_ORDER = Object.keys(ENEMIES) as EnemyType[];

// ---------- bosses ----------
/** Every boss, the giant included. */
export const isBoss = (type: EnemyType) => !!ENEMIES[type].boss;
// ---------- end bosses ----------
