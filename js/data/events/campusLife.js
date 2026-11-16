// Scenes sent by the campus engine (engine/campus.js): about the player's
// real roommate, organisations and standing. Each choice goes back to the engine.
import { any } from './helpers.js';

const campus = (value) => ({ type: 'campus', value });
const scene = (id, ageRange, text, choices) => ({ id, category: 'campus life', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, value]) => ({ label, outcomes: [any(line, 'neutral', campus(value))] })) });

export default [
  scene('roommate_clash', [17, 70], 'You and {mate} have stopped talking about it, which is worse than arguing about it: {habit}. One of you is going to have to say something.', [
    ['Talk about it, properly', 'You make two cups of tea and sit down.', 'clashTalk'],
    ['Leave a note', 'You find a pen.', 'clashNotes'],
    ['Ask to be moved', 'You go to the accommodation office.', 'clashMove'],
  ]),
  scene('campus_election', [17, 70], 'The {org} elects its new {post} next week, and three different people have told you that you ought to stand.', [
    ['Stand', 'You put your name on the list.', 'electRun'],
    ['Leave it to someone else', 'You thank them, and say no.', 'electNo'],
  ]),
  scene('academic_probation', [17, 70], 'A letter from {school}: your marks have put you on academic probation. Another year like the last one, and you will be asked to leave. Your adviser wants to see you.', [
    ['Get help with the work', 'You ask what is available.', 'probTutor'],
    ['Take fewer courses', 'You ask what can be dropped.', 'probLight'],
    ['Say it will be fine', 'You nod in the right places.', 'probCarry'],
  ]),
  scene('uni_graduation', [19, 90], 'Graduation day at {school}. {first}{offer}There is a ceremony this afternoon, and the people you have spent these years with are scattering tomorrow.', [
    ['Walk across the stage', 'You find your place in the line.', 'gradCeremony'],
    ['Spend the day with your friends', 'You leave the gown on its hanger.', 'gradFriends'],
  ]),
];
