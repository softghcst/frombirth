// Standing online: controversies (with what actually happened kept apart from
// what people say happened), safety problems and what the player can do
// about them, and how much of their life they give to screens.
import { rng } from '../../rng.js';
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { PLATFORM_BY_ID, DIGITAL_AGES } from '../../data/digital.js';
import { world, newId, charOf, acts, result, recordEvent, reputation, adjustReputation, spendHours, spareHours } from './core.js';
import { accountsOf, activeAccountsOf, account, followerCount, block as blockAccount, updateAccount } from './accounts.js';
import { FAMILY } from './messaging.js';

/**
 * Kinds of controversy. `truth` is whether the conduct people talk about
 * really happened: decided by the game's own record, never by the noise.
 */
export const CONTROVERSY = {
  misunderstood: { name: 'A misunderstood post', status: 'rumor', truth: false },
  rumor: { name: 'A rumor', status: 'rumor', truth: false },
  undisclosed_ad: { name: 'Hidden advertising', status: 'verified', truth: true },
  opinion: { name: 'An unpopular opinion', status: 'verified', truth: true },
  // A claim about something the player really did: an allegation, not a conviction. Courts are the Justice engine's business.
  allegation: { name: 'An allegation', status: 'allegation', truth: true },
  // A private message that someone shared without asking: the words were real, the sharing was not the player's doing.
  leak: { name: 'A leaked private message', status: 'verified', truth: true },
  charity: { name: 'A charity drive', status: 'resolved', truth: true, positive: true },
};

export const RESPONSES = [
  { id: 'clarify', label: 'Explain what you meant' },
  { id: 'correct', label: 'Correct the record with facts' },
  { id: 'apologize', label: 'Apologize' },
  { id: 'silence', label: 'Say nothing and let it pass' },
  { id: 'advice', label: 'Get professional advice first', cost: 1500 },
  { id: 'remove', label: 'Take the post down' },
  { id: 'break', label: 'Take a break from posting' },
];

export const openControversies = (charId = player().id) => Object.values(world().controversies).filter((c) => c.charId === charId && !c.resolvedYear);
export const controversiesOf = (charId = player().id) => Object.values(world().controversies).filter((c) => c.charId === charId);

/** Starts a controversy from something that really happened (a post, a deal). Never two at once, and not every year. */
export function raise(kind, o = {}) {
  const p = player();
  const d = world();
  const recent = controversiesOf(p.id).some((c) => c.year >= store.state.year - 5 && !CONTROVERSY[c.kind].positive);
  if (openControversies(p.id).length || recent) return null;
  const def = CONTROVERSY[kind];
  const c = { id: newId('cv'), charId: p.id, kind, status: def.status, truth: def.truth, year: store.state.year, response: null, resolvedYear: null, postId: o.postId ?? null, text: o.text };
  d.controversies[c.id] = c;
  adjustReputation(p.id, 'recognition', 2, `${def.name} got people talking`);
  if (def.truth) adjustReputation(p.id, 'credibility', -4, def.name);
  else adjustReputation(p.id, 'credibility', -1.5, `${def.name}, not yet answered`);
  return c;
}

/**
 * The player's answer to a controversy. What works depends on what really
 * happened: denying something true backfires; apologizing for something that
 * never happened costs a little; facts help when the facts are on your side.
 * Resolved controversies stay resolved.
 */
/** Babies and small children have no life online: nothing here can be done by them. */
const tooYoung = () => player().age < DIGITAL_AGES.digitalLife;
const TOO_YOUNG = 'You are too young for a life online.';

