// Public life online: office-holders and candidates speaking to citizens,
// royals' official accounts, and what being widely known brings — interviews,
// invitations, and the loss of a little privacy.
//
// Digital activity can make a campaign more visible; it never decides an
// election. Statements feed the Politics engine's own measures (approval in
// office, a campaign's appeal) in small, capped amounts, and the reaction
// depends on the person's standing and the country, never on which side of
// politics they are on.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { PLATFORM_BY_ID } from '../../data/digital.js';
import { inOffice, shiftApproval } from '../politics.js';
import { race } from '../campaign.js';
import { rep as royalRep, shift as royalShift } from '../reputation.js';
import { post as newsPost } from '../news.js';
import { world, newId, acts, result, recordEvent, reputation, adjustReputation, spendHours } from './core.js';
import { activeAccountsOf, followerCount } from './accounts.js';
import { publish } from './content.js';
import { raise, SAFETY } from './reputation.js';

/** Things a public official, a candidate or a royal can say online. */
export const STATEMENTS = {
  policy: { label: 'Explain a policy', who: 'office', text: 'A plain explanation of what the government is doing, and why.' },
  announcement: { label: 'Make a government announcement', who: 'office', text: 'An announcement from the office.' },
  conversation: { label: 'Hold an open conversation with citizens', who: 'any', text: 'Questions from anyone, answered live.' },
  campaign: { label: 'Post a campaign update', who: 'race', text: 'Where the campaign has been, and what it stands for.' },
  royal_charity: { label: 'Highlight a charity you support', who: 'royal', text: 'A cause the family supports, in its own words.' },
  royal_appearance: { label: 'Share a public appearance', who: 'royal', text: 'Photographs from a day of public duties.' },
  royal_milestone: { label: 'Announce family news', who: 'royal', text: 'News from the family.' },
};

const isRoyal = (p) => p.royal && ['monarch', 'heir', 'royal'].includes(p.royal.rank);

/** The official accounts the player can speak through. Personal accounts stay personal. */
export const officialAccounts = () => activeAccountsOf(player().id).filter((a) => a.kind === 'official' && PLATFORM_BY_ID[a.platformId].audience === 'followers');

/** Statements open to the player right now. */
export function statementOptions() {
  const p = player();
  const r = race();
  return Object.entries(STATEMENTS).filter(([, s]) => (s.who === 'office' && inOffice()) || (s.who === 'race' && r?.stage === 'trail')
    || (s.who === 'royal' && isRoyal(p)) || (s.who === 'any' && (inOffice() || r || isRoyal(p))))
    .map(([id, s]) => ({ id, ...s, done: !!acts()[`stmt:${id}`] }));
}

/**
 * Speaks publicly through an official account. The reaction comes from the
 * audience and the person's credibility; the effect on approval or a
 * campaign is small and the same whatever their politics.
 */
export function statement(accountId, kind) {
  const p = player();
  const s = STATEMENTS[kind];
  const acc = officialAccounts().find((a) => a.id === accountId);
  if (!s || !acc) return result(false, 'That has to come from an official account.');
  if (!statementOptions().some((o) => o.id === kind)) return result(false, 'That is not something you can say right now.');
  if (acts()[`stmt:${kind}`]) return result(false, 'You have already done that this year.');
  if (kind === 'royal_milestone' && !p.milestones.some((m) => m.age >= p.age - 1 && m.kind !== 'digital')) return result(false, 'There is no family news to announce.');
  const r = publish({ accountId, format: kind === 'conversation' ? 'short_video' : 'text', topic: kind.startsWith('royal') ? 'life' : 'work', audience: 'public', text: s.text, civic: kind });
  if (!r.ok) return r;
  acts()[`stmt:${kind}`] = true;
  const cred = reputation(p.id).credibility;
  const landed = rng.chance(clamp(0.35 + cred / 200 + p.stats.charm / 400, 0.2, 0.85));
  const notes = [];
  const office = inOffice();
  if (office && s.who !== 'royal') { const d = landed ? rng.int(1, 2) : -1; shiftApproval(d); notes.push(d > 0 ? 'Your approval ticked up.' : 'It did not go down well.'); }
  const rc = race();
  if (rc?.stage === 'trail' && s.who !== 'royal') {
    // Visibility, not votes: the Politics engine counts the votes.
    const used = rc.onlineAppeal ?? 0;
    const gain = landed ? Math.min(1.5, 3 - used) : -0.5;
    if (gain) { rc.appeal += gain; rc.onlineAppeal = used + Math.max(0, gain); }
    notes.push(landed ? 'More people know what your campaign is about.' : 'It got attention, not all of it useful.');
  }
  if (isRoyal(p) && s.who === 'royal') {
    royalShift('image', landed ? 2 : -1, landed ? 'warmly received posts from the official account' : 'an official post that fell flat');
    if (kind === 'royal_charity') royalShift('press', 1, 'publicity for a good cause');
    notes.push(landed ? 'The country liked it.' : 'The press picked holes in it.');
  }
  const w = store.state.polities?.[p.countryId];
  if (w && followerCount(acc) > 1000) newsPost(w, `${p.firstName} ${p.lastName} ${kind.startsWith('royal') ? 'posted on the family\'s official account' : 'spoke directly to the public online'}.`, { tone: landed ? 'good' : 'neutral', you: true });
  return result(true, `${r.text} ${notes.join(' ')}`.trim(), landed ? 'good' : 'neutral', { post: r.post });
}

