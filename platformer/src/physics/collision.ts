import { TILE_SIZE } from '../core/constants';
import type { TileMap } from '../level/TileMap';
import { overlaps, type Rect } from './aabb';

/** An axis-aligned box that moves through the world with a velocity. */
export type Body = {
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;
  vx: number;
  vy: number;
  onGround: boolean;
};

/**
 * Pushes a body out of a solid box along the axis of least penetration (minimal
 * translation vector) and zeroes the relevant velocity. Returns which side of
 * the box the body ended up on, or null if they weren't overlapping. Used for
 * moving platforms, where the solid isn't part of the tile grid.
 */
export function resolveAgainstBox(body: Body, box: Rect): 'top' | 'bottom' | 'side' | null {
  if (!overlaps(body, box)) return null;

  const fromLeft = body.x + body.w - box.x;
  const fromRight = box.x + box.w - body.x;
  const fromTop = body.y + body.h - box.y;
  const fromBottom = box.y + box.h - body.y;

  const minX = Math.min(fromLeft, fromRight);
  const minY = Math.min(fromTop, fromBottom);

  if (minX < minY) {
    body.x += fromLeft < fromRight ? -fromLeft : fromRight;
    body.vx = 0;
    return 'side';
  }
  if (fromTop < fromBottom) {
    body.y -= fromTop;
    body.vy = 0;
    return 'top';
  }
  body.y += fromBottom;
  body.vy = 0;
  return 'bottom';
}

/**
 * Moves a body through the tilemap one axis at a time, resolving overlaps with
 * solid tiles.
 *
 * Axis separation is what makes tile collision simple and robust: we move on X
 * and push the body out of any wall it hit, then move on Y and push it out of
 * any floor/ceiling. Doing both at once makes corners ambiguous; separating them
 * does not.
 *
 * Assumes per-step movement stays under one tile (true for our speeds at 60Hz),
 * so we only need to check the leading edge — no swept/tunnelling handling yet.
 */
export function moveAndCollide(body: Body, map: TileMap, dt: number) {
  // --- Horizontal ---
  body.x += body.vx * dt;
  if (body.vx > 0) {
    const col = Math.floor((body.x + body.w) / TILE_SIZE);
    if (columnSolid(map, col, body.y, body.h)) {
      body.x = col * TILE_SIZE - body.w;
      body.vx = 0;
    }
  } else if (body.vx < 0) {
    const col = Math.floor(body.x / TILE_SIZE);
    if (columnSolid(map, col, body.y, body.h)) {
      body.x = (col + 1) * TILE_SIZE;
      body.vx = 0;
    }
  }

  // --- Vertical ---
  body.onGround = false;
  body.y += body.vy * dt;
  if (body.vy > 0) {
    const row = Math.floor((body.y + body.h) / TILE_SIZE);
    if (rowSolid(map, row, body.x, body.w)) {
      body.y = row * TILE_SIZE - body.h;
      body.vy = 0;
      body.onGround = true;
    }
  } else if (body.vy < 0) {
    const row = Math.floor(body.y / TILE_SIZE);
    if (rowSolid(map, row, body.x, body.w)) {
      body.y = (row + 1) * TILE_SIZE;
      body.vy = 0;
    }
  }
}

/** True if any tile in column `col` is solid across the vertical span [top, top+height). */
function columnSolid(map: TileMap, col: number, top: number, height: number): boolean {
  const first = Math.floor(top / TILE_SIZE);
  const last = Math.floor((top + height - 1) / TILE_SIZE);
  for (let row = first; row <= last; row++) {
    if (map.isSolid(col, row)) return true;
  }
  return false;
}

/** True if any tile in row `row` is solid across the horizontal span [left, left+width). */
function rowSolid(map: TileMap, row: number, left: number, width: number): boolean {
  const first = Math.floor(left / TILE_SIZE);
  const last = Math.floor((left + width - 1) / TILE_SIZE);
  for (let col = first; col <= last; col++) {
    if (map.isSolid(col, row)) return true;
  }
  return false;
}
