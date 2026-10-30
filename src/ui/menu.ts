import { GAME_TITLE, H, W } from '../config';
import { MAPS, MAP_ORDER } from '../data/maps';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { UPGRADES, upgradeCost } from '../data/upgrades';
import { renderBackground } from '../game/background';
import { buildPath, heartOf } from '../game/path';
import { L, LOCALES, fmt, locale, setLocale } from '../i18n';
import { initAudio } from '../audio';
import { levelThreshold, mapOpen, persist, playerLevel, save, towerUnlocked } from '../save';
import { $, towerIcon } from './dom';
import { nav } from './nav';

const el = (tag: string, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export function showMenu() {
  $('game').hidden = true;
  $('menu').hidden = false;
  renderMenu();
  window.scrollTo({ top: 0 });
}

export function renderMenu() {
  const s = L();
  document.title = GAME_TITLE;
  $('mTitle').textContent = GAME_TITLE;
  $('mTag').textContent = s.tagline;

  const lang = $('mLang');
  lang.innerHTML = '';
  lang.setAttribute('aria-label', s.language);
  for (const l of LOCALES) {
    const b = el('button', 'btn' + (l.id === locale() ? ' on' : ''), l.label);
    b.onclick = () => { setLocale(l.id); renderMenu(); };
    lang.appendChild(b);
  }

  const level = playerLevel(), a = levelThreshold(level), b = levelThreshold(level + 1);
  $('mLevelLabel').textContent = s.menu.watchLevel;
  $('mDustLabel').textContent = s.menu.stardust;
  $('mLevel').textContent = String(level);
  $('mDust').textContent = fmt(save.dust);
  $('mBar').style.width = Math.min(100, ((save.total - a) / (b - a)) * 100) + '%';
  const next = TOWER_ORDER.find((t) => (TOWERS[t].unlock ?? 1) > level);
  $('mNext').textContent = s.menu.toLevel(save.total - a, b - a, level + 1)
    + (next ? ` · ${s.menu.unlocksAt(s.towers[next].name, TOWERS[next].unlock!)}` : '');

  $('mModesTitle').textContent = s.menu.chooseEvening;
  const modes = $('modes');
  modes.innerHTML = '';
  for (const id of MAP_ORDER) {
    const m = MAPS[id], open = mapOpen(id), text = s.maps[id];
    const card = el('div', 'card' + (open ? '' : ' locked'));
    const path = buildPath(m), bg = renderBackground(m, path);
    const mini = document.createElement('canvas');
    mini.width = W / 2; mini.height = H / 2;
    const g = mini.getContext('2d')!;
    g.drawImage(bg, 0, 0, W / 2, H / 2);
    const heart = heartOf(path);
    g.fillStyle = '#ffb547'; g.beginPath(); g.arc(heart.x / 2, heart.y / 2, 7, 0, 7); g.fill();
    card.appendChild(mini);
    const best = save.best[id];
    card.appendChild(el('div', 'card-body',
      `<div class="row"><h3>${text.name}</h3><span class="pill${m.survival ? ' gold' : ''}">${m.survival ? s.menu.survival : s.menu.waves(m.waves)}</span></div>
       <p class="muted">${text.blurb}</p>
       <p class="muted num">${save.won[id] ? s.menu.cleared + ' · ' : ''}${s.menu.best(best)}</p>`));
    const btn = el('button', 'btn primary', open ? s.menu.play : s.menu.locked) as HTMLButtonElement;
    btn.disabled = !open;
    btn.onclick = () => { initAudio(); nav.play(id); };
    card.appendChild(btn);
    modes.appendChild(card);
  }
  for (const soon of s.menu.soon) {
    modes.appendChild(el('div', 'card soon',
      `<div class="row"><h3>${soon.name}</h3><span class="pill">${s.menu.comingLater}</span></div><p class="muted">${soon.desc}</p>`));
  }

  $('mShopTitle').textContent = s.menu.workshop;
  $('mShopIntro').textContent = s.menu.workshopIntro;
  const shop = $('shop');
  shop.innerHTML = '';
  for (const u of UPGRADES) {
    const lv = save.up[u.id], maxed = lv >= u.max, cost = upgradeCost(lv), text = s.upgrades[u.id];
    const card = el('div', 'up',
      `<div class="row"><b>${text.name}</b><span class="muted num">${lv}/${u.max}</span></div>
       <p class="muted">${text.desc}</p>
       <div class="pips">${Array.from({ length: u.max }, (_, i) => `<b class="${i < lv ? 'f' : ''}"></b>`).join('')}</div>`);
    const btn = el('button', 'btn', maxed ? s.menu.maxed : s.menu.buyFor(cost)) as HTMLButtonElement;
    btn.disabled = maxed || save.dust < cost;
    btn.onclick = () => {
      if (save.dust < cost || maxed) return;
      save.dust -= cost;
      save.up[u.id]++;
      persist();
      renderMenu();
    };
    card.appendChild(btn);
    shop.appendChild(card);
  }

  $('mCodexTitle').textContent = s.menu.towers;
  $('mCodexIntro').textContent = s.menu.towersIntro;
  const codex = $('codex');
  codex.innerHTML = '';
  for (const type of TOWER_ORDER) {
    const d = TOWERS[type], ok = towerUnlocked(type), text = s.towers[type];
    const card = el('div', 'cx' + (ok ? '' : ' locked'));
    card.appendChild(towerIcon(type, 44));
    card.appendChild(el('div', '',
      `<b style="color:${d.color}">${text.name}</b> <span class="muted num">· ${s.menu.goldCost(d.cost)}</span>
       <p class="hint">${ok ? text.desc : s.menu.unlockAtLevel(d.unlock!)}</p>
       ${ok ? `<p class="hint">${s.menu.branches(text.branches[0].name, text.branches[1].name)}</p>` : ''}`));
    codex.appendChild(card);
  }
}
