import { COLS, MAX_LEVEL, ROWS } from '../config';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { draw } from '../game/render';
import { createGame, giveUp, startWave, update } from '../game/run';
import {
  canUpgrade, chooseBranch, needsBranch, nickname, placeTower, sell, sellValue, stats, upgrade, upgradeCost, NAMED_LEVEL,
} from '../game/towers';
import { L, fmt } from '../i18n';
import { initAudio, isMuted, setMuted } from '../audio';
import { finishRun } from '../meta';
import { towerUnlocked } from '../save';
import { $, clearTextCache, setText, towerIcon } from './dom';
import { nav } from './nav';
import type { Game, MapId, TowerType } from '../types';

let game: Game | null = null;
let quitArmed = false;
const cv = $<HTMLCanvasElement>('cv');
const ctx = cv.getContext('2d')!;

export const currentGame = () => game;

export function startRun(mapId: MapId) {
  game = createGame(mapId, {
    towerChanged: (t) => { if (game?.selected === t) renderInfo(); },
    ended: (win) => showEnd(win, false),
  });
  quitArmed = false;
  clearTextCache();
  $('menu').hidden = true;
  $('game').hidden = false;
  $('ov').hidden = true;
  applyStaticText();
  renderPalette();
  renderInfo();
  window.scrollTo({ top: 0 });
}

export function stopRun() { game = null; }

/** Called once per animation frame from main.ts. */
export function frame(dt: number) {
  const g = game;
  if (!g) return;
  if (!g.paused && !g.over) for (let i = 0; i < g.speed; i++) update(g, dt);
  draw(ctx, g);
  updateHud(g);
}

function applyStaticText() {
  const s = L().hud;
  $('hLivesL').textContent = s.lives;
  $('hGoldL').textContent = s.gold;
  $('hWaveL').textContent = s.wave;
  $('hMapName').textContent = L().maps[game!.map.id].name;
  const auto = $('bAuto');
  auto.textContent = s.auto;
  auto.title = s.autoTitle;
  auto.classList.remove('on');
  $('bSpeed').textContent = '1×';
  $('bPause').textContent = s.pause;
  $('bMute').textContent = isMuted() ? s.soundOff : s.soundOn;
  $('bQuit').textContent = s.giveUp;
  $('keys').textContent = s.keys;
}

function updateHud(g: Game) {
  const s = L().hud;
  setText('hLives', String(Math.max(0, g.lives)));
  setText('hGold', fmt(g.gold));
  setText('hWave', g.map.survival ? String(g.wave) : `${g.wave} / ${g.map.waves}`);
  const bw = $<HTMLButtonElement>('bWave');
  const disabled = g.active || g.over;
  if (bw.disabled !== disabled) bw.disabled = disabled;
  setText('bWave', g.active ? s.waveRunning(g.queue.length + g.enemies.length) : s.startWave);

  for (const b of Array.from($('palette').children) as HTMLButtonElement[]) {
    const type = b.dataset.type as TowerType;
    const dis = !towerUnlocked(type) || g.gold < TOWERS[type].cost;
    if (b.disabled !== dis) b.disabled = dis;
  }

  const t = g.selected;
  if (t) {
    const dis = !canUpgrade(g, t);
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('#iUpgrade, [data-br]'))) {
      if (b.disabled !== dis) b.disabled = dis;
    }
    const rec = document.getElementById('iRecord');
    if (rec) rec.textContent = L().info.record(t.kills, fmt(t.dealt));
  }
}

function renderPalette() {
  const g = game!, s = L();
  const p = $('palette');
  p.innerHTML = '';
  TOWER_ORDER.forEach((type, i) => {
    const d = TOWERS[type];
    const b = document.createElement('button');
    b.className = 'tbtn' + (g.build === type ? ' sel' : '');
    b.dataset.type = type;
    b.appendChild(towerIcon(type, 34));
    const txt = document.createElement('div');
    txt.innerHTML = towerUnlocked(type)
      ? `<div><b>${s.towers[type].name}</b></div><div class="c">${s.menu.goldCost(d.cost)} <span class="k">· ${i + 1}</span></div>`
      : `<div><b>${s.towers[type].name}</b></div><div class="k">${s.menu.unlockAtLevel(d.unlock!)}</div>`;
    b.appendChild(txt);
    b.onclick = () => selectBuild(type);
    p.appendChild(b);
  });
}

