import { TOWERS } from '../data/towers';
import type { TowerType } from '../types';

const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

/** Inline SVG icons for the in-game HUD, drawn in the storybook ink-and-fill style. */
export const ICONS = {
  heart: svg('<path d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.2 3.4 4.5 7 4.5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.6 0 5.8 3.7 4.4 7.2C19.5 16.4 12 21 12 21z" fill="#e8484f" stroke="#2a1c2c" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 8.2c-1 .3-1.6 1.2-1.6 2.2" stroke="#ffc2c2" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  coin: svg('<circle cx="12" cy="12" r="9" fill="#f2c14e" stroke="#2a1c2c" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#b07d22" stroke-width="1.6"/><path d="M9 8.5c.8-.9 1.9-1.4 3-1.4" stroke="#fff1c2" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  pause: svg('<rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/>'),
  play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  mute: svg('<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor"/><path d="M16 9l5 6m0-6l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  menu: svg('<path d="M4.5 7h15M4.5 12h15M4.5 17h15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  close: svg('<path d="M6.5 6.5l11 11m0-11l-11 11" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/>'),
  horn: svg('<path d="M3.5 10v4l3 .5 9.5 5V4.5L6.5 9.5z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M18.5 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M6 14.5l1.5 5h2.5l-1-4.5" fill="currentColor"/>'),
};

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
