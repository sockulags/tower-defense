// The title screen: parchment panels over the live demo board, in the same storybook style as the game.
import { GAME_TITLE } from '../config';
import { MAPS, MAP_ORDER } from '../data/maps';
import { TOWERS, TOWER_ORDER } from '../data/towers';
import { UPGRADES, upgradeCost } from '../data/upgrades';
import { L, LOCALES, fmt, locale, setLocale } from '../i18n';
import { initAudio } from '../audio';
import { levelThreshold, mapOpen, persist, playerLevel, save, towerUnlocked } from '../save';
import { heroPortrait, mapPortrait, towerPortraits } from '../three/view';
import { $ } from './dom';
import { ICONS } from './icons';
import { nav } from './nav';
import type { MapId } from '../types';

const el = (tag: string, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export function showMenu() {
  $('menu').hidden = false;
  $('menu').scrollTop = 0;
  renderMenu();
}

/** Map stills take a moment to render, so cards appear first and their pictures fill in one by one. */
function fillMapPictures(ids: MapId[]) {
  const id = ids.shift();
  if (!id) return;
  setTimeout(() => {
    const img = document.querySelector<HTMLImageElement>(`img[data-map="${id}"]`);
    if (img) { img.src = mapPortrait(MAPS[id]); img.classList.add('ready'); }
    fillMapPictures(ids);
  }, 30);
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
    const b = el('button', 'chip' + (l.id === locale() ? ' on' : ''), l.label);
    b.onclick = () => { setLocale(l.id); renderMenu(); };
    lang.appendChild(b);
  }

  const level = playerLevel(), a = levelThreshold(level), b = levelThreshold(level + 1);
  $('mLevelLabel').textContent = s.menu.watchLevel;
  $('mLevel').textContent = String(level);
  $('mDustIcon').innerHTML = ICONS.star;
  $('mDust').textContent = fmt(save.dust);
  $('mDustLabel').textContent = s.menu.stardust;
  $('mBar').style.width = Math.min(100, ((save.total - a) / (b - a)) * 100) + '%';
  const next = TOWER_ORDER.find((t) => (TOWERS[t].unlock ?? 1) > level);
  $('mNext').textContent = s.menu.toLevel(save.total - a, b - a, level + 1)
    + (next ? ` · ${s.menu.unlocksAt(s.towers[next].name, TOWERS[next].unlock!)}` : '');

  $('mLodgeLabel').textContent = s.lodge.open;
  $<HTMLImageElement>('mLodgeFace').src = heroPortrait(save.hero.equip, 96);
  $('mLodge').onclick = () => nav.lodge();
  $('mLab').textContent = s.lab.open;
  $('mLab').onclick = () => nav.lab();

  $('mModesTitle').textContent = s.menu.chooseEvening;
  const modes = $('modes');
  modes.innerHTML = '';
  for (const id of MAP_ORDER) {
    const m = MAPS[id], open = mapOpen(id), text = s.maps[id], best = save.best[id];
    const card = el('article', 'mcard panel' + (open ? '' : ' locked'));
    card.innerHTML = `
      <div class="shot"><img data-map="${id}" alt=""><span class="tag ${m.survival ? 'gold' : ''}">${m.survival ? s.menu.survival : s.menu.waves(m.waves)}</span>
        ${open ? '' : `<span class="lockmark">${ICONS.lock}</span>`}</div>
      <div class="mbody">
        <h3>${text.name}</h3>
        <p class="fine">${text.blurb}</p>
        <p class="best">${save.won[id] ? `<span class="won">${s.menu.cleared}</span>` : ''}${s.menu.best(best)}</p>
      </div>`;
    const btn = el('button', 'go', open ? s.menu.play : s.menu.locked) as HTMLButtonElement;
    btn.disabled = !open;
    btn.onclick = () => { initAudio(); nav.play(id); };
    card.appendChild(btn);
    modes.appendChild(card);
  }
  for (const soon of s.menu.soon) {
    modes.appendChild(el('article', 'mcard soon',
      `<div class="mbody"><span class="tag">${s.menu.comingLater}</span><h3>${soon.name}</h3><p class="fine">${soon.desc}</p></div>`));
  }
  fillMapPictures([...MAP_ORDER]);

  $('mShopTitle').textContent = s.menu.workshop;
  $('mShopIntro').textContent = s.menu.workshopIntro;
  const shop = $('shop');
  shop.innerHTML = '';
  for (const u of UPGRADES) {
    const lv = save.up[u.id], maxed = lv >= u.max, cost = upgradeCost(lv), text = s.upgrades[u.id];
    const row = el('div', 'up',
      `<div><b>${text.name}</b><p class="fine">${text.desc}</p>
        <div class="lvl-pips">${Array.from({ length: u.max }, (_, i) => `<b class="${i < lv ? 'f' : ''}"></b>`).join('')}</div></div>`);
    const btn = el('button', 'go small', maxed ? s.menu.maxed : `${ICONS.star} ${cost}`) as HTMLButtonElement;
    btn.disabled = maxed || save.dust < cost;
    btn.setAttribute('aria-label', maxed ? s.menu.maxed : s.menu.buyFor(cost));
    btn.title = maxed ? s.menu.maxed : s.menu.buyFor(cost);
    btn.onclick = () => {
      if (save.dust < cost || maxed) return;
      save.dust -= cost;
      save.up[u.id]++;
      persist();
      renderMenu();
    };
    row.appendChild(btn);
    shop.appendChild(row);
  }

  $('mCodexTitle').textContent = s.menu.towers;
  $('mCodexIntro').textContent = s.menu.towersIntro;
  const codex = $('codex');
  codex.innerHTML = '';
  const portraits = towerPortraits();
  for (const type of TOWER_ORDER) {
    const d = TOWERS[type], ok = towerUnlocked(type), text = s.towers[type];
    codex.appendChild(el('div', 'cx' + (ok ? '' : ' locked'),
      `<img src="${portraits[type]}" alt="">
       <div><b>${text.name}</b> <span class="cost">${ICONS.coin} ${d.cost}</span>
         <p class="fine">${ok ? text.desc : s.menu.unlockAtLevel(d.unlock!)}</p>
         ${ok ? `<p class="fine branches-line">${s.menu.branches(text.branches[0].name, text.branches[1].name)}</p>` : ''}</div>`));
  }
}
