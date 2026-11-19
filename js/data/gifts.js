// Gifts from one adult to another (engine/bonds.js give). Costs are base units, made local and of their time by the
// game's money; `from` is the first year such a thing could be bought at all. `kind` is what a person's taste is for.
const G = (id, name, kind, cost, from = 0) => ({ id, name, kind, cost, from });
export const ROMANTIC_GIFTS = [
  G('flowers', 'flowers', 'flowers', 40),
  G('chocolates', 'a box of chocolates', 'sweets', 30),
  G('book', 'a book they mentioned once', 'thoughtful', 25),
  G('scarf', 'a silk scarf', 'clothes', 180),
  G('coat', 'a good coat', 'clothes', 650),
  G('bracelet', 'a silver bracelet', 'jewelry', 400),
  G('necklace', 'a gold necklace', 'jewelry', 2200),
  G('earrings', 'diamond earrings', 'jewelry', 6500),
  G('diamonds', 'a diamond necklace', 'jewelry', 50000),
  G('watch', 'a fine watch', 'watches', 4500, 1870),
  G('handbag', 'a designer handbag', 'clothes', 2800, 1920),
  G('camera', 'a camera', 'gadgets', 900, 1900),
  G('phone', 'the newest phone', 'gadgets', 1100, 2008),
  G('dinner', 'a dinner somewhere they could never get a table', 'experiences', 350),
  G('concert', 'tickets to the concert they wanted', 'experiences', 300, 1900),
];
