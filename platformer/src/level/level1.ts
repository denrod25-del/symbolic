/**
 * Level 1: a start-to-finish level (48x15 tiles, ~2 screens). Run from the left
 * spawn, over platforms and past enemies, across the pit, to the goal flag on
 * the right. Falling into the pit (off the bottom of the world) is death.
 *
 * Legend:
 *   X = solid tile      . = empty
 *   P = player start    C = coin            E = enemy spawn
 *   G = goal flag
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
  'X.....XXXX.....................E...............X',
  'X.............CCC.............XXXX.............X',
  'X.............XXXX...............CCC...........X',
  'X.....................................XXX......X',
  'X.P.....CCC.......E...............E..........G.X',
  'XXXXXXXXXXXXXXXXXXXXXXXX...XXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXX...XXXXXXXXXXXXXXXXXXXXX',
];
