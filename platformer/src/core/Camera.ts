/** A box the camera can track. */
type Target = { x: number; y: number; w: number; h: number };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * A scrolling viewport. Holds a world-space offset that `render` subtracts so the
 * tracked target stays centred, clamped so the view never shows past the level
 * edges. With a level only as tall as the screen, the vertical clamp pins `y` to
 * 0 — vertical scrolling kicks in automatically once levels get taller.
 */
export class Camera {
  x = 0;
  y = 0;

  constructor(
    private readonly viewW: number,
    private readonly viewH: number,
  ) {}

  follow(target: Target, worldW: number, worldH: number) {
    const cx = target.x + target.w / 2 - this.viewW / 2;
    const cy = target.y + target.h / 2 - this.viewH / 2;
    this.x = clamp(cx, 0, Math.max(0, worldW - this.viewW));
    this.y = clamp(cy, 0, Math.max(0, worldH - this.viewH));
  }
}
