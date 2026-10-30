# Duskwatch (working title)

A tower defense game played in the browser. Lanterns hold back shadow creatures on a fixed road, towers level up from the damage they deal, and stardust earned each run buys permanent upgrades.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Build

```bash
npm run build
```

This type-checks the code and writes two files:

- `dist/index.html` is the whole game in one self-contained file.
- `dist/artifact.html` is the same page without the document wrapper, for publishing as a claude.ai Artifact.

## Layout

- `src/data/` holds numbers only: towers, enemies, maps, upgrades. Balance changes start here.
- `src/i18n/` holds every player-facing string. `en.ts` defines the shape, and `sv.ts` must match it.
- `src/game/` holds the simulation (`run.ts`, `combat.ts`, `towers.ts`, `waves.ts`) and drawing (`render.ts`). It has no DOM code except canvases.
- `src/ui/` holds the menu and play screens.
- `src/save.ts` and `src/meta.ts` handle progression between runs. Saves live in the browser's localStorage.
