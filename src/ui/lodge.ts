// The Warden's Lodge (#lodge, #lodge/talents, #lodge/workshop): all progress between runs in one
// place, in tabs. Stardust is shown once at the top; the back button returns to wherever the
// player came from. Item cards show the Warden wearing that item; pictures fill in one by one so
// the page appears at once.
import { CHARMS, CLOAKS, HATS, TALENTS, WEAPONS, talentCost, type Loadout } from '../data/hero';
import { UPGRADES, upgradeCost } from '../data/upgrades';
import { L, fmt } from '../i18n';
import { owns, persist, save } from '../save';
import { heroPortrait } from '../three/view';
import { $ } from './dom';
import { FRONT_ICONS } from './front-icons';
import { ICONS } from './icons';
import { nav } from './nav';

export type LodgeTab = 'warden' | 'talents' | 'workshop';
const TABS: LodgeTab[] = ['warden', 'talents', 'workshop'];

type Slot = keyof Loadout;
const SLOTS: { slot: Slot; items: Record<string, { cost: number }> }[] = [
  { slot: 'weapon', items: WEAPONS },
  { slot: 'charm', items: CHARMS },
  { slot: 'hat', items: HATS },
  { slot: 'cloak', items: CLOAKS },
];

let tab: LodgeTab = 'warden';

export function showLodge(sub?: string) {
  tab = (TABS as string[]).includes(sub ?? '') ? (sub as LodgeTab) : 'warden';
  $('menu').hidden = true;
  $('lodge').hidden = false;
  $('lodge').scrollTop = 0;
  renderLodge();
}

export function hideLodge() { $('lodge').hidden = true; }

function itemName(slot: Slot, id: string) {
  const h = L().hero;
  if (slot === 'weapon') return h.weapons[id as Loadout['weapon']].name;
  if (slot === 'charm') return h.charms[id as Loadout['charm']].name;
  if (slot === 'hat') return h.hats[id as Loadout['hat']];
  return h.cloaks[id as Loadout['cloak']];
}

function itemDetail(slot: Slot, id: string) {
  const s = L();
  if (slot === 'weapon') {
    const w = s.hero.weapons[id as Loadout['weapon']];
    return `<p class="fine"><b>${s.lodge.attack}:</b> ${w.attack}</p><p class="fine"><b>${s.lodge.ability} · ${w.ability}:</b> ${w.abilityDesc}</p>`;
  }
  if (slot === 'charm') return `<p class="fine">${s.hero.charms[id as Loadout['charm']].desc}</p>`;
  return '';
}

/** Fills item pictures after the page is on screen, one per tick. */
function fillPictures(queue: { img: HTMLImageElement; loadout: Loadout }[]) {
  const next = queue.shift();
  if (!next) return;
  setTimeout(() => {
    if (next.img.isConnected) { next.img.src = heroPortrait(next.loadout, 160); next.img.classList.add('ready'); }
    fillPictures(queue);
  }, 16);
}

/** A row in the talents or workshop list: name, description, level pips and a buy button. */
function buyRow(name: string, desc: string, lv: number, max: number, cost: number, buy: () => void) {
  const s = L(), maxed = lv >= max;
  const row = document.createElement('div');
  row.className = 'up';
  row.innerHTML = `<div><b>${name}</b><p class="fine">${desc}</p>
    <div class="lvl-pips">${Array.from({ length: max }, (_, i) => `<b class="${i < lv ? 'f' : ''}"></b>`).join('')}</div></div>`;
  const btn = document.createElement('button');
  btn.className = 'go small';
  btn.innerHTML = maxed ? s.menu.maxed : `${ICONS.star} ${cost}`;
  btn.disabled = maxed || save.dust < cost;
  btn.setAttribute('aria-label', maxed ? s.menu.maxed : s.menu.buyFor(cost));
  btn.title = maxed ? s.menu.maxed : s.menu.buyFor(cost);
  btn.onclick = () => {
    if (maxed || save.dust < cost) return;
    save.dust -= cost;
    buy();
    persist();
    renderLodge();
  };
  row.appendChild(btn);
  return row;
}

