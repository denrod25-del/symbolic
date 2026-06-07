import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS } from './constants';

/**
 * Owns the game state and the update/render split.
 *
 * Milestone 1 scope: prove the loop runs and draw a placeholder player. Real
 * movement (milestone 2), collision (milestone 3), and everything else slot in
 * by growing `update` and `render` — render must never mutate state, and update
 * must never touch the canvas.
 */
export class Game {
  private elapsed = 0;
  private ticks = 0;

  /** Placeholder player box. Movement & input arrive in milestone 2. */
  private readonly player = {
    x: 48,
    y: CANVAS_HEIGHT - 24 - 32,
    w: 16,
    h: 24,
  };

  update(dt: number) {
    this.elapsed += dt;
    this.ticks += 1;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.player;
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);

    this.renderDebug(ctx);
  }

  /** A live heartbeat + counters so you can see the fixed-timestep loop ticking. */
  private renderDebug(ctx: CanvasRenderingContext2D) {
    const beat = Math.sin(this.elapsed * 4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${(0.25 + beat * 0.75).toFixed(3)})`;
    ctx.fillRect(CANVAS_WIDTH - 20, 12, 8, 8);

    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`ticks: ${this.ticks}`, 8, 8);
    ctx.fillText(`sim:   ${this.elapsed.toFixed(1)}s`, 8, 22);
  }
}
