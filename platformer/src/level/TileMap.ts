import { COLORS, TILE_SIZE } from '../core/constants';

type Tile = 'empty' | 'solid';

/**
 * A grid of tiles parsed from a string-art level (see `level1.ts` for the
 * legend). Tile-based maps make collision cheap: instead of testing every
 * object, an actor only checks the handful of tiles its hitbox overlaps.
 */
export class TileMap {
  readonly cols: number;
  readonly rows: number;
  readonly playerStart: { x: number; y: number };
  private readonly tiles: Tile[];

  constructor(layout: readonly string[]) {
    const width = layout[0]?.length ?? 0;
    if (width === 0 || layout.some((row) => row.length !== width)) {
      throw new Error('TileMap: every row must be the same non-zero length');
    }

    this.cols = width;
    this.rows = layout.length;
    this.tiles = new Array<Tile>(this.cols * this.rows).fill('empty');

    let start = { x: TILE_SIZE, y: TILE_SIZE };
    layout.forEach((line, row) => {
      for (let col = 0; col < this.cols; col++) {
        const ch = line[col];
        if (ch === 'X') {
          this.tiles[row * this.cols + col] = 'solid';
        } else if (ch === 'P') {
          start = { x: col * TILE_SIZE, y: row * TILE_SIZE };
        }
        // C / E / G are recognised by the legend but treated as empty until
        // milestones 6–8 wire up coins, enemies, and the goal.
      }
    });
    this.playerStart = start;
  }

  get pixelWidth() {
    return this.cols * TILE_SIZE;
  }

  get pixelHeight() {
    return this.rows * TILE_SIZE;
  }

  /** Solid only inside bounds; everything outside the grid is empty (open air). */
  isSolid(col: number, row: number): boolean {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.tiles[row * this.cols + col] === 'solid';
  }

  draw(ctx: CanvasRenderingContext2D, cameraX = 0, cameraY = 0) {
    ctx.fillStyle = COLORS.ground;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.tiles[row * this.cols + col] === 'solid') {
          ctx.fillRect(
            col * TILE_SIZE - cameraX,
            row * TILE_SIZE - cameraY,
            TILE_SIZE,
            TILE_SIZE,
          );
        }
      }
    }
  }
}