export function respond(cvId, responseId) {
  if (tooYoung()) return result(false, TOO_YOUNG);
  const p = player();
  const c = world().controversies[cvId];
  if (!c || c.charId !== p.id) return result(false, 'There is nothing to answer.');
  if (c.resolvedYear) return result(false, 'That is behind you now.');
  const r = RESPONSES.find((x) => x.id === responseId);
  if (!r) return result(false, 'Not a response.');
  if (r.cost) {
    const cost = localMoney(r.cost, country());
    if (p.finance.cash < cost) return result(false, `Advice like that costs ${fmtMoney(cost, country())}.`);
    p.finance.cash -= cost;
  }
  const why = (s) => `${CONTROVERSY[c.kind].name}: ${s}`;
  let text; let tone = 'good';
  const t = c.truth;
  switch (responseId) {
    case 'clarify':
    case 'correct':
      if (t) { adjustReputation(p.id, 'credibility', -5, why('denied something that was true')); text = 'People had the receipts. Pushing back made it worse.'; tone = 'bad'; }
      else { adjustReputation(p.id, 'credibility', responseId === 'correct' ? 4 : 3, why('set the record straight')); c.status = 'cleared'; text = 'Most people took your word for it, and the ones who mattered saw the facts.'; }
      break;
    case 'apologize':
      if (t) { adjustReputation(p.id, 'credibility', 3, why('owned up')); adjustReputation(p.id, 'loyalty', 1, why('owned up')); text = 'A plain apology, without excuses. It did not make everyone happy, but it was the right thing and people could tell.'; }
      else { adjustReputation(p.id, 'loyalty', -1, why('apologized for something that did not happen')); text = 'You apologized to make it stop. It stopped. Some people now think you did it.'; tone = 'neutral'; }
      break;
    case 'silence':
      adjustReputation(p.id, 'credibility', t ? -1 : 0.5, why('said nothing'));
      text = t ? 'You kept quiet. It faded, slowly, without ever quite going away.' : 'You said nothing. A week later, everyone had moved on.';
      tone = 'neutral';
      break;
    case 'advice':
      adjustReputation(p.id, 'credibility', t ? 2 : 4, why('handled it carefully'));
      if (!t) c.status = 'cleared';
      text = 'A professional helped you say the right thing, once, clearly. It helped.';
      break;
    case 'remove': {
      const post = c.postId ? world().posts[c.postId] : null;
      if (post && !post.removed) post.removed = 'author';
      adjustReputation(p.id, 'credibility', t ? 0.5 : -0.5, why('took the post down'));
      text = post ? 'You took the post down. Screenshots live forever, but the argument ran out of fuel.' : 'There was nothing to take down.';
      tone = 'neutral';
      break;
    }
    case 'break':
      takeBreak();
      text = 'You stepped away from posting for a while. The noise went on without you, and then it stopped.';
      tone = 'neutral';
      break;
    default:
      text = 'Nothing changed.';
  }
  c.response = responseId;
  c.resolvedYear = store.state.year;
  if (c.status === 'rumor') c.status = 'resolved';
  if (c.kind !== 'charity' && reputation(p.id).credibility >= 55 && ['apologize', 'correct', 'advice'].includes(responseId)) {
    recordEvent({ kind: 'reputation_recovery', charIds: [p.id], summary: `${CONTROVERSY[c.kind].name} came and went. ${text}`, visibility: 'public', once: `recovery_${c.id}`, tone: 'neutral' });
  } else log(text, 'system', tone);
  return result(tone !== 'bad', text, tone);
}

/** A fundraiser for a good cause, run through the player's public following. The money goes to the charity, not the player. */
export function fundraise(accountId) {
  if (tooYoung()) return result(false, TOO_YOUNG);
  const p = player();
  const acc = account(accountId);
  if (!acc || acc.ownerId !== p.id || acc.status !== 'active') return result(false, 'That is not one of your accounts.');
  if (p.age < 18) return result(false, 'Fundraisers have to be run by an adult.');
  if (acc.visibility !== 'public' || followerCount(acc) < 50) return result(false, 'A fundraiser needs a public account with some followers.');
  if (acts().fundraiser) return result(false, 'One fundraiser a year.');
  if (!spendHours(10)) return result(false, 'No spare time left this year.');
  acts().fundraiser = true;
  const rep = reputation(p.id);
  const raised = localMoney(Math.max(40, followerCount(acc) * rng.around(0.05, 0.02) * (0.5 + rep.credibility / 100)), country());
  p.counters.donated += Math.round(raised / country().currency.scale);
  adjustReputation(p.id, 'credibility', 2, 'Ran a charity fundraiser');
  adjustReputation(p.id, 'loyalty', 2, 'Ran a charity fundraiser');
  p.hidden.karma = clamp(p.hidden.karma + 3);
  const text = `Your followers raised ${fmtMoney(raised, country())} for charity. Every bit of it went to the cause.`;
  const cvId = newId('cv');
  world().controversies[cvId] = { id: cvId, charId: p.id, kind: 'charity', status: 'resolved', truth: true, year: store.state.year, response: null, resolvedYear: store.state.year, text };
  recordEvent({ kind: 'charity', charIds: [p.id], platformId: acc.platformId, summary: text, visibility: 'public', tone: 'good' });
  return result(true, text, 'good');
}

