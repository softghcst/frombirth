// Heritage (js/data/heritage.js, js/avatar/heritage.js): people are born looking like the place they come from (a crowd
// in Tokyo or Seoul looks East Asian, one in Lagos Sub-Saharan African), children carry half of each parent's heritage,
// it survives a save, and it never moves the game's dice. Run with: node tests/heritage.mjs
import { rng } from '../js/rng.js';
import { PLACES } from '../js/data/world.js';
import { HERITAGE_BY_ID } from '../js/data/heritage.js';
import { placeMix, shareIn as shareOf, heritageFor, blendHeritage, heritageLabel, mainHeritage, cleanHeritage } from '../js/avatar/heritage.js';
import { randomAppearance, randomInherited, inheritAppearance } from '../js/avatar/inherit.js';
import { normalize, part } from '../js/avatar/catalog.js';
import { makeNpc } from '../js/engine/npcFactory.js';
import { store } from '../js/state.js';
import { createLife } from '../js/engine/characterGen.js';

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); };

// Every place has a mix, and every heritage it names exists.
for (const id of Object.keys(PLACES)) {
  const mix = placeMix(id);
  check(Array.isArray(mix) && mix.length, `${id} has a mix of heritages`);
  for (const [w, h] of mix) {
    check(w > 0, `${id}: weights are positive`);
    for (const hid of typeof h === 'string' ? [h] : Object.keys(h)) check(HERITAGE_BY_ID[hid], `${id}: names a known heritage (${hid})`);
  }
}

// People made in a place mostly have its heritage, and look it.
store.state = createLife({ countryId: 'jp' });
const crowd = (countryId, n = 150) => Array.from({ length: n }, () => makeNpc({ role: 'friend', countryId, age: 30 }));
const share = (list, f) => list.filter(f).length / list.length;
for (const [country, her] of [['jp', 'east_asian'], ['kr', 'east_asian'], ['ng', 'african'], ['in', 'south_asian'], ['se', 'european'], ['mx', 'latino']]) {
  const people = crowd(country);
  const s = share(people, (n) => mainHeritage(n.appearance.inherited.heritage) === her);
  check(s > 0.7, `${country}: most people are ${her} (${Math.round(s * 100)}%)`);
}
const tokyo = crowd('jp');
check(share(tokyo, (n) => ['black', 'dark_brown'].includes(n.appearance.inherited.hairColor)) > 0.95, 'Japan: dark hair');
check(share(tokyo, (n) => part('skin', n.appearance.inherited.skin).depth <= 9) > 0.95, 'Japan: light to tan skin');
const lagos = crowd('ng');
check(share(lagos, (n) => part('skin', n.appearance.inherited.skin).depth >= 9) > 0.9, 'Nigeria: deep skin');
check(share(lagos, (n) => ['coily', 'curly'].includes(n.appearance.inherited.hairTexture)) > 0.85, 'Nigeria: coily and curly hair');

// A child is half each parent's heritage, and that is named.
const mom = randomAppearance(undefined, 'female', { east_asian: 1 });
const dad = randomAppearance(undefined, 'male', { african: 1 });
const kid = inheritAppearance(mom, dad).inherited.heritage;
check(kid?.east_asian === 0.5 && kid?.african === 0.5, `a child of an East Asian mother and an African father is half each (${JSON.stringify(kid)})`);
check(heritageLabel(kid) === 'East Asian and Sub-Saharan African', `named as both (${heritageLabel(kid)})`);
check(JSON.stringify(blendHeritage(kid, { east_asian: 1 })) === JSON.stringify({ east_asian: 0.75, african: 0.25 }), 'a grandchild carries a quarter');
check(blendHeritage(null, { european: 1 })?.european === 1, 'an unknown parent passes on the other\'s');

// It survives a save; an older save without one stays without.
check(JSON.stringify(normalize(inheritAppearance(mom, dad), 's').inherited.heritage) === JSON.stringify(kid), 'heritage is kept by a save');
check(!normalize({ v: 3, inherited: { skin: 'tan' }, style: {} }, 's').inherited.heritage, 'an older save has none');
check(cleanHeritage({ nowhere: 1 }) === null && cleanHeritage({ european: 2, latino: 2 })?.european === 0.5, 'unknown ids are dropped, shares rescaled');

// Heritage takes none of the game's dice: the face someone is born with (shapes, proportions, marks) takes exactly as
// many rolls with a heritage as without; heritage's own draws use their own dice. (A first haircut then depends on the
// hair's texture, as it always has.)
rng.seed(12345); randomInherited(undefined); const plain = rng.state();
rng.seed(12345); randomInherited(undefined, { east_asian: 1 }); const withHer = rng.state();
check(plain === withHer, 'a heritage takes no extra rolls of the game\'s dice');
rng.seed(777); const a1 = heritageFor('us'); rng.seed(777); const a2 = heritageFor('us');
check(JSON.stringify(a1) === JSON.stringify(a2), 'the same game state gives the same heritage');

// Family roots, as places: a heritage common where someone is born roots them there; one that is not roots them in a
// homeland where it is. A child carries both parents' roots. A designed face's family is of the heritage the face looks.
{
  const { rootsFor, blendRoots, inferHeritage, FACE_VALUES } = await import('../js/avatar/heritage.js');
  const { rootsText } = await import('../js/ui/roots.js');
  check(JSON.stringify(rootsFor({ east_asian: 1 }, 'jp')) === '["jp"]', 'an East Asian family in Japan has its roots there');
  const away = rootsFor({ african: 1 }, 'jp');
  check(away.length === 1 && away[0] !== 'jp' && shareOf(away[0], 'african') >= 0.5, `an African family in Japan has its roots where African heritage is common (${away})`);
  check(JSON.stringify(blendRoots(['jp'], ['ng'])) === '["jp","ng"]', 'a child carries both parents\' roots');
  check(rootsText({ inherited: { roots: ['jp', 'ng'] } }) === 'Family roots: Japan and Nigeria.', 'shown as places');
  check(rootsText({ inherited: { roots: ['jp'] } }, 'jp') === '', 'nothing to add when the roots are where they were born');
  const typical = inferHeritage({ skin: 'beige', hairColor: 'black', hairTexture: 'straight', eyeColor: 'dark_brown' }, 'jp', FACE_VALUES);
  const unlike = inferHeritage({ skin: 'espresso', hairColor: 'black', hairTexture: 'coily', eyeColor: 'dark_brown' }, 'jp', FACE_VALUES);
  check(typical.east_asian === 1 && unlike.african === 1, `a designed face's family: like the people of the place, or like the face (${JSON.stringify(typical)} ${JSON.stringify(unlike)})`);
  const face = randomAppearance(undefined, 'female');
  Object.assign(face.inherited, { skin: 'espresso', hairColor: 'black', hairTexture: 'coily', eyeColor: 'dark_brown' });
  store.state = createLife({ countryId: 'jp', appearance: face, gender: 'female' });
  const mom = Object.values(store.state.npcs).find((n) => n.role === 'parent' && n.gender === 'female');
  check(mainHeritage(mom.appearance.inherited.heritage) === 'african' && (store.state.player.appearance.inherited.roots ?? []).every((r) => r !== 'jp'),
    'a player who designs a face unlike the place is born there to a family that looks like them, with roots elsewhere');
}

if (problems.length) { console.log(`${problems.length} problem(s):\n${problems.map((p) => ` ✗ ${p}`).join('\n')}`); process.exit(1); }
console.log(`Heritage is sound: ${Object.keys(PLACES).length} places, people look like where they come from, children carry half of each parent's, and the dice are untouched.`);
