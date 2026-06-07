import { COLORS, TILE_SIZE } from '../core/constants';

const COIN_SIZE = 10;

/**
 * A collectible coin, centred in its tile with a gentle bob so it reads as
 * pickup-able. Collection (the overlap test) is the Game's job; the coin just
 * tracks whether it's been taken and stops drawing once it has.
 */
export class Coin {
  readonly x: number;
  readonly y: number;
  readonly w = COIN_SIZE;
  readonly h = COIN_SIZE;
  collected = false;

  private bob = 0;

  /** `tileX`/`tileY` are the top-left pixel of the coin's tile. */
  constructor(tileX: number, tileY: number) {
    this.x = tileX + (TILE_SIZE - COIN_SIZE) / 2;
    this.y = tileY + (TILE_SIZE - COIN_SIZE) / 2;
  }

  update(dt: number) {
    this.bob += dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.collected) return;
    const bobOffset = Math.sin(this.bob * 4) * 2;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2 + bobOffset;
    const r = this.w / 2;

    // Horizontal "spin" — squash the width on a slow cycle.
    const squash = Math.abs(Math.cos(this.bob * 2));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.25, squash), 1);

    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.coinShine;
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
