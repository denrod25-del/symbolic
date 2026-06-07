import { COLORS, TILE_SIZE } from '../core/constants';
import type { MovingPlatformSpec } from '../level/levels';

/**
 * A solid platform that ping-pongs along one axis. It exposes the per-frame
 * delta (`dx`/`dy`) it moved so the Game can carry a rider along with it.
 */
export class MovingPlatform {
  x: number;
  y: number;
  readonly w: number;
  readonly h = TILE_SIZE;
  dx = 0;
  dy = 0;

  private readonly originX: number;
  private readonly originY: number;
  private readonly axis: 'x' | 'y';
  private readonly range: number;
  private readonly speed: number;
  private t = 0;
  private dir: 1 | -1 = 1;

  constructor(spec: MovingPlatformSpec) {
    this.originX = spec.col * TILE_SIZE;
    this.originY = spec.row * TILE_SIZE;
    this.x = this.originX;
    this.y = this.originY;
    this.w = spec.wTiles * TILE_SIZE;
    this.axis = spec.axis;
    this.range = spec.rangeTiles * TILE_SIZE;
    this.speed = spec.speed;
  }

  update(dt: number) {
    const prevX = this.x;
    const prevY = this.y;

    this.t += this.dir * this.speed * dt;
    if (this.t >= this.range) {
      this.t = this.range;
      this.dir = -1;
    } else if (this.t <= 0) {
      this.t = 0;
      this.dir = 1;
    }

    if (this.axis === 'x') this.x = this.originX + this.t;
    else this.y = this.originY + this.t;

    this.dx = this.x - prevX;
    this.dy = this.y - prevY;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    ctx.fillStyle = COLORS.platform;
    ctx.fillRect(x, y, this.w, this.h);
    ctx.fillStyle = COLORS.platformEdge;
    ctx.fillRect(x, y, this.w, 3);
  }
}
