import { TOWERS } from '../data/towers';
import type { TowerType } from '../types';

/** Flat 2D tower icons for the palette and the menu codex. */
export function drawTowerShape(c: CanvasRenderingContext2D, type: TowerType, x: number, y: number, s: number, angle: number, time: number) {
  const d = TOWERS[type];
  c.fillStyle = '#262739';
  c.strokeStyle = '#4a4b66';
  c.lineWidth = 2 * s;
  c.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.52; c.lineTo(x + Math.cos(a) * 22 * s, y + Math.sin(a) * 22 * s); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = d.color;
  c.strokeStyle = d.color;

  if (type === 'spark') {
    c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = '#3a3b52'; c.fillRect(0, -4 * s, 16 * s, 8 * s); c.restore();
    c.fillStyle = d.color; c.beginPath(); c.arc(x, y, 9 * s, 0, 7); c.fill();
    c.fillStyle = '#fff6dc'; c.beginPath(); c.arc(x, y, 4 * s, 0, 7); c.fill();
  } else if (type === 'frost') {
    c.beginPath(); c.moveTo(x, y - 14 * s); c.lineTo(x + 9 * s, y); c.lineTo(x, y + 14 * s); c.lineTo(x - 9 * s, y); c.closePath(); c.fill();
    c.fillStyle = '#e8f7ff';
    c.beginPath(); c.moveTo(x, y - 7 * s); c.lineTo(x + 4 * s, y); c.lineTo(x, y + 7 * s); c.lineTo(x - 4 * s, y); c.closePath(); c.fill();
  } else if (type === 'pulse') {
    const f = 1 + 0.12 * Math.sin(time * 8);
    c.lineWidth = 3 * s; c.beginPath(); c.arc(x, y, 13 * s, 0, 7); c.stroke();
    c.beginPath(); c.arc(x, y, 7 * s * f, 0, 7); c.fill();
  } else {
    c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = '#3a3b52'; c.fillRect(-2 * s, -6 * s, 20 * s, 12 * s); c.restore();
    c.save(); c.translate(x, y); c.rotate(time * 1.2); c.fillStyle = d.color; c.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 4 * s : 12 * s, a = (i / 8) * 6.283; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fill(); c.restore();
  }
}