// ---------- Safety ----------

export const SAFETY = {
  bullying: { name: 'Cyberbullying', text: 'Someone from school has been posting cruel things about you.' },
  unwanted: { name: 'Unwanted contact', text: 'A stranger keeps sending you messages, though you have never replied.' },
  impersonation: { name: 'Impersonation', text: 'An account is pretending to be you.' },
  signin: { name: 'Suspicious sign-in', text: 'Someone tried to sign in to your account from somewhere you have never been.' },
  privacy: { name: 'Too much attention', text: 'People who recognize you online have started turning up where you go, and someone posted which neighborhood you live in.' },
};

export const openSafety = () => world().safety.filter((s) => s.charId === player().id && s.status === 'open');

/** Handles a safety problem. Every option here is a sensible one; the game never rewards the person causing the harm. */
export const SAFETY_ACTIONS = {
  bullying: [['tell', 'Tell a parent or another adult you trust'], ['block', 'Block and report them'], ['private', 'Make your account private'], ['break', 'Take a break from it']],
  unwanted: [['block', 'Block and report them'], ['restrict', 'Only accept messages from people you follow'], ['tell', 'Tell someone you trust']],
  impersonation: [['report', 'Report the fake account'], ['post', 'Tell your followers which account is really you']],
  signin: [['secure', 'Change your password and turn on two-step sign-in'], ['ignore', 'Ignore it']],
  privacy: [['report', 'Report the post with your neighborhood in it'], ['private', 'Make your accounts private for a while'], ['tell', 'Tell someone you trust'], ['break', 'Step back from posting']],
};

export function handleSafety(safetyId, actionId) {
  if (tooYoung()) return result(false, TOO_YOUNG);
  const p = player();
  const s = world().safety.find((x) => x.id === safetyId && x.charId === p.id);
  if (!s || s.status !== 'open') return result(false, 'That is dealt with.');
  const acc = account(s.accountId);
  let text = '';
  let done = true;
  switch (actionId) {
    case 'tell': {
      const trusted = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age >= 18 && ['parent', 'grandparent', 'sibling', 'mentor', 'spouse', 'partner', 'friend'].includes(n.role)).sort((a, b) => b.meters.relationship - a.meters.relationship)[0];
      if (!trusted) { text = 'There was nobody to tell. You reported it to the platform instead, and it stopped.'; break; }
      trusted.meters.relationship = clamp(trusted.meters.relationship + 4);
      trusted.lastInteractionAge = p.age;
      p.stats.mood = clamp(p.stats.mood + 4);
      text = `You told ${trusted.firstName}. They helped you report it${s.kind === 'bullying' && p.education?.enrolled ? ' and spoke to the school' : ''}. It stopped, and you felt less alone.`;
      break;
    }
    case 'block':
    case 'report':
      text = `${PLATFORM_BY_ID[acc?.platformId]?.name ?? 'The platform'} removed the account after your report.`;
      break;
    case 'private':
      if (acc && PLATFORM_BY_ID[acc.platformId].privacy.includes('private')) updateAccount(acc.id, { visibility: 'private' });
      text = 'Your account is private now. It went quiet.';
      break;
    case 'restrict':
      if (acc) updateAccount(acc.id, { messages: 'connections' });
      text = 'Strangers cannot message you any more.';
      break;
    case 'break':
      takeBreak();
      text = 'You took a break. When you came back, it had blown over.';
      break;
    case 'post':
      adjustReputation(p.id, 'credibility', 1, 'Warned followers about an impersonator');
      text = 'Your followers reported the fake for you. It was gone in a day.';
      break;
    case 'secure':
      if (acc) acc.security = { strong: true, twoStep: true };
      for (const a of accountsOf(p.id)) a.security = { strong: true, twoStep: true };
      text = 'Your accounts are locked down. Nobody got in.';
      break;
    case 'ignore':
      if (rng.chance(0.4) && acc) {
        acc.status = 'locked';
        acc.lockedYear = store.state.year;
        text = 'Someone got into your account and posted spam. You are locked out until you recover it.';
        adjustReputation(p.id, 'credibility', -1, 'Account taken over');
      } else text = 'Nothing came of it this time.';
      break;
    default:
      done = false;
  }
  if (!done) return result(false, 'Not something you can do.');
  s.status = 'handled';
  s.action = actionId;
  s.handledYear = store.state.year;
  log(text, 'system', 'neutral');
  return result(true, text, 'good');
}

