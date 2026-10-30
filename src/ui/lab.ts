// Developer lab, reached from the menu footer or #lab. Two tabs:
// - Gallery: every tower, enemy and the Warden lined up on Ring Rampart, with buttons that
//   trigger each animation and state, and stat tables for the chosen level and wave strength.
// - Sandbox: an ordinary run with developer switches (infinite gold, god mode, all towers),
//   spawn buttons, time controls and stepping.
import { T } from '../config';
import { ENEMIES } from '../data/enemies';
import { CHARMS, CLOAKS, HATS, WEAPONS, type Loadout } from '../data/hero';
import { MAP_ORDER } from '../data/maps';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { heroStats, placeHero } from '../game/hero';
import { createGame, spawnEnemy, startWave, update } from '../game/run';
import { chooseBranch, needsBranch, placeTower, stats, upgrade } from '../game/towers';
import { hpMultiplier } from '../game/waves';
import { L } from '../i18n';
import { $ } from './dom';
import { nav } from './nav';
import { adopt, currentGame, currentView, renderBelt, setFrameHook, startRun } from './play';
import type { Branch, EnemyType, Game, MapId, Tower } from '../types';

type Tab = 'gallery' | 'sandbox';

const opts = {
  tab: 'gallery' as Tab,
  /** Folds the panel down to its tab row so the board and HUD underneath are free. */
  folded: false,
  level: 1,
  branch: 0 as 0 | 1,
  live: false,
  strength: 1,
  slow: false, burn: false, stun: false,
  map: 'mill' as MapId,
  loadout: { weapon: 'staff', charm: 'badge', hat: 'hood', cloak: 'moss' } as Loadout,
};

const ENEMY_ORDER = Object.keys(ENEMIES) as EnemyType[];
/** Gallery layout on Ring Rampart, whose first stretch of road is long and straight. */
const ENEMY_D = [2.4, 4.6, 6.8, 9, 11.2];
const TOWER_X = [1.2, 3.6, 6, 8.4];
const HERO_X = 10.8;
/** Between the first stretch of road (row 1) and the inner loop (row 4). */
const ROW_Y = 2.5;

export function showLab() {
  $('menu').hidden = true;
  $('lab').hidden = false;
  if (opts.tab === 'gallery') startGallery(); else startSandbox();
}

export function hideLab() {
  $('lab').hidden = true;
  setFrameHook(null);
  currentView().setFocus(null);
}

// ---------- gallery ----------

function startGallery() {
  const g = createGame('ring', { towerChanged: () => {}, ended: () => {} });
  g.dev = { god: true, freeGold: true, allTowers: true };
  g.gold = 1e9;
  g.wave = opts.strength;
  g.loadout = { ...opts.loadout };
  TOWER_ORDER.forEach((type, i) => {
    const t = placeTower(g, type, (TOWER_X[i] + 0.5) * T, (ROW_Y + 0.5) * T, true);
    if (t) levelTo(g, t, opts.level, opts.branch);
  });
  const h = placeHero(g, (HERO_X + 0.5) * T, (ROW_Y + 0.5) * T);
  if (h) h.level = Math.min(5, opts.level);
  spawnAll(g);
  g.fx = [];
  g.paused = !opts.live;
  adopt(g, 'gallery');
  // Centred right of the line-up so it sits in the space left of the lab panel.
  currentView().setFocus({ x: 10.4 * T, y: 2.4 * T, halfWidth: 10.6 });
  setFrameHook(galleryTick);
  render();
}

function levelTo(g: Game, t: Tower, level: number, branch: Branch) {
  for (let i = 0; i < 6 && t.level < level; i++) {
    if (needsBranch(t)) chooseBranch(g, t, branch ?? 0); else upgrade(g, t);
  }
}

function spawnAll(g: Game) {
  g.enemies = [];
  ENEMY_ORDER.forEach((type, i) => { spawnEnemy(g, type, ENEMY_D[i] * T).pinned = true; });
}

