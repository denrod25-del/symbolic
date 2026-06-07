/** Internal render resolution in pixels. Scaled up to fit the screen via CSS. */
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 240;

/** Size of one tile in pixels. The level grid is built from these. */
export const TILE_SIZE = 16;

/** Fixed simulation step: the physics loop always advances in 1/60s slices. */
export const FIXED_DT = 1 / 60;

/**
 * Largest real frame delta we'll feed the accumulator. Prevents a "spiral of
 * death" where, after the tab is backgrounded, a huge delta queues hundreds of
 * catch-up updates at once.
 */
export const MAX_FRAME_TIME = 0.25;

export const COLORS = {
  sky: '#5c94fc',
  player: '#e52521',
  text: '#ffffff',
} as const;
