// Scenes about your children's schooling, and a royal child's education,
// sent by engine/kidschool.js and engine/royaled.js. Each choice goes back
// to the engine that sent it, which decides what happens.
import { any, need } from './helpers.js';

const parent = (value) => ({ type: 'parent', value });
const royal = (value) => ({ type: 'royalEd', value });
const scene = (id, ageRange, text, choices, kind = parent) => ({ id, category: 'parenting', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, value, requires]) => ({ label, ...(requires ? { requires } : {}), outcomes: [any(line, 'neutral', kind(value))] })) });

export default [
  scene('kid_school_choice', [18, 130], '{kid} is starting {stage}. For now the place is at {school}, but where {kid} goes is your decision, and it will shape the next few years.', [
    ['Keep them at the local state school', 'You fill in the form for the local school.', 'kidState'],
    ['Pay for a private school', 'You book a tour.', 'kidPrivate'],
    ['Send them to boarding school', 'You look at the brochures, and the fees.', 'kidBoarding'],
    ['Find a school that fits their gifts', 'You think about what {kid} is good at.', 'kidGifts'],
    ['Ask {kid} what they want', 'You sit down with {kid}.', 'kidAsk'],
  ]),
  scene('kid_struggling', [18, 130], '{kid}\'s report from {school} is bad: {mark} overall, and "needs to apply themselves" written in three different hands.', [
    ['Pay for a tutor', 'You ask around for someone good.', 'kidTutor'],
    ['Sit down and find out what is wrong', 'You turn off the television.', 'kidTalk'],
    ['Take the phone away until the marks improve', 'You hold out your hand for it.', 'kidStrict'],
    ['Tell them marks are not everything', 'You put the report in a drawer.', 'kidAccept'],
  ]),
  scene('kid_prize', [18, 130], '{kid} has won {prize} at {school}. There is a ceremony on Thursday afternoon, in the middle of the working day.', [
    ['Take the afternoon off and be there', 'You tell work you will be out.', 'kidCheer'],
    ['Celebrate at home that evening', 'You buy a cake on the way home.', 'kidHome'],
    ['Ask why it was not first place in everything', 'You ask.', 'kidDoBetter'],
  ]),
  scene('kid_back_to_study', [40, 130], '{kid}, at {age}, has decided to go back to study: {course}, in the evenings, alongside work. The fees come to {$6000}. They have not asked you for anything.', [
    ['Offer to pay the fees', 'You write the cheque before they can refuse.', 'kidFund', [need('cashBase', '>=', 6000)]],
    ['Tell them you are proud of them', 'You ring them that night.', 'kidCheerOn'],
    ['Ask if it is wise, at their age', 'You ask.', 'kidDoubt'],
  ]),
  scene('royal_schooling', [8, 14], 'The household has views on your education, and so do your parents, and for once you have been asked as well. From next year: the palace schoolroom, the boarding school the family has always used, or a day school, among ordinary children.', [
    ['Tutors at the palace', 'You picture the schoolroom.', 'royalTutors'],
    ['The family\'s boarding school', 'You picture the dormitories.', 'royalBoarding'],
    ['A day school, like anyone else', 'You picture a bus, and a protection officer on it.', 'royalDay'],
  ], royal),
  scene('royal_expectations', [15, 19], 'Your family has always sent its children to {uni}, and then into a year of service. At dinner, your grandmother asks, in front of everyone, what your plans are.', [
    ['Do what is expected', 'You say {uni}, and the table relaxes.', 'expectFollow'],
    ['Say you want to study art, somewhere else', 'You say it.', 'expectOwn'],
    ['A year in the armed forces first', 'You say you would like to serve first.', 'expectService'],
    ['Say you have not decided', 'You say you have not decided.', 'expectWait'],
  ], royal),
];
