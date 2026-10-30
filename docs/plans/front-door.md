# Front door: from opening the page to playing

Status: built.

## Goal

Someone who opens the game should be playing within a few seconds, understand what to do without
reading a manual, and later find everything else (story, survival, the Warden, settings) without
hunting for it. Each view shows exactly what that moment needs and nothing more.

## What changes compared with today

Today one long menu shows everything at once: watch level, stardust, language, the Lodge, every map,
"coming later" cards, the stardust workshop, the tower codex and the lab link. The plan splits that
into a few small views, each with one job.

| Today's menu item | Where it goes |
|---|---|
| Title and tagline | Title view |
| Watch level, stardust | Profile chip on the title view; stardust also in the Lodge |
| Language chips | Settings (and picked automatically from the browser on first visit) |
| Map cards | Storybook (story maps) and Survival (survival maps) |
| "Coming later" cards | Removed; nothing is shown before it exists |
| Stardust workshop | The Lodge, as its own tab, so all progress between runs lives in one place |
| Tower codex | Removed; towers explain themselves on the build belt in game |
| Lab link | Removed from the player's view; the lab stays reachable at `#lab` |

## The views

The live board keeps running behind every view outside a run, as today.

### 1. Title

The first thing anyone sees.

- Shows: the game title, one large **Play** button, a small **Lodge** button with the Warden's
  portrait, a **settings** gear, and the profile chip (name and watch level) in a corner.
- Play continues where the player left off. On a first visit it starts the first story page
  directly; there is no map choice to make yet. Once Survival is unlocked, Play opens the mode choice.
- Does not show: maps, stardust shop, tower info, language, anything locked.

### 2. Mode choice

Only exists once there is more than one mode.

- Shows two large cards: **Story** (the storybook, with the next unplayed page named on the card)
  and **Survival** (best wave reached).
- A back button to the title.
- Head-to-head gets a card here the day it exists, not before.

### 3. Storybook (story mode)

The campaign as a book; the storybook campaign idea the user liked.

- Shows one spread at a time: on the left an illustration of the map (the existing map still), on
  the right the page title, one short line of story, the result so far and a **Begin** button.
- Arrows or page edges flip to the previous and next page. Pages not yet reached are shown as
  pencil sketches with no text and no button.
- Story maps today: Mill Hill and Marsh Ditch. More pages come with new maps.
- Story text is extremely short: one line per page, so players barely have to read. Drafts:
  - Mill Hill: "The sun is setting on the mill. Light the lanterns before the shadows come."
  - Marsh Ditch: "The Gloom has found the marsh road. Hold it until morning."
- Does not show: waves count, difficulty numbers, stats. The page says what kind of evening it is
  in story words.
- Once shadow traits exist (gameplay plan, phase 3), the page also shows small portraits of the
  shadows this map sends, so the player knows what is coming.
- Once the squad is unlocked (gameplay plan, phase 7), the page shows the four towers the player
  will bring, with a **Change** button that swaps them on the spot. Before that, neither is shown.

### 4. Survival

- Shows the survival maps (today only Ring Rampart) with each one's best wave and a **Begin** button.
- Unlocked once every tower is unlocked (watch level 3), so survival is played with the full set and a new player is never asked to choose.
- A later home for the daily challenge, which the user saved for the future.

### 5. The run

Covered by the in-game decisions already made: the hover "+" upgrade, two branch buttons with hover
descriptions, the full card on click or long hover, and the upgrade preview. Additions from this plan:

- The **pause menu** (the menu orb) holds exactly: Resume, Settings, How to play, Give up.
- **How to play** opens three or four short illustrated cards: build on the grass, call the wave,
  upgrade with "+", use the Warden. It is the same content the first story page teaches.

### 6. First run teaches itself

No separate tutorial screen. The first story page shows one hint at a time, each waiting for the
player to do it: place a tower, call the wave, upgrade with "+", place the Warden (when the Warden
becomes useful). A hint disappears once done and never returns for that profile. The existing tip
banner that stays on screen goes away.

### 7. End of run

- Shows: won or lost, stardust earned, anything newly unlocked (a page, a tower, survival), and the
  buttons that make sense next.
- Story win: **Next page** (primary) and **Back to the book**. Story loss: **Try again** and
  **Back to the book**. Survival: **Again** and **Back**.

### 8. The Lodge

All progress between runs in one place, in tabs:

- **Warden**: gear and looks (today's Lodge).
- **Talents**: the four Warden talents.
- **Workshop**: the stardust upgrades moved from the menu.
- **Squad**: appears once a fifth tower is unlocked. All unlocked towers, with four slots to fill;
  each tower shows what it is strong against and whether it hits flyers.

Stardust is shown once, at the top. A back button returns to wherever the player came from.

### 9. Settings

An overlay panel, opened from the title gear or the pause menu, so the game behind it never resets.

- Sound effects volume (a slider, replacing on/off).
- Music volume, only once the game has music.
- Language.
- Keyboard shortcuts, as a list (also opened with `?` in game).
- Profile: rename, switch profile, reset this profile's progress (with a second confirmation).

### 10. Profiles (users)

Local profiles on this device, so several people can share a computer.

- First visit: no sign-up screen. The player is "Watcher" and plays at once. After the first run the
  end screen asks for a name once ("Sign the watch book"), which can be skipped.
- The profile chip on the title opens a small list: each profile with its Warden portrait, name and
  watch level, plus **New watcher**. Choosing one switches all progress.
- Each profile has its own save (stardust, maps, Warden, hints seen). The existing save becomes the
  first profile, so nobody loses progress.
- Real accounts with cloud saves are a separate later decision (see open decisions).

## Addresses

Each view gets an address so the browser's back button and links work: `#` title, `#play` mode
choice, `#story` (optionally `#story/marsh` for a page), `#survival`, `#lodge` with `#lodge/talents`
and `#lodge/workshop`, `#lab`. Settings and profiles are overlays without their own address.

## Work order, once decided

1. Profiles in `save.ts`: per-profile save keys, migration of the existing save, switching.
2. Title view, mode choice and the router for the addresses above; retire today's long menu.
3. Storybook and Survival views, with story text in `en.ts` and `sv.ts`.
4. Lodge tabs, with the workshop moved in.
5. Settings overlay and pause menu entries; volume control in `audio.ts`.
6. In-game hover upgrade, branch buttons and upgrade preview (decided earlier).
7. First-run hints and How to play cards.
8. End of run with the next-step buttons and the name prompt.

Each step is verified in the browser, then `npm run typecheck` and `npm run build`, and published.

## Decisions

1. **Accounts:** local profiles only for now. Cloud accounts are not planned.
2. **Story text:** I write it, and it stays extremely short (one line per page).
3. **Survival unlock:** the user suggested after the first run or once all towers are unlocked. The
   plan uses "all towers unlocked"; switching to "after the first run" is a one-line change.
4. **Tower codex:** removed.
5. **Lab:** reachable only at `#lab`, with no button anywhere.
6. **Name prompt:** after the first run, skippable.
