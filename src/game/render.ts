import { H, T, W } from '../config';
import { TOWERS } from '../data/towers';
import { canBuild, needsBranch, stats } from './towers';
import { heartOf } from './path';
import type { Enemy, Game, TowerType } from '../types';

const fog = document.createElement('canvas');
fog.width = W; fog.height = H;
const fctx = fog.getContext('2d')!;

const FONT = '"Alegreya Sans", sans-serif';

/** Cuts a soft hole in the darkness layer. */
function light(x: number, y: number, r: number, a: number) {
  const g = fctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.6, `rgba(0,0,0,${a * 0.7})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  fctx.fillStyle = g;
  fctx.beginPath(); fctx.arc(x, y, r, 0, 7); fctx.fill();
}

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

function drawEnemy(ctx: CanvasRenderingContext2D, g: Game, e: Enemy) {
  const d = e.def, r = d.r * T, t = g.t * 6 + e.seed;
  const wob = 1 + 0.07 * Math.sin(t), sq = 1 - 0.07 * Math.sin(t);
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.type === 'flitter') {
    const fl = Math.sin(g.t * 22 + e.seed) * 0.6;
    ctx.fillStyle = d.color; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(-r * 1.1, -r * 0.2, r * 0.9, r * (0.35 + 0.25 * fl), 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 1.1, -r * 0.2, r * 0.9, r * (0.35 + 0.25 * fl), -0.3, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.9, r * 0.3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = d.color;
  ctx.beginPath(); ctx.ellipse(0, 0, r * wob, r * sq, 0, 0, 7); ctx.fill();
  if (e.type === 'shimmer') {
    ctx.strokeStyle = `rgba(180,210,255,${0.35 + 0.25 * Math.sin(t * 1.5)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, 7); ctx.stroke();
  }
  if (e.type === 'giant') {
    ctx.fillStyle = '#24183a';
    for (let i = 0; i < 5; i++) {
      const a = -2.6 + i * 0.55;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
      ctx.lineTo(Math.cos(a + 0.25) * r * 0.85, Math.sin(a + 0.25) * r * 0.85);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.2, -0.5, 0, 7); ctx.fill();

  const blink = Math.sin(g.t * 1.3 + e.seed * 3) > 0.97;
  ctx.fillStyle = d.eye;
  const ey = -r * 0.1, ex = r * 0.32, er = Math.max(2, r * 0.14);
  if (blink) { ctx.fillRect(-ex - er, ey, er * 2, 1.5); ctx.fillRect(ex - er, ey, er * 2, 1.5); }
  else { ctx.beginPath(); ctx.arc(-ex, ey, er, 0, 7); ctx.arc(ex, ey, er, 0, 7); ctx.fill(); }

  if (e.slowUntil > g.t) {
    ctx.strokeStyle = 'rgba(143,211,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * wob + 3, r * sq + 3, 0, 0, 7); ctx.stroke();
  }
  if (e.burnUntil > g.t) {
    ctx.fillStyle = `rgba(255,120,60,${0.5 + 0.3 * Math.sin(g.t * 30)})`;
    ctx.beginPath(); ctx.arc(Math.sin(t * 3) * r * 0.4, -r * 0.9, 3, 0, 7); ctx.fill();
  }
  if (e.stun > g.t) {
    ctx.fillStyle = '#fff3a8';
    for (let i = 0; i < 3; i++) {
      const a = g.t * 5 + i * 2.09;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.8, -r * 1.1 + Math.sin(a) * 3, 2, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

export function draw(ctx: CanvasRenderingContext2D, g: Game) {
  const time = performance.now() / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * 16, (Math.random() - 0.5) * g.shake * 16);
  ctx.drawImage(g.bg, 0, 0);
  const heart = heartOf(g.path);

  // The heart, dimming as lives drop.
  const beat = 0.85 + 0.15 * Math.sin(time * 2.4), hc = g.lives / g.maxLives;
  ctx.fillStyle = '#2a2033'; ctx.beginPath(); ctx.arc(heart.x, heart.y, T * 0.42, 0, 7); ctx.fill();
  ctx.fillStyle = `rgb(255,${(120 + 100 * hc) | 0},${(60 + 40 * hc) | 0})`;
  ctx.beginPath(); ctx.arc(heart.x, heart.y, T * 0.22 * beat, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(heart.x, heart.y, T * 0.09 * beat, 0, 7); ctx.fill();

  for (const t of g.towers) drawTowerShape(ctx, t.type, t.x, t.y, 1, t.angle, time);
  for (const e of g.enemies) drawEnemy(ctx, g, e);

  // Darkness, with lantern light cut out of it.
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, W, H);
  fctx.fillStyle = 'rgba(5,5,14,0.6)';
  fctx.fillRect(0, 0, W, H);
  fctx.globalCompositeOperation = 'destination-out';
  for (const t of g.towers) light(t.x, t.y, stats(t).range * T * 1.05 + 6 * Math.sin(time * 3 + t.tx), 0.85);
  light(heart.x, heart.y, T * 2.2 * beat, 0.9);
  for (const sh of g.shots) light(sh.x, sh.y, T * 0.6, 0.6);
  for (const f of g.fx) if (f.k === 'ring') light(f.x, f.y, f.r1, (0.4 * f.life) / f.max);
  ctx.drawImage(fog, 0, 0);

  ctx.globalCompositeOperation = 'lighter';
  for (const t of g.towers) {
    const color = TOWERS[t.type].color, r = stats(t).range * T;
    const grad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
    grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, 7); ctx.fill();
  }
  {
    const grad = ctx.createRadialGradient(heart.x, heart.y, 0, heart.x, heart.y, T * 1.6);
    grad.addColorStop(0, 'rgba(255,170,80,0.35)'); grad.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(heart.x, heart.y, T * 1.6, 0, 7); ctx.fill();
  }
  for (const sh of g.shots) {
    const big = sh.kind === 'shell';
    ctx.fillStyle = sh.color; ctx.beginPath(); ctx.arc(sh.x, sh.y, big ? 6 : 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = sh.color + '55'; ctx.beginPath(); ctx.arc(sh.x, sh.y, big ? 13 : 8, 0, 7); ctx.fill();
  }
  for (const f of g.fx) {
    const a = Math.max(0, f.life / f.max);
    if (f.k === 'p') { ctx.globalAlpha = a; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, 7); ctx.fill(); }
    else if (f.k === 'ring') {
      const r = f.r0 + (f.r1 - f.r0) * (1 - a);
      ctx.globalAlpha = a * 0.8; ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.stroke();
    } else if (f.k === 'line') {
      ctx.globalAlpha = a; ctx.strokeStyle = f.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const t of g.towers) if (t.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${t.flash * 0.5})`;
    ctx.beginPath(); ctx.arc(t.x, t.y, 24 + 10 * (1 - t.flash), 0, 7); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Level pips and the "choose a branch" badge.
  for (const t of g.towers) {
    for (let i = 0; i < t.level; i++) {
      ctx.fillStyle = t.branch !== null && i >= 2 ? TOWERS[t.type].color : '#e9e1c9';
      ctx.beginPath(); ctx.arc(t.x - (t.level - 1) * 4 + i * 8, t.y + T * 0.43, 2.6, 0, 7); ctx.fill();
    }
    if (needsBranch(t)) {
      const b = 0.6 + 0.4 * Math.sin(time * 6);
      ctx.fillStyle = `rgba(255,181,71,${b})`;
      ctx.beginPath(); ctx.arc(t.x + T * 0.32, t.y - T * 0.32, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#24170a'; ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', t.x + T * 0.32, t.y - T * 0.31);
    }
  }

  for (const e of g.enemies) {
    if (e.hp >= e.maxHp) continue;
    const r = e.def.r * T, w = Math.max(22, r * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - r - 10, w, 4);
    ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#7fc28a' : '#ff5f6d';
    ctx.fillRect(e.x - w / 2, e.y - r - 10, w * Math.max(0, e.hp / e.maxHp), 4);
  }

  if (g.selected) {
    const t = g.selected, r = stats(t).range * T;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  if (g.build && g.hover) {
    const { tx, ty } = g.hover;
    const ok = canBuild(g, tx, ty) && g.gold >= TOWERS[g.build].cost;
    const x = (tx + 0.5) * T, y = (ty + 0.5) * T;
    ctx.fillStyle = ok ? 'rgba(127,194,138,0.12)' : 'rgba(255,95,109,0.15)';
    ctx.fillRect(tx * T, ty * T, T, T);
    ctx.strokeStyle = ok ? 'rgba(127,194,138,0.7)' : 'rgba(255,95,109,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, TOWERS[g.build].range * T, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.6; drawTowerShape(ctx, g.build, x, y, 1, -Math.PI / 2, time); ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of g.fx) if (f.k === 'txt') {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
    ctx.font = `700 ${f.size}px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
