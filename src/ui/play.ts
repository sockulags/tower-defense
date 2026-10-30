// The in-game screen: a full-window board with the controls living on it as parts of the world,
// a resource plaque, a build belt of medallions (the Warden first, then the towers), a wave horn
// at the road's entrance, an ability button for the Warden, and a card that opens beside
// whichever tower or Warden is selected.
//
// The same board also runs the silent demo behind the menu ('menu' mode) and the developer
// lab's gallery ('gallery' mode). The lab's sandbox is an ordinary run with `game.dev` switches.
import { MAX_LEVEL, T } from '../config';
import { HERO_MAX_LEVEL, heroUpgradeCost } from '../data/hero';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { posAt } from '../game/path';
import { canUpgradeHero, castAbility, heroStats, placeHero, upgradeHero } from '../game/hero';
import { createGame, giveUp, startWave, update } from '../game/run';
import {
  canUpgrade, chooseBranch, needsBranch, nickname, placeTower, sell, sellValue, stats, towerAt, upgrade, upgradeCost, NAMED_LEVEL,
  TOWER_SPACING,
} from '../game/towers';
import { GameView, branchPortrait, heroPortrait, towerPortraits } from '../three/view';
import { L, fmt } from '../i18n';
import { initAudio, isMuted, setMuted, setQuiet } from '../audio';
import { finishRun } from '../meta';
import { towerUnlocked } from '../save';
import { $, clearTextCache, setText } from './dom';
import { ICONS } from './icons';
import { nav } from './nav';
// Front door: first-run hints, the end-of-run panel and the pause menu's overlays.
import { renderEnd } from './endrun';
import { startHints, stopHints } from './hints';
import { openHowTo, openSettings } from './settings';
// Shadow traits: tower attribute icons and the next-wave preview.
import { renderWavePreview, towerAttrIcons } from './traits';
import type { Game, MapId, Stats, Tower, TowerType } from '../types';

type Mode = 'menu' | 'play' | 'gallery';

let game: Game | null = null;
let mode: Mode = 'menu';
let quitArmed = false;
let toastTimer = 0;
let frameHook: ((g: Game) => void) | null = null;
const cv = $<HTMLCanvasElement>('cv');
const view = new GameView(cv, $<HTMLCanvasElement>('cv2d'));

export const currentGame = () => game;
export const currentView = () => view;
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__view = view;

/** Lets the lab run its own per-frame code (readouts, invulnerable dummies). */
export const setFrameHook = (fn: ((g: Game) => void) | null) => { frameHook = fn; };

/** Shows a game on the board without the play HUD; used by the menu demo and the lab gallery. */
export function adopt(g: Game, m: 'menu' | 'gallery') {
  mode = m;
  setQuiet(m === 'menu');
  game = g;
  $('hud').hidden = true;
  $('ov').hidden = true;
  $('card').hidden = true;
  resetControls();
  view.setGame(g);
}

export function startRun(mapId: MapId, dev = false) {
  mode = 'play';
  setQuiet(false);
  const g = createGame(mapId, {
    towerChanged: (t) => { if (game?.selected === t) renderCard(); },
    // The sandbox never ends a run or pays out stardust.
    ended: (win) => { if (g.dev) g.over = false; else showEnd(win, false); },
  });
  if (dev) g.dev = { god: true, freeGold: true, allTowers: true };
  game = g;
  quitArmed = false;
  clearTextCache();
  $('menu').hidden = true;
  $('hud').hidden = false;
  $('ov').hidden = true;
  $('menuPop').hidden = true;
  resetControls();
  view.setGame(g);
  applyStaticText();
  renderBelt();
  renderCard();
  startHints(g);
}

/** Demo towers for the menu backdrop: one of each kind, spread along Mill Hill's road. */
const DEMO: [TowerType, number, number, number][] = [
  ['spark', 2.8, 3.4, 3], ['frost', 5.4, 1.0, 2], ['pulse', 6.6, 6.1, 3], ['star', 7.4, 4.2, 4],
  ['spark', 10.6, 5.6, 2], ['frost', 11.6, 1.0, 3], ['star', 14.2, 4.4, 2],
];

/** Starts the silent, endless demo that plays behind the menu. */
export function startAttract() {
  const g = createGame('mill', { towerChanged: () => {}, ended: () => startAttract() });
  g.lives = g.maxLives = 1e6;
  g.gold = 1e6;
  g.auto = true;
  g.autoT = 1;
  for (const [type, tx, ty, level] of DEMO) {
    const t = placeTower(g, type, (tx + 0.5) * T, (ty + 0.5) * T, true);
    if (!t) continue;
    for (let i = 0; i < 6 && t.level < level; i++) {
      if (needsBranch(t)) chooseBranch(g, t, t.x > 400 ? 1 : 0); else upgrade(g, t);
    }
  }
  placeHero(g, 11.2 * T, 4.6 * T);
  g.fx = [];
  adopt(g, 'menu');
}

/** Called once per animation frame from main.ts. */
export function frame(dt: number) {
  const g = game;
  if (!g) return;
  if (g.dev?.freeGold) g.gold = Math.max(g.gold, 99999);
  if (!g.paused && !g.over) {
    if (g.speed < 1) update(g, dt * g.speed);
    else for (let i = 0; i < g.speed; i++) update(g, dt);
  }
  frameHook?.(g);
  if (mode === 'play') updateQuick(g);
  view.render(g);
  if (mode !== 'play') return;
  updateHud(g);
  placeAnchors(g);
  placeQuick(g);
}

