import { drawTowerShape } from '../game/render';
import type { TowerType } from '../types';

export const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;

/** Sets text only when it changed, so per-frame HUD updates stay cheap. */
const cache = new Map<string, string>();
export function setText(id: string, value: string) {
  if (cache.get(id) === value) return;
  cache.set(id, value);
  $(id).textContent = value;
}
export const clearTextCache = () => cache.clear();

export function towerIcon(type: TowerType, size: number) {
  const c = document.createElement('canvas');
  c.width = size * 2; c.height = size * 2;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  drawTowerShape(g, type, size / 2, size / 2, size / 50, -Math.PI / 2, 0.3);
  return c;
}
