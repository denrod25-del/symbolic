import { FIXED_DT, MAX_FRAME_TIME } from './constants';

type LoopCallbacks = {
  /** Advances the simulation by exactly one fixed step. */
  update: (dt: number) => void;
  /** Draws the current state. Called once per animation frame. */
  render: () => void;
};

/**
 * A fixed-timestep game loop with an accumulator.
 *
 * `requestAnimationFrame` fires at the display's refresh rate (variable), but we
 * advance the simulation in fixed 1/60s slices so physics and game feel are
 * identical regardless of frame rate. Leftover time is carried in the
 * accumulator into the next frame.
 */
export class GameLoop {
  private readonly update: (dt: number) => void;
  private readonly render: () => void;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  constructor(callbacks: LoopCallbacks) {
    this.update = callbacks.update;
    this.render = callbacks.render;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number) => {
    if (!this.running) return;

    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    this.accumulator += frameTime;
    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }

    this.render();
    this.rafId = requestAnimationFrame(this.frame);
  };
}