function selectBuild(type: TowerType) {
  const g = game;
  if (!g || !towerUnlocked(type)) return;
  g.build = g.build === type ? null : type;
  g.selected = null;
  renderPalette();
  renderInfo();
}

function renderInfo() {
  const g = game!, s = L(), box = $('info');
  if (g.selected) {
    const t = g.selected, d = TOWERS[t.type], st = stats(t), text = s.towers[t.type];
    const title = t.branch !== null ? text.branches[t.branch].name : text.name;
    let h = `<div><h3 style="color:${d.color}">${title}</h3><div class="muted">${s.info.level(t.level)}${t.level >= NAMED_LEVEL ? ` · ${nickname(t)}` : ''}</div></div>`;
    h += `<div class="levelpips">${Array.from({ length: MAX_LEVEL }, (_, i) => `<b class="${i < t.level ? 'f' : ''}"></b>`).join('')}</div>`;
    h += `<dl class="stats">
      <dt>${s.info.damage}</dt><dd>${st.dmg.toFixed(1)}${st.targets > 1 ? ' × 2' : ''}</dd>
      <dt>${s.info.range}</dt><dd>${s.info.tiles(st.range.toFixed(1))}</dd>
      <dt>${s.info.rate}</dt><dd>${s.info.perSecond((1 / st.rate).toFixed(2))}</dd>`;
    if (st.slow) h += `<dt>${s.info.slows}</dt><dd>${Math.round(st.slow * 100)} %</dd>`;
    h += `</dl><div class="hint" id="iRecord"></div>`;
    const cost = s.menu.goldCost(upgradeCost(t));
    if (needsBranch(t)) {
      h += `<div class="branch"><b style="color:var(--lamp)">${s.info.chooseBranch}</b>`;
      text.branches.forEach((br, i) => {
        h += `<button class="btn" data-br="${i}"><b>${br.name} · ${cost}</b><span>${br.desc}</span></button>`;
      });
      h += `</div><div class="acts"><button class="btn" id="iSell">${s.info.sell(sellValue(t))}</button></div>`;
    } else {
      if (t.branch !== null) h += `<p class="hint">${text.branches[t.branch].desc}</p>`;
      const maxed = t.level >= MAX_LEVEL;
      h += `<div class="acts">${maxed
        ? `<button class="btn" disabled>${s.info.maxLevel}</button>`
        : `<button class="btn primary" id="iUpgrade">${s.info.upgrade(upgradeCost(t))}</button>`}<button class="btn" id="iSell">${s.info.sell(sellValue(t))}</button></div>`;
    }
    box.innerHTML = h;
    box.querySelectorAll<HTMLButtonElement>('[data-br]').forEach((b) => {
      b.onclick = () => chooseBranch(g, t, Number(b.dataset.br) as 0 | 1);
    });
    document.getElementById('iUpgrade')?.addEventListener('click', () => upgrade(g, t));
    $('iSell').onclick = () => { sell(g, t); renderInfo(); };
    updateHud(g);
  } else if (g.build) {
    const d = TOWERS[g.build], text = s.towers[g.build];
    box.innerHTML = `<h3 style="color:${d.color}">${text.name}</h3><p>${text.desc}</p>
      <p class="hint">${s.info.buildHint}</p>
      <p class="hint"><b>${text.branches[0].name}</b> ${s.info.or} <b>${text.branches[1].name}</b>.</p>`;
  } else {
    box.innerHTML = `<h3>${s.info.idleTitle}</h3><p class="hint">${s.info.idleHint}</p><p class="hint">${s.info.idleHint2}</p>`;
  }
}

