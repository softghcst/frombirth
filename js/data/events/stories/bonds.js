// Scenes of the relationships kept by engine/bonds.js. None is drawn by chance: each is queued by that engine when the
// thing it is about has really happened to these two people (queuedOnly), and each choice goes back to it (bondChoice).
import { any } from '../helpers.js';

const b = (value) => ({ type: 'bond', value });
const scene = (id, text, choices) => ({ id, category: 'marriage', ageRange: [18, 120], queuedOnly: true, text,
  choices: choices.map(([label, value, line, tone = 'neutral']) => ({ label, outcomes: [any(line, tone, b(value))] })) });

export default [
  scene('romance_complicated_001', 'A Complicated Romance. You have been seeing {them} in private for some time, and lately they have gone quiet at the end of every evening. Tonight they say it: "I care about you, but I do not want to keep pretending this does not exist. What are we doing?"', [
    ['Have an honest conversation', 'complicated:honest', 'You tell {them} how you feel, and what you do not know.'],
    ['Discuss making the relationship public', 'complicated:public', 'You say that you may be ready for it not to be a secret.'],
    ['Explain you are not ready for more', 'complicated:notReady', 'You tell {them} that this, as it is, is what you can give.'],
    ['End the relationship respectfully', 'complicated:end', 'You tell {them} that it would be kinder to stop.'],
  ]),
  scene('bond_promise', 'A Promise You Made. A year ago you told {them} that soon it would not be a secret. They have not mentioned it since. Tonight they do: "You said soon."', [
    ['Follow through', 'promise:keep', 'You do what you said you would.'],
    ['Discuss changing the plan', 'promise:change', 'You ask {them} for a little longer, and say why.'],
    ['Explain that things have changed', 'promise:explain', 'You tell {them} that you cannot do it after all.', 'bad'],
  ]),
  scene('bond_answer', 'They Need an Answer. {them} has given you the time you asked for. "I am not asking for everything. I am asking what this is."', [
    ['Choose them, openly', 'answer:commit', 'You tell {them} that you want this, and not in secret.'],
    ['Ask to go on as you are', 'answer:asIs', 'You say that you want things to stay as they are.'],
    ['Let them go', 'answer:end', 'You tell {them} they deserve an answer, and that the answer is no.'],
  ]),
  scene('bond_questions', 'Someone Is Asking Questions. {love} has noticed something: an evening you could not account for, a name that came up twice. They are not accusing you. They ask, carefully, whether there is anything they should know.', [
    ['Tell the truth', 'questions:truth', 'You tell {love} about {them}.'],
    ['Say there is nothing', 'questions:deny', 'You say there is nothing to know.'],
    ['Say there is nothing, and end it with {them}', 'questions:end', 'You say there is nothing to know, and decide that soon there will not be.'],
  ]),
  scene('bond_truth', 'The Truth Comes Out. {love} knows about {them}: {how}. They are standing in the kitchen with their coat still on. "Is it true?"', [
    ['Tell the whole truth, and apologize', 'truth:truth', 'You tell {love} everything, and say you are sorry.'],
    ['End it with {them}, and ask for another chance', 'truth:another', 'You say it is over with {them} as of now, and ask {love} not to give up on you.'],
    ['Ask whether the two of you could agree different terms', 'truth:boundaries', 'You say that perhaps the promise you made each other was the wrong one.'],
    ['Accept that it is over', 'truth:separate', 'You do not ask {love} to stay.', 'bad'],
  ]),
];
