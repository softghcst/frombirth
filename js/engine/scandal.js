// Scandal: what an office-holder has done that could come out, and what
// happens when somebody starts to look.
//
//   p.flags.secrets  [{ id, kind, year, evidence }]
//     evidence  0–100: how much there is to find. It fades as the years pass.
//   p.flags.inquiry  { secretId, stage: 'rumour' | 'story' | 'inquiry', denied }
//     One at a time. A rumour may die or become a story; a story may be
//     survived, or go to an inquiry; an inquiry clears or condemns.
// The scenes are in data/events/politics.js (scandal_rumour, scandal_story,
// scandal_verdict), and each choice comes back here through decide().
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country } from '../state.js';
import * as world from './polity.js';
import { report } from './news.js';

/** The kinds of thing that can come out. crime: an inquiry that finds against the player brings the police. */
export const SECRETS = {
  graft: { what: 'contracts steered to friends', crime: true },
  envelopes: { what: 'votes bought with cash', crime: true },
  donors: { what: 'favors promised to wealthy donors' },
  coverup: { what: 'a newspaper story suppressed' },
  nepotism: { what: 'a ministry given to a relative' },
  // An allegation with nothing behind it. It can still do damage before it is seen off.
  smear: { what: 'money said to have gone missing', false: true },
};
export const HUSH = 80000; // what it costs to lean on an editor, in base money

const secrets = () => (player().flags.secrets ??= []);
const find = (id) => secrets().find((s) => s.id === id) ?? null;
const drop = (id) => { player().flags.secrets = secrets().filter((s) => s.id !== id); };
/** What people think of the player: approval in office; out of it, the standing they left with, and they will stand on again. */
const shift = (n) => { const p = player(); const k = p.politics; if (k) k.approval = Math.round(clamp(k.approval + n)); else p.flags.lastApproval = Math.round(clamp((p.flags.lastApproval ?? 50) + n)); };
/** Whether the player is a public figure: in office, standing for it, or remembered for it. */
const publicFigure = (p) => !!p.politics || !!p.flags.race || (p.flags.offices ?? []).some((o) => o.tier >= 2);
const words = (s) => ({ what: SECRETS[s.kind].what, office: player().politics?.title ?? 'former office-holder' });
const tell = (kind, s) => report(world.polity(player().countryId), kind, words(s));

/** Something has been done that could come out later. */
export function addSecret(kind, evidence) {
  if (!SECRETS[kind]) return;
  const p = player();
  p.counters.secretSeq = (p.counters.secretSeq ?? 0) + 1;
  secrets().push({ id: `s${p.counters.secretSeq}`, kind, year: store.state.year, evidence: Math.round(clamp(evidence)) });
}

/** Yearly: trails go cold, and now and then somebody picks one up. */
export function tickScandal() {
  const p = player();
  const c = country();
  const year = store.state.year;
  const pend = store.state.pendingEvents;
  for (const s of secrets()) s.evidence = Math.max(0, s.evidence - 4);
  p.flags.secrets = secrets().filter((s) => year - s.year <= 15 && (s.evidence > 5 || p.flags.inquiry?.secretId === s.id));
  const q = p.flags.inquiry;
  if (q) {
    const s = find(q.secretId);
    if (!s || !publicFigure(p)) { delete p.flags.inquiry; return; }
    if (q.stage === 'story') { shift(-Math.round(s.evidence / 6)); tell('story', s); pend.push({ id: 'scandal_story', cast: { words: words(s) } }); }
    else if (q.stage === 'inquiry') pend.push({ id: 'scandal_verdict', cast: { words: words(s) } });
    return;
  }
  if (!publicFigure(p)) return;
  // A freer press digs more; the higher the office, the more worth digging. Out of office, there is less of a story in it.
  const tier = p.politics?.tier ?? 0;
  const keen = clamp(1.2 - (c.living?.graft ?? 40) / 120, 0.3, 1.2) * (p.politics ? 1 + tier / 5 : 0.5);
  // Not everything said about a public figure is true.
  if (tier >= 2 && !secrets().some((s) => SECRETS[s.kind].false) && rng.chance(0.015)) addSecret('smear', rng.int(15, 35));
  for (const s of secrets()) {
    if (s.year === year) continue;
    if (!rng.chance(clamp(s.evidence / 400 * keen, 0, 0.4))) continue;
    p.flags.inquiry = { secretId: s.id, stage: 'rumour', denied: false };
    tell('rumour', s);
    pend.push({ id: 'scandal_rumour', cast: { words: { ...words(s), hush: fmtMoney(localMoney(HUSH, c), c) } } });
    break;
  }
}

