// Economy buildings (lab experiment, gameplay.md phase 10): the mill's medallion on the build belt,
// placing a mill on the board, and the small card that opens beside a mill with its stage, its pay
// and a sell button. Everything here stays dormant unless the run has `game.dev.mills` on, which
// only the lab's sandbox switch sets; players never see it until the user decides.
//
// The belt calls `appendMillMedal`; everything else listens for itself. Board input is caught in
// the capture phase before ui/play.ts sees it, and only when it concerns a mill: a click or tap on
// a mill opens its card, and while the mill medallion is picked a click places one (on touch, a
// tap places the ghost and a second tap on it builds, like the towers).
import { T } from '../config';
import { MILL } from '../data/mills';
import { canAffordMill, millAt, millCount, millPay, millSellValue, millStageOf, millsAllowed, placeMill, sellMill } from '../game/mills';
import { canBuild, towerAt, TOWER_SPACING } from '../game/towers';
import { millPortrait } from '../three/view';
import { L } from '../i18n';
import { $ } from './dom';
import { ICONS } from './icons';
import { currentGame, currentView } from './play';
import type { Game, Mill } from '../types';


const cv = $<HTMLCanvasElement>('cv');
let pointer: string = 'mouse';
let pending: { x: number; y: number } | null = null;
let press: { id: number; cx: number; cy: number; moved: boolean; mill: Mill | null; near: boolean } | null = null;
let cardKey = '';

/** The run, when mills are on and the play HUD is showing (not the menu demo or the lab gallery). */
function active(): Game | null {
  const g = currentGame();
  return g && millsAllowed(g) && !$('hud').hidden && !g.over ? g : null;
}

// ---------- the medallion ----------

/** Adds the mill medallion at the end of the belt when the run allows mills. Called by renderBelt. */
export function appendMillMedal(belt: HTMLElement) {
  const g = currentGame();
  if (!g || !millsAllowed(g)) return;
  const s = L();
  const b = document.createElement('button');
  b.className = 'medal mill';
  b.dataset.mill = '1';
  b.setAttribute('aria-label', s.mills.name);
  b.innerHTML = `<span class="face"><img src="${millPortrait(3)}" alt=""></span>
    <span class="key">M</span><span class="price">${ICONS.coin} ${MILL.cost}</span>`;
  b.onpointerdown = (e) => { pointer = e.pointerType; };
  b.onclick = () => toggleBuild();
  b.onpointerenter = (e) => { if (e.pointerType === 'mouse') showTip(b); };
  b.onpointerleave = () => { $('tip').hidden = true; };
  belt.appendChild(b);
}

function showTip(anchor: HTMLElement) {
  const s = L(), tip = $('tip');
  tip.innerHTML = `<h3>${s.mills.name}</h3><p>${s.mills.desc}</p><p class="fine">${s.mills.limit(MILL.max)}</p>`;
  tip.hidden = false;
  const r = anchor.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(window.innerWidth - tip.offsetWidth - 12, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
}

function toast(text: string) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  window.setTimeout(() => { if (el.textContent === text) el.hidden = true; }, 4000);
}

function toggleBuild() {
  const g = active();
  if (!g) return;
  if (!g.millBuild && millCount(g) >= MILL.max) { toast(L().mills.full); return; }
  g.millBuild = !g.millBuild;
  pending = null;
  closeCard(g);
  if (g.millBuild) {
    // The mill takes the pointer over from whatever else was picked.
    g.build = null; g.selected = null; g.heroSelected = false;
    $('card').hidden = true;
    const name = L().mills.inHint;
    toast(pointer === 'touch' ? L().hud.placeHintTouch(name) : L().hud.placeHint(name));
  } else { g.hover = pointer === 'touch' ? null : g.hover; $('toast').hidden = true; }
}

function stopBuild(g: Game) {
  g.millBuild = false;
  pending = null;
  $('toast').hidden = true;
}

function tryPlace(g: Game, x: number, y: number) {
  if (!placeMill(g, x, y)) return false;
  pending = null;
  if (!canAffordMill(g)) stopBuild(g);
  return true;
}

// ---------- the card ----------

function openCard(g: Game, m: Mill) {
  stopBuild(g);
  g.selected = null; g.heroSelected = false; g.build = null;
  $('card').hidden = true;
  $('quick').hidden = true;
  g.millSelected = m;
  cardKey = '';
  renderCard(g);
}

function closeCard(g: Game) {
  g.millSelected = null;
  const el = document.getElementById('millCard');
  if (el) el.hidden = true;
}

function cardEl() {
  let el = document.getElementById('millCard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'millCard';
    el.className = 'tcard panel';
    el.hidden = true;
    $('card').after(el);
  }
  return el;
}

