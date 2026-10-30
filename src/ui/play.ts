// The in-game screen: a full-window board with the controls living on it as parts of the world,
// a resource plaque, a build belt of tower medallions, a wave horn at the road's entrance, and
// a card that opens beside whichever tower is selected.
import { MAX_LEVEL, T } from '../config';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { posAt } from '../game/path';
import { createGame, giveUp, startWave, update } from '../game/run';
import {
  canUpgrade, chooseBranch, needsBranch, nickname, placeTower, sell, sellValue, stats, towerAt, upgrade, upgradeCost, NAMED_LEVEL,
} from '../game/towers';
import { GameView, towerPortraits } from '../three/view';
import { L, fmt } from '../i18n';
import { initAudio, isMuted, setMuted } from '../audio';
import { finishRun } from '../meta';
import { towerUnlocked } from '../save';
import { $, clearTextCache, setText } from './dom';
import { ICONS } from './icons';
import { nav } from './nav';
import type { Game, MapId, Tower, TowerType } from '../types';

let game: Game | null = null;
let quitArmed = false;
let toastTimer = 0;
const cv = $<HTMLCanvasElement>('cv');
const view = new GameView(cv, $<HTMLCanvasElement>('cv2d'));
let portraits: Record<TowerType, string> | null = null;

export const currentGame = () => game;
export const currentView = () => view;
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__view = view;

export function startRun(mapId: MapId) {
  game = createGame(mapId, {
    towerChanged: (t) => { if (game?.selected === t) renderCard(); },
    ended: (win) => showEnd(win, false),
  });
  portraits ??= towerPortraits();
  quitArmed = false;
  clearTextCache();
  $('menu').hidden = true;
  $('game').hidden = false;
  document.body.classList.add('playing');
  $('ov').hidden = true;
  $('menuPop').hidden = true;
  view.setGame(game);
  applyStaticText();
  renderBelt();
  renderCard();
  toast(L().info.idleHint, 7000);
}

export function stopRun() {
  game = null;
  view.setGame(null);
  document.body.classList.remove('playing');
}

/** Called once per animation frame from main.ts. */
export function frame(dt: number) {
  const g = game;
  if (!g) return;
  if (!g.paused && !g.over) for (let i = 0; i < g.speed; i++) update(g, dt);
  view.render(g);
  updateHud(g);
  placeAnchors(g);
}

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
  setText('hLives', String(Math.max(0, g.lives)));
  setText('hGold', fmt(g.gold));
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
    const type = b.dataset.type as TowerType;
    const locked = !towerUnlocked(type), poor = g.gold < TOWERS[type].cost;
    b.classList.toggle('poor', !locked && poor);
    b.classList.toggle('sel', g.build === type);
  }

  const t = g.selected;
  if (t) {
    const dis = !canUpgrade(g, t);
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#cUpgrade, [data-br]'))) {
      if (b.disabled !== dis) b.disabled = dis;
    }
    const rec = document.getElementById('cRecord');
    if (rec) rec.textContent = L().info.record(t.kills, fmt(t.dealt));
  }
}

/** Keeps world-anchored controls (wave horn, tower card) pinned to what they belong to. */
function placeAnchors(g: Game) {
  const w = cv.clientWidth, h = cv.clientHeight;
  const entry = posAt(g.path, T * 0.9);
  const e = view.screenOf(entry.x, entry.y, 0.6);
  const call = $('call');
  call.style.left = `${Math.min(w - 260, Math.max(90, e.sx))}px`;
  call.style.top = `${Math.min(h - 220, Math.max(70, e.sy))}px`;

  const card = $('card');
  if (g.selected && !card.hidden) {
    const p = view.screenOf(g.selected.x, g.selected.y, 0.8);
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left = p.sx + 46;
    if (left + cw > w - 12) left = p.sx - 46 - cw;
    const top = Math.min(h - ch - 120, Math.max(76, p.sy - ch / 2));
    card.style.transform = `translate(${Math.round(Math.max(12, left))}px, ${Math.round(top)}px)`;
  }
}

// ---------- build belt ----------

