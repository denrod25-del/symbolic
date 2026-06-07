import { Sfx } from '../audio/Sfx';
import { Coin } from '../entities/Coin';
import { Enemy } from '../entities/Enemy';
import { MovingPlatform } from '../entities/MovingPlatform';
import { Mushroom } from '../entities/Mushroom';
import { Player } from '../entities/Player';
import { DEFAULT_BINDINGS, Input } from '../input/Input';
import { LEVELS } from '../level/levels';
import { TileMap } from '../level/TileMap';
import { overlaps, type Rect } from '../physics/aabb';
import { moveAndCollide, resolveAgainstBox } from '../physics/collision';
import { Camera } from './Camera';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLORS, STOMP_BOUNCE, TILE_SIZE } from './constants';

type GameState = 'title' | 'playing' | 'won' | 'dead';

/** Background clouds at fixed world positions, drawn with parallax. */
const CLOUDS = [
  { x: 60, y: 40 },
  { x: 260, y: 70 },
  { x: 460, y: 30 },
  { x: 640, y: 80 },
] as const;

/**
 * Owns the game state and the update/render split.
 *
 * Runs a sequence of levels: reach the goal to advance, clear the last level to
 * win, fall in a pit or touch an enemy to die. Render never mutates state; update
 * never touches the canvas.
 */
export class Game {
  private readonly input = new Input(DEFAULT_BINDINGS);
  private readonly sfx = new Sfx();
  private readonly camera = new Camera(CANVAS_WIDTH, CANVAS_HEIGHT);
  private readonly player = new Player(0, 0);

  private map!: TileMap;
  private spawn = { x: 0, y: 0 };
  private goalRect: Rect | null = null;
  private coins: Coin[] = [];
  private enemies: Enemy[] = [];
  private mushrooms: Mushroom[] = [];
  private platforms: MovingPlatform[] = [];
  private riding: MovingPlatform | null = null;

  private currentLevel = 0;
  private coinCount = 0;
  private state: GameState = 'title';
  private prevJump = false;

  constructor() {
    this.input.attach();
    this.loadLevel(0);
  }

  /** Builds all per-level state from `LEVELS[index]` and repositions the player. */
  private loadLevel(index: number) {
    this.currentLevel = index;
    const data = LEVELS[index];
    if (!data) return;

    this.map = new TileMap(data.layout);
    const s = this.map.playerStart;
    // Place feet on the start tile; uses the current height so a powered player
    // carried into the next level still lands correctly.
    this.spawn = { x: s.x, y: s.y + TILE_SIZE - this.player.h };
    this.player.x = this.spawn.x;
    this.player.y = this.spawn.y;
    this.player.vx = 0;
    this.player.vy = 0;

    this.coins = this.map.coinSpawns.map((c) => new Coin(c.x, c.y));
    this.enemies = this.map.enemySpawns.map((e) => new Enemy(e.x, e.y));
    this.mushrooms = this.map.mushroomSpawns.map((m) => new Mushroom(m.x, m.y));
    this.platforms = data.platforms.map((p) => new MovingPlatform(p));
    this.riding = null;
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
    for (const platform of this.platforms) platform.update(dt);

    // Carry the player along with the platform they were riding last frame.
    if (this.riding) {
      this.player.x += this.riding.dx;
      this.player.y += this.riding.dy;
    }

    this.player.update(dt, this.input);
    if (this.player.justJumped) this.sfx.jump();
    moveAndCollide(this.player, this.map, dt);

    // Resolve against moving platforms; remember any we're standing on.
    this.riding = null;
    for (const platform of this.platforms) {
      if (resolveAgainstBox(this.player, platform) === 'top') {
        this.player.onGround = true;
        this.riding = platform;
      }
    }

    this.camera.follow(this.player, this.map.pixelWidth, this.map.pixelHeight);

    for (const coin of this.coins) {
      coin.update(dt);
      if (!coin.collected && overlaps(this.player, coin)) {
        coin.collected = true;
        this.coinCount += 1;
        this.sfx.coin();
      }
    }

    for (const mushroom of this.mushrooms) {
      mushroom.update(dt);
      if (!mushroom.collected && overlaps(this.player, mushroom)) {
        mushroom.collected = true;
        this.player.grow();
        this.sfx.powerup();
      }
    }

    for (const enemy of this.enemies) {
      enemy.update(dt, this.map);
      if (!enemy.alive || !overlaps(this.player, enemy)) continue;

      const stomped =
        this.player.vy > 0 && this.player.y + this.player.h - enemy.y < enemy.h * 0.6;
      if (stomped) {
        enemy.alive = false;
        this.player.vy = -STOMP_BOUNCE;
        this.sfx.stomp();
      } else {
        // Powered players shrink (with brief invincibility) instead of dying.
        const result = this.player.hit();
        if (result === 'died') {
          this.die();
          return;
        }
        if (result === 'shrank') this.sfx.hurt();
      }
    }

    if (this.player.y > this.map.pixelHeight) {
      this.die();
      return;
    }

    if (this.goalRect && overlaps(this.player, this.goalRect)) {
      this.reachGoal();
    }
  }

