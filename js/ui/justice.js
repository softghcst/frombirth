// The court flow: lawyer, plea, verdict. The open case is saved after every
// step, so closing the app mid-trial resumes where it left off.
import { country } from '../state.js';
import { fmtMoney } from '../util.js';
import * as law from '../engine/justice.js';
import { CRIME_BY_ID, LIFE_SENTENCE } from '../data/crimes.js';
import { messageModal, pickModal } from './modals.js';

/** Runs any open case to its verdict. Safe to call when there is none. */
export async function runJustice(api) {
  const c = country();
  while (law.pendingCase()) {
    const pending = law.pendingCase();
    const crime = CRIME_BY_ID[pending.crimeId];
    if (!pending.lawyer) {
      const id = await pickModal({
        title: 'You have been charged',
        body: `The charge is ${crime.charge}. ${pending.evidence > 0.7 ? 'You were caught in the act.' : 'The case against you is built on evidence gathered since.'} Who will defend you?`,
        cancel: 'Take the public defender',
        options: law.lawyerOptions().map((x) => ({ value: x.id, label: x.name, disabled: !x.affordable,
          sub: `${x.blurb}${x.cost ? ` ${fmtMoney(x.cost, c)}.` : ''}` })),
      });
      const hired = law.hireLawyer(id ?? 'public');
      api.changed();
      if (!hired.ok) continue;
    }
    const top = crime.sentence[1] >= LIFE_SENTENCE ? 'life' : `${crime.sentence[1]} years`;
    const plea = await pickModal({
      title: 'How do you plead?',
      body: `${law.trialOutlook()} ${crime.minor ? 'A first offense usually means a fine.' : `The sentence could be anything up to ${top}.`}`,
      cancel: 'Plead not guilty',
      options: [
        { value: 'notGuilty', label: 'Not guilty', sub: 'Go to trial. Walk free if the jury believes you.' },
        { value: 'guilty', label: 'Guilty', sub: 'No trial. A certain conviction, and a much shorter sentence.' },
      ],
    });
    const verdict = law.enterPlea(plea ?? 'notGuilty');
    api.changed();
    await messageModal({ eyebrow: 'The verdict', body: verdict.text, tone: verdict.tone });
  }
}
