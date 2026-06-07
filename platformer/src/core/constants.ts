/** Internal render resolution in pixels. Scaled up to fit the screen via CSS. */
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 240;

/** Size of one tile in pixels. The level grid is built from these. */
export const TILE_SIZE = 16;

/** Player hitbox size in pixels. Taller than one tile, one tile wide. */
export const PLAYER_W = 16;
export const PLAYER_H = 24;

/** Fixed simulation step: the physics loop always advances in 1/60s slices. */
export const FIXED_DT = 1 / 60;

/**
 * Largest real frame delta we'll feed the accumulator. Prevents a "spiral of
 * death" where, after the tab is backgrounded, a huge delta queues hundreds of
 * catch-up updates at once.
 */
export const MAX_FRAME_TIME = 0.25;

/**
 * Movement tuning (milestone 2 — "basic" feel).
 * Units: pixels and seconds. Momentum, friction, and variable jump height are
 * intentionally deferred to milestone 5; these are deliberately simple.
 */
export const MOVE_SPEED = 130; // horizontal speed, px/s (instant on/off)
export const GRAVITY = 900; // downward acceleration, px/s^2
export const JUMP_SPEED = 330; // initial upward speed on jump, px/s (~60px / ~3.7 tiles)
export const MAX_FALL_SPEED = 420; // terminal velocity, px/s

export const COLORS = {
  sky: '#5c94fc',
  ground: '#9c5a3c',
  player: '#e52521',
  text: '#ffffff',
} as const;