// ---------- Being known ----------

export const MEDIA = [
  { id: 'interview', label: 'An interview', hours: 6, text: 'asked for an interview about your work online' },
  { id: 'panel', label: 'A panel at an event', hours: 10, text: 'invited you to speak on a panel' },
  { id: 'feature', label: 'A newspaper feature', hours: 4, text: 'wants to write a feature about you' },
];

/** Requests from the media and organizers, open now. */
export const mediaOffers = () => world().offers.filter((o) => o.kind === 'media' && o.status === 'open' && o.year >= store.state.year - 1);

export function answerMedia(offerId, yes) {
  const p = player();
  const o = world().offers.find((x) => x.id === offerId && x.kind === 'media' && x.status === 'open');
  if (!o) return result(false, 'That request is no longer open.');
  if (!yes) { o.status = 'declined'; return result(true, 'You said no. Not everything needs a yes.', 'neutral'); }
  const m = MEDIA.find((x) => x.id === o.media);
  if (!spendHours(m.hours)) return result(false, 'You do not have the time this year.');
  o.status = 'accepted';
  const good = rng.chance(clamp(0.45 + p.stats.charm / 250 + reputation(p.id).credibility / 400, 0.2, 0.9));
  adjustReputation(p.id, 'recognition', good ? 4 : 2, `${m.label} with ${o.outlet}`);
  adjustReputation(p.id, 'credibility', good ? 2 : -2, good ? `Came across well in ${m.label.toLowerCase()}` : `Came across badly in ${m.label.toLowerCase()}`);
  p.hidden.fame = clamp(p.hidden.fame + (good ? 2 : 1));
  if (p.traits.includes('worrier')) p.stats.mood = clamp(p.stats.mood - 2);
  const text = good ? `${m.label} with ${o.outlet}. You were yourself, and it showed.` : `${m.label} with ${o.outlet}. You said one thing badly, and that was the part everyone quoted.`;
  recordEvent({ kind: 'media', charIds: [p.id], summary: text, visibility: 'public', once: `media_${o.id}` });
  return result(true, text, good ? 'good' : 'neutral');
}

const OUTLETS = ['The Evening Ledger', 'Cityline Radio', 'The Morning Standard', 'Signal Weekly', 'The Commons Podcast'];

/** The year in public attention: offers for the well known, and the privacy that recognition costs. */
export function tickFame() {
  const p = player();
  const r = reputation(p.id);
  if (!activeAccountsOf(p.id).length) return;
  if (r.recognition >= 40 && !mediaOffers().length && rng.chance(0.3)) {
    const m = rng.pick(MEDIA);
    const outlet = rng.pick(OUTLETS);
    world().offers.push({ id: newId('offer'), kind: 'media', media: m.id, outlet, year: store.state.year, status: 'open' });
    log(`${outlet} ${m.text}.`, 'system', 'good');
  }
  // Recognition costs some privacy: strangers recognize you, and some go too far.
  if (r.recognition >= 55 && rng.chance(0.15) && !world().safety.some((s) => s.kind === 'privacy' && s.status === 'open')) {
    const acc = activeAccountsOf(p.id).find((a) => a.visibility === 'public') ?? activeAccountsOf(p.id)[0];
    world().safety.push({ id: newId('safe'), charId: p.id, kind: 'privacy', accountId: acc.id, year: store.state.year, status: 'open' });
    log(`${SAFETY.privacy.text} You can deal with it in Digital Life.`, 'system', 'bad');
    if (p.traits.includes('worrier')) p.stats.mood = clamp(p.stats.mood - 3);
  }
  // Something the player really did, which the police never solved, can surface as an allegation once enough people know the name.
  if (r.recognition >= 30 && (p.legal?.unsolved ?? []).length && rng.chance(0.08)) {
    const c = raise('allegation', { text: 'Someone online is saying you were involved in something years ago. They have no proof, but they are not wrong.' });
    if (c) { p.legal.heat = clamp(p.legal.heat + 5); log(c.text, 'system', 'bad'); }
  }
}
