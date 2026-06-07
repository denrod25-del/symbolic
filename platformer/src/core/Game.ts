import { Player } from '../entities/Player';
import { DEFAULT_BINDINGS, Input } from '../input/Input';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, TILE_SIZE } from './constants';

/**
 * TEMPORARY ground line. Lets gravity and jumping be tested before real
 * tile-based collision lands in milestone 3, at which point this is removed.
 */
const FLOOR_Y = CANVAS_HEIGHT - TILE_SIZE * 2;

/**
 * Owns the game state and the update/render split.
 *
 * Milestone 2 scope: a movable player with gravity and a basic jump, resting on
 * a temporary floor. Render never mutates state; update never touches the canvas.
 */
export class Game {
  private elapsed = 0;
  private ticks = 0;
  private readonly input = new Input(DEFAULT_BINDINGS);
  private readonly player = new Player(48, FLOOR_Y - 24);

  constructor() {
    this.input.attach();
  }

  update(dt: number) {
    this.elapsed += dt;
    this.ticks += 1;

    this.player.update(dt, this.input);
    this.resolveTempGround();
    this.clampToScreen();
  }

  /** TEMPORARY: a single floor line. Replaced by tile collision in milestone 3. */
  private resolveTempGround() {
    const feet = this.player.y + this.player.h;
    if (feet >= FLOOR_Y) {
      this.player.y = FLOOR_Y - this.player.h;
      this.player.vy = 0;
      this.player.onGround = true;
    } else {
      this.player.onGround = false;
    }
  }

  /** TEMPORARY: keep the player on-screen horizontally until a real level exists. */
  private clampToScreen() {
    this.player.x = Math.max(0, Math.min(this.player.x, CANVAS_WIDTH - this.player.w));
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y);

    this.player.draw(ctx);
    this.renderDebug(ctx);
  }

  /** Counters + live velocity so you can feel the physics while tuning. */
  private renderDebug(ctx: CanvasRenderingContext2D) {
    const beat = Math.sin(this.elapsed * 4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${(0.25 + beat * 0.75).toFixed(3)})`;
    ctx.fillRect(CANVAS_WIDTH - 20, 12, 8, 8);

    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`ticks: ${this.ticks}`, 8, 8);
    ctx.fillText(`vx: ${this.player.vx.toFixed(0)}  vy: ${this.player.vy.toFixed(0)}`, 8, 22);
    ctx.fillText(`grounded: ${this.player.onGround}`, 8, 36);
  }
}
