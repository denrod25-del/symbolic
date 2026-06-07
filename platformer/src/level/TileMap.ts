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
  /** Top-left pixel of each coin tile, for spawning Coin entities. */
  readonly coinSpawns: ReadonlyArray<{ x: number; y: number }>;
  /** Top-left pixel of each enemy tile, for spawning Enemy entities. */
  readonly enemySpawns: ReadonlyArray<{ x: number; y: number }>;
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
    const coins: { x: number; y: number }[] = [];
    const enemies: { x: number; y: number }[] = [];
    layout.forEach((line, row) => {
      for (let col = 0; col < this.cols; col++) {
        const ch = line[col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        if (ch === 'X') {
          this.tiles[row * this.cols + col] = 'solid';
        } else if (ch === 'P') {
          start = { x, y };
        } else if (ch === 'C') {
          coins.push({ x, y });
        } else if (ch === 'E') {
          enemies.push({ x, y });
        }
        // G is recognised by the legend but treated as empty until milestone 8
        // wires up the goal.
      }
    });
    this.playerStart = start;
    this.coinSpawns = coins;
    this.enemySpawns = enemies;
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