export function renderLodge() {
  const s = L(), f = s.front;
  $('lTitle').textContent = s.lodge.title;
  $('lDustIcon').innerHTML = ICONS.star;
  $('lDust').textContent = fmt(save.dust);
  $('lDustLabel').textContent = s.menu.stardust;
  $('lBack').innerHTML = `${FRONT_ICONS.left}<span>${f.back}</span>`;
  $('lBack').onclick = () => nav.back();

  const tabs = $('lTabs');
  tabs.setAttribute('aria-label', s.lodge.title);
  tabs.innerHTML = TABS.map((t) =>
    `<button role="tab" class="ltab${t === tab ? ' on' : ''}" aria-selected="${t === tab}" data-tab="${t}">${f.tabs[t]}</button>`).join('');
  tabs.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    // Tabs replace the address rather than adding history, so Back leaves the Lodge in one step.
    b.onclick = () => {
      const t = b.dataset.tab as LodgeTab;
      try { history.replaceState(null, '', t === 'warden' ? '#lodge' : `#lodge/${t}`); } catch { /* sandboxed */ }
      tab = t;
      renderLodge();
    };
  });

  const root = $('lBody');
  root.innerHTML = '';
  root.setAttribute('role', 'tabpanel');
  if (tab === 'warden') renderWarden(root);
  else if (tab === 'talents') renderTalents(root);
  else renderWorkshop(root);
}

function renderWarden(root: HTMLElement) {
  const s = L(), equip = save.hero.equip;
  const grid = document.createElement('div');
  grid.className = 'lodge-grid';
  grid.innerHTML = `<div class="mirror panel"><img alt="" src="${heroPortrait(equip, 320)}"><h2>${s.hero.name}</h2>
    <p class="fine">${s.hero.weapons[equip.weapon].name} · ${s.hero.charms[equip.charm].name}</p>
    <p class="fine intro">${s.lodge.intro}</p></div><div class="lodge-slots"></div>`;
  const slots = grid.querySelector('.lodge-slots')!;
  const pictures: { img: HTMLImageElement; loadout: Loadout }[] = [];
  for (const { slot, items } of SLOTS) {
    const sec = document.createElement('section');
    sec.className = 'book panel';
    sec.innerHTML = `<h2>${s.lodge[slot]}</h2><div class="items ${slot === 'hat' || slot === 'cloak' ? 'small' : ''}"></div>`;
    const list = sec.querySelector('.items')!;
    for (const [id, item] of Object.entries(items)) {
      const have = owns(slot, id), on = equip[slot] === id;
      const card = document.createElement('article');
      card.className = 'item' + (on ? ' on' : '') + (have ? '' : ' locked');
      card.innerHTML = `<img alt=""><div class="txt"><b>${itemName(slot, id)}</b>${itemDetail(slot, id)}</div>`;
      const btn = document.createElement('button');
      btn.className = on ? 'go small' : have ? 'ghost' : 'go small';
      btn.innerHTML = on ? s.lodge.equipped : have ? s.lodge.equip : `${ICONS.star} ${s.lodge.unlock(item.cost)}`;
      btn.disabled = on || (!have && save.dust < item.cost);
      btn.onclick = () => {
        if (!have) {
          if (save.dust < item.cost) return;
          save.dust -= item.cost;
          save.hero.owned.push(`${slot}:${id}`);
        }
        save.hero.equip = { ...save.hero.equip, [slot]: id };
        persist();
        renderLodge();
      };
      card.appendChild(btn);
      list.appendChild(card);
      pictures.push({ img: card.querySelector('img')!, loadout: { ...equip, [slot]: id } });
    }
    slots.appendChild(sec);
  }
  root.appendChild(grid);
  fillPictures(pictures);
}

function renderTalents(root: HTMLElement) {
  const s = L();
  const sec = document.createElement('section');
  sec.className = 'book panel narrow';
  sec.innerHTML = `<p class="fine">${s.lodge.talentsIntro}</p><div class="shop"></div>`;
  const list = sec.querySelector('.shop')!;
  for (const t of TALENTS) {
    const lv = save.hero.talents[t.id], text = s.hero.talents[t.id];
    list.appendChild(buyRow(text.name, text.desc, lv, t.max, talentCost(lv), () => { save.hero.talents[t.id]++; }));
  }
  root.appendChild(sec);
}

function renderWorkshop(root: HTMLElement) {
  const s = L();
  const sec = document.createElement('section');
  sec.className = 'book panel narrow';
  sec.innerHTML = `<p class="fine">${s.menu.workshopIntro}</p><div class="shop"></div>`;
  const list = sec.querySelector('.shop')!;
  for (const u of UPGRADES) {
    const lv = save.up[u.id], text = s.upgrades[u.id];
    list.appendChild(buyRow(text.name, text.desc, lv, u.max, upgradeCost(lv), () => { save.up[u.id]++; }));
  }
  root.appendChild(sec);
}
