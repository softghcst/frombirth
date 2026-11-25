// Scenes from hospital life, sent by the medical career engine (engine/medicine): rotations,
// mentors, rivals, friends, romance between colleagues, competition for a fellowship, telling a
// family the truth, a leadership offer, and a former patient who comes back to say thank you.
// Each choice goes back to the engine (effect type 'medicine', engine/medicine/drama.js).
// The characters are the game's own. No scene here changes how any patient fares.
import { any, st } from '../helpers.js';

const med = (value) => ({ type: 'medicine', value });
const scene = (id, text, choices) => ({ id, category: 'career', ageRange: [18, 100], queuedOnly: true, text,
  choices: choices.map(([label, line, value, tone = 'neutral', ...more]) => ({ label, outcomes: [any(line, tone, ...(value ? [med(value)] : []), ...more)] })) });

export default [
  scene('med_rotation', 'Your {rotation} rotation: {shows}. On the last day the resident asks what you made of it.', [
    ['Say you could see yourself doing this', 'They grin. "Then come back on your elective, and I will write you a letter."', null, 'good', st('mood', 3)],
    ['Say it taught you a lot, but it is not for you', '"Knowing what you do not want is worth a rotation," they say, and mean it.', null, 'neutral'],
    ['Ask what they wish they had known as a student', 'They think for a long time. "That the patients remember how you spoke to them long after they forget the diagnosis."', null, 'good', st('intellect', 1)],
  ]),
  scene('med_mentor', '{mentor} catches you after rounds. "You ask the right questions. If you want, I will look over your cases with you every month. No promises, just time."', [
    ['Accept, gratefully', '{mentor} sends the first calendar invitation that evening.', 'mentor:yes', 'good'],
    ['Thank them, but say you are managing', '"The offer stands," {mentor} says.', 'mentor:no'],
  ]),
  scene('med_rival', '{rival} has started arriving an hour before you, and presenting your patients at morning report before you get the chance.', [
    ['Match them, hour for hour', 'Neither of you says it out loud, but it is a race now.', 'rival:compete'],
    ['Suggest you split the early work and both sleep', '{rival} looks surprised, then relieved. The race becomes a rota.', 'rival:ally', 'good'],
    ['Let it go', 'You decide your patients matter more than who presents them.', null],
  ]),
  scene('med_friend', 'It is two in the morning in the call room and {peer} has brought two cups of terrible coffee. "Tell me something that is not about medicine."', [
    ['Talk until your pagers go', 'You talk about everything else. It is the best hour of the week.', 'friend:yes', 'good', st('mood', 4)],
    ['Say you need to sleep', '{peer} shrugs and drinks both coffees.', null],
  ]),
  scene('med_romance', 'After the department party, {peer} walks with you to the station. Neither of you supervises the other; you are both on the same rung, and you both know it has been more than friendship for a while.', [
    ['Ask {peer} out properly', 'You ask. Then you wait for the answer.', 'romance:ask'],
    ['Keep it a friendship', 'You say goodnight at the station, and keep it that way.', 'romance:no'],
  ]),
  scene('med_competition', 'There is one fellowship place at the program you both want, and {rival} has applied too. A senior physician offers to mention a mistake of {rival}\'s from last year to the committee.', [
    ['Decline, and let the applications speak', 'You say no. Whatever happens, it will be fair.', 'compete:fair', 'good'],
    ['Let them mention it', 'You say nothing, which is the same as yes.', 'compete:undercut', 'bad'],
  ]),
  scene('med_disclosure', 'Looking back over a case that went badly, you see that a step was missed: probably not the whole reason, but part of it. The family does not know.', [
    ['Tell the family what happened, and say sorry', 'It is the hardest conversation of your year.', 'disclose:yes', 'good'],
    ['Leave it: it would not change anything now', 'You close the chart.', 'disclose:no', 'bad'],
  ]),
  scene('med_grateful', 'A card arrives at the hospital, addressed to you. A former patient, the one who came in with {label} years ago, is doing well, and wanted you to know.', [
    ['Pin it to the wall', 'It stays there for years. On bad days you read it again.', 'grateful:yes', 'good'],
    ['Write back', 'You write a short note back. You do not say how much it meant.', 'grateful:yes', 'good'],
  ]),
  { ...scene('med_family_calling', 'You think of {relative}, {what}, {how}. People keep asking whether you will be a doctor too.', [
    ['Say you might: you want to understand what they did', 'You start paying attention in biology.', 'calling:drawn', 'good', st('intellect', 1)],
    ['Say you will find your own way', 'Nobody minds. Whatever you choose, it will be yours.', 'calling:own'],
  ]), ageRange: [12, 18] },
  scene('med_leadership_offer', '{hospital} would like you to become its {post}. More meetings, more responsibility, and fewer patients of your own.', [
    ['Accept', 'You say yes, and look at your calendar with some dread.', 'offer:yes', 'good'],
    ['Decline: you would rather keep seeing patients', 'You thank them, and say no.', 'offer:no'],
  ]),
];