const canUseTower = (g: Game, type: TowerType) => !!g.dev?.allTowers || towerUnlocked(type);

// ---------- static text and icons ----------

function applyStaticText() {
  const s = L().hud;
  $('bWaveIcon').innerHTML = ICONS.horn;
  $('hLivesIcon').innerHTML = ICONS.heart;
  $('hGoldIcon').innerHTML = ICONS.coin;
  $('hWaveL').textContent = s.wave;
  $('hMapName').textContent = L().maps[game!.map.id].name;
  $('bSpeed').textContent = '1×';
  $('bSpeed').title = s.speed;
  $('bSpeed').classList.remove('on');
  setIcon('bPause', ICONS.pause, s.pause);
  delete $('bPause').dataset.paused;
  setIcon('bMute', isMuted() ? ICONS.mute : ICONS.sound, isMuted() ? s.soundOff : s.soundOn);
  setIcon('bMenu', ICONS.menu, s.menu);
  $('bAuto').textContent = s.auto;
  $('bAuto').title = s.autoTitle;
  $('bAuto').classList.remove('on');
  $('pausedBanner').textContent = s.paused;
  $('mResume').textContent = s.resume;
  $('mSettings').textContent = L().front.settings;
  $('mHowTo').textContent = L().front.howTo;
  $('bQuit').textContent = s.giveUp;
  $('turnNote').textContent = s.turnPhone;
}

function setIcon(id: string, svg: string, label: string) {
  const b = $(id);
  b.innerHTML = svg;
  b.setAttribute('aria-label', label);
  b.title = label;
}

// ---------- per-frame HUD ----------

function updateHud(g: Game) {
  const s = L().hud;
  setText('hLives', g.dev?.god ? '∞' : String(Math.max(0, g.lives)));
  setText('hGold', g.dev?.freeGold ? '∞' : fmt(g.gold));
  setText('hWave', g.map.survival ? String(g.wave) : `${g.wave} / ${g.map.waves}`);

  const horn = $<HTMLButtonElement>('bWave');
  const busy = g.active || g.over;
  if (horn.disabled !== busy) horn.disabled = busy;
  setText('bWaveLabel', busy ? s.shadowsLeft(g.queue.length + g.enemies.length) : s.callWave);
  setText('bWaveSub', busy ? s.waveNumber(g.wave) : s.waveNumber(g.wave + 1));
  updateWavePreview(g); // shadow traits: next-wave preview
  $('pausedBanner').hidden = !g.paused || !$('menuPop').hidden;
  if ($('bPause').dataset.paused !== String(g.paused)) {
    $('bPause').dataset.paused = String(g.paused);
    setIcon('bPause', g.paused ? ICONS.play : ICONS.pause, g.paused ? s.resume : s.pause);
  }

  for (const b of Array.from($('belt').children) as HTMLButtonElement[]) {
    const type = b.dataset.type as TowerType | 'hero';
    if (type === 'hero') {
      b.classList.toggle('sel', g.build === 'hero' || g.heroSelected);
      b.classList.toggle('placed', !!g.hero);
      continue;
    }
    const locked = !canUseTower(g, type), poor = g.gold < TOWERS[type].cost;
    b.classList.toggle('poor', !locked && poor);
    b.classList.toggle('sel', g.build === type);
  }

  updateAbility(g);

  const t = g.selected;
  if (t) {
    const dis = !canUpgrade(g, t);
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#cUpgrade, [data-br]'))) {
      if (b.disabled !== dis) b.disabled = dis;
    }
    const rec = document.getElementById('cRecord');
    if (rec) rec.textContent = L().info.record(t.kills, fmt(t.dealt));
  } else if (g.heroSelected && g.hero) {
    const up = document.getElementById('cUpgrade') as HTMLButtonElement | null;
    if (up) { const dis = !canUpgradeHero(g); if (up.disabled !== dis) up.disabled = dis; }
    const rec = document.getElementById('cRecord');
    if (rec) rec.textContent = L().info.record(g.hero.kills, fmt(g.hero.dealt));
    const cast = document.getElementById('cCast') as HTMLButtonElement | null;
    if (cast) {
      const dis = g.hero.abilityCd > 0;
      if (cast.disabled !== dis) cast.disabled = dis;
      setText('cCastTime', dis ? L().hero.seconds(Math.ceil(g.hero.abilityCd)) : L().hero.ready);
    }
  }
}

/** The ability button beside the belt: a round brass seal that fills back up as it cools down. */
function updateAbility(g: Game) {
  const btn = $<HTMLButtonElement>('ability');
  const h = g.hero;
  btn.hidden = !h;
  if (!h) return;
  const total = heroStats(h).cooldown;
  const left = h.abilityCd;
  btn.style.setProperty('--cool', String(left > 0 ? left / total : 0));
  btn.classList.toggle('ready', left <= 0);
  if (btn.disabled !== left > 0) btn.disabled = left > 0;
  setText('abilityName', L().hero.weapons[h.loadout.weapon].ability);
  setText('abilityTime', left > 0 ? String(Math.ceil(left)) : L().hero.ready);
}

// ---------- shadow traits: next-wave preview at the wave horn ----------

let previewKey = '';

