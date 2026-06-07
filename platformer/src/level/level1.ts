/**
 * Milestone 3 test level: a flat floor with side walls and two small platforms,
 * sized to one screen (25x15 tiles) since there's no camera yet (milestone 4).
 *
 * Legend:
 *   X = solid tile      . = empty
 *   P = player start    C = coin (milestone 6)
 *   E = enemy spawn     G = goal flag (milestone 8)
 *
 * The platforms exist to test collision on every face: landing on top, bonking
 * your head from below, and bumping the sides. C/E/G are parsed but treated as
 * empty for now.
 */
export const LEVEL_1: readonly string[] = [
  'X.......................X',
  'X.......................X',
  'X.......................X',
  'X.......................X',
  'X.......................X',
  'X.......................X',
  'X.......................X',
  'X......XXXX.............X',
  'X.......................X',
  'X.......................X',
  'X..P.........XXXX.......X',
  'X.......................X',
  'X.......................X',
  'XXXXXXXXXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXXXXXXXXX',
];
