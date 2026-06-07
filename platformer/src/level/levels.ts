/**
 * Level definitions. Each level is a string-art `layout` plus a list of
 * `platforms` (moving platforms, which can't be expressed as static tiles).
 *
 * Layout legend:
 *   X = solid tile      . = empty
 *   P = player start    C = coin            E = enemy spawn
 *   M = mushroom        G = goal flag
 */

/** A moving platform, authored in tile units; converted to pixels at spawn. */
export type MovingPlatformSpec = {
  col: number;
  row: number;
  wTiles: number;
  axis: 'x' | 'y';
  rangeTiles: number;
  speed: number; // px/s
};

export type LevelData = {
  layout: readonly string[];
  platforms: readonly MovingPlatformSpec[];
};

const LEVEL_1: LevelData = {
  layout: [
    'X..............................................X',
    'X..............................................X',
    'X..............................................X',
    'X..............................................X',
    'X..............................................X',
    'X.....................CCCCC....................X',
    'X.....................XXXXX.............CCCC...X',
    'X.....CCCC..............................XXXX...X',
    'X.....XXXX.....................E...............X',
    'X.............CCC.............XXXX.............X',
    'X.............XXXX...............CCC...........X',
    'X.....................................XXX......X',
    'X.P..M..CCC.......E...............E..........G.X',
    'XXXXXXXXXXXXXXXXXXXXXXXX...XXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXX...XXXXXXXXXXXXXXXXXXXXX',
  ],
  platforms: [{ col: 10, row: 11, wTiles: 2, axis: 'x', rangeTiles: 3, speed: 35 }],
};

const LEVEL_2: LevelData = {
  layout: [
    'X..............................................X',
    'X..............................................X',
    'X..............................................X',
    'X..............................................X',
    'X..............................................X',
    'X....................................CCC.......X',
    'X.........CCC........................XXX.......X',
    'X.........XXX..................................X',
    'X....CCC..................................XXX..X',
    'X....XXX......................CECC.............X',
    'X.............................XXXX.............X',
    'X................................CC............X',
    'X.P.....M...E..CCC......................E....G.X',
    'XXXXXXXXXXXXXXXXXXXXX......XXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXX......XXXXXXXXXXXXXXXXXXXXX',
  ],
  // Horizontal ferry across the wide pit, plus a vertical lift on the right.
  platforms: [
    { col: 20, row: 12, wTiles: 3, axis: 'x', rangeTiles: 4, speed: 40 },
    { col: 36, row: 9, wTiles: 2, axis: 'y', rangeTiles: 3, speed: 30 },
  ],
};

export const LEVELS: readonly LevelData[] = [LEVEL_1, LEVEL_2];
