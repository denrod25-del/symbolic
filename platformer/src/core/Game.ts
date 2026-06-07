import { Player } from '../entities/Player';
import { DEFAULT_BINDINGS, Input } from '../input/Input';
import { LEVEL_1 } from '../level/level1';
import { TileMap } from '../level/TileMap';
import { moveAndCollide } from '../physics/collision';
import { Camera } from './Camera';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, PLAYER_H, TILE_SIZE } from './constants';

/**
 * Owns the game state and the update/render split.
 *
 * Milestone 3 scope: a player with gravity and a basic jump, colliding against a
 * tile-based level. Render never mutates state; update never touches the canvas.
 */
export class Game {
  private elapsed = 0;
  private ticks = 0;
  private readonly input = new Input(DEFAULT_BINDINGS);
  private readonly map = new TileMap(LEVEL_1);
  private readonly camera = new Camera(CANVAS_WIDTH, CANVAS_HEIGHT);
  private readonly player: Player;

  constructor() {
    this.input.attach();
    // Spawn so the player's feet sit on the bottom of the start tile.
    const start = this.map.playerStart;
    this.player = new Player(start.x, start.y + TILE_SIZE - PLAYER_H);
  }

  update(dt: number) {
    this.elapsed += dt;
    this.ticks += 1;

    this.player.update(dt, this.input);
    moveAndCollide(this.player, this.map, dt);
    this.camera.follow(this.player, this.map.pixelWidth, this.map.pixelHeight);
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // World space: shift everything by the camera offset (rounded to whole
    // pixels to avoid tile seams / jitter), then draw the level and entities.
    ctx.save();
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    this.map.draw(ctx);
    this.player.draw(ctx);
    ctx.restore();

    // Screen space: the HUD stays put.
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