function renderCard(g: Game) {
  const m = g.millSelected, el = cardEl();
  if (!m || !g.mills?.includes(m)) { el.hidden = true; return; }
  const stage = millStageOf(m), next = stage >= 3 ? 0 : MILL.grow[stage - 1] - m.waves;
  const key = `${stage}:${m.paid}:${m.waves}:${L().mills.name}`;
  if (key !== cardKey) {
    cardKey = key;
    const s = L();
    el.innerHTML = `<button class="x" id="mcClose" aria-label="${s.hud.close}">${ICONS.close}</button>
      <header><img src="${millPortrait(stage)}" alt=""><div>
        <h3>${s.mills.name}</h3>
        <p class="fine">${s.mills.stage(stage)}</p>
        <div class="lvl-pips">${[1, 2, 3].map((i) => `<b class="${i <= stage ? 'f' : ''}"></b>`).join('')}</div>
      </div></header>
      <p class="fine">${s.mills.pays(millPay(m))}. ${next > 0 ? s.mills.grows(next) : s.mills.grown}.</p>
      <p class="fine">${s.mills.paid(m.paid)}</p>
      <div class="btnrow"><button class="ghost" id="mcSell">${s.info.sell(millSellValue(m))}</button></div>`;
    el.style.setProperty('--accent', MILL.color);
    $('mcClose').onclick = () => closeCard(g);
    $('mcSell').onclick = () => { sellMill(g, m); closeCard(g); };
  }
  el.hidden = false;
  // Beside the mill, like the tower card.
  const w = cv.clientWidth, h = cv.clientHeight, p = currentView().screenOf(m.x, m.y, 0.8);
  const cw = el.offsetWidth, ch = el.offsetHeight;
  let left = p.sx + 46;
  if (left + cw > w - 12) left = p.sx - 46 - cw;
  const top = Math.max(8, Math.min(h - ch - 8, p.sy - ch / 2));
  el.style.transform = `translate(${Math.round(Math.max(12, left))}px, ${Math.round(top)}px)`;
}

// ---------- every frame: the medallion's state and the card ----------

function tick() {
  requestAnimationFrame(tick);
  const g = currentGame();
  const el = document.getElementById('millCard');
  if (!g || !active()) {
    if (el) el.hidden = true;
    if (g) g.millBuild = false;
    return;
  }
  // Picking a tower, the Warden or a tower card hands the pointer back to them.
  if (g.build || g.selected || g.heroSelected) {
    if (g.millBuild) stopBuild(g);
    if (g.millSelected) closeCard(g);
  }
  const medal = document.querySelector<HTMLElement>('#belt [data-mill]');
  if (medal) {
    const full = millCount(g) >= MILL.max;
    medal.classList.toggle('sel', !!g.millBuild || !!g.millSelected);
    medal.classList.toggle('locked', full);
    medal.classList.toggle('poor', !full && g.gold < MILL.cost);
  }
  if (g.millSelected) renderCard(g); else if (el && !el.hidden) el.hidden = true;
}
requestAnimationFrame(tick);

// ---------- board input, caught before ui/play.ts ----------

const onBoard = (ev: PointerEvent) => ev.target === cv;
const heroAt = (g: Game, x: number, y: number) => !!g.hero && Math.hypot(g.hero.x - x, g.hero.y - y) < TOWER_SPACING / 2;
const claim = (ev: Event) => { ev.stopImmediatePropagation(); ev.preventDefault(); };

window.addEventListener('pointerdown', (ev) => {
  const g = active();
  if (!g || !onBoard(ev)) return;
  pointer = ev.pointerType;
  const p = currentView().pickPoint(ev.clientX, ev.clientY);
  if (!p) return;
  const m = millAt(g, p.x, p.y) ?? null;
  const other = !!towerAt(g, p.x, p.y) || heroAt(g, p.x, p.y);
  if (ev.pointerType === 'touch') {
    if (!m && !(g.millBuild && !other)) { if (g.millSelected) closeCard(g); return; }
    const near = !!pending && Math.hypot(pending.x - p.x, pending.y - p.y) < 0.55 * T;
    press = { id: ev.pointerId, cx: ev.clientX, cy: ev.clientY, moved: false, mill: m, near };
    if (!m && !near) { pending = p; g.hover = p; }
    claim(ev);
    return;
  }
  if (ev.button === 2) { if (g.millBuild) stopBuild(g); if (g.millSelected) closeCard(g); return; }
  if (m) { openCard(g, m); claim(ev); return; }
  if (g.millBuild && !other) {
    g.hover = p;
    tryPlace(g, p.x, p.y);
    claim(ev);
    return;
  }
  if (g.millSelected) closeCard(g);
}, true);

window.addEventListener('pointermove', (ev) => {
  const g = active();
  if (!g || !press || press.id !== ev.pointerId) return;
  if (!press.moved && Math.hypot(ev.clientX - press.cx, ev.clientY - press.cy) > 12) press.moved = true;
  if (press.moved && g.millBuild && !press.mill) {
    const p = currentView().pickPoint(ev.clientX, ev.clientY);
    if (p) { pending = p; g.hover = p; }
  }
  claim(ev);
}, true);

window.addEventListener('pointerup', (ev) => {
  const g = active();
  const pr = press;
  if (!g || !pr || pr.id !== ev.pointerId) return;
  press = null;
  claim(ev);
  if (pr.mill) { if (!pr.moved) openCard(g, pr.mill); return; }
  if (pr.near && !pr.moved && pending) {
    if (canBuild(g, pending.x, pending.y) && tryPlace(g, pending.x, pending.y)) g.hover = null;
    return;
  }
  toast(L().hud.confirmPlace);
}, true);

window.addEventListener('pointercancel', () => { press = null; }, true);

document.addEventListener('keydown', (ev) => {
  const g = active();
  if (!g) return;
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
  if (ev.key === 'm' || ev.key === 'M') { pointer = 'mouse'; toggleBuild(); }
  else if (ev.key === 'Escape') { if (g.millBuild) stopBuild(g); if (g.millSelected) closeCard(g); }
});
