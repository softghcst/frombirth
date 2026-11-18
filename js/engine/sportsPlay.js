// How a game, match, race or bout comes out. Pure functions: each takes the
// two sides' strengths and a seeded run of luck, and returns the score in the
// form the sport uses. Nothing here reads or writes the game's state, and
// nothing draws on the game's own dice, so a result worked out once is the
// same result however many times the save is loaded.
//
// Strength is on the 0–100 scale the skills use. A side 10 points stronger wins
// most of the time, never all of it.

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A private run of luck for one key: the same key gives the same numbers, every time. */
export function seeded(key) {
  let s = hash(String(key)) || 1;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    /** Roughly normal, mean m and spread sd. */
    normal: (m = 0, sd = 1) => m + sd * (next() + next() + next() + next() - 2) * 1.2247,
    /** A count with mean `mean`. */
    poisson(mean) { const L = Math.exp(-Math.max(0, mean)); let k = 0; let p = 1; do { k++; p *= next(); } while (p > L && k < 40); return k - 1; },
    shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
  return r;
}

/** The chance the first side wins a single contest, from the gap in strength. */
export const edge = (a, b, spread = 9) => 1 / (1 + Math.exp(-(a - b) / spread));

// ---------- Team games ----------

/** Soccer and hockey: goals. */
function goals(a, b, r, sport) {
  const base = sport.id === 'ice_hockey' ? 2.9 : 1.35;
  const ma = base * Math.exp((a - b) / 28) * (r.next() * 0.3 + 0.85);
  const mb = base * Math.exp((b - a) / 28) * (r.next() * 0.3 + 0.85);
  return [r.poisson(ma), r.poisson(mb)];
}
/** Basketball, American football, rugby, volleyball (as points across sets). */
function points(a, b, r, sport) {
  const avg = { basketball: 72, wheelchair_basketball: 58, american_football: 21, rugby: 22, volleyball: 2 }[sport.id] ?? 50;
  if (sport.id === 'volleyball') { // best of five sets
    let wa = 0; let wb = 0; const p = edge(a, b, 10);
    while (wa < 3 && wb < 3) { if (r.chance(p)) wa++; else wb++; }
    return [wa, wb];
  }
  const sd = avg * 0.18;
  const sa = Math.max(0, Math.round(r.normal(avg + (a - b) * avg / 120, sd)));
  let sb = Math.max(0, Math.round(r.normal(avg + (b - a) * avg / 120, sd)));
  if (sa === sb && sport.id === 'basketball') sb += r.chance(0.5) ? 2 : -2; // overtime settles it
  return [sa, Math.max(0, sb)];
}
/** Baseball and softball: runs, no ties. */
function baseball(a, b, r) {
  const ma = 4.4 * Math.exp((a - b) / 30); const mb = 4.4 * Math.exp((b - a) / 30);
  let ra = r.poisson(ma); let rb = r.poisson(mb);
  while (ra === rb) { if (r.chance(edge(a, b, 12))) ra++; else rb++; } // extra innings
  return [ra, rb];
}
/** Cricket: runs and wickets for each side; the score shown is runs. */
function cricket(a, b, r) {
  const runs = (x, y) => Math.max(40, Math.round(r.normal(220 + (x - y) * 3, 38)));
  const ra = runs(a, b); let rb = runs(b, a);
  if (ra === rb) rb += r.chance(0.5) ? 1 : -1;
  return [ra, rb];
}

export function teamGame(sport, a, b, key) {
  const r = seeded(key);
  const fn = { goals, points, baseball, cricket }[sport.adapter] ?? points;
  return fn(a, b, r, sport);
}

// ---------- Tennis: points, games, sets ----------

/**
 * A tennis match, point by point. `a` and `b` are { serve, ret, rest } on the skill scale.
 * Returns sets as [[6,4],[3,6],[7,6]] from a's side and the winner (0 or 1).
 */
export function tennisMatch(a, b, key, bestOf = 3) {
  const r = seeded(key);
  // The chance the server wins a point: around 62% between equals.
  const pServe = (s, o) => Math.min(0.85, Math.max(0.35, 0.62 + (s.serve * 0.6 + s.rest * 0.4 - (o.ret * 0.6 + o.rest * 0.4)) / 150));
  const pa = pServe(a, b); const pb = pServe(b, a);
  const game = (p) => { let x = 0; let y = 0; for (;;) { if (r.chance(p)) x++; else y++; if (x >= 4 && x - y >= 2) return 0; if (y >= 4 && y - x >= 2) return 1; } };
  const tiebreak = (first) => { let x = 0; let y = 0; let n = 0; for (;;) { const srv = ((n + 1) >> 1) % 2 === 0 ? first : 1 - first; const p = srv === 0 ? pa : pb; const w = r.chance(p) ? srv : 1 - srv; if (w === 0) x++; else y++; n++; if ((x >= 7 || y >= 7) && Math.abs(x - y) >= 2) return x > y ? 0 : 1; } };
  const sets = []; let won = [0, 0]; let server = r.chance(0.5) ? 0 : 1;
  const need = Math.ceil(bestOf / 2);
  while (won[0] < need && won[1] < need) {
    let g = [0, 0];
    for (;;) {
      if (g[0] === 6 && g[1] === 6) { const w = tiebreak(server); g[w]++; server = 1 - server; break; }
      const w = server === 0 ? game(pa) : 1 - game(pb);
      g[w]++; server = 1 - server;
      if ((g[0] >= 6 || g[1] >= 6) && Math.abs(g[0] - g[1]) >= 2) break;
      if (g[0] === 7 || g[1] === 7) break;
    }
    sets.push(g); won[g[0] > g[1] ? 0 : 1]++;
  }
  return { sets, winner: won[0] > won[1] ? 0 : 1 };
}

