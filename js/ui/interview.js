// A part-time job interview (engine/partTime.js interviewFor): one question from the manager, three ways to answer.
// Then the application goes in with that answer. Resolves the result, or null if the player decided not to go.
import { pickModal } from './modals.js';
import * as pt from '../engine/partTime.js';

export async function interviewThenTake(id) {
  const iv = pt.interviewFor(id);
  const answer = await pickModal({ title: 'The Interview', body: `At ${iv.place}, the manager looks up from your form. ${iv.question}`, cancel: 'Not today',
    options: iv.answers.map((a) => ({ value: a.id, label: a.label })) });
  if (answer == null) return null;
  return pt.takeJob(id, answer);
}
