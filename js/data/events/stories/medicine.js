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
  // The story of becoming a doctor, told once each, when it is true (engine/medicine).
  scene('med_school_interview', 'The medical school interview. Two doctors and a medical student behind a long table. "So," says the older one, "why medicine?"', [
    ['Tell them about the people you met volunteering', 'You talk about one patient in particular. The student on the panel stops taking notes and listens.', 'skill:interview:1', 'good'],
    ['Give the answer you rehearsed', 'It is a good answer. It sounds like everyone else\'s.', 'skill:interview:0.3'],
    ['Admit you are still finding out', '"Good," says the older doctor. "So are we, most days."', 'skill:interview:0.6', 'good'],
  ]),
  scene('med_anatomy_exam', 'Your first anatomy exam at {school}. Forty stations, ninety seconds each, a bell between them, and a room colder than seems fair.', [
    ['Trust the hours you put in', 'You finish with time to spare at every station but one.', 'skill:reasoning:2', 'good'],
    ['Panic quietly, then steady yourself', 'Station twelve is a blur. By station twenty you have found your feet.', 'skill:reasoning:1'],
  ]),
  scene('med_patient_remember', 'On your first clinical rotation, a patient asks you to stay a minute after the team moves on. Nobody has told them what is happening, and they are frightened.', [
    ['Sit down, listen, then find the resident so they get real answers', 'You are late for the next patient. The resident says it was the right call.', 'skill:communication:2', 'good'],
    ['Tell them someone will come, and hurry after the team', 'You catch up with the team. You think about the patient all afternoon.', null],
  ]),
  scene('med_choosing_specialty', 'Everyone in your year is choosing. A friend has a spreadsheet: hours, pay, lifestyle, years of training. You have a feeling about one rotation you cannot quite put into a column.', [
    ['Choose what you loved, and rank it first', 'You list the rotation that felt like yours. The spreadsheet can say what it likes.', 'skill:professionalism:1', 'good'],
    ['Choose what makes sense on paper', 'Sensible. You will find out if it was right.', null],
    ['Ask a doctor you admire how they chose', 'They laugh. "I picked the people I wanted to be like at three in the morning."', 'skill:reasoning:1', 'good'],
  ]),
  scene('med_residency_interview', 'Residency interviews: a dozen hospitals, a dozen dinners with residents who are trying to tell you the truth without saying so.', [
    ['Ask the residents what they would change', 'Some deflect. One tells you exactly, and you trust that program more for it.', 'skill:reasoning:1', 'good'],
    ['Focus on impressing the faculty', 'They seem impressed. You learn less about where you would be happy.', null],
  ]),
  scene('med_match_day', 'Match Day. A room full of envelopes, families, and a clock. At noon, everyone opens theirs at once: {specialty}, at {hospital}, in {city}.', [
    ['Call home', 'Someone on the other end cries before you finish the sentence.', null, 'good', st('mood', 10)],
    ['Find your friends and compare', 'The room is shouting. Some of them got their first choice, some did not, and you hold on to each other either way.', null, 'good', st('mood', 6)],
  ]),
  scene('med_match_day_unmatched', 'Match Day. You open the envelope with everyone else. It says you did not match. Around you, people are celebrating.', [
    ['Step outside and breathe', 'It is not the end. It is a year you did not plan. Tomorrow you will make a plan.', null, 'neutral', st('mood', 2)],
    ['Go straight to the dean\'s office', 'They have seen this before. They walk you through the options, calmly, and you leave with a list.', 'skill:professionalism:1'],
  ]),
  scene('med_first_night', 'Your first night on call at {hospital}. A pager, a list of forty patients you met this morning, and a senior resident who said "call me if you are worried" and meant it.', [
    ['Call the senior resident when you are unsure', 'You call twice. Both times they say you were right to.', 'skill:teamwork:2', 'good'],
    ['Try to handle everything yourself', 'You manage, just. In the morning the senior resident says: next time, call.', 'skill:reasoning:1'],
  ]),
  scene('med_leadership_offer', '{hospital} would like you to become its {post}. More meetings, more responsibility, and fewer patients of your own.', [
    ['Accept', 'You say yes, and look at your calendar with some dread.', 'offer:yes', 'good'],
    ['Decline: you would rather keep seeing patients', 'You thank them, and say no.', 'offer:no'],
  ]),
];
