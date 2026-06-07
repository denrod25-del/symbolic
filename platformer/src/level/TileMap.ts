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
  /** Top-left pixel of each mushroom tile, for spawning power-ups. */
  readonly mushroomSpawns: ReadonlyArray<{ x: number; y: number }>;
  /** Top-left pixel of the goal tile, or null if the level has no goal. */
  readonly goal: { x: number; y: number } | null;
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
    let goal: { x: number; y: number } | null = null;
    const coins: { x: number; y: number }[] = [];
    const enemies: { x: number; y: number }[] = [];
    const mushrooms: { x: number; y: number }[] = [];
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
        } else if (ch === 'M') {
          mushrooms.push({ x, y });
        } else if (ch === 'G') {
          goal = { x, y };
        }
      }
    });
    this.playerStart = start;
    this.coinSpawns = coins;
    this.enemySpawns = enemies;
    this.mushroomSpawns = mushrooms;
    this.goal = goal;
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

  draw(ctx: CanvasRenderingContext2D) {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.tiles[row * this.cols + col] !== 'solid') continue;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const exposed = !this.isSolid(col, row - 1); // grass only on exposed tops

        ctx.fillStyle = COLORS.dirt;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Subtle dirt speckle so large fills aren't flat.
        ctx.fillStyle = COLORS.dirtDark;
        ctx.fillRect(x + 3, y + 8, 2, 2);
        ctx.fillRect(x + 10, y + 11, 2, 2);

        if (exposed) {
          ctx.fillStyle = COLORS.grass;
          ctx.fillRect(x, y, TILE_SIZE, 5);
          ctx.fillStyle = COLORS.grassDark;
          ctx.fillRect(x, y + 5, TILE_SIZE, 1);
        }
      }
    }
  }
}
