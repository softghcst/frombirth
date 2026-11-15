// The prison escape puzzle. Pure logic: no game state, so it can be tested
// and solved on its own.

/** Where a guard stands on a given turn: along its path and back again. */
export function guardAt(guard, turn) {
  const n = guard.path.length;
  if (n === 1) return guard.path[0];
  const cycle = 2 * (n - 1);
  const k = turn % cycle;
  return guard.path[k < n ? k : cycle - k];
}

const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= 1;

/** @returns {{layout, w, h, you:number[], exit:number[], turn:number, status:'playing'|'escaped'|'caught'}} */
export function newGame(layout) {
  const h = layout.grid.length;
  const w = layout.grid[0].length;
  let you; let exit;
  layout.grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'S') you = [x, y];
    if (ch === 'E') exit = [x, y];
  }));
  return { layout, w, h, you, exit, turn: 0, status: 'playing' };
}

export const isWall = (g, x, y) => x < 0 || y < 0 || x >= g.w || y >= g.h || g.layout.grid[y][x] === '#';
export const guards = (g) => g.layout.guards.map((gd) => guardAt(gd, g.turn));
export const turnsLeft = (g) => g.layout.turns - g.turn;

/** True if standing at `pos` on `turn` gets you caught. */
function seen(layout, pos, turn) {
  return layout.guards.some((gd) => near(guardAt(gd, turn), pos));
}

/**
 * Takes one turn: move by (dx, dy), or wait with (0, 0). Walking into a wall
 * does nothing and costs no turn.
 */
export function step(g, dx, dy) {
  if (g.status !== 'playing') return g;
  const to = [g.you[0] + dx, g.you[1] + dy];
  if (isWall(g, to[0], to[1])) return g;
  g.you = to;
  g.turn += 1;
  if (to[0] === g.exit[0] && to[1] === g.exit[1]) g.status = 'escaped';
  else if (seen(g.layout, to, g.turn) || g.turn >= g.layout.turns) g.status = 'caught';
  return g;
}

/**
 * Finds the shortest way out, if there is one. Used by tests to prove every
 * layout can be beaten. @returns {?number} turns needed, or null
 */
export function solve(layout) {
  const start = newGame(layout);
  const key = (x, y, t) => `${x},${y},${t}`;
  let frontier = [start.you];
  const seenStates = new Set([key(start.you[0], start.you[1], 0)]);
  for (let turn = 0; turn < layout.turns; turn++) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const to = [x + dx, y + dy];
        if (isWall(start, to[0], to[1])) continue;
        if (to[0] === start.exit[0] && to[1] === start.exit[1]) return turn + 1;
        if (seen(layout, to, turn + 1)) continue;
        const k = key(to[0], to[1], turn + 1);
        if (seenStates.has(k)) continue;
        seenStates.add(k);
        next.push(to);
      }
    }
    frontier = next;
  }
  return null;
}
