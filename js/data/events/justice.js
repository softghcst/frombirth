// Scenes where ordinary life meets the justice system from the outside: seeing
// something, being asked to help, sitting on a jury, a family member's case.
// Effects of type 'justice' are carried out by engine/justiceScenes.js, which
// creates the real incidents, statements and cases.
import { st, hid, ok, bad, any, chk, need } from './helpers.js';

const j = (value) => ({ type: 'justice', value });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    // Sent by engine/guardianship.js when a teenager faces a long stay with a carer who lives in another town.
    id: 'care_choice', category: 'family', ageRange: [10, 17], queuedOnly: true,
    text: '{carer} will be looking after you for a long while. {carer} lives in {town}. You could move there and start again at a new school, or {carer} could come and live with you here in {here}, near your school and your friends.',
    choices: [
      { label: 'Move to their town', outcomes: [any('You pack your room into boxes.', 'neutral', j('care_move'))] },
      { label: 'Ask them to come and live here', outcomes: [any('You ask. It is a lot to ask.', 'neutral', j('care_stay'))] },
    ],
  },
  {
    // Sent by engine/kinCases.js when a relative is charged. The case runs to its end with the choice made here.
    id: 'kin_charged', category: 'family', ageRange: [10, 120], queuedOnly: true,
    text: 'A phone call you will remember: {kin} has been charged with {offense}. {bail} They say they need you.',
    choices: [
      { label: 'Pay for a good lawyer for them', outcomes: [any('You make the calls, and you pay.', 'neutral', j('kin_lawyer'))] },
      { label: 'Be there: post bail if there is any, and sit in court every day', outcomes: [any('You are in the public gallery at every hearing.', 'good', j('kin_court'))] },
      { label: 'Keep your distance', outcomes: [any('You do not go. You hear about it from others.', 'bad', j('kin_distance'))] },
    ],
  },
  {
    id: 'witness_incident', category: 'everyday', ageRange: [14, 90], cooldown: 8, weight: 0.6,
    text: 'Waiting at a bus stop, you see a man snatch a bag from a woman outside the chemist and run. You saw his face, for a second or two.',
    choices: [
      { label: 'Go to the police and give a statement', outcomes: [any('You tell an officer what you saw, as carefully as you can. They take your details: you may be needed in court.', 'good', j('witness_report'), hid('karma', 5))] },
      { label: 'Help the woman, and leave it at that', outcomes: [any('You help her up and wait with her until her son arrives. You never hear what happened next.', 'good', j('witness_help'), hid('karma', 3))] },
      { label: 'Keep your head down', outcomes: [any('It is not your business. You get on the bus.', 'neutral', j('witness_none'))] },
    ],
  },
  {
    id: 'deposit_kept', category: 'money', ageRange: [19, 70], cooldown: 12, weight: 0.5, requires: [need('renting', '==', true)],
    text: 'Your landlord is keeping your whole deposit for "wear and tear" on an apartment you left spotless.',
    choices: [
      { label: 'Take them to the small claims court', outcomes: [any('You fill in the claim form and post it. It is a civil matter: nobody is in trouble, somebody owes somebody money.', 'neutral', j('civil_deposit'))] },
      { label: 'Write them a firm letter', check: chk(0.45, { 'stats.charm': 0.4, 'stats.intellect': 0.4 }), outcomes: [
        ok('A week later, the money is back in your account, without apology.', { type: 'cash', delta: 800 }),
        bad('No reply. The money is gone.', st('mood', -4)),
      ] },
      { label: 'Let it go', outcomes: [any('It is not worth the fight. It still annoys you every time you think of it.', 'neutral', st('mood', -3))] },
    ],
  },
  {
    id: 'ancestor_record', category: 'family', ageRange: [14, 90], once: true, weight: 2, requires: [need('ancestorRecord', '==', true)],
    text: 'Clearing out old papers, you find court letters about the family member whose life came before yours: a case, a court, years you never heard about.',
    choices: [
      { label: 'Read everything', outcomes: [any('It is all there: what they were accused of, what the court decided, what came after. It is part of the family story. It is not yours.', 'neutral', st('intellect', 1), j('ancestor_read'))] },
      { label: 'Put it back in the box', outcomes: [any('Some things can stay in the box. You know where it is if you ever want it.', 'neutral')] },
    ],
  },
  {
    id: 'record_question', category: 'work', ageRange: [19, 70], cooldown: 6, weight: 1, requires: [need('hasRecord', '==', true)],
    text: 'A job application asks: "Do you have any unspent criminal convictions?"',
    choices: [
      { label: 'Tell the truth, and explain what has changed', check: chk(0.45, { 'stats.charm': 0.5, 'hidden.discipline': 0.3 }), outcomes: [
        ok('The interviewer thanks you for being straight with them. You get a second interview.', st('mood', 5), hid('karma', 3)),
        bad('They are polite, and they do not call back.', st('mood', -5)),
      ] },
      { label: 'Do not apply', outcomes: [any('You close the form. There will be other jobs, ones that do not ask.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'mentor_young', category: 'everyday', ageRange: [30, 85], cooldown: 10, weight: 1, requires: [need('servedTime', '==', true)],
    text: 'A youth charity asks whether you would talk to teenagers who are heading the way you once went.',
    choices: [
      { label: 'Say yes', outcomes: [any('You tell it straight: what it cost, and what came after. One of them stays behind to ask more.', 'good', hid('karma', 6), st('mood', 6), j('mentor'))] },
      { label: 'Not yet', outcomes: [any('You are not ready to tell it. Maybe one day.', 'neutral')] },
    ],
  },
];

