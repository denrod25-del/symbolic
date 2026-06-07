import { Coin } from '../entities/Coin';
import { Player } from '../entities/Player';
import { DEFAULT_BINDINGS, Input } from '../input/Input';
import { LEVEL_1 } from '../level/level1';
import { TileMap } from '../level/TileMap';
import { overlaps } from '../physics/aabb';
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
  private readonly input = new Input(DEFAULT_BINDINGS);
  private readonly map = new TileMap(LEVEL_1);
  private readonly camera = new Camera(CANVAS_WIDTH, CANVAS_HEIGHT);
  private readonly player: Player;
  private readonly coins: Coin[];
  private coinCount = 0;

  constructor() {
    this.input.attach();
    // Spawn so the player's feet sit on the bottom of the start tile.
    const start = this.map.playerStart;
    this.player = new Player(start.x, start.y + TILE_SIZE - PLAYER_H);
    this.coins = this.map.coinSpawns.map((c) => new Coin(c.x, c.y));
  }

  update(dt: number) {
    this.player.update(dt, this.input);
    moveAndCollide(this.player, this.map, dt);
    this.camera.follow(this.player, this.map.pixelWidth, this.map.pixelHeight);

    for (const coin of this.coins) {
      coin.update(dt);
      if (!coin.collected && overlaps(this.player, coin)) {
        coin.collected = true;
        this.coinCount += 1;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // World space: shift everything by the camera offset (rounded to whole
    // pixels to avoid tile seams / jitter), then draw the level and entities.
    ctx.save();
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    this.map.draw(ctx);
    for (const coin of this.coins) coin.draw(ctx);
    this.player.draw(ctx);
    ctx.restore();

    // Screen space: the HUD stays put.
    this.renderHud(ctx);
    this.renderDebug(ctx);
  }

  /** Coin counter — a gold pip plus the running tally. */
  private renderHud(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.coin;
    ctx.fillRect(10, 10, 10, 10);
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`x ${this.coinCount}`, 26, 10);
  }

  /** Debug readout for tuning physics. */
  private renderDebug(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`vx: ${this.player.vx.toFixed(0)}  vy: ${this.player.vy.toFixed(0)}`, 10, 28);
    ctx.fillText(`grounded: ${this.player.onGround}`, 10, 40);
  }
}
