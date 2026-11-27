// Callbacks: years later, someone from the player's past comes back into the story, because of something that really
// happened between them. Each kind looks only at recorded history (a placement that ended, a lease shared, a school
// friendship that faded, a step-parent who stayed close) and at how that person's own life has gone since (engine/
// npcLives.js). Nothing is invented: no reunion without the history, no wedding without the marriage.
//
// Once a world year, at most one callback, each kind once per person (player.flags.callbacks). Keyed dice, so 3-, 6- and
// 12-month turns bring the same ones.
//
//   cb_care_wedding      a child who lived with the player in foster care, grown and married, invites them
//   cb_roommate_job      an old roommate, now senior in their field, knows of an opening the player is qualified for
//   cb_school_friend     a school friend the player lost touch with gets in touch, ten years or more on
//   cb_former_step       a former step-parent who stayed close turns up for a milestone birthday
//   cb_stepsib_wedding   a step-brother or step-sister who has married invites the player
import { clamp } from '../util.js';
import { store, player, log } from '../state.js';
import { keyedDice } from './keyedDice.js';
import { storyBeat } from './storyDirector.js';
import { remember } from './conditions.js';
import { recordEvent } from './chronicle.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { unmet, hire } from './career.js';

const S = () => store.state;
const npc = (id) => S().npcs[id] ?? null;
const done = (p) => (p.flags.callbacks ??= {});
const seen = (p, kind, id) => !!done(p)[`${kind}:${id}`];
const mine = (p) => p.npcIds.map(npc).filter((n) => n?.alive);
/** The year a placement with this child ended, from the record. */
const placementEnded = (p, id) => (p.fostering?.placements ?? []).find((x) => x.childId === id && x.end != null)?.end ?? null;
const leftSchoolAt = (p) => (p.education?.degrees ?? []).find((d) => d.type === 'high')?.age ?? null;

/** Each kind: who it could be about now, and how likely it is this year. */
const KINDS = [
  { id: 'cb_care_wedding', chance: 0.5,
    who: (p) => mine(p).filter((n) => (n.flags.formerPlacement || /foster care|in care/.test(n.flags.title ?? '')) && n.age >= 20 && n.life?.married && (n.flags.weddingYear ?? 0) >= S().year - 1
      && n.meters.relationship >= 40 && (placementEnded(p, n.id) ?? S().year) <= S().year - 4) },
  { id: 'cb_roommate_job', chance: 0.35,
    who: (p) => (p.age >= 22 && p.age <= 60 && !p.career.careerId && !p.legal?.incarceration ? mine(p).filter((n) => /roommate/i.test(n.flags.title ?? '') && (n.life?.job?.level ?? 0) >= 2
      && CAREER_BY_ID[n.life.job.careerId] && !unmet(CAREER_BY_ID[n.life.job.careerId]).length) : []) },
  { id: 'cb_school_friend', chance: 0.12,
    who: (p) => { const left = leftSchoolAt(p); if (left == null || p.age - left < 10) return [];
      return mine(p).filter((n) => n.flags.metAt && n.role === 'friend' && n.meters.relationship < 35 && Math.abs(n.age - p.age) <= 2); } },
  { id: 'cb_former_step', chance: 0.6,
    who: (p) => ([30, 40, 50].includes(p.age) ? mine(p).filter((n) => n.role === 'stepparent' && n.flags.former && n.meters.relationship >= 50) : []) },
  { id: 'cb_stepsib_wedding', chance: 0.6,
    who: (p) => mine(p).filter((n) => n.role === 'stepsibling' && n.life?.married && (n.flags.weddingYear ?? 0) >= S().year - 1 && n.meters.relationship >= 45) },
];

/** Once a world year: at most one person from the past, by a history that is really there. */
export function tickCallbacks() {
  const p = player();
  if (!p?.alive) return null;
  const d = keyedDice(`callbacks/${S().slotId}/${p.id}/${S().year}`);
  for (const k of KINDS) {
    const people = k.who(p).filter((n) => !seen(p, k.id, n.id));
    if (!people.length || !d.chance(k.chance)) continue;
    const n = people[0];
    done(p)[`${k.id}:${n.id}`] = S().year;
    storyBeat(k.id, { them: n.id }, { source: 'friends', must: true });
    return { kind: k.id, id: n.id };
  }
  return null;
}

/** A choice in a callback scene (data/events/callbacks.js). */
export function callbackChoice(value, cast = {}) {
  const p = player();
  const n = npc(cast.them);
  if (!n) return '';
  const bump = (x) => { n.meters.relationship = clamp(n.meters.relationship + x); n.lastInteractionAge = p.age; };
  const mark = (title, type) => recordEvent({ key: `callback:${type}:${n.id}:${S().year}`, type: 'reunion', title, people: [n.id], significance: 1, privacy: 'family' });
  switch (value) {
    case 'wed_go': bump(10); remember(n, 'cameToTheirWedding', 'Came to their wedding, years after they lived with you.'); mark(`${n.firstName}'s wedding`, 'wedding'); p.stats.mood = clamp(p.stats.mood + 8);
      return `You sit near the front. In the speech, ${n.firstName} thanks "the people who took me in when I needed it." You did not expect that, and you do not manage to hide it.`;
    case 'wed_gift': bump(4); return 'You send a gift and a card, and keep their reply.';
    case 'job_take': {
      const career = CAREER_BY_ID[n.life?.job?.careerId];
      if (!career || unmet(career).length || p.career.careerId) return 'By the time you call, the post has gone. You stay in touch anyway.';
      hire(career, 0, 55, 'referral');
      bump(6); remember(n, 'gotYouAJob', 'Put your name forward for a job, years after you shared a flat.');
      mark(`${n.firstName} helped you into work`, 'job');
      return `You start at ${n.firstName}'s firm the next month. "Do not make me regret this," ${n.firstName} says, grinning.`;
    }
    case 'job_no': bump(1); return `You thank ${n.firstName} and say it is not for you. You arrange a drink instead.`;
    case 'friend_meet': bump(18); remember(n, 'reconnected', 'Got back in touch years after school.'); mark(`Caught up with ${n.firstName}`, 'friend');
      return `You meet for coffee and stay four hours. It is as if no time has passed, and also as if all of it has.`;
    case 'friend_reply': bump(8); return 'You write back. Long messages, every few weeks, for a while.';
    case 'friend_leave': return 'You leave it unanswered. Some things are better as they were.';
    case 'step_glad': bump(8); remember(n, 'cameToBirthday', `Came to your ${p.age}th birthday, years after it ended with your parent.`);
      return `${n.firstName} brings the same kind of cake as when you were small. Somebody asks who they are, and you say "family," and leave it at that.`;
    case 'step_polite': bump(2); return 'You thank them for coming. It is kind, and a little strange.';
    case 'sib_go': bump(10); mark(`${n.firstName}'s wedding`, 'wedding'); remember(n, 'cameToTheirWedding', 'Came to their wedding.');
      return `You dance with ${n.firstName}'s new in-laws and tell the story of the summer you two shared a room. ${n.firstName} pretends to be embarrassed.`;
    case 'sib_gift': bump(3); return 'You send a gift. They send a photograph back.';
    default: log('', 'system'); return '';
  }
}
