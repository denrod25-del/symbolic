import { Coin } from '../entities/Coin';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { DEFAULT_BINDINGS, Input } from '../input/Input';
import { LEVEL_1 } from '../level/level1';
import { TileMap } from '../level/TileMap';
import { overlaps, type Rect } from '../physics/aabb';
import { moveAndCollide } from '../physics/collision';
import { Camera } from './Camera';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  PLAYER_H,
  STOMP_BOUNCE,
  TILE_SIZE,
} from './constants';

type GameState = 'playing' | 'won' | 'dead';

/**
 * Owns the game state and the update/render split.
 *
 * Milestone 8 scope: a complete play loop — run to the goal flag to win, fall in
 * the pit or touch an enemy to die, press jump to restart. Render never mutates
 * state; update never touches the canvas.
 */
export class Game {
  private readonly input = new Input(DEFAULT_BINDINGS);
  private readonly map = new TileMap(LEVEL_1);
  private readonly camera = new Camera(CANVAS_WIDTH, CANVAS_HEIGHT);
  private readonly player: Player;
  private readonly spawn: { x: number; y: number };
  private readonly goalRect: Rect | null;
  private readonly totalCoins: number;

  private coins: Coin[];
  private enemies: Enemy[];
  private coinCount = 0;
  private state: GameState = 'playing';
  private prevJump = false;

  constructor() {
    this.input.attach();
    // Spawn so the player's feet sit on the bottom of the start tile.
    const start = this.map.playerStart;
    this.spawn = { x: start.x, y: start.y + TILE_SIZE - PLAYER_H };
    this.player = new Player(this.spawn.x, this.spawn.y);
    this.coins = this.map.coinSpawns.map((c) => new Coin(c.x, c.y));
    this.enemies = this.map.enemySpawns.map((e) => new Enemy(e.x, e.y));
    this.totalCoins = this.coins.length;
    this.goalRect = this.map.goal
      ? { x: this.map.goal.x, y: this.map.goal.y - TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE * 2 }
      : null;
  }

  update(dt: number) {
    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.justPressedJump()) {
      this.restart();
    }
    this.prevJump = this.input.isDown('jump');
  }

  private updatePlaying(dt: number) {
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

    for (const enemy of this.enemies) {
      enemy.update(dt, this.map);
      if (!enemy.alive || !overlaps(this.player, enemy)) continue;

      // Stomp: falling onto the enemy's upper half kills it and bounces you.
      const stomped =
        this.player.vy > 0 && this.player.y + this.player.h - enemy.y < enemy.h * 0.6;
      if (stomped) {
        enemy.alive = false;
        this.player.vy = -STOMP_BOUNCE;
      } else {
        this.state = 'dead';
        return;
      }
    }

    // Fell into the pit / off the bottom of the world.
    if (this.player.y > this.map.pixelHeight) {
      this.state = 'dead';
      return;
    }

    // Reached the goal.
    if (this.goalRect && overlaps(this.player, this.goalRect)) {
      this.state = 'won';
    }
  }

  /** Rising edge of the jump key, used to dismiss the win/lose screen. */
  private justPressedJump(): boolean {
    return this.input.isDown('jump') && !this.prevJump;
  }

  private restart() {
    this.player.x = this.spawn.x;
    this.player.y = this.spawn.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.coins = this.map.coinSpawns.map((c) => new Coin(c.x, c.y));
    this.enemies = this.map.enemySpawns.map((e) => new Enemy(e.x, e.y));
    this.coinCount = 0;
    this.state = 'playing';
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    this.map.draw(ctx);
    this.drawGoal(ctx);
    for (const coin of this.coins) coin.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx);
    this.player.draw(ctx);
    ctx.restore();

    this.renderHud(ctx);
    if (this.state !== 'playing') this.renderOverlay(ctx);
  }

  private drawGoal(ctx: CanvasRenderingContext2D) {
    const goal = this.map.goal;
    if (!goal) return;
    // Pole from one tile above the goal down to the ground, with a flag on top.
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(goal.x + 7, goal.y - TILE_SIZE, 2, TILE_SIZE * 2);
    ctx.fillStyle = COLORS.goal;
    ctx.fillRect(goal.x + 9, goal.y - TILE_SIZE, 10, 7);
  }

  /** Coin counter — a gold pip plus the running tally. */
  private renderHud(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.coin;
    ctx.fillRect(10, 10, 10, 10);
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`x ${this.coinCount}`, 26, 10);
  }

  private renderOverlay(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 24px monospace';
    ctx.fillText(this.state === 'won' ? 'YOU WIN!' : 'GAME OVER', cx, CANVAS_HEIGHT / 2 - 16);

    ctx.font = '11px monospace';
    if (this.state === 'won') {
      ctx.fillText(`Coins: ${this.coinCount}/${this.totalCoins}`, cx, CANVAS_HEIGHT / 2 + 8);
    }
    ctx.fillText('Press Jump (Space) to play again', cx, CANVAS_HEIGHT / 2 + 24);
  }
}
