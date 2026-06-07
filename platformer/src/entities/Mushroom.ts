import { COLORS, TILE_SIZE } from '../core/constants';

const SIZE = 14;

/**
 * A stationary power-up. Collecting it grows the player (the Game does the
 * overlap test and calls `player.grow()`); the mushroom just bobs and hides once
 * taken.
 */
export class Mushroom {
  readonly x: number;
  readonly y: number;
  readonly w = SIZE;
  readonly h = SIZE;
  collected = false;

  private bob = 0;

  constructor(tileX: number, tileY: number) {
    this.x = tileX + (TILE_SIZE - SIZE) / 2;
    this.y = tileY + (TILE_SIZE - SIZE) / 2;
  }

  update(dt: number) {
    this.bob += dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.collected) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y + Math.sin(this.bob * 4) * 1.5);

    // Stem.
    ctx.fillStyle = COLORS.mushroomStem;
    ctx.fillRect(x + 3, y + 7, SIZE - 6, 7);

    // Red dome.
    ctx.fillStyle = COLORS.mushroomCap;
    ctx.beginPath();
    ctx.arc(x + SIZE / 2, y + 7, SIZE / 2, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x, y + 7, SIZE, 2);

    // White spots.
    ctx.fillStyle = COLORS.mushroomSpot;
    ctx.fillRect(x + 3, y + 4, 2, 2);
    ctx.fillRect(x + SIZE - 5, y + 4, 2, 2);
  }
}
