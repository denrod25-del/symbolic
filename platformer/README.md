# Platformer

A 2D side-scrolling platformer built from scratch on HTML5 Canvas + TypeScript.
Learning project (hand-written game loop, physics, and collision) and portfolio
piece (one polished, deployable level).

> This is a self-contained Vite project. It currently lives in a subfolder but
> has no dependency on the parent repo and can be lifted into its own repo at any
> time.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 — hot-reloading dev server
npm run build    # type-check + static build into dist/
npm run preview  # serve the production build locally
```

## Tech & design decisions

- **Raw HTML5 Canvas + TypeScript**, bundled with **Vite**. No game framework —
  the physics, collision, and camera are written by hand (that's the point).
- **Fixed 60 Hz timestep** with an accumulator (`src/core/GameLoop.ts`) so game
  feel is frame-rate independent.
- **Strict logic/render split**: `update(dt)` mutates state, `render(ctx)` only
  draws. This keeps the planned sprite skin a drop-in change.
- **Rectangles first, art last**: everything is colored boxes until the final
  polish pass swaps in a [Kenney](https://kenney.nl) CC0 pixel pack.
- **Tile-based level**: a string-art grid with tile-based AABB collision
  (arrives in milestone 3).
- **Simple OOP** (`Game` owns the loop, map, camera, and entities) — no ECS.

## Scope

**In (MVP):** follow-camera, run + jump with good feel, tile collision,
coins + HUD, one stompable enemy, death/respawn, win on reaching the goal flag.

**Out:** power-ups, multiple levels, level editor, mobile/touch, lives, timer,
gamepad. Sound is a stretch goal.

## Milestones

- [x] **1. Skeleton** — Vite + TS, fixed-timestep loop, canvas, placeholder box
- [x] **2. Movement A** — run + basic jump + gravity, wired input (on a temporary floor)
- [x] **3. Tilemap + collision** — parse string-art map, axis-separated AABB tile collision
- [x] **4. Camera** — follow player, clamp to level bounds
- [x] **5. Feel B→C** — momentum, variable jump, coyote time, jump buffering
- [x] **6. Coins + HUD** — collect coins, on-screen counter
- [x] **7. Enemy + combat** — patrolling enemy, stomp to kill, side-contact death
- [ ] **8. Win/lose loop** — goal flag wins, pit/enemy death respawns
- [ ] **9. Polish** — Kenney skin, title/win/lose screens, sound (if time), deploy

## Controls (from milestone 2)

Arrow keys / **WASD** to move · **Space** / **Up** / **W** to jump.

## Project layout

```
src/
  main.ts            bootstrap: canvas + loop wiring
  core/
    constants.ts     resolution, tile size, fixed dt, colors
    GameLoop.ts      fixed-timestep accumulator loop
    Game.ts          state + update/render
  input/
    Input.ts         held-keys input-as-state (ready for milestone 2)
```
