// The three levels, built programmatically so every map is exactly 32x20 tiles.
//   # wall (blocks movement and sight)   . floor
//   C crate (cover: blocks movement and sight)   B bush (cover: hides the player inside)
//   P player start   E exit   L intel to steal   G guard spawn
// Guard patrol routes are listed per level as tile waypoints (they must be floor tiles).

export const COLS = 32;
export const ROWS = 20;

function emptyGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) row.push(r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '#' : '.');
    grid.push(row);
  }
  return grid;
}

function rect(grid, c0, r0, c1, r1, ch = '#') {
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r][c] = ch;
}

function put(grid, c, r, ch) {
  grid[r][c] = ch;
}

function putAll(grid, list, ch) {
  for (const [c, r] of list) put(grid, c, r, ch);
}

function finish(grid) {
  return grid.map((row) => row.join(''));
}

function buildLevel(name, parSeconds, build, guards) {
  const grid = emptyGrid();
  build(grid);
  return { name, parSeconds, map: finish(grid), guards };
}

export const LEVELS = [
  buildLevel(
    'The Gallery',
    90,
    (g) => {
      rect(g, 8, 5, 13, 6);
      rect(g, 8, 10, 13, 11);
      rect(g, 15, 1, 15, 4);
      rect(g, 15, 8, 15, 11);
      rect(g, 20, 5, 23, 6);
      rect(g, 20, 10, 24, 10);
      putAll(g, [[6, 1], [6, 2], [3, 5], [3, 6], [3, 10], [3, 11], [26, 6], [26, 7], [11, 13], [12, 13], [21, 17], [22, 17], [10, 17], [10, 18]], 'C');
      putAll(g, [[2, 3], [3, 3], [17, 8], [18, 8], [25, 13], [26, 13], [9, 15], [10, 15]], 'B');
      putAll(g, [[22, 1], [30, 7], [3, 8], [26, 15]], 'L');
      put(g, 1, 1, 'P');
      put(g, 29, 1, 'E');
      putAll(g, [[27, 4], [2, 13], [13, 17]], 'G');
    },
    [
      [[27, 4], [27, 9], [24, 9], [24, 4]],
      [[2, 13], [8, 13], [8, 17], [2, 17]],
      [[13, 17], [20, 17], [20, 13], [13, 13]],
    ],
  ),
  buildLevel(
    'The Vault Floor',
    120,
    (g) => {
      rect(g, 11, 1, 11, 2);
      rect(g, 11, 4, 11, 4);
      rect(g, 11, 6, 11, 11);
      rect(g, 20, 1, 20, 4);
      rect(g, 20, 6, 20, 11);
      rect(g, 14, 5, 15, 5);
      rect(g, 18, 5, 20, 5);
      putAll(g, [[12, 6], [13, 6]], 'B');
      rect(g, 26, 1, 26, 5);
      rect(g, 26, 8, 26, 11);
      putAll(g, [[6, 1], [6, 2], [3, 5], [3, 6], [3, 10], [3, 11], [8, 14], [8, 15], [16, 14], [22, 14], [22, 15], [28, 10], [28, 11], [18, 3], [15, 9], [15, 10]], 'C');
      putAll(g, [[2, 3], [3, 3], [10, 13], [11, 13], [22, 10], [23, 10], [27, 17], [28, 17], [12, 6], [13, 6], [14, 2]], 'B');
      putAll(g, [[17, 1], [28, 3], [9, 7], [27, 12], [28, 15]], 'L');
      put(g, 1, 1, 'P');
      put(g, 29, 1, 'E');
      putAll(g, [[21, 8], [3, 8], [13, 16]], 'G');
    },
    [
      [[21, 8], [25, 8], [25, 11], [21, 11]],
      [[3, 8], [3, 12], [9, 12], [9, 8]],
      [[13, 16], [19, 16], [19, 13], [13, 13]],
    ],
  ),
  buildLevel(
    "The Director's Wing",
    150,
    (g) => {
      rect(g, 10, 1, 10, 3);
      rect(g, 10, 5, 10, 7);
      rect(g, 10, 9, 10, 11);
      rect(g, 19, 1, 19, 4);
      rect(g, 19, 6, 19, 8);
      rect(g, 19, 10, 19, 11);
      rect(g, 26, 1, 26, 2);
      rect(g, 26, 4, 26, 7);
      rect(g, 26, 9, 26, 11);
      rect(g, 11, 13, 18, 13);
      putAll(g, [[5, 1], [5, 2], [3, 5], [3, 6], [4, 10], [4, 11], [13, 7], [16, 8], [22, 9], [23, 9], [13, 17], [18, 17], [28, 13], [28, 14]], 'C');
      putAll(g, [[2, 3], [3, 3], [14, 13], [15, 13], [24, 12], [25, 12], [8, 16], [9, 16]], 'B');
      putAll(g, [[15, 1], [28, 3], [6, 7], [3, 13], [28, 15], [5, 18]], 'L');
      put(g, 1, 1, 'P');
      put(g, 28, 1, 'E');
      putAll(g, [[6, 3], [22, 3], [3, 8], [16, 15], [28, 7]], 'G');
    },
    [
      [[6, 3], [6, 7], [8, 7], [8, 3]],
      [[22, 3], [24, 3], [24, 7], [22, 7]],
      [[3, 8], [3, 12], [8, 12], [8, 8]],
      [[16, 15], [21, 15], [21, 18], [16, 18]],
      [[28, 7], [28, 12], [25, 12], [25, 7]],
    ],
  ),
];

/** Tiles that block movement and line of sight. */
export function isSolidTile(ch) {
  return ch === '#' || ch === 'C';
}

/** Tiles the player can stand on (bushes hide but do not block). */
export function isWalkableTile(ch) {
  return ch !== '#' && ch !== 'C';
}