/** What the player chose in a scandal scene. @returns {string} what happened */
export function decide(what) {
  const p = player();
  const c = country();
  const q = p.flags.inquiry;
  const s = q ? find(q.secretId) : null;
  if (!q || !s) return '';
  const end = () => { delete p.flags.inquiry; };
  if (q.stage === 'rumour') {
    if (what === 'confess') { shift(-8); p.hidden.karma = clamp(p.hidden.karma + 6); drop(s.id); end(); tell('confessed', s); return 'You call the cameras in and tell it yourself, all of it. It hurts, and then it is over.'; }
    if (what === 'kill') {
      const cost = localMoney(HUSH, c);
      if (p.finance.cash < cost) return 'You do not have that kind of money to hand.';
      p.finance.cash -= cost;
      p.hidden.karma = clamp(p.hidden.karma - 6);
      if (rng.chance(0.55)) { end(); s.evidence = Math.max(0, s.evidence - 10); addSecret('coverup', rng.int(50, 70)); return 'The story does not run. The editor will remember what it cost you, and so will whoever carried the envelope.'; }
      q.stage = 'story'; q.denied = true; s.evidence = clamp(s.evidence + 15);
      return 'The editor takes notes throughout your call, and prints those too. The story will run, and now it is a bigger one.';
    }
    // Deny it: the less there is to find, the likelier it dies.
    if (rng.chance((1 - s.evidence / 100) * 0.8)) { end(); s.evidence = Math.max(0, s.evidence - 10); return 'You deny it flatly. The reporter cannot stand the story up, and it goes in a drawer. For now.'; }
    q.stage = 'story'; q.denied = true;
    return 'You deny it flatly. The reporter thanks you, and goes on digging.';
  }
  if (q.stage === 'story') {
    if (what === 'apologise') { shift(q.denied ? 1 : 4); drop(s.id); end(); tell('confessed', s); return q.denied ? 'You apologize. It would have counted for more if you had not denied it first.' : 'You apologize, plainly and without excuses. Some people even believe you.'; }
    if (what === 'aide') {
      p.hidden.karma = clamp(p.hidden.karma - 8);
      if (s.evidence < 60 && rng.chance(0.6)) { end(); s.evidence = Math.max(0, s.evidence - 20); tell('aide', s); return 'A junior aide resigns with a statement taking full responsibility. You wish them well in a short letter. The story moves on.'; }
      shift(-8); q.stage = 'inquiry'; q.denied = true;
      return 'The aide refuses to go quietly, and has kept every message. Now there will be an inquiry, and they will be its first witness.';
    }
    if (what === 'inquiry') { shift(2); q.stage = 'inquiry'; return 'You announce an independent inquiry and promise to accept whatever it finds. That buys you a year.'; }
    return '';
  }
  if (q.stage === 'inquiry') {
    end();
    if (!SECRETS[s.kind].false && rng.chance(clamp(s.evidence / 100 + (q.denied ? 0.1 : 0), 0.05, 0.95))) {
      shift(-18);
      p.flags.disgraced = true; // the name carries it, for this generation and the next
      if (SECRETS[s.kind].crime) p.legal.heat = clamp(p.legal.heat + 40);
      drop(s.id); tell('guilty', s);
      return `The inquiry finds against you, in four hundred pages.${SECRETS[s.kind].crime ? ' A copy has gone to the police.' : ''}`;
    }
    shift(SECRETS[s.kind].false ? 12 : 8); drop(s.id); tell('cleared', s);
    return SECRETS[s.kind].false ? 'The inquiry finds that there was never anything in it: the documents were forged, and it says by whom. You are cleared completely.' : 'The inquiry finds that nothing can be proved. You are cleared, and say so on every channel.';
  }
  return '';
}
