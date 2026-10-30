# Project policy

Browser tower defense game, built with Vite and TypeScript. The game board is rendered in 3D with Three.js; menus and icons are plain DOM and Canvas 2D. It has no UI framework.

## Verify

- `npm run typecheck` must pass.
- `npm run build` must pass. It also produces `dist/artifact.html`.
- For gameplay changes, run `npm run dev` and drive a run from the console. In dev, `window.__dw` exposes `startRun`, `currentGame`, `update`, `startWave`, `placeTower`, `chooseBranch` and the rest of `game/run` and `game/towers`. Step `update(game, 1/60)` in a loop to simulate whole runs quickly.

## Conventions

- The game is in English first. Every player-facing string goes in `src/i18n/en.ts`, with a Swedish counterpart in `sv.ts`. Never hard-code display text in game or UI code.
- `src/data/` holds plain numbers with no display text.
- The simulation in `src/game/` must not touch the DOM, so it can be stepped headless for balance tests.
- The game has a single dark look on purpose. UI colors come from the tokens in `src/style.css`; 3D colors come from `C` in `src/three/models.ts`.
- All 3D models are built in code from low-poly primitives in `src/three/models.ts`, which must stay free of DOM access so `npm run export-models` can run it in Node. The user chose code-built models over ArtCraft's AI generation and the Codex ArtCraft MCP prototype.
- `src/three/view.ts` maps simulation pixels to world units (one tile = one unit, board centred on the origin) and keeps one 3D object per tower, enemy and shot in sync each frame. The simulation never imports from `src/three/`.
- Anything glowing uses `glow()` with intensity above 1 so the bloom pass picks it up; keep UI helpers such as range rings and effect rings dim so they do not bloom. Bright additive flashes made the whole board blink, which the user disliked; avoid screen shake on routine hits.
- The look should be soft, not blocky: one smooth terrain mesh with the road painted in along a rounded curve, a rounded island, smooth shading by default (`flat` only for rocks and ice), and the tile grid shown only while placing a tower.
- Camera: close to top-down by default. The player may turn (right or middle drag) and zoom (wheel) within the limits set in `GameView`; there is no panning, and Reset view returns to the default.
- `npm run export-models` writes every model to `exports/models/*.glb` (gitignored) so the user can view them in ArtCraft via 3D Stage > Upload 3D Model.
- `GAME_TITLE` in `src/config.ts` is a working title until the project gets a real name.

## Planning

- Order agreed with the user: make the core loop fun first (game feel, meaningful decisions, balance). Then add breadth (maps, towers, the build-your-own-road mode). Head-to-head comes last: local same-screen first, then against AI, then online.
- Levelling happens both inside a run and between runs. Inside a run, towers level up only when the player pays gold. There is no automatic XP; the user explicitly rejected it. The branch choice at level 3 is itself the paid upgrade to level 4. Between runs, the player has a watch level and stardust upgrades.
- Tower light is mood only. Keep it a small glow around the tower, never a wash over the whole range, and keep enemies drawn above the darkness so they stay readable.
- Visual direction: a 3D low-poly dusk diorama with meshes, chosen by the user for a livelier tone.

## Publishing

The game is published as a private claude.ai Artifact at https://claude.ai/artifact/LjdboXzVdcQvxs4tFVmkTL. To update it, publish `dist/artifact.html` with that URL.
