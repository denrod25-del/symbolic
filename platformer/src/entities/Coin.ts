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
    ctx.fillStyle = COLORS.coin;
    ctx.fillRect(Math.round(this.x), Math.round(this.y + bobOffset), this.w, this.h);
  }
}