/** The year's safety problems. Rare, less likely for private, well-protected accounts, and never a required part of growing up. */
function tickSafety() {
  const p = player();
  const accs = activeAccountsOf(p.id);
  if (!accs.length || openSafety().length) return;
  const pub = accs.find((a) => a.visibility === 'public');
  const roll = rng.next();
  let kind = null; let acc = null;
  if (p.age < 18 && p.education?.enrolled && roll < (pub ? 0.04 : 0.015)) { kind = 'bullying'; acc = pub ?? accs[0]; }
  else if (roll < 0.06 && accs.some((a) => a.messages === 'everyone')) { kind = 'unwanted'; acc = accs.find((a) => a.messages === 'everyone'); }
  else if (roll < 0.08 && reputation(p.id).recognition >= 30 && pub) { kind = 'impersonation'; acc = pub; }
  else if (roll < 0.11 && accs.some((a) => !a.security?.twoStep)) { kind = 'signin'; acc = accs.find((a) => !a.security?.twoStep); }
  if (!kind) return;
  world().safety.push({ id: newId('safe'), charId: p.id, kind, accountId: acc.id, year: store.state.year, status: 'open' });
  log(`${SAFETY[kind].text} You can deal with it in Digital Life.`, 'system', 'bad');
  if (kind === 'bullying') p.stats.mood = clamp(p.stats.mood - 4);
}

/** Gets a compromised account back: proving who you are, then a new password and two-step sign-in. */
export function recoverAccount(accountId) {
  const acc = account(accountId);
  if (!acc || acc.ownerId !== player().id || acc.status !== 'locked') return result(false, 'That account is not locked.');
  if (!spendHours(3)) return result(false, 'Recovering an account takes a few hours you do not have this year.');
  acc.status = 'active';
  acc.security = { strong: true, twoStep: true };
  for (const id of acc.postIds) { const x = world().posts[id]; if (x?.spam) x.removed = 'spam'; }
  return result(true, `@${acc.handle} is yours again, with a new password and two-step sign-in.`, 'good');
}

// ---------- Well-being and time ----------

export function wellbeing(charId = player().id) {
  const w = world().wellbeing;
  w[charId] ??= {};
  w[charId].notifications ??= 'important';
  return w[charId];
}

/** A year away from posting. Accounts stay; people who care are still there when you come back. */
export function takeBreak() {
  if (tooYoung()) return result(false, TOO_YOUNG);
  const w = wellbeing();
  w.breakUntil = store.state.year + 1;
  w.breaks = (w.breaks ?? 0) + 1;
  return result(true, 'You are taking a break from social media until next year.', 'neutral');
}
export const onBreak = () => (wellbeing().breakUntil ?? 0) >= store.state.year;
export function endBreak() { if (tooYoung()) return result(false, TOO_YOUNG); wellbeing().breakUntil = store.state.year - 1; return result(true, 'Welcome back.', 'neutral'); }
/** A limit on how much of the year goes to screens: 'light', 'moderate' or none. */
export function setLimit(level) {
  if (tooYoung()) return result(false, TOO_YOUNG);
  if (![null, 'light', 'moderate'].includes(level)) return result(false, 'Not a setting.');
  wellbeing().limit = level;
  return result(true, level ? `You will keep screens to ${level === 'light' ? 'a little' : 'a moderate amount'} of your spare time.` : 'No limit on screen time.', 'neutral');
}

export function setNotifications(level) {
  if (tooYoung()) return result(false, TOO_YOUNG);
  if (!['all', 'important', 'off'].includes(level)) return result(false, 'Not a setting.');
  wellbeing().notifications = level;
  for (const a of activeAccountsOf(player().id)) a.notifications = level;
  return result(true, level === 'off' ? 'Notifications are off. Nothing will buzz.' : 'Notifications updated.', 'neutral');
}