/** Shows the coming wave's shadows under the horn while the player can still call it. */
function updateWavePreview(g: Game) {
  let el = document.getElementById('wavePreview');
  if (!el) {
    el = document.createElement('div');
    el.id = 'wavePreview';
    el.className = 'wave-preview';
    $('call').appendChild(el);
  }
  const next = g.wave + 1;
  const show = !g.active && !g.over && next <= g.map.waves;
  if (el.hidden === show) el.hidden = !show;
  const key = show ? `${g.map.id}:${next}:${L().traits.nextWave(0)}` : '';
  if (!show || key === previewKey) return;
  previewKey = key;
  renderWavePreview(el, g.map, next);
}
// ---------- end next-wave preview ----------

/** Keeps world-anchored controls (wave horn, card) pinned to what they belong to. */
function placeAnchors(g: Game) {
  const w = cv.clientWidth, h = cv.clientHeight;
  const entry = posAt(g.path, T * 0.9);
  const e = view.screenOf(entry.x, entry.y, 0.6);
  const call = $('call');
  call.style.left = `${Math.min(w - 260, Math.max(90, e.sx))}px`;
  call.style.top = `${Math.min(h - 220, Math.max(70, e.sy))}px`;

  const card = $('card');
  const anchor = g.selected ?? (g.heroSelected ? g.hero : null);
  if (anchor && !card.hidden) {
    const p = view.screenOf(anchor.x, anchor.y, 0.8);
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left = p.sx + 46;
    if (left + cw > w - 12) left = p.sx - 46 - cw;
    // Short screens (a phone held sideways) let the card use the full height.
    const short = h < 500;
    const top = Math.max(8, Math.min(h - ch - (short ? 8 : 120), Math.max(short ? 8 : 76, p.sy - ch / 2)));
    card.style.transform = `translate(${Math.round(Math.max(12, left))}px, ${Math.round(top)}px)`;
  }
}

// ---------- build belt ----------

/** Rebuilds the belt; call again when unlock rules change (the lab's switches). */
export function renderBelt() {
  const g = game!, s = L(), portraits = towerPortraits();
  const belt = $('belt');
  belt.innerHTML = '';

  const hb = document.createElement('button');
  hb.className = 'medal hero';
  hb.dataset.type = 'hero';
  hb.setAttribute('aria-label', s.hero.name);
  hb.innerHTML = `<span class="face"><img src="${heroPortrait(g.loadout, 128)}" alt=""></span>
    <span class="key">H</span><span class="price">${s.hero.medal}</span>`;
  hb.onclick = () => selectHeroMedal();
  // Tips follow a mouse only; on touch a tap picks the medallion and nothing lingers on screen.
  hb.onpointerenter = (e) => { if (e.pointerType === 'mouse') showHeroTip(hb); };
  hb.onpointerleave = () => { $('tip').hidden = true; };
  belt.appendChild(hb);

  TOWER_ORDER.forEach((type, i) => {
    const d = TOWERS[type], locked = !canUseTower(g, type);
    const b = document.createElement('button');
    b.className = 'medal' + (locked ? ' locked' : '') + (g.build === type ? ' sel' : '');
    b.dataset.type = type;
    b.setAttribute('aria-label', s.towers[type].name);
    b.innerHTML = `<span class="face"><img src="${portraits[type]}" alt=""></span>
      <span class="key">${i + 1}</span>
      <span class="price">${locked ? ICONS.lock + ` ${d.unlock}` : ICONS.coin + ` ${d.cost}`}</span>`;
    b.onclick = () => selectBuild(type);
    b.onpointerenter = (e) => { if (e.pointerType === 'mouse') showTip(type, b); };
    b.onpointerleave = () => { $('tip').hidden = true; };
    belt.appendChild(b);
  });
}