// ---------- Rally scoring: pickleball, badminton, table tennis ----------

/**
 * Games to `to`, win by two, best of three. `a`/`b` are a single strength. In doubles the side's strength already
 * holds the two players and how well they play together. Pickleball games to 11 are side-out scored in the game
 * itself; here the points a side gets reflect that only by being lower-scoring, which is what a player sees.
 */
export function rallyMatch(a, b, key, to = 11, bestOf = 3) {
  const r = seeded(key);
  const p = Math.min(0.8, Math.max(0.2, 0.5 + (a - b) / 140));
  const game = () => { let x = 0; let y = 0; for (;;) { if (r.chance(p)) x++; else y++; if ((x >= to || y >= to) && Math.abs(x - y) >= 2) return [x, y]; if (x > to + 9 || y > to + 9) return x > y ? [x, y] : [x, y]; } };
  const games = []; const won = [0, 0]; const need = Math.ceil(bestOf / 2);
  while (won[0] < need && won[1] < need) { const g = game(); games.push(g); won[g[0] > g[1] ? 0 : 1]++; }
  return { sets: games, winner: won[0] > won[1] ? 0 : 1 };
}

// ---------- Combat: bouts ----------

export function bout(a, b, key) {
  const r = seeded(key);
  const p = edge(a, b, 8);
  const winner = r.chance(p) ? 0 : 1;
  const gap = Math.abs(a - b);
  const how = r.chance(0.15 + gap / 200) ? r.pick(['by stoppage', 'by submission', 'by pin', 'before the final round']) : r.chance(0.5) ? 'on points' : 'by a split decision';
  return { winner, how };
}

// ---------- Times, distances, judged scores, golf ----------

/**
 * A mark in a measured event: [id, name, unit, best, beginner]. `skill` 0–100 maps between a beginner's mark and a strong
 * competitive one, with a little luck on the day. Times go down as skill goes up; distances go up.
 */
export function mark(event, skill, key) {
  const r = seeded(key);
  const [, , unit, best, beginner] = event;
  const t = Math.max(0, Math.min(1.08, (skill - 20) / 75));
  const ideal = beginner + (best - beginner) * Math.pow(t, 0.9);
  const wobble = Math.abs(best - beginner) * 0.02 * r.normal(0, 1);
  const v = ideal + (best < beginner ? Math.abs(wobble) * 0.5 + wobble * 0.5 : -Math.abs(wobble) * 0.5 + wobble * 0.5);
  return unit === 'm' ? Math.round(v * 100) / 100 : Math.round(v * 100) / 100;
}
export const better = (event, x, y) => (event[3] < event[4] ? x < y : x > y); // lower time wins, longer jump wins
export function fmtMark(event, v) {
  if (event[2] === 'm') return `${v.toFixed(2)} m`;
  if (v < 60) return `${v.toFixed(2)} s`;
  const h = Math.floor(v / 3600); const m = Math.floor((v % 3600) / 60); const s = Math.round(v % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
/** A judged routine, out of 100, to one decimal place. */
export function judged(skill, key, nerve = 50) {
  const r = seeded(key);
  const fall = r.chance(Math.max(0.03, 0.22 - nerve / 500 - skill / 700));
  return Math.round(Math.max(20, Math.min(99.9, r.normal(skill * 0.85 + 12, 3.5) - (fall ? 8 : 0))) * 10) / 10;
}
/** A round of golf on a par-72 course. */
export function golfRound(skill, key) {
  const r = seeded(key);
  return Math.round(r.normal(72 + (70 - skill) * 0.42, 2.6));
}

// ---------- The Pathways Rating ----------

/**
 * PR is the game's own rating, not any real body's. It starts at 1000 and moves only with results: an expected win
 * moves it a little, an upset a lot. K is larger while a player has few results.
 */
export function prChange(mine, theirs, won, played = 30) {
  const k = played < 10 ? 40 : played < 30 ? 28 : 18;
  const expected = 1 / (1 + 10 ** ((theirs - mine) / 400));
  return Math.round(k * ((won ? 1 : 0) - expected));
}
/** The rating a player of this skill would settle at: used only to rate invented opponents, never the player. */
export const prOfSkill = (skill) => Math.round(600 + skill * 11);
