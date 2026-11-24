// A trans character's face follows the body they were born with until hormones have had a year to work, then who they
// are; coming out alone changes their name, clothes and hair, not their face. And a random life can be anyone: trans,
// non-binary, any sexuality. Run with: node tests/trans-face.mjs
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { faceGenderOf, dressOfPlayer } = await import('../js/avatar/render.js');
const { resolveLook } = await import('../js/avatar/catalog.js');
const identity = await import('../js/engine/identity.js');

rng.seed(7);
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const P = () => store.state.player;
/** The lips the face is drawn with, which is where a face reads as a man's or a woman's. */
const lipsOf = (p) => resolveLook(p.appearance, p.id, faceGenderOf(p)).lips;

// 1. A trans man: born a girl, comes out, starts testosterone at 18; his face changes a year later, and stays.
{
  const n = problems.length;
  store.state = createLife({ countryId: 'us', sex: 'female', trans: true });
  const p = P();
  check(p.flags.bornAs === 'female' || p.gender === 'female', 'setup: born a girl');
  p.age = 16;
  check(faceGenderOf(p) === 'female', 'before anything, the face is the one he was born with');
  const born = lipsOf(p);
  // Coming out: he lives as a boy from now on.
  p.flags.identity = { ...(p.flags.identity ?? {}), knows: true, outGender: true };
  p.gender = 'male';
  check(faceGenderOf(p) === 'female' && lipsOf(p) === born, 'coming out changes his name and clothes, not his face');
  check(dressOfPlayer(p).face === 'female', 'and the portrait draws the face he was born with');
  // Testosterone at 18.
  p.age = 18; p.flags.identity.hrtAge = 18;
  check(faceGenderOf(p) === 'female', 'the first months on hormones: not yet');
  p.age = 19;
  check(faceGenderOf(p) === 'male', 'a year on testosterone: his face is a man\'s');
  const after = lipsOf(p);
  check(after !== born || resolveLook(p.appearance, p.id, 'male').lips === resolveLook(p.appearance, p.id, 'female').lips, 'and the lips are drawn the masculine way');
  // He stops; the changes stay.
  p.age = 22;
  const stopped = identity.stopHrt();
  check(stopped.ok && p.flags.identity.hrtAge == null && p.flags.identity.hrtYears === 4, 'stopping keeps the years he was on them');
  check(faceGenderOf(p) === 'male', 'and his face stays as hormones made it');
  section('a trans man\'s face changes with testosterone, a year in, not when he comes out', n);
}

// 2. A trans woman, and someone who is not trans.
{
  const n = problems.length;
  store.state = createLife({ countryId: 'uk', sex: 'male', trans: true });
  const p = P();
  p.age = 20; p.gender = 'female'; p.flags.identity = { ...(p.flags.identity ?? {}), knows: true, outGender: true };
  check(faceGenderOf(p) === 'male', 'a trans woman who has come out: the face she was born with');
  p.flags.identity.hrtAge = 20; p.age = 21;
  check(faceGenderOf(p) === 'female', 'and after a year of estrogen, her own');
  store.state = createLife({ countryId: 'uk', sex: 'female', trans: false });
  check(faceGenderOf(P()) === 'female', 'someone who is not trans: their own face, always');
  store.state = createLife({ countryId: 'uk', sex: 'male', trans: false });
  check(faceGenderOf(P()) === 'male', 'either way');
  section('a trans woman likewise; nobody else is affected', n);
}

// 3. A random life can be anyone.
{
  const n = problems.length;
  let trans = 0; let nb = 0; let notStraight = 0; const N = 1500;
  for (let i = 0; i < N; i++) {
    store.state = createLife();
    const p = P();
    const born = p.flags.bornAs ?? p.gender;
    if ((p.flags.trueGender && p.flags.trueGender !== born) || born !== p.gender) trans++;
    if (p.flags.trueGender === 'nonbinary' || p.gender === 'nonbinary') nb++;
    if (p.orientation !== 'straight') notStraight++;
  }
  check(trans / N > 0.025 && trans / N < 0.085, `about 5 in 100 random lives are trans or non-binary (${trans} of ${N})`);
  check(nb > 0, `some random lives are non-binary (${nb} of ${N})`);
  check(notStraight / N > 0.08 && notStraight / N < 0.22, `about 14 in 100 random lives are not straight (${notStraight} of ${N})`);
  section('a random life can be trans, non-binary or any sexuality', n);
}

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
console.log(problems.length ? `${problems.length} problem(s).` : 'Faces change with hormones, and a random life can be anyone.');
process.exit(problems.length ? 1 : 0);