/** Keeps the dummies alive and their chosen statuses on, every frame. */
function galleryTick(g: Game) {
  for (const e of g.enemies) {
    if (opts.live) e.hp = e.maxHp;
    if (opts.slow) { e.slowUntil = g.t + 1; e.slowAmt = 0.45; }
    if (opts.burn) { e.burnUntil = g.t + 1; e.burnDps = 0.001; }
    if (opts.stun) e.stun = g.t + 1;
  }
}

/** Nudges a cooldown so the view plays the firing animation even while paused. */
const fire = (t: { cd: number }) => { t.cd += 0.5; };

// ---------- sandbox ----------

function startSandbox() {
  startRun(opts.map, true);
  const g = currentGame()!;
  g.wave = opts.strength;
  currentView().setFocus(null);
  setFrameHook(null);
  renderBelt();
  render();
}

// ---------- panel ----------

function render() {
  const s = L(), lab = s.lab, panel = $('lab');
  const g = currentGame();
  const tabs = `<div class="labtabs">
      <button class="chip ${opts.tab === 'gallery' ? 'on' : ''}" data-tab="gallery">${lab.gallery}</button>
      <button class="chip ${opts.tab === 'sandbox' ? 'on' : ''}" data-tab="sandbox">${lab.sandbox}</button>
      <button class="ghost" id="labBack">${lab.back}</button>
      <button class="orb small" id="labFold" aria-label="${opts.folded ? lab.unfold : lab.fold}" title="${opts.folded ? lab.unfold : lab.fold}">${opts.folded ? '‹' : '›'}</button>
    </div>`;
  panel.classList.toggle('folded', opts.folded);
  panel.innerHTML = tabs + (opts.tab === 'gallery' ? galleryHtml() : sandboxHtml());
  $('labFold').onclick = () => { opts.folded = !opts.folded; render(); };
  panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    b.onclick = () => { opts.tab = b.dataset.tab as Tab; showLab(); };
  });
  $('labBack').onclick = () => nav.menu();
  if (!g) return;
  if (opts.tab === 'gallery') wireGallery(g); else wireSandbox(g);
}

const row = (cells: (string | number)[], head = false) =>
  `<tr>${cells.map((c) => (head ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`;
const toggle = (id: string, label: string, on: boolean) => `<button class="chip ${on ? 'on' : ''}" id="${id}">${label}</button>`;

