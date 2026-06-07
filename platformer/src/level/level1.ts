/**
 * Level 1: a wider test level (48x15 tiles, ~2 screens) so the camera has room
 * to scroll. Continuous ground (no pits yet — falling-death lands in milestone
 * 8), side walls, and platforms scattered to test collision and scrolling.
 *
 * Legend:
 *   X = solid tile      . = empty
 *   P = player start    C = coin (milestone 6)
 *   E = enemy spawn     G = goal flag (milestone 8)
 */
export const LEVEL_1: readonly string[] = [
  'X..............................................X',
  'X..............................................X',
  'X..............................................X',
  'X..............................................X',
  'X..............................................X',
  'X..............................................X',
  'X.....................XXXXX....................X',
  'X.......................................XXXX...X',
  'X.....XXXX.....................................X',
  'X.............................XXXX.............X',
  'X.............XXXX.............................X',
  'X.....................................XXX......X',
  'X.P............................................X',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
];