function placeTip(anchor: HTMLElement) {
  const tip = $('tip');
  tip.hidden = false;
  const r = anchor.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(window.innerWidth - tip.offsetWidth - 12, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
}

function showTip(type: TowerType, anchor: HTMLElement) {
  const s = L(), text = s.towers[type], d = TOWERS[type];
  $('tip').innerHTML = `<h3>${text.name}</h3><p>${text.desc}</p>
    <p class="fine">${canUseTower(game!, type) ? s.menu.branches(text.branches[0].name, text.branches[1].name) : s.menu.unlockAtLevel(d.unlock!)}</p>
    ${towerAttrIcons(type) /* shadow traits: tower attributes */}`;
  placeTip(anchor);
}

function showHeroTip(anchor: HTMLElement) {
  const s = L(), w = s.hero.weapons[game!.loadout.weapon];
  $('tip').innerHTML = `<h3>${s.hero.name}</h3><p>${w.attack}</p><p class="fine"><b>${w.ability}:</b> ${w.abilityDesc}</p>`;
  placeTip(anchor);
}

function selectBuild(type: TowerType) {
  const g = game;
  if (!g || !canUseTower(g, type)) return;
  g.build = g.build === type ? null : type;
  g.selected = null;
  g.heroSelected = false;
  pendingPlace = null;
  hideQuick();
  renderCard();
  const name = L().towers[type].name;
  if (g.build) toast(lastPointer === 'touch' ? L().hud.placeHintTouch(name) : L().hud.placeHint(name), 4000);
  else hideToast();
}

/** The Warden's medallion places the Warden the first time and selects them after that. */
function selectHeroMedal() {
  const g = game;
  if (!g) return;
  if (g.hero) { selectHero(); return; }
  g.build = g.build === 'hero' ? null : 'hero';
  g.selected = null;
  g.heroSelected = false;
  pendingPlace = null;
  hideQuick();
  renderCard();
  if (g.build) toast(L().hero.placeHint, 4000); else hideToast();
}

// ---------- tower and Warden card ----------

function renderCard() {
  const g = game!, card = $('card');
  if (g.heroSelected && g.hero) { renderHeroCard(); return; }
  const t = g.selected;
  if (!t) { card.hidden = true; return; }
  const s = L(), d = TOWERS[t.type], st = stats(t), text = s.towers[t.type];
  const title = t.branch !== null ? text.branches[t.branch].name : text.name;
  let h = `<button class="x" id="cClose" aria-label="${s.hud.close}">${ICONS.close}</button>
    <header><img src="${towerPortraits()[t.type]}" alt=""><div>
      <h3>${title}</h3>
      <p class="fine">${s.info.level(t.level)}${t.level >= NAMED_LEVEL ? ` · ${nickname(t)}` : ''}</p>
      <div class="lvl-pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<b class="${i < t.level ? 'f' : ''}"></b>`).join('')}</div>
      ${towerAttrIcons(t.type, t.branch) /* shadow traits: tower attributes */}
    </div></header>
    <dl id="cStats">${statRows(st, nextStats(t), !!t.boost)}</dl>
    <p class="fine" id="cRecord"></p>`;
  const cost = upgradeCost(t);
  if (needsBranch(t)) {
    h += `<p class="ask">${s.info.chooseBranch}</p><div class="branches">`;
    text.branches.forEach((br, i) => {
      h += `<button class="branch" data-br="${i}" style="--accent:${d.color}"><b>${br.name}</b><span>${br.desc}</span><em>${ICONS.coin} ${cost}</em></button>`;
    });
    h += `</div><div class="btnrow"><button class="ghost" id="cSell">${s.info.sell(sellValue(t))}</button></div>`;
  } else {
    if (t.branch !== null) h += `<p class="fine">${text.branches[t.branch].desc}</p>`;
    h += `<div class="btnrow">${t.level >= MAX_LEVEL
      ? `<button class="go" disabled>${s.info.maxLevel}</button>`
      : `<button class="go" id="cUpgrade">${s.info.upgradeTo(t.level + 1)} <em>${ICONS.coin} ${cost}</em></button>`}
      <button class="ghost" id="cSell">${s.info.sell(sellValue(t))}</button></div>`;
  }
  card.innerHTML = h;
  card.hidden = false;
  card.style.setProperty('--accent', d.color);
  card.querySelectorAll<HTMLButtonElement>('[data-br]').forEach((b) => {
    const br = Number(b.dataset.br) as 0 | 1;
    b.onclick = () => chooseBranch(g, t, br);
    previewOn(b, t, br);
  });
  const up = document.getElementById('cUpgrade');
  if (up) { up.addEventListener('click', () => upgrade(g, t)); previewOn(up, t, undefined); }
  // After an upgrade the pointer may still rest on the new button; keep previewing what it offers.
  const hovered = card.querySelector<HTMLElement>('#cUpgrade:hover, [data-br]:hover');
  cardHot = !hovered || lastPointer === 'touch' ? null : hovered.dataset.br !== undefined ? (Number(hovered.dataset.br) as 0 | 1) : 'up';
  if (cardHot !== null) showCardPreview(t);
  $('cSell').onclick = () => { sell(g, t); renderCard(); };
  $('cClose').onclick = () => select(null);
  updateHud(g);
  placeAnchors(g);
}

function renderHeroCard() {
  const g = game!, h = g.hero!, s = L(), card = $('card');
  const st = heroStats(h), w = s.hero.weapons[h.loadout.weapon], charm = s.hero.charms[h.loadout.charm];
  const html = `<button class="x" id="cClose" aria-label="${s.hud.close}">${ICONS.close}</button>
    <header><img src="${heroPortrait(h.loadout, 128)}" alt=""><div>
      <h3>${s.hero.name}</h3>
      <p class="fine">${s.info.level(h.level)} · ${w.name}</p>
      <div class="lvl-pips">${Array.from({ length: HERO_MAX_LEVEL }, (_, i) => `<b class="${i < h.level ? 'f' : ''}"></b>`).join('')}</div>
    </div></header>
    <dl>
      <dt>${s.info.damage}</dt><dd>${st.dmg.toFixed(1)}</dd>
      <dt>${s.info.range}</dt><dd>${s.info.tiles(st.range.toFixed(1))}</dd>
      <dt>${s.info.rate}</dt><dd>${s.info.perSecond((1 / st.rate).toFixed(2))}</dd>
    </dl>
    <p class="fine">${w.attack}</p>
    <div class="ability-box">
      <div><b>${w.ability}</b><p class="fine">${w.abilityDesc}</p></div>
      <button class="go" id="cCast">${s.hero.cast} <small id="cCastTime"></small></button>
    </div>
    ${h.loadout.charm !== 'none' ? `<p class="fine"><b>${charm.name}:</b> ${charm.desc}</p>` : ''}
    <p class="fine" id="cRecord"></p>
    <div class="btnrow">${h.level >= HERO_MAX_LEVEL
      ? `<button class="go" disabled>${s.info.maxLevel}</button>`
      : `<button class="go" id="cUpgrade">${s.info.upgradeTo(h.level + 1)} <em>${ICONS.coin} ${heroUpgradeCost(h.level)}</em></button>`}</div>`;
  card.innerHTML = html;
  card.hidden = false;
  card.style.setProperty('--accent', '#f0bf55');
  document.getElementById('cUpgrade')?.addEventListener('click', () => { upgradeHero(g); renderHeroCard(); });
  $('cCast').onclick = () => cast();
  $('cClose').onclick = () => select(null);
  updateHud(g);
  placeAnchors(g);
}

function select(t: Tower | null) {
  const g = game;
  if (!g) return;
  g.selected = t;
  g.heroSelected = false;
  if (t) { g.build = null; pendingPlace = null; }
  // The full card replaces the quick buttons.
  hideQuick();
  renderCard();
}

function selectHero() {
  const g = game;
  if (!g || !g.hero) return;
  g.selected = null;
  g.build = null;
  g.heroSelected = true;
  pendingPlace = null;
  hideQuick();
  hideToast();
  renderCard();
}

function cast() {
  const g = game;
  if (g && castAbility(g) && g.heroSelected) renderHeroCard();
}

// ---------- toasts, menu and end of run ----------

function toast(text: string, ms: number) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(hideToast, ms);
}
function hideToast() { $('toast').hidden = true; }

function setMenu(open: boolean) {
  const g = game;
  if (!g) return;
  $('menuPop').hidden = !open;
  if (open) { g.paused = true; resetControls(); }
  quitArmed = false;
  $('bQuit').textContent = L().hud.giveUp;
}

function showEnd(win: boolean, gaveUp: boolean) {
  const g = game!, r = finishRun(g, win);
  $('card').hidden = true;
  $('menuPop').hidden = true;
  stopHints();
  hideToast();
  renderEnd($('ovbox'), g, r, gaveUp, (id) => startRun(id));
  $('ov').hidden = false;
}

/** True while the player is in a run: not the demo, the lab's sandbox or a finished run. */
export const runActive = () => mode === 'play' && !!game && !game.over && !game.dev;
/** Opens the pause menu, e.g. when the browser's back button is pressed during a run. */
export const openPauseMenu = () => { if (runActive()) setMenu(true); };

// ---------- input ----------

const pointFromEvent = (ev: PointerEvent) => view.pickPoint(ev.clientX, ev.clientY);
const heroAt = (g: Game, x: number, y: number) => !!g.hero && Math.hypot(g.hero.x - x, g.hero.y - y) < TOWER_SPACING / 2;

cv.addEventListener('pointermove', (ev) => {
  const g = game;
  if (!g || mode !== 'play') return;
  if (ev.pointerType === 'touch') { touchMove(g, ev); return; }
  g.hover = pointFromEvent(ev);
  mouseHover(g);
});
cv.addEventListener('pointerleave', (ev) => {
  // A finger lifting also "leaves"; the touch ghost has to stay where it was put.
  if (!game || ev.pointerType === 'touch') return;
  game.hover = null;
  mouseHover(game);
});
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerup', (ev) => { if (game && mode === 'play' && ev.pointerType === 'touch') touchUp(game, ev); });
cv.addEventListener('pointercancel', () => { cancelPress(); });
cv.addEventListener('pointerdown', (ev) => {
  initAudio();
  const g = game;
  if (!g || g.over || mode !== 'play') return;
  if (ev.pointerType === 'touch') { touchDown(g, ev); return; }
  if (ev.button === 2) { g.build = null; hideToast(); select(null); return; }
  const p = pointFromEvent(ev);
  g.hover = p;
  if (!p) return;
  const t = towerAt(g, p.x, p.y);
  if (t) { select(t); hideToast(); return; }
  if (heroAt(g, p.x, p.y)) { selectHero(); return; }
  if (g.build === 'hero') { if (placeHero(g, p.x, p.y)) { g.build = null; hideToast(); selectHero(); } return; }
  if (g.build) {
    if (placeTower(g, g.build, p.x, p.y, !!g.dev?.allTowers) && g.gold < TOWERS[g.build].cost) g.build = null;
    return;
  }
  if (g.selected || g.heroSelected) select(null);
});

document.addEventListener('keydown', (ev) => {
  const g = game;
  if (!g || mode !== 'play') return;
  if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
  if (ev.key >= '1' && ev.key <= '4') selectBuild(TOWER_ORDER[Number(ev.key) - 1]);
  else if (ev.key === 'h' || ev.key === 'H') selectHeroMedal();
  else if (ev.key === 'q' || ev.key === 'Q') cast();
  else if (ev.key === ' ') { ev.preventDefault(); initAudio(); startWave(g); }
  else if (ev.key === 'p' || ev.key === 'P') g.paused = !g.paused;
  else if (ev.key === 'Escape') { g.build = null; pendingPlace = null; hideToast(); select(null); setMenu(false); }
});

$('bWave').onclick = () => { initAudio(); if (game) startWave(game); };
$('ability').onclick = () => cast();
$('bAuto').onclick = () => {
  if (!game) return;
  game.auto = !game.auto;
  game.autoT = 1;
  $('bAuto').classList.toggle('on', game.auto);
};
$('bSpeed').onclick = () => {
  if (!game) return;
  game.speed = game.speed === 1 ? 2 : game.speed === 2 ? 3 : 1;
  $('bSpeed').textContent = game.speed + '×';
  $('bSpeed').classList.toggle('on', game.speed > 1);
};
$('bPause').onclick = () => { if (game) game.paused = !game.paused; };
$('bMute').onclick = () => {
  setMuted(!isMuted());
  setIcon('bMute', isMuted() ? ICONS.mute : ICONS.sound, isMuted() ? L().hud.soundOff : L().hud.soundOn);
};
$('bMenu').onclick = () => setMenu($('menuPop').hidden);
$('mResume').onclick = () => { setMenu(false); if (game) game.paused = false; };
$('mSettings').onclick = () => openSettings();
$('mHowTo').onclick = () => openHowTo();
$('bQuit').onclick = () => {
  const g = game;
  if (!g || g.over) return;
  if (g.dev) { $('menuPop').hidden = true; nav.lab(); return; }
  if (!quitArmed) { quitArmed = true; $('bQuit').textContent = L().hud.sure; return; }
  $('menuPop').hidden = true;
  g.hooks.ended = () => {};
  giveUp(g);
  showEnd(false, true);
};

// ---------- In-game controls: quick upgrade, upgrade preview, touch ----------
//
// Hovering a built tower (or tapping it on a touch screen) shows a small round "+" with the price
// that upgrades in place, or the two branch buttons when a branch is due. Hovering a button, or
// the first tap on a branch, shows a note with what the upgrade gives, and the range ring grows
// to the next level's range. A long hover (or a long press) or a click opens the full card.

const LONG_HOVER_MS = 700;
const LONG_PRESS_MS = 480;
/** How long the quick buttons wait after the pointer leaves, so it can travel up to them. */
const LEAVE_GRACE_MS = 320;

type Hot = 'up' | 0 | 1 | null;

let lastPointer = 'mouse';
let quickFor: Tower | null = null;
let quickKey = '';
/** The quick button being previewed (hovered, or tapped once on touch). */
let quickHot: Hot = null;
/** The card button being previewed. */
let cardHot: Hot = null;
let overQuick = false;
let hoverTower: Tower | null = null;
let leaveTimer = 0;
let longTimer = 0;
/** Touch building: where the ghost waits for the confirming tap. */
let pendingPlace: { x: number; y: number } | null = null;
let press: {
  id: number; cx: number; cy: number; moved: boolean; long: boolean; timer: number;
  t: Tower | null; hero: boolean; nearPending: boolean;
} | null = null;

document.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; }, true);

function resetControls() {
  hideQuick();
  cancelPress();
  pendingPlace = null;
  hoverTower = null;
  cardHot = null;
  clearTimeout(longTimer);
  view.setRangeFocus(null);
}

/** The tower's stats after its next upgrade, or null at max level or when the branch is not chosen yet. */
function nextStats(t: Tower, branch?: 0 | 1): Stats | null {
  if (t.level >= MAX_LEVEL) return null;
  if (needsBranch(t) && branch === undefined) return null;
  return stats({ ...t, level: t.level + 1, branch: needsBranch(t) ? branch! : t.branch });
}

const n1 = (v: number) => v.toFixed(1).replace(/\.0$/, '');
const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Stat rows for the card and the notes; with `next`, changed values read "9 → 12". */
function statRows(cur: Stats, next: Stats | null, boosted: boolean, onlyChanged = false) {
  const i = L().info, same = (v: string) => v;
  const rows: [string, (s: Stats) => string | null, (v: string) => string][] = [
    [i.damage, (s) => n1(s.dmg), (v) => v + (boosted ? ' ★' : '')],
    [i.targets, (s) => (s.targets > 1 ? String(s.targets) : null), same],
    [i.range, (s) => s.range.toFixed(1), i.tiles],
    [i.rate, (s) => (1 / s.rate).toFixed(2), i.perSecond],
    [i.slows, (s) => (s.slow ? pct(s.slow) : null), same],
    [i.freezes, (s) => (s.freeze ? pct(s.freeze) : null), same],
    [i.burns, (s) => (s.burn ? n1(s.burn) : null), same],
    [i.stuns, (s) => (s.stun ? pct(s.stun) : null), same],
    [i.shards, (s) => (s.shards ? String(s.shards) : null), same],
  ];
  return rows.map(([label, val, unit]) => {
    const a = val(cur), b = next ? val(next) : null;
    if (a === null && b === null) return '';
    const changed = b !== null && b !== a;
    if (onlyChanged && !changed) return '';
    const v = !changed ? unit(a!) : a === null ? unit(b!) : unit(`${a} → ${b}`);
    return `<dt>${label}</dt><dd${changed ? ' class="chg"' : ''}>${v}</dd>`;
  }).join('');
}

/** Card buttons preview their upgrade while hovered or focused: stat changes and a growing ring. */
function previewOn(el: HTMLElement, t: Tower, branch: 0 | 1 | undefined) {
  const on = () => { cardHot = branch ?? 'up'; showCardPreview(t); };
  const off = () => { cardHot = null; showCardPreview(t); };
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') on(); });
  el.addEventListener('pointerleave', off);
  el.addEventListener('focus', () => { if (lastPointer !== 'touch') on(); });
  el.addEventListener('blur', off);
}

function showCardPreview(t: Tower) {
  const dl = document.getElementById('cStats');
  if (!dl || game?.selected !== t) return;
  const next = cardHot === 'up' || cardHot === null ? nextStats(t) : nextStats(t, cardHot);
  dl.innerHTML = statRows(stats(t), next, !!t.boost);
}

/** Which range the ring should show this frame, and around which tower. */
function updateRing(g: Game) {
  const hotRange = (t: Tower, hot: Hot) => {
    if (hot === null) return stats(t).range;
    const n = hot === 'up' ? nextStats(t) : nextStats(t, hot);
    return n ? n.range : stats(t).range;
  };
  if (quickFor) view.setRangeFocus(quickFor, hotRange(quickFor, quickHot));
  else if (g.selected) view.setRangeFocus(g.selected, hotRange(g.selected, cardHot));
  else view.setRangeFocus(null);
}

// --- the quick buttons ---

function showQuick(t: Tower) {
  const g = game;
  if (!g || g.selected === t || t.level >= MAX_LEVEL) { if (quickFor === t) hideQuick(); return; }
  clearTimeout(leaveTimer);
  if (quickFor !== t) { quickHot = null; quickKey = ''; }
  quickFor = t;
}

function hideQuick() {
  clearTimeout(leaveTimer);
  quickFor = null;
  quickHot = null;
  quickKey = '';
  overQuick = false;
  const q = document.getElementById('quick'), n = document.getElementById('qnote');
  if (q) q.hidden = true;
  if (n) n.hidden = true;
}

function hideQuickSoon() {
  clearTimeout(leaveTimer);
  leaveTimer = window.setTimeout(() => { if (!overQuick && hoverTower !== quickFor) hideQuick(); }, LEAVE_GRACE_MS);
}

/** Per frame: drops stale quick buttons and re-renders them when level, price or affordability change. */
function updateQuick(g: Game) {
  const t = quickFor;
  if (t && (g.over || g.build || !g.towers.includes(t) || g.selected === t || t.level >= MAX_LEVEL)) hideQuick();
  if (quickFor) {
    const q = quickFor;
    const key = `${q.level}:${q.branch}:${upgradeCost(q)}:${canUpgrade(g, q)}:${quickHot}:${lastPointer}`;
    if (key !== quickKey) { quickKey = key; renderQuick(g, q); }
  }
  updateRing(g);
}

function renderQuick(g: Game, t: Tower) {
  const el = $('quick'), s = L(), cost = upgradeCost(t), poor = !canUpgrade(g, t);
  const price = `<span class="qprice${poor ? ' poor' : ''}">${ICONS.coin} ${cost}</span>`;
  if (needsBranch(t)) {
    const btn = (b: 0 | 1) => `<button class="qbr${quickHot === b ? ' hot' : ''}" data-qbr="${b}" aria-disabled="${poor}"
      aria-label="${s.info.branchFor(s.towers[t.type].branches[b].name, cost)}" style="--accent:${TOWERS[t.type].color}">
      <img src="${branchPortrait(t.type, b)}" alt=""></button>`;
    el.innerHTML = btn(0) + price + btn(1);
  } else {
    el.innerHTML = `<button class="qplus${quickHot === 'up' ? ' hot' : ''}" data-qup aria-disabled="${poor}"
      aria-label="${s.info.upgradeFor(t.level + 1, cost)}"><b>+</b></button>${price}`;
  }
  el.classList.toggle('poor', poor);
  el.hidden = false;
  el.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    const hot: Hot = b.dataset.qbr !== undefined ? (Number(b.dataset.qbr) as 0 | 1) : 'up';
    b.onpointerenter = (e) => { if (e.pointerType === 'mouse') setQuickHot(hot); };
    b.onpointerleave = (e) => { if (e.pointerType === 'mouse') setQuickHot(null); };
    b.onfocus = () => { if (lastPointer !== 'touch') setQuickHot(hot); };
    b.onclick = () => quickPress(hot);
  });
  renderNote(g, t);
}

function setQuickHot(hot: Hot) {
  if (quickHot === hot) return;
  quickHot = hot;
  quickKey = '';
}

/** A press on a quick button. On touch, a branch needs a first tap to read its note, then a second to choose. */
function quickPress(hot: Hot) {
  const g = game, t = quickFor;
  if (!g || !t || hot === null) return;
  if (lastPointer === 'touch' && hot !== 'up' && quickHot !== hot) { setQuickHot(hot); return; }
  if (!canUpgrade(g, t)) return;
  initAudio();
  if (hot === 'up') upgrade(g, t); else chooseBranch(g, t, hot);
  // Stay on the tower for the next upgrade; the note follows the new level.
  if (hot !== 'up' || lastPointer === 'touch') quickHot = null;
  quickKey = '';
}

/** The note above the quick buttons: what the previewed upgrade gives. */
function renderNote(g: Game, t: Tower) {
  const note = $('qnote'), s = L();
  if (quickHot === null) { note.hidden = true; return; }
  const next = quickHot === 'up' ? nextStats(t) : nextStats(t, quickHot);
  if (!next) { note.hidden = true; return; }
  const rows = statRows(stats(t), next, !!t.boost, true);
  if (quickHot === 'up') {
    note.innerHTML = `<h3>${s.info.level(t.level + 1)}</h3><dl>${rows}</dl>`;
  } else {
    const br = s.towers[t.type].branches[quickHot];
    note.innerHTML = `<header><img src="${branchPortrait(t.type, quickHot)}" alt=""><div><h3>${br.name}</h3>
      <p class="fine">${br.desc}</p></div></header><dl>${rows}</dl>
      ${lastPointer === 'touch' && canUpgrade(g, t) ? `<p class="ask">${s.info.tapToChoose}</p>` : ''}`;
  }
  note.style.setProperty('--accent', TOWERS[t.type].color);
  note.hidden = false;
}

/** Pins the quick buttons just above their tower, and the note above them (or below near the top). */
function placeQuick(g: Game) {
  const t = quickFor, el = $('quick');
  if (!t || el.hidden || !g.towers.includes(t)) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  const p = view.screenOf(t.x, t.y, 1.9);
  const qw = el.offsetWidth, qh = el.offsetHeight;
  const left = Math.max(8, Math.min(w - qw - 8, p.sx - qw / 2));
  const top = Math.max(8, Math.min(h - qh - 8, p.sy - qh - 4));
  el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  const note = $('qnote');
  if (note.hidden) return;
  const nw = note.offsetWidth, nh = note.offsetHeight;
  const nl = Math.max(8, Math.min(w - nw - 8, p.sx - nw / 2));
  const above = top - nh - 8 >= 8;
  const nt = above ? top - nh - 8 : Math.min(h - nh - 8, top + qh + 8);
  note.style.transform = `translate(${Math.round(nl)}px, ${Math.round(nt)}px)`;
}

{
  const q = $('quick');
  q.addEventListener('pointerenter', () => { overQuick = true; clearTimeout(leaveTimer); clearTimeout(longTimer); });
  q.addEventListener('pointerleave', (e) => {
    overQuick = false;
    if (e.pointerType === 'mouse') { setQuickHot(null); hideQuickSoon(); }
  });
}

// --- mouse: hover shows the quick buttons, a long hover opens the card ---

function mouseHover(g: Game) {
  const p = g.hover;
  const t = !g.build && p ? towerAt(g, p.x, p.y) ?? null : null;
  if (t === hoverTower) return;
  hoverTower = t;
  clearTimeout(longTimer);
  if (!t) { if (quickFor) hideQuickSoon(); return; }
  if (g.selected !== t) showQuick(t);
  longTimer = window.setTimeout(() => {
    if (game === g && hoverTower === t && !overQuick && g.towers.includes(t) && g.selected !== t) select(t);
  }, LONG_HOVER_MS);
}

// --- touch: tap shows the quick buttons, a long press opens the card, building takes two taps ---

function cancelPress() {
  if (press) clearTimeout(press.timer);
  press = null;
}

function touchDown(g: Game, ev: PointerEvent) {
  cancelPress();
  const p = pointFromEvent(ev);
  if (!p) return;
  const t = towerAt(g, p.x, p.y) ?? null;
  const hero = !t && heroAt(g, p.x, p.y);
  const nearPending = !!pendingPlace && Math.hypot(pendingPlace.x - p.x, pendingPlace.y - p.y) < 0.55 * T;
  press = { id: ev.pointerId, cx: ev.clientX, cy: ev.clientY, moved: false, long: false, timer: 0, t, hero, nearPending };
  if (g.build && !t && !hero) {
    // The ghost jumps to the finger and can be dragged; lifting leaves it there to check.
    if (!nearPending) pendingPlace = p;
    g.hover = pendingPlace;
    return;
  }
  if (t || hero) {
    const pr = press;
    pr.timer = window.setTimeout(() => {
      if (press !== pr || pr.moved) return;
      pr.long = true;
      if (pr.t && g.towers.includes(pr.t)) select(pr.t); else if (pr.hero) selectHero();
    }, LONG_PRESS_MS);
  }
}

function touchMove(g: Game, ev: PointerEvent) {
  if (!press || press.id !== ev.pointerId) return;
  if (!press.moved && Math.hypot(ev.clientX - press.cx, ev.clientY - press.cy) > 12) {
    press.moved = true;
    clearTimeout(press.timer);
  }
  if (g.build && press.moved) {
    const p = pointFromEvent(ev);
    if (p) { pendingPlace = p; g.hover = p; }
  }
}

function touchUp(g: Game, ev: PointerEvent) {
  const pr = press;
  if (!pr || pr.id !== ev.pointerId) return;
  // The long-press timer has already acted if it fired; drop the press without clearing `long`.
  clearTimeout(pr.timer);
  press = null;
  if (pr.long || g.over) return;
  if (g.build && !pr.t && !pr.hero) {
    if (pr.nearPending && !pr.moved && pendingPlace) {
      const { x, y } = pendingPlace;
      if (g.build === 'hero') {
        if (placeHero(g, x, y)) { g.build = null; pendingPlace = null; g.hover = null; hideToast(); selectHero(); }
      } else if (placeTower(g, g.build, x, y, !!g.dev?.allTowers)) {
        pendingPlace = null;
        g.hover = null;
        hideToast();
        if (g.gold < TOWERS[g.build].cost) g.build = null;
      }
      return;
    }
    toast(L().hud.confirmPlace, 3000);
    return;
  }
  if (pr.moved) return;
  if (pr.t) {
    // Tapping a tower: show its quick buttons, or put them away on a second tap.
    if (g.build) { g.build = null; pendingPlace = null; g.hover = null; hideToast(); }
    if (g.selected && g.selected !== pr.t) select(null);
    if (quickFor === pr.t) hideQuick(); else if (g.selected !== pr.t) showQuick(pr.t);
    return;
  }
  if (pr.hero) { selectHero(); return; }
  hideQuick();
  if (g.selected || g.heroSelected) select(null);
}

// --- phones held upright: a short note, and the run waits ---

{
  const upright = window.matchMedia('(orientation: portrait) and (max-width: 600px)');
  let pausedForTurn = false;
  const check = () => {
    const g = game;
    if (!g || mode !== 'play' || g.over) return;
    if (upright.matches && !g.paused) { g.paused = true; pausedForTurn = true; }
    else if (!upright.matches && pausedForTurn) { pausedForTurn = false; if ($('menuPop').hidden) g.paused = false; }
  };
  upright.addEventListener('change', check);
  window.setInterval(check, 1000);
}
