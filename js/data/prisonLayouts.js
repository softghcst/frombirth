// Escape maps. '#' is a wall, '.' is floor, 'S' is your cell, 'E' is the way
// out. Each guard walks its path one cell per turn, there and back again.
// You are caught if a guard ends a turn on your cell or right next to it
// (up, down, left or right). turns is how long you have before the count.
//
// After editing, run `node tests/escape-layouts.mjs` to prove each one still has a way out.
export const LAYOUTS = [
  { name: 'Minimum security', turns: 22, grid: [
    'S..#...',
    '.#.#.#.',
    '.#.....',
    '.#.###.',
    '...#...',
    '.#...#.',
    '.#.#..E',
  ], guards: [
    { path: [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2]] },
  ] },
  { name: 'Medium security', turns: 30, grid: [
    'S.#....',
    '..#.##.',
    '.......',
    '.##.#..',
    '....#.#',
    '.#.....',
    '.#.##.E',
  ], guards: [
    { path: [[3, 2], [4, 2], [5, 2], [6, 2]] },
    { path: [[2, 4], [2, 5], [3, 5], [4, 5]] },
  ] },
  { name: 'Maximum security', turns: 30, grid: [
    'S..#....',
    '.#.#.##.',
    '.#......',
    '.#.##.#.',
    '...#..#.',
    '.#...##.',
    '.#.#....',
    '...#..#E',
  ], guards: [
    { path: [[3, 2], [4, 2], [5, 2], [6, 2]] },
    { path: [[7, 2], [7, 3], [7, 4], [7, 5]] },
    { path: [[4, 5], [4, 6], [5, 6], [6, 6]] },
  ] },
];
