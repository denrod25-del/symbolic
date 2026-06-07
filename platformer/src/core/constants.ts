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
 * Movement tuning (milestone 5, stage B — momentum + variable jump).
 * Units: pixels and seconds. Coyote time / jump buffering are stage C.
 */
export const MAX_RUN_SPEED = 130; // top horizontal speed, px/s
export const GROUND_ACCEL = 1000; // how fast you ramp up to speed on the ground
export const GROUND_FRICTION = 1300; // how fast you slow to a stop on the ground
export const AIR_ACCEL = 650; // weaker steering while airborne
export const AIR_FRICTION = 250; // you keep most momentum in the air

export const GRAVITY = 900; // downward acceleration, px/s^2
export const JUMP_SPEED = 330; // initial upward speed on jump, px/s (~60px / ~3.7 tiles)
export const MAX_FALL_SPEED = 420; // terminal velocity, px/s
/** On releasing jump while still rising, cut upward velocity to this fraction. */
export const JUMP_CUT_MULTIPLIER = 0.45;
/** Grace window (seconds) to still jump just after walking off a ledge. */
export const COYOTE_TIME = 0.1;
/** Window (seconds) before landing in which a jump press is remembered. */
export const JUMP_BUFFER_TIME = 0.1;

/** Enemy tuning. */
export const ENEMY_SPEED = 40; // patrol speed, px/s
export const STOMP_BOUNCE = 250; // upward speed given to the player on a stomp, px/s

export const COLORS = {
  sky: '#5c94fc',
  ground: '#9c5a3c',
  player: '#e52521',
  coin: '#fbd000',
  enemy: '#7a4b2b',
  text: '#ffffff',
} as const;
