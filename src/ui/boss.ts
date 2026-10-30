// Bosses on screen: a name banner when a boss arrives, and a health bar for each boss on the
// board. The banner is a storybook ribbon with the boss's portrait, name and one line on how to
// answer it; it never takes input. The bars sit top centre and show the Thief's loot beside its
// health. Driven every frame by updateBossUi from the play HUD (src/ui/play.ts).
import { liveBosses } from '../game/bosses';
import { L } from '../i18n';
import { enemyPortraits } from '../three/view';
import type { Enemy, EnemyType, Game } from '../types';

/** How long the arrival banner stays up, in milliseconds. */
const BANNER_MS = 3600;

let lastGame: Game | null = null;
let seen = new WeakSet<Enemy>();
let bannerTimer = 0;
let shown: Enemy[] = [];

function root(): HTMLElement {
  let el = document.getElementById('bossUi');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bossUi';
    el.className = 'boss-ui';
    el.innerHTML = '<div class="boss-bars"></div><div class="boss-banner" role="status" aria-live="polite" hidden></div>';
    document.getElementById('hud')!.appendChild(el);
  }
  return el;
}

const name = (type: EnemyType) => L().bosses.title(L().enemies[type]);

function showBanner(type: EnemyType) {
  const el = root().querySelector<HTMLElement>('.boss-banner')!;
  const hint = (L().bosses.hint as Partial<Record<EnemyType, string>>)[type] ?? '';
  el.innerHTML = `<img src="${enemyPortraits()[type]}" alt=""><div><b>${name(type)}</b><p>${hint}</p></div>`;
  el.hidden = false;
  // Restart the swoop-in animation.
  el.classList.remove('in');
  void el.offsetWidth;
  el.classList.add('in');
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => { el.hidden = true; }, BANNER_MS);
}

function hideAll() {
  const el = root();
  window.clearTimeout(bannerTimer);
  el.querySelector<HTMLElement>('.boss-banner')!.hidden = true;
  el.querySelector('.boss-bars')!.innerHTML = '';
  shown = [];
}

/** Banner on each boss's arrival, then one bar per live boss: name, health and any stolen gold. */
export function updateBossUi(g: Game) {
  if (g !== lastGame) { lastGame = g; seen = new WeakSet(); hideAll(); }
  const bosses = liveBosses(g).slice(0, 3);
  for (const e of bosses) if (!seen.has(e)) { seen.add(e); showBanner(e.type); }

  const bars = root().querySelector<HTMLElement>('.boss-bars')!;
  if (bosses.length !== shown.length || bosses.some((e, i) => e !== shown[i])) {
    shown = bosses;
    bars.innerHTML = bosses.map((e) => `
      <div class="boss-bar panel" role="progressbar" aria-label="${L().bosses.health(name(e.type))}" aria-valuemin="0" aria-valuemax="100">
        <b>${name(e.type)}</b><span class="loot" hidden></span>
        <div class="track"><div class="fill"></div></div>
      </div>`).join('');
  }
  bosses.forEach((e, i) => {
    const row = bars.children[i] as HTMLElement;
    const pct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
    const w = `${pct.toFixed(1)}%`;
    const fill = row.querySelector<HTMLElement>('.fill')!;
    if (fill.style.width !== w) { fill.style.width = w; row.setAttribute('aria-valuenow', String(Math.round(pct))); }
    row.classList.toggle('mending', !!e.def.boss?.mend && e.mending);
    const loot = row.querySelector<HTMLElement>('.loot')!, carry = e.boss?.loot ?? 0;
    if (loot.hidden !== !carry) loot.hidden = !carry;
    const text = carry ? L().bosses.carrying(Math.round(carry)) : '';
    if (carry && loot.textContent !== text) loot.textContent = text;
  });
}
