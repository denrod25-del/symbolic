/**
 * Level 1: a wider test level (48x15 tiles, ~2 screens) with platforms and coins.
 * Continuous ground (no pits yet — falling-death lands in milestone 8) and side
 * walls keep the player inside while there's no goal.
 *
 * Legend:
 *   X = solid tile      . = empty
 *   P = player start    C = coin
 *   E = enemy spawn (milestone 7)    G = goal flag (milestone 8)
 */
export const LEVEL_1: readonly string[] = [
  'X..............................................X',
  'X..............................................X',
  'X..............................................X',
  'X..............................................X',
  'X..............................................X',
  'X.....................CCCCC....................X',
  'X.....................XXXXX.............CCCC...X',
  'X.....CCCC..............................XXXX...X',
  'X.....XXXX.....................................X',
  'X.............CCC.............XXXX.............X',
  'X.............XXXX...............CCC...........X',
  'X.....................................XXX......X',
  'X.P.....CCC....................................X',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
];
