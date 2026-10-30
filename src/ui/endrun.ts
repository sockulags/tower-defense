// The end-of-run panel: won or lost, stardust earned, anything newly unlocked, and the buttons that
// make sense next for the mode. After a profile's first run it also asks once for a name.
import { NAMED_LEVEL, nickname } from '../game/towers';
import { L } from '../i18n';
import type { RunResult } from '../meta';
import { DEFAULT_NAME, activeProfile, persist, renameProfile, save } from '../save';
import { STORY_MAPS } from './front';
import { nav } from './nav';
import type { Game, MapId } from '../types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Fills the end panel. `restart` starts a new run on a map. */
export function renderEnd(box: HTMLElement, g: Game, r: RunResult, gaveUp: boolean, restart: (id: MapId) => void) {
  const s = L(), f = s.front, m = g.map;
  let h = `<div class="big">${r.win ? s.end.win : gaveUp ? s.end.gaveUp : s.end.lose}</div>`;
  h += `<p>${m.survival ? s.end.survived(r.cleared) : s.end.clearedOf(r.cleared, m.waves)}${r.newBest && r.cleared > 0 ? ' ' + s.end.record : ''}</p>`;
  h += `<p class="dust">${s.end.dust(r.dust)}</p>`;
  if (r.hero && r.hero.dealt > 0) {
    const who = r.hero.level >= NAMED_LEVEL ? `${nickname(r.hero)} (${s.towers[r.hero.type].name})` : s.towers[r.hero.type].name;
    h += `<p class="fine">${s.end.hero(who, r.hero.level, r.hero.kills)}</p>`;
  }
  if (r.levelAfter > r.levelBefore) h += `<p class="good"><b>${s.end.newLevel(r.levelAfter)}</b></p>`;
  for (const t of r.newTowers) h += `<p class="good">${s.end.newTower(s.towers[t].name)}</p>`;
  for (const id of r.newMaps) h += `<p class="good">${f.end.newPage(s.maps[id].name)}</p>`;
  if (r.newSurvival) h += `<p class="good"><b>${f.end.newSurvival}</b></p>`;

  // The buttons that make sense next, primary first.
  const buttons: { label: string; act: () => void }[] = [];
  if (m.survival) {
    buttons.push({ label: f.end.again, act: () => restart(m.id) }, { label: f.end.back, act: () => nav.go('survival') });
  } else {
    const next = STORY_MAPS[STORY_MAPS.indexOf(m.id) + 1];
    if (r.win && next) buttons.push({ label: f.end.nextPage, act: () => nav.go(`story/${next}`) });
    if (!r.win) buttons.push({ label: f.end.tryAgain, act: () => restart(m.id) });
    buttons.push({ label: f.end.toBook, act: () => nav.go(`story/${m.id}`) });
  }
  h += `<div class="btnrow" id="oButtons">${buttons.map((b, i) => `<button class="${i === 0 ? 'go' : 'ghost'}" data-i="${i}">${b.label}</button>`).join('')}</div>`;

  // After the first run, ask once for a name; skipping is fine.
  const ask = r.firstRun && !save.named;
  if (ask) {
    const name = activeProfile().name;
    h += `<form class="sign" id="oSign">
        <b>${f.end.signTitle}</b>
        <label class="fine" for="oName">${f.end.signText}</label>
        <div class="rename"><input id="oName" maxlength="24" value="${name === DEFAULT_NAME ? '' : esc(name)}" placeholder="${esc(f.yourName)}" autocomplete="off">
          <button class="go small" type="submit">${f.end.sign}</button><button class="ghost" type="button" id="oSkip">${f.end.skip}</button></div>
      </form>`;
  }
  box.innerHTML = h;
  box.querySelectorAll<HTMLButtonElement>('#oButtons [data-i]').forEach((b) => { b.onclick = () => buttons[Number(b.dataset.i)].act(); });
  if (ask) {
    const done = () => { save.named = true; persist(); document.getElementById('oSign')?.remove(); };
    (document.getElementById('oSign') as HTMLFormElement).onsubmit = (e) => {
      e.preventDefault();
      renameProfile((document.getElementById('oName') as HTMLInputElement).value);
      done();
    };
    document.getElementById('oSkip')!.onclick = done;
  }
}
