// Scenes from a blended family (engine/blended.js): parents who separate, a parent's new partner, a step-brother or
// step-sister moving in, a parent's wedding. Each is queued only when it has really happened, about the people it
// happened with; each choice goes back to the engine (blendedChoice), which knows who they are.
import { any, need } from './helpers.js';

const b = (value) => ({ type: 'blended', value });
const scene = (id, ageRange, text, choices) => ({ id, category: 'family', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, value, requires]) => ({ label, ...(requires ? { requires } : {}), outcomes: [any(line, 'neutral', b(value))] })) });

export default [
  scene('blend_separation', [2, 17], 'Your parents sit you down together, which they never do. {staying} and {leaving} are separating. {leaving} is moving out; you will live mostly with {staying}, and see {leaving} {schedule}. Both of them say it, more than once: they are still your parents, and that does not change.', [
    ['Ask them both if it is because of you', 'You ask the question you were most afraid of.', 'sep_both'],
    ['Ask to live with {leaving} instead', 'You say it before you can stop yourself.', 'sep_ask', [need('age', '>=', 12)]],
    ['Say nothing', 'You nod, and go to your room.', 'sep_quiet'],
  ]),
  scene('blend_separation_adult', [18, 120], 'Your parents are separating, after all these years. {staying} and {leaving} each call you the same evening, each wanting you to understand.', [
    ['Tell them you love them both', 'You say you will not choose.', 'sepa_both'],
    ['Take a side', 'You tell one of them what you really think.', 'sepa_side'],
    ['Stay out of it', 'You keep out of it.', 'sepa_out'],
  ]),
  scene('blend_partner_kids', [18, 120], '{partner} has something to tell you, and has clearly been working up to it: there is a child in their life, {kid}, and {kid} comes first.', [
    ['Ask to meet {kid}', 'You say you would like to meet them.', 'pk_meet'],
    ['Take it slowly', 'You say there is no hurry.', 'pk_slow'],
    ['Admit it is a lot', 'You tell {partner} it is a lot to take in.', 'pk_alot'],
  ]),
  scene('blend_meet_partner', [3, 120], '{parent} wants you to meet someone: {partner}. You meet over a meal that has clearly been planned with great care. {partner} asks you questions and listens to the answers.', [
    ['Be friendly', 'You decide to give them a chance.', 'meet_warm'],
    ['Give it time', 'You are polite. You are not ready to be more than that.', 'meet_time'],
    ['Keep your distance', 'You answer in single words.', 'meet_cool'],
  ]),
  scene('blend_new_stepsibling', [3, 25], '{partner} has moved in, and so has {kid}. Their things are in boxes in the hall, and there is a new toothbrush in the bathroom that is not yours.', [
    ['Show them around', 'You show them where everything is.', 'step_show'],
    ['Give them some space', 'You let them settle in.', 'step_space'],
    ['Set out some rules', 'You explain how things work in this house.', 'step_rules'],
  ]),
  scene('blend_parent_wedding', [3, 120], '{parent} and {partner} are getting married. It is a small, warm day. At the end {parent} finds you, and asks how you feel about it, and means it.', [
    ['Tell them you are happy for them', 'You hug them both.', 'wed_glad'],
    ['Tell them it is complicated', 'You tell them the truth.', 'wed_honest'],
    ['Ask what you should call {partner}', 'You have been wondering.', 'wed_names'],
  ]),
  scene('blend_custody_heard', [10, 17], 'A court officer comes to talk to you, at school, in a quiet room with a box of tissues on the table. {staying} and {leaving} cannot agree where you should live, and the court wants to hear what you think. There is no wrong answer.', [
    ['Say you want to live with {staying}', 'You tell her what you think.', 'court_staying'],
    ['Say you want to live with {leaving}', 'You tell her what you think.', 'court_leaving'],
    ['Say you love them both', 'You say you just want to see both of them.', 'court_both'],
  ]),
];