function galleryHtml() {
  const s = L(), lab = s.lab, c = lab.col, g = currentGame()!;
  const towerRows = g.towers.map((t) => {
    const st = stats(t), name = t.branch !== null ? s.towers[t.type].branches[t.branch].name : s.towers[t.type].name;
    return row([name, st.dmg.toFixed(1), st.range.toFixed(1), (1 / st.rate).toFixed(2), ((st.dmg / st.rate) * st.targets).toFixed(1)]);
  }).join('');
  const h = g.hero, hs = h ? heroStats(h) : null;
  const heroRow = h && hs ? row([s.hero.name, hs.dmg.toFixed(1), hs.range.toFixed(1), (1 / hs.rate).toFixed(2), (hs.dmg / hs.rate).toFixed(1)]) : '';
  const enemyRows = ENEMY_ORDER.map((type) => {
    const d = ENEMIES[type];
    return row([s.enemies[type], Math.round(d.hp * hpMultiplier(g.map, opts.strength)), d.speed.toFixed(2), Math.round(d.reward * (1 + 0.02 * opts.strength)), d.leak]);
  }).join('');
  const sel = (id: string, values: Record<string, unknown>, cur: string, names: Record<string, string>) =>
    `<select id="${id}">${Object.keys(values).map((k) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${names[k]}</option>`).join('')}</select>`;
  const names = (rec: Record<string, { name: string }>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v.name]));
  return `
    <section>
      <h3>${lab.towers}</h3>
      <div class="labrow"><span>${lab.level}</span>${[1, 2, 3, 4, 5, 6].map((n) => `<button class="chip ${opts.level === n ? 'on' : ''}" data-level="${n}">${n}</button>`).join('')}</div>
      <div class="labrow"><span>${lab.branch}</span>${[0, 1].map((b) => `<button class="chip ${opts.branch === b ? 'on' : ''}" data-branch="${b}">${b ? 'B' : 'A'}</button>`).join('')}</div>
      <div class="labrow">${TOWER_ORDER.map((t, i) => `<button class="go small" data-fire="${i}">${lab.fire}: ${s.towers[t].name}</button>`).join('')}</div>
      <table>${row([c.name, c.dmg, c.range, c.rate, c.dps], true)}${towerRows}${heroRow}</table>
    </section>
    <section>
      <h3>${lab.warden}</h3>
      <div class="labgrid">
        <label>${s.lodge.weapon}${sel('lWeapon', WEAPONS, opts.loadout.weapon, names(s.hero.weapons))}</label>
        <label>${s.lodge.charm}${sel('lCharm', CHARMS, opts.loadout.charm, names(s.hero.charms))}</label>
        <label>${s.lodge.hat}${sel('lHat', HATS, opts.loadout.hat, s.hero.hats)}</label>
        <label>${s.lodge.cloak}${sel('lCloak', CLOAKS, opts.loadout.cloak, s.hero.cloaks)}</label>
      </div>
      <div class="labrow"><button class="go small" id="hFire">${lab.fire}</button><button class="go small" id="hCast">${lab.cast}</button></div>
    </section>
    <section>
      <h3>${lab.enemies}</h3>
      <div class="labrow"><span>${lab.strength(opts.strength)}</span><input type="range" id="lStrength" min="1" max="40" value="${opts.strength}"></div>
      ${ENEMY_ORDER.map((type, i) => `<div class="labrow"><b class="ename">${s.enemies[type]}</b><button class="chip" data-hit="${i}">${lab.hit}</button><button class="chip" data-kill="${i}">${lab.kill}</button></div>`).join('')}
      <div class="labrow"><button class="go small" id="lRespawn">${lab.respawn}</button></div>
      <div class="labrow"><span>${lab.statuses}</span>${toggle('sSlow', lab.slow, opts.slow)}${toggle('sBurn', lab.burn, opts.burn)}${toggle('sStun', lab.stun, opts.stun)}</div>
      <table>${row([c.name, c.hp, c.speed, c.gold, c.leak], true)}${enemyRows}</table>
    </section>
    <section><div class="labrow">${toggle('lLive', lab.live, opts.live)}</div></section>`;
}

function wireGallery(g: Game) {
  const panel = $('lab');
  panel.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => { b.onclick = () => { opts.level = Number(b.dataset.level); startGallery(); }; });
  panel.querySelectorAll<HTMLButtonElement>('[data-branch]').forEach((b) => { b.onclick = () => { opts.branch = Number(b.dataset.branch) as 0 | 1; startGallery(); }; });
  panel.querySelectorAll<HTMLButtonElement>('[data-fire]').forEach((b) => { b.onclick = () => { const t = g.towers[Number(b.dataset.fire)]; if (t) fire(t); }; });
  panel.querySelectorAll<HTMLButtonElement>('[data-hit]').forEach((b) => {
    b.onclick = () => { const e = g.enemies.find((x) => x.type === ENEMY_ORDER[Number(b.dataset.hit)]); if (e) e.lastHit = g.t + Math.random() * 1e-3; };
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-kill]').forEach((b) => {
    b.onclick = () => {
      const e = g.enemies.find((x) => x.type === ENEMY_ORDER[Number(b.dataset.kill)]);
      if (!e) return;
      e.hp = 0;
      e.dead = true;
      g.enemies = g.enemies.filter((x) => x !== e);
    };
  });
  $('lRespawn').onclick = () => spawnAll(g);
  $('hFire').onclick = () => { if (g.hero) fire(g.hero); };
  $('hCast').onclick = () => { if (g.hero) { g.hero.castAt = g.t + Math.random() * 1e-3; g.hero.flash = 1; } };
  const loadoutSel = (id: string, key: keyof Loadout) => {
    $<HTMLSelectElement>(id).onchange = (ev) => {
      opts.loadout = { ...opts.loadout, [key]: (ev.target as HTMLSelectElement).value };
      startGallery();
    };
  };
  loadoutSel('lWeapon', 'weapon'); loadoutSel('lCharm', 'charm'); loadoutSel('lHat', 'hat'); loadoutSel('lCloak', 'cloak');
  $<HTMLInputElement>('lStrength').onchange = (ev) => { opts.strength = Number((ev.target as HTMLInputElement).value); startGallery(); };
  const flip = (id: string, key: 'slow' | 'burn' | 'stun' | 'live') => {
    $(id).onclick = () => {
      opts[key] = !opts[key];
      if (key === 'live') g.paused = !opts.live;
      render();
    };
  };
  flip('sSlow', 'slow'); flip('sBurn', 'burn'); flip('sStun', 'stun'); flip('lLive', 'live');
}

function sandboxHtml() {
  const s = L(), lab = s.lab, g = currentGame()!;
  return `
    <section>
      <div class="labrow"><span>${lab.map}</span>${MAP_ORDER.map((id) => `<button class="chip ${opts.map === id ? 'on' : ''}" data-map="${id}">${s.maps[id].name}</button>`).join('')}</div>
      <div class="labrow">${toggle('dGod', lab.god, !!g.dev?.god)}${toggle('dGold', lab.freeGold, !!g.dev?.freeGold)}</div>
    </section>
    <section>
      <h3>${lab.spawn}</h3>
      <div class="labrow"><span>${lab.strength(opts.strength)}</span><input type="range" id="lStrength" min="1" max="40" value="${opts.strength}"></div>
      ${ENEMY_ORDER.map((type) => `<div class="labrow"><b class="ename">${s.enemies[type]}</b><button class="chip" data-spawn="${type}" data-n="1">+1</button><button class="chip" data-spawn="${type}" data-n="5">+5</button></div>`).join('')}
      <div class="labrow"><button class="go small" id="dWave">${lab.nextWave}</button><button class="ghost" id="dClear">${lab.clear}</button></div>
    </section>
    <section>
      <h3>${lab.speed}</h3>
      <div class="labrow">${[0.25, 0.5, 1, 2, 4].map((v) => `<button class="chip ${g.speed === v ? 'on' : ''}" data-speed="${v}">${v}×</button>`).join('')}</div>
      <div class="labrow"><button class="go small" id="dPause">${g.paused ? lab.play : lab.pause}</button><button class="ghost" id="dStep">${lab.step}</button></div>
    </section>`;
}

function wireSandbox(g: Game) {
  const panel = $('lab');
  panel.querySelectorAll<HTMLButtonElement>('[data-map]').forEach((b) => { b.onclick = () => { opts.map = b.dataset.map as MapId; startSandbox(); }; });
  $('dGod').onclick = () => { g.dev!.god = !g.dev!.god; render(); };
  $('dGold').onclick = () => { g.dev!.freeGold = !g.dev!.freeGold; render(); };
  $<HTMLInputElement>('lStrength').onchange = (ev) => { opts.strength = Number((ev.target as HTMLInputElement).value); g.wave = opts.strength; render(); };
  panel.querySelectorAll<HTMLButtonElement>('[data-spawn]').forEach((b) => {
    b.onclick = () => {
      const type = b.dataset.spawn as EnemyType;
      for (let i = 0; i < Number(b.dataset.n); i++) spawnEnemy(g, type, -i * 0.6 * T);
    };
  });
  $('dWave').onclick = () => startWave(g);
  $('dClear').onclick = () => { g.enemies = []; g.queue = []; g.active = false; };
  panel.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => { b.onclick = () => { g.speed = Number(b.dataset.speed); render(); }; });
  $('dPause').onclick = () => { g.paused = !g.paused; render(); };
  $('dStep').onclick = () => { g.paused = true; update(g, 1 / 60); render(); };
}