  private reachGoal() {
    if (this.currentLevel + 1 < LEVELS.length) {
      this.loadLevel(this.currentLevel + 1);
    } else {
      this.state = 'won';
      this.sfx.win();
    }
  }

  private die() {
    this.state = 'dead';
    this.sfx.die();
  }

  private justPressedJump(): boolean {
    return this.input.isDown('jump') && !this.prevJump;
  }

  /** Starts a fresh run from the first level. */
  private restart() {
    this.coinCount = 0;
    this.player.depower();
    this.loadLevel(0);
    this.state = 'playing';
  }

  render(ctx: CanvasRenderingContext2D) {
    this.drawBackground(ctx);

    ctx.save();
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
    this.map.draw(ctx);
    this.drawGoal(ctx);
    for (const platform of this.platforms) platform.draw(ctx);
    for (const coin of this.coins) coin.draw(ctx);
    for (const mushroom of this.mushrooms) mushroom.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx);
    this.player.draw(ctx);
    ctx.restore();

    this.renderHud(ctx);
    if (this.state !== 'playing') this.renderOverlay(ctx);
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    sky.addColorStop(0, COLORS.skyTop);
    sky.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = COLORS.cloud;
    const parallax = this.camera.x * 0.4;
    const span = CANVAS_WIDTH + 80;
    for (const cloud of CLOUDS) {
      const x = (((cloud.x - parallax) % span) + span) % span - 40;
      this.drawCloud(ctx, x, cloud.y);
    }
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.arc(x + 12, y + 2, 13, 0, Math.PI * 2);
    ctx.arc(x + 26, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGoal(ctx: CanvasRenderingContext2D) {
    const goal = this.map.goal;
    if (!goal) return;
    const poleX = goal.x + 7;
    const top = goal.y - TILE_SIZE;

    ctx.fillStyle = COLORS.pole;
    ctx.fillRect(poleX, top, 2, TILE_SIZE * 2);
    ctx.fillStyle = COLORS.goal;
    ctx.beginPath();
    ctx.moveTo(poleX, top);
    ctx.lineTo(poleX + 14, top + 4);
    ctx.lineTo(poleX, top + 8);
    ctx.closePath();
    ctx.fill();
  }

  private renderHud(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.coin;
    ctx.fillRect(10, 10, 10, 10);
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`x ${this.coinCount}`, 26, 10);

    ctx.textAlign = 'right';
    ctx.fillText(`LV ${this.currentLevel + 1}/${LEVELS.length}`, CANVAS_WIDTH - 10, 10);
  }

  private renderOverlay(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'title') {
      ctx.font = 'bold 26px monospace';
      ctx.fillText('PLATFORMER', cx, cy - 24);
      ctx.font = '11px monospace';
      ctx.fillText('Arrows / WASD to move  -  Space to jump', cx, cy + 4);
      ctx.fillText('Stomp enemies, grab coins, reach the flag', cx, cy + 20);
      ctx.fillText('Press Space to start', cx, cy + 40);
      return;
    }

    ctx.font = 'bold 24px monospace';
    ctx.fillText(this.state === 'won' ? 'YOU WIN!' : 'GAME OVER', cx, cy - 16);

    ctx.font = '11px monospace';
    if (this.state === 'won') {
      ctx.fillText(`Coins collected: ${this.coinCount}`, cx, cy + 8);
    }
    ctx.fillText('Press Jump (Space) to play again', cx, cy + 24);
  }
}
