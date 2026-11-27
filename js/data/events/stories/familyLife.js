// Scenes of Living Families & Growing Up. Every one is queued by the engine that knows it is true (engine/blended.js,
// teenLife.js, independence.js, engagement.js, fostering.js); none is drawn by chance. Each choice is handed back to
// its engine as 'feature:story:choice' (engine/familyLife.js familyLifeChoice).
import { any } from '../helpers.js';

const f = (value) => ({ type: 'family', value });
const scene = (id, category, ages, text, feature, choices) => ({ id: `fl_${id}`, category, ageRange: ages, queuedOnly: true, text,
  choices: choices.map(([label, choice, line, tone = 'neutral']) => ({ label, outcomes: [any(line, tone, f(`${feature}:${id}:${choice}`))] })) });

const pressure = (kind, text, yes) => scene(`pressure_${kind}`, 'family', [14, 17], text, 'teen', [
  [yes, 'yes', 'You go along with it.'],
  ['Say no', 'no', 'You say no.'],
  ['Make an excuse and leave', 'leave', 'You say you have to be somewhere, and go.'],
  ['Tell an adult', 'adult', 'You tell someone.', 'good'],
]);

export default [
  // Blended families
  scene('parents_split', 'family', [0, 17], 'Your parents are separating. {mom} and {dad} sit at either end of the sofa, with you in the middle, and say it is nobody\'s fault, least of all yours.', 'blended', [
    ['Ask all your questions', 'questions', 'You ask where you will live, and whether you can keep the dog, and why.'],
    ['Tell them it is their fault', 'blame', 'You tell them they have ruined everything.', 'bad'],
    ['Go to your room', 'room', 'You go upstairs and shut the door.'],
  ]),
  scene('stepparent_meet', 'family', [0, 17], 'Dinner, to meet {step} properly. {parent} has clearly cleaned the whole house. {step} brought dessert and is trying very hard.', 'blended', [
    ['Make them welcome', 'welcome', 'You ask {step} about themselves, and listen to the answers.', 'good'],
    ['Be polite, and no more', 'polite', 'You say please and thank you, and not much else.'],
    ['Make it clear you are not interested', 'cold', 'You eat in silence and leave before dessert.', 'bad'],
  ]),
  // Teenage life
  pressure('drink', 'At a party, {them} hands you a cup of something that is definitely not juice. "Everyone\'s having one."', 'Drink it'),
  pressure('vape', '{them} offers you a vape behind the sports hall. "It\'s nothing. Just try it."', 'Try it'),
  pressure('dare', '{them} dares you to take something from the corner shop. A few people are watching to see what you do.', 'Do the dare'),
  pressure('skip', '{them} has a plan: skip the afternoon and go to the beach. "Nobody takes the register after lunch."', 'Skip with them'),
  scene('bff_trouble', 'family', [12, 17], '{them} calls you at eleven at night, crying. Things at home are bad, and they do not know who else to talk to.', 'teen', [
    ['Listen for as long as it takes', 'listen', 'You listen.', 'good'],
    ['Tell them what you would do', 'advice', 'You tell them what you think.'],
    ['Change the subject', 'change', 'You try to cheer them up with something else.'],
  ]),
  // Moving out
  scene('rent_arrears', 'money', [18, 120], 'A letter from your landlord: the rent account is behind, and they would like it cleared.', 'home', [
    ['Pay what you can', 'pay', 'You transfer what you have.'],
    ['Put it in a drawer', 'drawer', 'You put it somewhere you cannot see it.', 'bad'],
  ]),
  scene('eviction_notice', 'money', [18, 120], 'A formal notice, taped to your door: pay what you owe within six months, or leave.', 'home', [
    ['Pay what you can', 'pay', 'You pay what you can.'],
    ['Ask to move back home', 'home', 'You call home.'],
    ['Hope it goes away', 'drawer', 'You take the notice down and pretend you never saw it.', 'bad'],
  ]),
  // Love and marriage
  scene('wedding_day', 'marriage', [18, 120], 'The date you set with {them} is here. The planning cannot wait any longer.', 'love', [
    ['Plan the wedding', 'plan', 'You sit down with {them} and a notebook.', 'good'],
    ['Postpone it', 'postpone', 'You ask {them} for more time.'],
  ]),
  scene('cold_feet', 'marriage', [18, 120], '{them} has gone quiet about the wedding. Tonight, finally: "Are we doing this because we want to, or because we said we would?"', 'love', [
    ['Talk it all through', 'talk', 'You stay up all night talking.', 'good'],
    ['Agree to postpone', 'postpone', 'You agree to slow down.'],
    ['Call it off', 'calloff', 'You say maybe you should not.', 'bad'],
  ]),
  // Foster care and guardianship
  scene('placement_offer', 'family', [21, 120], 'The fostering agency calls: a child of {age} needs somewhere to stay, tonight if possible.', 'care', [
    ['Say yes', 'yes', 'You make up the spare bed.', 'good'],
    ['Not this time', 'no', 'You say you cannot, this time.'],
  ]),
  scene('kinship', 'family', [21, 120], 'A call from the family: {them}\'s parent cannot cope any more, and someone needs to take {them} in, or the authorities will.', 'care', [
    ['Take {them} in', 'yes', 'You say yes before they finish asking.', 'good'],
    ['Help with money, not a home', 'help', 'You say you cannot, but you will help.'],
    ['Say you cannot', 'no', 'You say you cannot.', 'bad'],
  ]),
  scene('care_review', 'family', [21, 120], 'The care review for {them}: the plan was meant to end by now, and it has not. The social worker asks what you think should happen.', 'care', [
    ['Offer a home for as long as they need', 'longterm', 'You say they can stay.', 'good'],
    ['Ask about adopting {them}', 'adopt', 'You ask the question.', 'good'],
    ['Keep the plan as it is', 'keep', 'You say the plan should stand.'],
  ]),
];