function showEnd(win: boolean, gaveUp: boolean) {
  const g = game!, s = L(), r = finishRun(g, win), m = g.map;
  let h = `<div class="big">${win ? s.end.win : gaveUp ? s.end.gaveUp : s.end.lose}</div>`;
  h += `<p>${m.survival ? s.end.survived(r.cleared) : s.end.clearedOf(r.cleared, m.waves)}${r.newBest && r.cleared > 0 ? ' ' + s.end.record : ''}</p>`;
  h += `<p class="dust">${s.end.dust(r.dust)}</p>`;
  if (r.hero && r.hero.dealt > 0) {
    const who = r.hero.level >= NAMED_LEVEL ? `${nickname(r.hero)} (${s.towers[r.hero.type].name})` : s.towers[r.hero.type].name;
    h += `<p class="muted">${s.end.hero(who, r.hero.level, r.hero.kills)}</p>`;
  }
  if (r.levelAfter > r.levelBefore) h += `<p style="color:var(--lamp)"><b>${s.end.newLevel(r.levelAfter)}</b></p>`;
  for (const t of r.newTowers) h += `<p style="color:var(--moss)">${s.end.newTower(s.towers[t].name)}</p>`;
  for (const id of r.newMaps) h += `<p style="color:var(--moss)">${s.end.newMap(s.maps[id].name)}</p>`;
  h += `<div class="acts" style="width:100%"><button class="btn primary" id="oAgain">${s.end.again}</button><button class="btn" id="oMenu">${s.end.menu}</button></div>`;
  $('ovbox').innerHTML = h;
  $('ov').hidden = false;
  $('oAgain').onclick = () => startRun(m.id);
  $('oMenu').onclick = () => { stopRun(); nav.menu(); };
}

// ---------- input ----------
function tileFromEvent(ev: PointerEvent) {
  const r = cv.getBoundingClientRect();
  return { tx: Math.floor(((ev.clientX - r.left) / r.width) * COLS), ty: Math.floor(((ev.clientY - r.top) / r.height) * ROWS) };
}

cv.addEventListener('pointermove', (ev) => { if (game) game.hover = tileFromEvent(ev); });
cv.addEventListener('pointerleave', () => { if (game) game.hover = null; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (ev) => {
  initAudio();
  const g = game;
  if (!g || g.over) return;
  const { tx, ty } = tileFromEvent(ev);
  g.hover = { tx, ty };
  if (ev.button === 2) { g.build = null; renderPalette(); renderInfo(); return; }
  const t = g.towers.find((t) => t.tx === tx && t.ty === ty);
  if (t) { g.selected = t; g.build = null; renderPalette(); renderInfo(); return; }
  if (g.build) { placeTower(g, g.build, tx, ty); return; }
  if (g.selected) { g.selected = null; renderInfo(); }
});

document.addEventListener('keydown', (ev) => {
  const g = game;
  if (!g || $('game').hidden) return;
  if (ev.key >= '1' && ev.key <= '4') selectBuild(TOWER_ORDER[Number(ev.key) - 1]);
  else if (ev.key === ' ') { ev.preventDefault(); initAudio(); startWave(g); }
  else if (ev.key === 'Escape') { g.build = null; g.selected = null; renderPalette(); renderInfo(); }
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
};
$('bPause').onclick = () => {
  if (!game) return;
  game.paused = !game.paused;
  $('bPause').textContent = game.paused ? L().hud.resume : L().hud.pause;
};
$('bMute').onclick = () => {
  setMuted(!isMuted());
  $('bMute').textContent = isMuted() ? L().hud.soundOff : L().hud.soundOn;
};
$('bQuit').onclick = () => {
  const g = game;
  if (!g || g.over) return;
  if (!quitArmed) {
    quitArmed = true;
    $('bQuit').textContent = L().hud.sure;
    setTimeout(() => {
      if (game === g && !g.over) { quitArmed = false; $('bQuit').textContent = L().hud.giveUp; }
    }, 2500);
    return;
  }
  g.hooks.ended = () => {};
  giveUp(g);
  showEnd(false, true);
};
