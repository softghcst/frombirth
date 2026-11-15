// Seeded RNG (mulberry32). The running state is stored in the save file so a
// reloaded game continues the same sequence of rolls.
let s = 1;

export const rng = {
  seed(n) { s = (n >>> 0) || 1; },
  state() { return s; },
  /** @returns {number} float in [0, 1) */
  next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
  /** Inclusive integer range. */
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); },
  chance(p) { return this.next() < p; },
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; },
  /** Weighted pick; weightFn defaults to item.weight ?? 1. */
  weighted(items, weightFn = (i) => i.weight ?? 1) {
    const weights = items.map((i) => Math.max(0, weightFn(i)));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return items[0];
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll < 0) return items[i];
    }
    return items[items.length - 1];
  },
  /** Roughly bell-shaped value around mean. */
  around(mean, spread) {
    return mean + (this.next() + this.next() + this.next() - 1.5) / 1.5 * spread;
  },
};
