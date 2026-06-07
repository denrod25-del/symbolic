import {
  COLORS,
  ENEMY_SPEED,
  GRAVITY,
  MAX_FALL_SPEED,
  TILE_SIZE,
} from '../core/constants';
import type { TileMap } from '../level/TileMap';
import { moveAndCollide } from '../physics/collision';

/**
 * A Goomba-style patrolling enemy. Walks in one direction, turning around when
 * it hits a wall or reaches the edge of a platform (a "look-ahead" sensor checks
 * for ground just beyond its leading foot). Uses the same tile collision as the
 * player, so it stands on platforms and respects walls for free.
 */
export class Enemy {
  x: number;
  y: number;
  readonly w = TILE_SIZE;
  readonly h = TILE_SIZE;
  vx: number;
  vy = 0;
  onGround = false;
  alive = true;

  private dir: 1 | -1 = -1; // start walking left

  constructor(tileX: number, tileY: number) {
    this.x = tileX;
    this.y = tileY;
    this.vx = this.dir * ENEMY_SPEED;
  }

  update(dt: number, map: TileMap) {
    if (!this.alive) return;

    this.vx = this.dir * ENEMY_SPEED;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL_SPEED);
    moveAndCollide(this, map, dt);

    // Turn around at a wall (collision zeroed our speed) or at a ledge.
    if (this.vx === 0 || (this.onGround && this.atLedge(map))) {
      this.dir = this.dir === 1 ? -1 : 1;
      this.vx = this.dir * ENEMY_SPEED;
    }
  }

  /** True if there's no ground in the tile just beyond the leading foot. */
  private atLedge(map: TileMap): boolean {
    const aheadX = this.dir === 1 ? this.x + this.w + 1 : this.x - 1;
    const col = Math.floor(aheadX / TILE_SIZE);
    const rowBelow = Math.floor((this.y + this.h + 1) / TILE_SIZE);
    return !map.isSolid(col, rowBelow);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.alive) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const { w, h } = this;

    // Body (rounded-ish: trim the top corners).
    ctx.fillStyle = COLORS.enemy;
    ctx.fillRect(x + 1, y, w - 2, h - 3);
    ctx.fillRect(x, y + 2, w, h - 5);

    // Feet.
    ctx.fillStyle = COLORS.enemyFoot;
    ctx.fillRect(x + 1, y + h - 3, 5, 3);
    ctx.fillRect(x + w - 6, y + h - 3, 5, 3);

    // Eyes looking the way it walks.
    const eyeX = this.dir === 1 ? 1 : 0;
    ctx.fillStyle = COLORS.eye;
    ctx.fillRect(x + 3, y + 5, 4, 4);
    ctx.fillRect(x + w - 7, y + 5, 4, 4);
    ctx.fillStyle = COLORS.pupil;
    ctx.fillRect(x + 4 + eyeX, y + 6, 2, 2);
    ctx.fillRect(x + w - 6 + eyeX, y + 6, 2, 2);
  }
}
