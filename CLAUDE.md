# Project policy

Browser tower defense game, built with Vite and TypeScript. The game board is rendered in 3D with Three.js; menus and icons are plain DOM and Canvas 2D. It has no UI framework.

## Verify

- `npm run typecheck` must pass.
- `npm run build` must pass. It also produces `dist/artifact.html`.
- For gameplay changes, run `npm run dev` and drive a run from the console. In dev, `window.__dw` exposes `startRun`, `currentGame`, `update`, `startWave`, `placeTower`, `canBuild`, `chooseBranch` and the rest of `game/run` and `game/towers`, and `window.__view` is the `GameView` (move `__view.camera` and `__view.controls` for close-up screenshots). Step `update(game, 1/60)` in a loop to simulate whole runs quickly. Towers are placed by position in simulation pixels, for example `placeTower(game, 'spark', 3.5 * 60, 2.5 * 60)`.
- The dev server sometimes keeps serving a stale `src/main.ts`; dev handles added elsewhere (as `__view` in `play.ts`) load reliably.

## Conventions

- The game is in English first. Every player-facing string goes in `src/i18n/en.ts`, with a Swedish counterpart in `sv.ts`. Never hard-code display text in game or UI code.
- `src/data/` holds plain numbers with no display text.
- The simulation in `src/game/` must not touch the DOM, so it can be stepped headless for balance tests. The simulation never imports from `src/three/`.
- Tower placement is free, not on a grid: a tower may stand anywhere on the board that is `ROAD_CLEARANCE` from the road centreline and `TOWER_SPACING` from other towers (`canBuild` in `game/towers.ts`). The user asked for this so players can use the space cleverly. Do not reintroduce a visible grid.
- UI colors come from the tokens in `src/style.css`; 3D colors come from `C` in `src/three/models.ts`.
- All 3D models are built in code from primitives in `src/three/models.ts`, which must stay free of DOM access so `npm run export-models` can run it in Node. The user chose code-built models over ArtCraft's AI generation and the Codex ArtCraft MCP prototype.
- `src/three/view.ts` maps simulation pixels to world units (one tile = one unit, board centred on the origin) and keeps one 3D object per tower, enemy and shot in sync each frame. It detects events by watching state: a tower fired when its cooldown jumps up, an enemy was hit when `lastHit` changes, and an enemy that disappears with `hp <= 0` was killed (otherwise it leaked).
- Models expose named parts that the view animates: towers use `aim`, `recoil`, `swing`, `core`, `flames`, `embers`, `float`, `orbit`, `mist`, `spin`, `arc`, `flag`, `badge`; enemies use `body`, `skin`, `footL/R`, `wingL/R`, `armL/R`, `cloak`, `shield`, `slow`, `burn`, `stun`. Keep these names when reworking a model.
- `npm run export-models` writes every model to `exports/models/*.glb` (gitignored) so the user can view them in ArtCraft via 3D Stage > Upload 3D Model.
- `GAME_TITLE` in `src/config.ts` is a working title until the project gets a real name.

## Art direction ("storybook golden hour")

- Cel-shaded with outlines: `toon()` gives three hard light steps, and `addOutlines` in the view adds an inverted-hull outline to every opaque toon mesh. New models should use `toon()` for surfaces, `gem()` for faintly self-lit ice and magic, and `glow()` only for true light sources.
- Golden hour, not night: a low warm sun with long shadows, a cool sky fill, a pink rim light and a gradient sky. The user rejected a dark theme and ground light pools around towers. Keep glow modest so only light sources bloom, and avoid bright additive flashes and screen shake on routine hits, which made the board blink.
- Two sides in color: the village is warm brass, wood and cool stone; the Gloom is violet and magenta ink with yellow-green eyes, and it stains the grass purple around its rift.
- Everything moves: towers pop in when built, idle (swinging lanterns, floating crystals, living flames) and react when they fire (recoil, flare). Enemies spawn with a pop, waddle, flap or stomp by type, flash white when hit, and squash and burst when killed. Faces sit high on the front so they read from the near top-down camera.
- The look is soft, not blocky: one smooth terrain mesh with the road painted in along a rounded curve, a rounded island, and smooth shading by default.
- Camera: close to top-down by default. The player may turn (right or middle drag) and zoom (wheel) within the limits set in `GameView`; there is no panning, and Reset view returns to the default.

## Planning

- Order agreed with the user: make the core loop fun first (game feel, meaningful decisions, balance). Then add breadth (maps, towers, the build-your-own-road mode). Head-to-head comes last: local same-screen first, then against AI, then online.
- Levelling happens both inside a run and between runs. Inside a run, towers level up only when the player pays gold. There is no automatic XP; the user explicitly rejected it. The branch choice at level 3 is itself the paid upgrade to level 4. Between runs, the player has a watch level and stardust upgrades.

## Publishing

The game is published as a private claude.ai Artifact at https://claude.ai/artifact/LjdboXzVdcQvxs4tFVmkTL. To update it, publish `dist/artifact.html` with that URL.
