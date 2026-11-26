// True-crime media. Years later, a podcast or a documentary takes up an old case from the public record: a cold
// case, or a conviction. Public attention follows (which a conviction review can take up, never a verdict), and
// someone who never came forward may finally do so: a lead, to be checked like any other.
//
// The player may be asked to take part: as the investigator who worked it, or as a descendant of the one who did.
// Speaking to what was public is fine; telling what was in the case file is a breach. Declining is always allowed.
import { store, player } from '../../state.js';
import * as k from '../cases.js';
import { W, rec, now, year, me, result, seeded, regard, legacies, nameOfId } from './core.js';
import { incidentOf } from './casework.js';

const nm = (id) => nameOfId(id);
const SHOWS = ['The Long Night', 'Cold Files', 'Unsolved on Main Street', 'What the Jury Heard', 'The Quiet Street'];
const media = () => { const w = W(); w.media ??= {}; return w.media; };

/** Old cases in the public record that a show might take up: cold for years, or a conviction long ago. */
function candidates(countryId) {
  return Object.values(k.J().investigations).filter((inv) => {
    const f = inv.file;
    if (!f || f.mediaId || incidentOf(inv)?.countryId !== countryId) return false;
    const age = (now() - f.opened) / 12;
    const c = f.courtCaseId && k.J().cases[f.courtCaseId];
    return age >= 12 && (f.coldSince || c?.stage === 'sentenced');
  });
}
/** The year: maybe a show about an old case. */
export function mediaYear(p = player()) {
  const out = [];
  const roll = seeded(`media/${p.countryId}/${year()}`);
  if (!roll.chance(0.35)) return out;
  const inv = candidates(p.countryId)[0];
  if (!inv) return out;
  const f = inv.file;
  const id = `media_${inv.id}`;
  const kind = roll.pick(['podcast', 'documentary']);
  const show = { id, invId: inv.id, kind, title: `${roll.pick(SHOWS)}: ${f.title}`, year: year(), cold: !!f.coldSince };
  media()[id] = show;
  f.mediaId = id;
  f.publicAttention = year();
  // Someone who never came forward may now: a lead, not a fact.
  if (roll.chance(0.5)) {
    f.leads.push({ id: `media_lead_${inv.id}`, text: `After the ${kind} "${show.title}", someone who was near the scene that night called in. They never told anyone before. It needs checking.`, why: `A ${kind}`, status: 'open', at: now() });
    show.lead = true;
  }
  out.push(`A ${kind}, "${show.title}", takes up an old case.${show.lead ? ' Someone has come forward because of it.' : ''}`);
  // The player is asked to take part if they worked it, or their ancestor did.
  const mine = f.leadId === me(p) || (inv.investigatorIds ?? []).includes(me(p));
  const anc = legacies().find((x) => x.id === (f.ancestorId ?? f.formerLeadId ?? f.leadId));
  if (mine || anc) { show.askId = me(p); show.as = mine ? 'investigator' : 'descendant'; show.ancestor = anc?.name ?? null; }
  return out;
}
export const invitations = (p = player()) => Object.values(media()).filter((m) => m.askId === me(p) && !m.answered);
/** How the player takes part: within the public record, not at all, or telling what the file held. */
export function takePart(id, how, p = player()) {
  const m = media()[id];
  if (!m || m.askId !== me(p) || m.answered) return result(false, 'There is no invitation.', 'neutral');
  m.answered = how;
  const r = rec(p);
  if (how === 'decline') return result(true, 'You decline. Some cases are better left to the people they belong to.', 'neutral');
  if (how === 'file') {
    if (r) { regard('ethics', -8); regard('integrity', -5); }
    if (r?.job) { const cid = `complaint_media_${id}`; W().complaints[cid] = { id: cid, subjectId: me(p), kind: 'confidentiality', text: 'Details from a case file were told to a podcast.', invId: m.invId, opened: now(), due: now() + 6, status: 'open', true: true }; }
    return result(true, 'You tell them what was in the file: names, statements, what one witness said off the record. The episode is the most listened to of the series. The people in it did not agree to be.', 'bad');
  }
  if (r) regard('reliability', 1);
  return result(true, m.as === 'investigator' ? 'You talk about the case as the public record has it, and about what it was like to work it. You do not name anyone who was never charged.' : `You talk about ${m.ancestor}, and what the case meant to the family, from what was public.`);
}
export const shows = (countryId = player().countryId) => Object.values(media()).filter((m) => incidentOf(k.J().investigations[m.invId])?.countryId === countryId);
