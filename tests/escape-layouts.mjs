// Proves every prison escape layout can be beaten. Run after editing
// js/data/prisonLayouts.js:   node tests/escape-layouts.mjs
import { LAYOUTS } from '../js/data/prisonLayouts.js';
import { solve } from '../js/engine/escapeGame.js';

let failed = false;
for (const layout of LAYOUTS) {
  const widths = new Set(layout.grid.map((row) => row.length));
  const onWalls = layout.guards.flatMap((g) => g.path).filter(([x, y]) => layout.grid[y]?.[x] !== '.');
  const broken = layout.guards.some((g) => g.path.some((c, i) =>
    i > 0 && Math.abs(c[0] - g.path[i - 1][0]) + Math.abs(c[1] - g.path[i - 1][1]) !== 1));
  const turns = solve(layout);
  const problems = [
    widths.size !== 1 && 'rows are different lengths',
    onWalls.length && 'a guard path crosses a wall, the start or the exit',
    broken && 'a guard path jumps between cells that are not next to each other',
    turns === null && 'there is no way out',
  ].filter(Boolean);
  failed ||= problems.length > 0;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${layout.name}: ${problems.join('; ') || `shortest escape ${turns} of ${layout.turns} turns`}`);
}
process.exit(failed ? 1 : 0);
