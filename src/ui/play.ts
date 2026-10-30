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
import { GameView, heroPortrait, towerPortraits } from '../three/view';
import { L, fmt } from '../i18n';
import { initAudio, isMuted, setMuted, setQuiet } from '../audio';
import { finishRun } from '../meta';
import { towerUnlocked } from '../save';
import { $, clearTextCache, setText } from './dom';
import { ICONS } from './icons';
import { nav } from './nav';
import type { Game, MapId, Tower, TowerType } from '../types';

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
  view.setGame(g);
  applyStaticText();
  renderBelt();
  renderCard();
  toast(L().info.idleHint, 7000);
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
  view.render(g);
  if (mode !== 'play') return;
  updateHud(g);
  placeAnchors(g);
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
  $('bQuit').textContent = s.giveUp;
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
    const top = Math.min(h - ch - 120, Math.max(76, p.sy - ch / 2));
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
  hb.onmouseenter = () => showHeroTip(hb);
  hb.onmouseleave = () => { $('tip').hidden = true; };
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
    b.onmouseenter = () => showTip(type, b);
    b.onmouseleave = () => { $('tip').hidden = true; };
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
    <p class="fine">${canUseTower(game!, type) ? s.menu.branches(text.branches[0].name, text.branches[1].name) : s.menu.unlockAtLevel(d.unlock!)}</p>`;
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
  renderCard();
  if (g.build) toast(L().hud.placeHint(L().towers[type].name), 4000);
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
    </div></header>
    <dl>
      <dt>${s.info.damage}</dt><dd>${st.dmg.toFixed(1)}${st.targets > 1 ? ' × 2' : ''}${t.boost ? ' ★' : ''}</dd>
      <dt>${s.info.range}</dt><dd>${s.info.tiles(st.range.toFixed(1))}</dd>
      <dt>${s.info.rate}</dt><dd>${s.info.perSecond((1 / st.rate).toFixed(2))}</dd>
      ${st.slow ? `<dt>${s.info.slows}</dt><dd>${Math.round(st.slow * 100)} %</dd>` : ''}
    </dl>
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
    b.onclick = () => chooseBranch(g, t, Number(b.dataset.br) as 0 | 1);
  });
  document.getElementById('cUpgrade')?.addEventListener('click', () => upgrade(g, t));
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
  if (t) g.build = null;
  renderCard();
}

function selectHero() {
  const g = game;
  if (!g || !g.hero) return;
  g.selected = null;
  g.build = null;
  g.heroSelected = true;
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
  if (open) g.paused = true;
  quitArmed = false;
  $('bQuit').textContent = L().hud.giveUp;
}

function showEnd(win: boolean, gaveUp: boolean) {
  const g = game!, s = L(), r = finishRun(g, win), m = g.map;
  $('card').hidden = true;
  let h = `<div class="big">${win ? s.end.win : gaveUp ? s.end.gaveUp : s.end.lose}</div>`;
  h += `<p>${m.survival ? s.end.survived(r.cleared) : s.end.clearedOf(r.cleared, m.waves)}${r.newBest && r.cleared > 0 ? ' ' + s.end.record : ''}</p>`;
  h += `<p class="dust">${s.end.dust(r.dust)}</p>`;
  if (r.hero && r.hero.dealt > 0) {
    const who = r.hero.level >= NAMED_LEVEL ? `${nickname(r.hero)} (${s.towers[r.hero.type].name})` : s.towers[r.hero.type].name;
    h += `<p class="fine">${s.end.hero(who, r.hero.level, r.hero.kills)}</p>`;
  }
  if (r.levelAfter > r.levelBefore) h += `<p class="good"><b>${s.end.newLevel(r.levelAfter)}</b></p>`;
  for (const t of r.newTowers) h += `<p class="good">${s.end.newTower(s.towers[t].name)}</p>`;
  for (const id of r.newMaps) h += `<p class="good">${s.end.newMap(s.maps[id].name)}</p>`;
  h += `<div class="btnrow"><button class="go" id="oAgain">${s.end.again}</button><button class="ghost" id="oMenu">${s.end.menu}</button></div>`;
  $('ovbox').innerHTML = h;
  $('ov').hidden = false;
  $('oAgain').onclick = () => startRun(m.id);
  $('oMenu').onclick = () => nav.menu();
}

// ---------- input ----------

const pointFromEvent = (ev: PointerEvent) => view.pickPoint(ev.clientX, ev.clientY);
const heroAt = (g: Game, x: number, y: number) => !!g.hero && Math.hypot(g.hero.x - x, g.hero.y - y) < TOWER_SPACING / 2;

cv.addEventListener('pointermove', (ev) => { if (game && mode === 'play') game.hover = pointFromEvent(ev); });
cv.addEventListener('pointerleave', () => { if (game) game.hover = null; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (ev) => {
  initAudio();
  const g = game;
  if (!g || g.over || mode !== 'play') return;
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
  else if (ev.key === 'Escape') { g.build = null; hideToast(); select(null); setMenu(false); }
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
