// Hair texture is genetic: children mix their parents' textures, everyone wears hairstyles of the texture their hair
// shows, and a salon treatment shows another texture only for the years paid for, then grows out.
// Run: node tests/hair-texture.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { CATALOG, hairSuits, hairTextureOf, normalize, stylesFor, fittedFor } = await import('../js/avatar/catalog.js');
const { childTexture, randomAppearance, inheritAppearance, ensureStyled, fitHairToTexture } = await import('../js/avatar/inherit.js');
const salon = await import('../js/engine/salon.js');

rng.seed(11);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const TEX = ['straight', 'wavy', 'curly', 'coily'];
const share = (a, b, t, n = 3000) => { let k = 0; for (let i = 0; i < n; i++) if (childTexture(a, b) === t) k++; return k / n; };

// 1. Genetics.
{
  const n = problems.length;
  check(share('straight', 'straight', 'straight') > 0.75 && share('coily', 'coily', 'coily') > 0.75, 'parents of one texture mostly have children of it');
  const sc = Object.fromEntries(TEX.map((t) => [t, share('straight', 'curly', t)]));
  check(sc.wavy > 0.2 && sc.straight > 0.15 && sc.curly > 0.15, `straight and curly parents can have wavy, straight or curly children (${JSON.stringify(sc)})`);
  check(share('straight', 'straight', 'coily') < 0.01, 'straight-haired parents almost never have a coily-haired child');
  let fromParents = 0;
  for (let i = 0; i < 400; i++) {
    const mom = randomAppearance(undefined, 'female'); const dad = randomAppearance(undefined, 'male');
    mom.inherited.hairTexture = 'straight'; dad.inherited.hairTexture = 'coily';
    const kid = inheritAppearance(mom, dad).inherited.hairTexture;
    if (TEX.includes(kid)) fromParents++;
  }
  check(fromParents === 400, 'every child has a hair texture');
  section('a child\'s hair texture comes from both parents, often between them', n);
}

// 2. Everyone wears hairstyles of their texture.
{
  const n = problems.length;
  let bad = 0; let total = 0;
  for (let i = 0; i < 600; i++) {
    const g = i % 2 ? 'female' : 'male';
    const a = ensureStyled(randomAppearance(undefined, g), g);
    total++; if (!hairSuits(a.style.hair, a.inherited.hairTexture)) bad++;
  }
  check(!bad, `generated people wear hairstyles of their own texture (${bad} of ${total} did not)`);
  for (const t of TEX) check([...stylesFor(t), ...fittedFor(t)].length >= 12, `${t} hair has a choice of hairstyles`);
  const straightStyle = stylesFor('straight')[0].id;
  const a = normalize({ ...randomAppearance(undefined, 'female') }, 'x');
  a.inherited.hairTexture = 'coily'; a.style.hair = straightStyle;
  check(fitHairToTexture(a, 'female', 'x') && hairSuits(a.style.hair, 'coily'), 'a straight style on coily hair is changed for a coily one');
  check(!fitHairToTexture(a, 'female', 'x'), 'and then left alone');
  section('generated people, and anyone grown up, wear hairstyles of the texture their hair shows', n);
}

// 3. Salon treatments.
{
  const n = problems.length;
  check(salon.treatmentFor('curly', 'straight').kind === 'japanese' && salon.treatmentFor('coily', 'straight').kind === 'relaxer', 'straightening: Japanese straightening, or a relaxer for coily hair');
  check(salon.treatmentFor('straight', 'curly').kind === 'spiral_perm' && salon.treatmentFor('coily', 'wavy').kind === 'texturizer', 'a perm adds curl; a texturizer loosens it');
  check(salon.treatmentFor('wavy', 'wavy') === null, 'no treatment to the texture you have');
  check(salon.treatmentCost('japanese', 6) < salon.treatmentCost('japanese', 2) * 3 && salon.treatmentCost('japanese', 4) > salon.treatmentCost('japanese', 2), 'longer costs more, a little less a year');

  store.state = createLife({ countryId: 'us', sex: 'female' });
  const s = store.state; const p = s.player;
  p.age = 25; p.finance.cash = 100000; p.legal.incarceration = null;
  p.appearance = normalize(p.appearance, p.id); p.appearance.inherited.hairTexture = 'curly';
  fitHairToTexture(p.appearance, p.gender, p.id);
  const next = JSON.parse(JSON.stringify(p.appearance));
  next.style.treatment = { texture: 'straight', kind: 'japanese', years: 4 };
  const q = salon.salonQuote(next);
  check(q.total > 0 && q.lines.some((l) => /Japanese straightening/.test(l.label) && /4 years/.test(l.label)), `the salon charges for the treatment (${q.lines.map((l) => l.label)})`);
  const cash = p.finance.cash;
  const r = salon.applySalon(next);
  check(r.ok && p.finance.cash < cash, 'and takes the money');
  check(p.appearance.inherited.hairTexture === 'curly' && hairTextureOf(p.appearance) === 'straight', 'the hair shows straight; the person is still curly-haired');
  check(hairSuits(p.appearance.style.hair, 'straight'), 'and wears a straight style');
  check(p.appearance.style.treatment.until === s.year + 4, 'for the four years paid for');
  for (let y = 1; y < 4; y++) { s.year += 1; salon.tickHair(s); }
  check(hairTextureOf(p.appearance) === 'straight', 'it holds through the years paid for');
  s.year += 1; salon.tickHair(s);
  check(!p.appearance.style.treatment && hairTextureOf(p.appearance) === 'curly' && hairSuits(p.appearance.style.hair, 'curly'), 'then grows out: curly again, in a curly style');

  // Stopping early: free, and no refund.
  const again = JSON.parse(JSON.stringify(p.appearance));
  again.style.treatment = { texture: 'wavy', kind: 'texturizer', years: 6 };
  salon.applySalon(again);
  const before = p.finance.cash;
  const stop = JSON.parse(JSON.stringify(p.appearance)); stop.style.treatment = null;
  const sq = salon.salonQuote(stop);
  check(sq.lines.some((l) => /no refund/.test(l.label)) && sq.total === 0, 'stopping a treatment early is free, with no refund');
  salon.applySalon(stop);
  check(p.finance.cash === before && hairTextureOf(p.appearance) === 'curly', 'and the natural texture shows again');

  p.age = 14;
  const kid = JSON.parse(JSON.stringify(p.appearance)); kid.style.treatment = { texture: 'straight', kind: 'japanese', years: 2 };
  check(!salon.applySalon(kid).ok, 'treatments are for grown-ups');
  section('a treatment shows another texture for the years paid for, then the natural texture grows back', n);
}

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Hair texture is in the genes, and the salon only borrows another for a while.');
process.exit(problems.length ? 1 : 0);