/**
 * How the year online felt. Depends on the person: some love making things,
 * some find attention draining, and a hard year online is softened by friends.
 * A small nudge to mood at most; screens never decide whether someone is happy.
 */
function tickWellbeing() {
  const p = player();
  const d = world();
  const w = wellbeing();
  if (!activeAccountsOf(p.id).length) return;
  // The tick runs as a new year starts: this looks back at the year that has just ended.
  const last = store.state.year - 1;
  const mine = Object.values(d.posts).filter((x) => x.authorId === p.id && x.year === last);
  const hostile = mine.reduce((s, x) => s + x.comments.filter((c) => c.tone === 'hostile' && !c.hidden).length, 0);
  const warm = mine.reduce((s, x) => s + x.comments.filter((c) => c.authorId && c.tone === 'warm').length, 0);
  const busy = d.lastYearUse?.year === last ? d.lastYearUse.used : 0;
  const heavy = busy >= spareHours() * 0.85 && busy >= 150;
  w.heavyYears = heavy ? (w.heavyYears ?? 0) + 1 : 0;
  const frets = p.traits.includes('worrier');
  const loves = p.traits.some((t) => ['radiant', 'dramatic', 'musical', 'sunny'].includes(t));
  let delta = 0;
  if (warm) delta += Math.min(2, warm * 0.5);
  if (hostile) delta -= Math.min(frets ? 4 : 2, hostile * (frets ? 1 : 0.5));
  if (busy > 300) delta -= frets ? 2 : 1;
  if (mine.some((x) => x.outcome === 'viral') && frets) delta -= 2;
  if (loves && mine.length) delta += 1;
  if (onBreak()) delta += frets ? 2 : 0.5;
  if (w.notifications === 'off') delta += 0.5;
  p.stats.mood = clamp(p.stats.mood + Math.round(delta));
  w.lastYear = { year: last, posts: mine.length, hostile, warm, hours: busy, mood: Math.round(delta) };
}

/** The year's reputation drift: attention fades without new reasons for it; trust slowly returns. */
export function tickReputation() {
  const p = player();
  const r = reputation(p.id);
  if (r.recognition > 0) adjustReputation(p.id, 'recognition', -Math.max(0.5, r.recognition * 0.06), 'Time passing');
  if (r.credibility < 60 && !openControversies().length) adjustReputation(p.id, 'credibility', 1, 'Time passing');
  // A post that drew an argument this year can become a misunderstanding people talk about.
  const argued = Object.values(world().posts).find((x) => x.authorId === p.id && x.year >= store.state.year - 1 && x.outcome === 'disagreement' && !x.removed);
  if (argued && rng.chance(0.35)) {
    const c = raise('misunderstood', { postId: argued.id, text: `A post of yours ("${argued.text}") has been taken the wrong way, and people are talking about it.` });
    if (c) log(c.text, 'system', 'bad');
  } else if (r.recognition >= 25 && rng.chance(0.06) && Object.values(world().threads).some((t) => t.messages.some((m) => m.from === p.id && m.intent === 'vent' && store.state.year - m.year <= 3))) {
    // Something the player really wrote, in private, that someone else shared.
    const c = raise('leak', { text: 'Someone screenshotted a private message where you complained about people, and shared it.' });
    if (c) log(c.text, 'system', 'bad');
  } else if (r.recognition >= 35 && rng.chance(0.05)) {
    const c = raise('rumor', { text: 'A rumor about you is going around online. It is not true.' });
    if (c) log(c.text, 'system', 'bad');
  }
  // Unanswered controversies settle on their own after a year, with a small, lasting cost.
  for (const c of openControversies()) {
    if (store.state.year - c.year >= 2) { c.resolvedYear = store.state.year; c.response = 'none'; adjustReputation(p.id, 'credibility', c.truth ? -2 : -0.5, `${CONTROVERSY[c.kind].name}, never answered`); }
  }
  // The Fame system and online recognition meet here: being widely known online raises general fame, slowly.
  if (r.recognition >= 40) p.hidden.fame = clamp(p.hidden.fame + 1);
  tickSafety();
  tickWellbeing();
}

export { blockAccount, FAMILY, charOf };
