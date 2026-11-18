// What the justice scenes in data/events/justice.js do: they create the real
// incidents, statements, juries and claims behind the words.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, milestone } from '../state.js';
import * as k from './cases.js';
import { freshCase } from './legalCareers.js';
import { bringClaim } from './civil.js';
import { standBy } from './kinCases.js';
import { careChoice } from './guardianship.js';

/** @returns {string} a line added to the scene's outcome, or '' */
export function justiceScene(value, cast = {}) {
  const p = player();
  if (value.startsWith('kin_')) return standBy(value, cast.kin);
  if (value.startsWith('care_')) return careChoice(value);
  if (value.startsWith('witness_')) {
    const perp = k.civilian(p.countryId, { age: rng.int(17, 40) });
    const victim = k.civilian(p.countryId);
    const report = value === 'witness_report';
    const inc = k.createIncident({ offenseId: 'robbery', perpetratorId: perp.id, victimId: victim.id, countryId: p.countryId, city: p.city, witnessIds: report ? [p.id] : [] });
    if (value === 'witness_none' && rng.chance(0.5)) return '';
    const inv = k.openInvestigation(inc);
    if (report) {
      // How good the player's account is depends on them, not on the plot.
      const mine = inv.evidenceIds.map((id) => k.J().evidence[id]).find((e) => e.sourceId === p.id);
      if (mine) mine.reliability = Math.round(clamp(0.45 + p.stats.intellect / 250 + rng.next() * 0.15, 0.3, 0.9) * 100) / 100;
      k.note(p.id, 'witness', `Gave a statement to the police about a robbery in ${p.city}.`);
      const right = mine?.pointsTo === perp.id;
      return right ? '' : 'Afterward, you are not quite as sure of the face as you were when you said it.';
    }
    return '';
  }
  if (value === 'jury') {
    const c = freshCase({ innocent: 0.2 });
    if (!c) return '';
    k.runToEnd(c, { plea: 'notGuilty' });
    k.note(p.id, 'jury', `Served on a jury: ${k.nameOf(c.defendantId)} was found ${c.stage === 'sentenced' ? 'guilty' : 'not guilty'}.`, c.id);
    if (!p.flags.servedJury) { p.flags.servedJury = true; milestone('Served on a jury.', 'life'); }
    return c.stage === 'sentenced' ? `In the end the jury found ${k.nameOf(c.defendantId)} guilty.` : `In the end the jury found ${k.nameOf(c.defendantId)} not guilty.`;
  }
  if (value === 'civil_deposit') {
    const r = bringClaim('deposit');
    return r.ok ? 'The claim is in. You will find it under Legal matters in Pursuits.' : r.text;
  }
  if (value === 'ancestor_read') {
    const a = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.flags.tag === 'recordedAncestor');
    if (a) k.note(p.id, 'family', `Read the court records of ${a.firstName} ${a.lastName}.`);
    return '';
  }
  if (value === 'mentor') {
    if (!p.flags.mentoredYoung) { p.flags.mentoredYoung = true; milestone('Began mentoring young people in trouble.', 'life'); }
    return '';
  }
  return '';
}
