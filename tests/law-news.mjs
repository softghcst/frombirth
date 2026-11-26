// The legal career in the papers and in the family: big public cases, appeals, the highest court and elections are
// reported (never a client's confidential file); years later a child of the player's may find the story.
// Run with: node tests/law-news.mjs
import { store, rng, ls, lp, lc, check, finish, lawyer, playCase } from './helpers/lawSetup.mjs';
const world = await import('../js/engine/polity.js');
const camp = await import('../js/engine/lawCampaign.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
rng.seed(97);
const news = () => (world.polity(store.state.player.countryId).news ?? []).filter((x) => x.you);

lawyer('lawyer');
store.state.player.age = 40;
let won = null;
for (let i = 0; i < 10 && !won; i++) { const c = lc.createCase('criminal_appeal'); playCase(c); if (c.outcome.favorable > 0) won = c; }
check(won && news().some((x) => x.kind === 'conviction_overturned' && x.text.includes(won.title) || x.kind === 'conviction_overturned'), 'an appeal that overturns a conviction is in the papers');
const n0 = news().length;
const will = lc.createCase('will'); playCase(will);
check(news().length === n0, 'a private matter, like a will, never is');
// An election.
lawyer('prosecutor', { level: 2 });
const p = store.state.player;
p.age = 48; p.career.experience = { prosecutor: 16 }; p.finance.cash = 5e6;
camp.declare('da'); camp.nextRound(); camp.debate('plan'); camp.nextRound(); camp.nextRound(); camp.pollingDay();
check(news().some((x) => x.kind === 'legal_won' || x.kind === 'legal_lost'), 'a race for District Attorney is reported, won or lost');
check(lp.legalHeadlines().length >= 1, 'the Family Archive can show what the papers said');
// Years later, a child reads it.
const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 14, relationship: 60 });
store.state.npcs[kid.id] = kid; p.npcIds.push(kid.id);
store.state.year += 4;
store.state.pendingEvents = [];
lp.storyBeats();
const ev = store.state.pendingEvents.find((e) => e.id === 'law_child_reads');
check(ev && ev.cast.words.kid === kid.firstName && ev.cast.words.headline, `a child finds the old story (${ev?.cast.words.headline})`);
const before = kid.meters.relationship;
const text = lp.lawChoice('childReads:tell');
check(kid.meters.relationship > before && kid.flags.inspiredByLaw && /law schools/.test(text), 'telling them the whole story brings you closer, and gives them ideas');
// What the child does with that: a lean toward law school, and law, never a certainty.
{
  const { ensureLife, tickLives } = await import('../js/engine/npcLives.js');
  let legacySeen = false;
  const run = (inspired) => {
    let lawyers = 0;
    for (let i = 0; i < 30; i++) {
      lawyer('lawyer');
      const p = store.state.player; p.age = 50;
      for (const id of [...p.npcIds]) { const n = store.state.npcs[id]; if (n?.role === 'child') n.alive = false; }
      const k = makeNpc({ role: 'child', countryId: p.countryId, age: 17, relationship: 70 });
      store.state.npcs[k.id] = k; p.npcIds.push(k.id);
      ensureLife(k); k.life.edu.gpa = 3.6; k.meters.intellect = 75;
      if (inspired) { k.flags.inspiredBy = 'law'; k.flags.inspiredTrack = 'lawyer'; }
      for (let y = 0; y < 10; y++) { k.age += 1; store.state.pendingEvents = []; tickLives(); }
      if (k.life.edu.degrees.includes('law')) { lawyers++; if (lp.familyLegalLegacy().some((x) => !x.you && x.name.includes(k.firstName) && x.milestones.some((m) => /Qualified as a lawyer/.test(m.title)))) legacySeen = true; }
    }
    return lawyers;
  };
  const a = run(true); const b = run(false);
  check(legacySeen, 'a child who became a lawyer is in the family\'s legal legacy');
  check(a > b && a < 30, `a child who caught the interest goes to law school far more often, but not always (${a} of 30, against ${b})`);
}

finish('Big cases make the papers; the family reads them later.');