function renderBelt() {
  const g = game!, s = L();
  const belt = $('belt');
  belt.innerHTML = '';
  TOWER_ORDER.forEach((type, i) => {
    const d = TOWERS[type], locked = !towerUnlocked(type);
    const b = document.createElement('button');
    b.className = 'medal' + (locked ? ' locked' : '') + (g.build === type ? ' sel' : '');
    b.dataset.type = type;
    b.setAttribute('aria-label', s.towers[type].name);
    b.innerHTML = `<span class="face"><img src="${portraits![type]}" alt=""></span>
      <span class="key">${i + 1}</span>
      <span class="price">${locked ? ICONS.lock + ` ${d.unlock}` : ICONS.coin + ` ${d.cost}`}</span>`;
    b.onclick = () => selectBuild(type);
    b.onmouseenter = () => showTip(type, b);
    b.onmouseleave = () => { $('tip').hidden = true; };
    belt.appendChild(b);
  });
}

function showTip(type: TowerType, anchor: HTMLElement) {
  const s = L(), text = s.towers[type], d = TOWERS[type], tip = $('tip');
  tip.innerHTML = `<h3>${text.name}</h3><p>${text.desc}</p>
    <p class="fine">${towerUnlocked(type) ? s.menu.branches(text.branches[0].name, text.branches[1].name) : s.menu.unlockAtLevel(d.unlock!)}</p>`;
  tip.hidden = false;
  const r = anchor.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(window.innerWidth - tip.offsetWidth - 12, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
}

function selectBuild(type: TowerType) {
  const g = game;
  if (!g || !towerUnlocked(type)) return;
  g.build = g.build === type ? null : type;
  g.selected = null;
  renderCard();
  if (g.build) toast(L().hud.placeHint(L().towers[type].name), 4000);
  else hideToast();
}

// ---------- tower card ----------

function renderCard() {
  const g = game!, card = $('card');
  const t = g.selected;
  if (!t) { card.hidden = true; return; }
  const s = L(), d = TOWERS[t.type], st = stats(t), text = s.towers[t.type];
  const title = t.branch !== null ? text.branches[t.branch].name : text.name;
  let h = `<button class="x" id="cClose" aria-label="${s.hud.close}">${ICONS.close}</button>
    <header><img src="${portraits![t.type]}" alt=""><div>
      <h3>${title}</h3>
      <p class="fine">${s.info.level(t.level)}${t.level >= NAMED_LEVEL ? ` · ${nickname(t)}` : ''}</p>
      <div class="lvl-pips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<b class="${i < t.level ? 'f' : ''}"></b>`).join('')}</div>
    </div></header>
    <dl>
      <dt>${s.info.damage}</dt><dd>${st.dmg.toFixed(1)}${st.targets > 1 ? ' × 2' : ''}</dd>
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

function select(t: Tower | null) {
  const g = game;
  if (!g) return;
  g.selected = t;
  if (t) g.build = null;
  renderCard();
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
  $('oMenu').onclick = () => { stopRun(); nav.menu(); };
}

// ---------- input ----------

const pointFromEvent = (ev: PointerEvent) => view.pickPoint(ev.clientX, ev.clientY);

cv.addEventListener('pointermove', (ev) => { if (game) game.hover = pointFromEvent(ev); });
cv.addEventListener('pointerleave', () => { if (game) game.hover = null; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (ev) => {
  initAudio();
  const g = game;
  if (!g || g.over) return;
  if (ev.button === 2) { g.build = null; hideToast(); select(null); return; }
  const p = pointFromEvent(ev);
  g.hover = p;
  if (!p) return;
  const t = towerAt(g, p.x, p.y);
  if (t) { select(t); hideToast(); return; }
  if (g.build) { if (placeTower(g, g.build, p.x, p.y) && g.gold < TOWERS[g.build].cost) g.build = null; return; }
  if (g.selected) select(null);
});

document.addEventListener('keydown', (ev) => {
  const g = game;
  if (!g || $('game').hidden) return;
  if (ev.key >= '1' && ev.key <= '4') selectBuild(TOWER_ORDER[Number(ev.key) - 1]);
  else if (ev.key === ' ') { ev.preventDefault(); initAudio(); startWave(g); }
  else if (ev.key === 'p' || ev.key === 'P') g.paused = !g.paused;
  else if (ev.key === 'Escape') { g.build = null; hideToast(); select(null); setMenu(false); }
});

$('bWave').onclick = () => { initAudio(); if (game) startWave(game); };
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
  if (!quitArmed) { quitArmed = true; $('bQuit').textContent = L().hud.sure; return; }
  $('menuPop').hidden = true;
  g.hooks.ended = () => {};
  giveUp(g);
  showEnd(false, true);
};
