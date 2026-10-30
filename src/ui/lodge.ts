// The Warden's Lodge, reached from the menu or #lodge: dress and equip the Warden between runs.
// Each item card shows the Warden wearing that item; pictures fill in one by one so the page
// appears at once.
import { CHARMS, CLOAKS, HATS, TALENTS, WEAPONS, talentCost, type Loadout } from '../data/hero';
import { L, fmt } from '../i18n';
import { owns, persist, save } from '../save';
import { heroPortrait } from '../three/view';
import { $ } from './dom';
import { ICONS } from './icons';
import { nav } from './nav';

type Slot = keyof Loadout;
const SLOTS: { slot: Slot; items: Record<string, { cost: number }> }[] = [
  { slot: 'weapon', items: WEAPONS },
  { slot: 'charm', items: CHARMS },
  { slot: 'hat', items: HATS },
  { slot: 'cloak', items: CLOAKS },
];

export function showLodge() {
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

export function renderLodge() {
  const s = L(), equip = save.hero.equip;
  $('lTitle').textContent = s.lodge.title;
  $('lIntro').textContent = s.lodge.intro;
  $('lDustIcon').innerHTML = ICONS.star;
  $('lDust').textContent = fmt(save.dust);
  $('lDustLabel').textContent = s.menu.stardust;
  $('lBack').textContent = s.lodge.back;
  $('lBack').onclick = () => nav.menu();
  $<HTMLImageElement>('lPortrait').src = heroPortrait(equip, 320);
  $('lName').textContent = s.hero.name;
  $('lKit').textContent = `${s.hero.weapons[equip.weapon].name} · ${s.hero.charms[equip.charm].name}`;

  const root = $('lSlots');
  root.innerHTML = '';
  const pictures: { img: HTMLImageElement; loadout: Loadout }[] = [];
  for (const { slot, items } of SLOTS) {
    const sec = document.createElement('section');
    sec.className = 'book panel';
    sec.innerHTML = `<h2>${s.lodge[slot]}</h2><div class="items ${slot === 'hat' || slot === 'cloak' ? 'small' : ''}"></div>`;
    const grid = sec.querySelector('.items')!;
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
      grid.appendChild(card);
      pictures.push({ img: card.querySelector('img')!, loadout: { ...equip, [slot]: id } });
    }
    root.appendChild(sec);
  }

  const tal = document.createElement('section');
  tal.className = 'book panel';
  tal.innerHTML = `<h2>${s.lodge.talents}</h2><p class="fine">${s.lodge.talentsIntro}</p><div class="shop"></div>`;
  const list = tal.querySelector('.shop')!;
  for (const t of TALENTS) {
    const lv = save.hero.talents[t.id], maxed = lv >= t.max, cost = talentCost(lv), text = s.hero.talents[t.id];
    const row = document.createElement('div');
    row.className = 'up';
    row.innerHTML = `<div><b>${text.name}</b><p class="fine">${text.desc}</p>
      <div class="lvl-pips">${Array.from({ length: t.max }, (_, i) => `<b class="${i < lv ? 'f' : ''}"></b>`).join('')}</div></div>`;
    const btn = document.createElement('button');
    btn.className = 'go small';
    btn.innerHTML = maxed ? s.menu.maxed : `${ICONS.star} ${cost}`;
    btn.disabled = maxed || save.dust < cost;
    btn.onclick = () => {
      if (maxed || save.dust < cost) return;
      save.dust -= cost;
      save.hero.talents[t.id]++;
      persist();
      renderLodge();
    };
    row.appendChild(btn);
    list.appendChild(row);
  }
  root.appendChild(tal);
  fillPictures(pictures);
}
