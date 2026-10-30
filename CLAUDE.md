# Project policy

Browser tower defense game, built with Vite and TypeScript and drawn with Canvas 2D. It has no framework.

## Verify

- `npm run typecheck` must pass.
- `npm run build` must pass. It also produces `dist/artifact.html`.
- For gameplay changes, run `npm run dev` and drive a run from the console. In dev, `window.__dw` exposes `startRun`, `currentGame`, `update`, `startWave`, `placeTower`, `chooseBranch` and the rest of `game/run` and `game/towers`. Step `update(game, 1/60)` in a loop to simulate whole runs quickly.

## Conventions

- The game is in English first. Every player-facing string goes in `src/i18n/en.ts`, with a Swedish counterpart in `sv.ts`. Never hard-code display text in game or UI code.
- `src/data/` holds plain numbers with no display text.
- The simulation in `src/game/` must not touch the DOM, so it can be stepped headless for balance tests.
- The game has a single dark look on purpose. Colors come from the tokens in `src/style.css`.
- `GAME_TITLE` in `src/config.ts` is a working title until the project gets a real name.

## Planning

- Order agreed with the user: make the core loop fun first (game feel, meaningful decisions, balance). Then add breadth (maps, towers, the build-your-own-road mode). Head-to-head comes last: local same-screen first, then against AI, then online.
- Levelling happens both inside a run and between runs. Inside a run, towers level up only when the player pays gold. There is no automatic XP; the user explicitly rejected it. The branch choice at level 3 is itself the paid upgrade to level 4. Between runs, the player has a watch level and stardust upgrades.
- Tower light is mood only. Keep it a small glow around the tower, never a wash over the whole range, and keep enemies drawn above the darkness so they stay readable.
- Visual direction (sprites, meshes, a livelier tone) comes after the in-game gameplay pass, at the user's request.

## Publishing

The game is published as a private claude.ai Artifact at https://claude.ai/artifact/LjdboXzVdcQvxs4tFVmkTL. To update it, publish `dist/artifact.html` with that URL.
