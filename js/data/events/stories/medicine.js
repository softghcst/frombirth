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
    ['Accept, gratefully', '{mentor} writes the first meeting into their diary that evening.', 'mentor:yes', 'good'],
    ['Thank them, but say you are managing', '"The offer stands," {mentor} says.', 'mentor:no'],
  ]),
  scene('med_rival', '{rival} has started arriving an hour before you, and presenting your patients at morning report before you get the chance.', [
    ['Match them, hour for hour', 'Neither of you says it out loud, but it is a race now.', 'rival:compete'],
    ['Suggest you split the early work and both sleep', '{rival} looks surprised, then relieved. The race becomes a rota.', 'rival:ally', 'good'],
    ['Let it go', 'You decide your patients matter more than who presents them.', null],
  ]),
  scene('med_friend', 'It is two in the morning in the call room and {peer} has brought two cups of terrible coffee. "Tell me something that is not about medicine."', [
    ['Talk until one of you is called away', 'You talk about everything else. It is the best hour of the week.', 'friend:yes', 'good', st('mood', 4)],
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
  scene('med_choosing_specialty', 'Everyone in your year is choosing. A friend has made a list in neat columns: hours, pay, lifestyle, years of training. You have a feeling about one rotation you cannot quite put into a column.', [
    ['Choose what you loved, and rank it first', 'You list the rotation that felt like yours. The columns can say what they like.', 'skill:professionalism:1', 'good'],
    ['Choose what makes sense on paper', 'Sensible. You will find out if it was right.', null],
    ['Ask a doctor you admire how they chose', 'They laugh. "I picked the people I wanted to be like at three in the morning."', 'skill:reasoning:1', 'good'],
  ]),
  scene('med_residency_interview', 'Residency interviews: a dozen hospitals, a dozen dinners with residents who are trying to tell you the truth without saying so.', [
    ['Ask the residents what they would change', 'Some deflect. One tells you exactly, and you trust that program more for it.', 'skill:reasoning:1', 'good'],
    ['Focus on impressing the faculty', 'They seem impressed. You learn less about where you would be happy.', null],
  ]),
  scene('med_match_day', '{day}. A room full of envelopes, families, and a clock. At noon, everyone opens theirs at once: {specialty}, at {hospital}, in {city}.', [
    ['Call home', 'Someone on the other end cries before you finish the sentence.', null, 'good', st('mood', 10)],
    ['Find your friends and compare', 'The room is shouting. Some of them got their first choice, some did not, and you hold on to each other either way.', null, 'good', st('mood', 6)],
  ]),
  scene('med_match_day_unmatched', '{day}. You open the envelope with everyone else. It says you did not match. Around you, people are celebrating.', [
    ['Step outside and breathe', 'It is not the end. It is a year you did not plan. Tomorrow you will make a plan.', null, 'neutral', st('mood', 2)],
    ['Go straight to the dean\'s office', 'They have seen this before. They walk you through the options, calmly, and you leave with a list.', 'skill:professionalism:1'],
  ]),
  scene('med_first_night', 'Your first night on call at {hospital}. A list of forty patients you met this morning, and a senior resident who said "call me if you are worried" and meant it.', [
    ['Call the senior resident when you are unsure', 'You call twice. Both times they say you were right to.', 'skill:teamwork:2', 'good'],
    ['Try to handle everything yourself', 'You manage, just. In the morning the senior resident says: next time, call.', 'skill:reasoning:1'],
  ]),
  scene('med_strain', 'It has been a hard stretch: long nights, a run of difficult cases, and you are not sleeping well even when you can. A colleague asks, quietly, whether you are all right.', [
    ['Tell the truth and ask for support', 'Saying it out loud helps more than you expected.', 'strain:support', 'good'],
    ['Ask to work fewer hours', 'You ask for a lighter schedule.', 'strain:hours'],
    ['Take your vacation, all of it', 'You book the time off before you can talk yourself out of it.', 'strain:leave', 'good'],
    ['Say you are fine', 'You are not fine. Nobody is rewarded for pretending otherwise, least of all your patients.', null, 'bad', st('mood', -3)],
  ]),
  scene('med_offer_away', '{hospital}, in {city}, wants you: the same kind of post, a bigger program, and a move across the country. It would change more than your commute.', [
    ['Accept and move', 'You say yes, and start planning the move.', 'away:accept', 'good'],
    ['Use it to negotiate where you are', 'You tell your chief about the offer.', 'away:negotiate'],
    ['Decline: your family\'s life is here', 'You say no. At dinner, nobody asks why, and you are glad.', 'away:family', 'good'],
    ['Decline politely', 'You thank them and say no.', 'away:no'],
  ]),
  scene('med_reunion', 'A conference, a crowded reception, and suddenly {peer}, whom you have not seen since your training days at {hospital}. Ten years, and you recognize the laugh before the face.', [
    ['Skip the keynote and catch up properly', 'You talk until the staff stack the chairs around you.', 'reunion:go', 'good'],
    ['Swap numbers and promise to call', 'You mean it at the time.', 'reunion:later'],
  ]),
  // The wider catalog of hospital life.
  scene('med_talked_about', 'Everyone is talking about {peer}: a difficult diagnosis caught at three in the morning, and the chief mentioned it at grand rounds.', [
    ['Congratulate {peer}, and mean it', '{peer} looks surprised, then pleased.', 'talk:congratulate', 'good'],
    ['Ask {peer} to show you how they spotted it', 'They walk you through it over coffee. You learn something.', 'talk:learn', 'good'],
    ['Say nothing, and stew', 'It is not a good look, even in your own head.', 'talk:resent', 'bad'],
  ]),
  scene('med_or_disagreement', 'In the operating room, a senior colleague wants to go one way and you think the patient would be safer another. Everyone is waiting.', [
    ['Say so, calmly, with your reasons', 'They listen. You agree on a plan together, and it is a better one.', 'talk:speak', 'good'],
    ['Keep quiet and follow their lead', 'It goes fine. You wonder whether it would have.', 'talk:defer'],
    ['Argue in front of the team', 'You may have been right. Nobody remembers that part.', 'talk:argue', 'bad'],
  ]),
  scene('med_attending_choice', '{mentor} has one place for a resident at a national course. Word is the choice was between you and {peer}, and the choice was {chosen}.', [
    ['Congratulate whoever went', 'Whatever happened, you say the right thing.', 'talk:congratulate', 'good'],
    ['Ask {mentor} what to work on for next time', '{mentor} gives you three things, frankly. They are fair.', 'talk:ask', 'good'],
  ]),
  scene('med_friend_pressure', '{peer} is your closest friend in the program, and you have both applied for the same thing. Neither of you has mentioned it.', [
    ['Talk about it, out loud', 'You agree that whoever gets it, the other buys dinner. It helps.', 'talk:honest', 'good'],
    ['Avoid each other until it is decided', 'The silence costs more than either application.', 'talk:distance', 'bad'],
  ]),
  scene('med_new_chief', 'Your department has a new chief, from outside, with a list of changes and a habit of asking why things are done the way they are.', [
    ['Go and introduce yourself', 'They ask good questions. Some of them are about you.', 'talk:welcome', 'good'],
    ['Keep your head down', 'It is a long year of rumors.', 'talk:defer'],
  ]),
  scene('med_work_relationship', 'You and {peer} work in the same department. Hospital policy asks colleagues in a relationship to tell their chief, so neither ever supervises or evaluates the other.', [
    ['Tell the chief together', 'It is a five-minute conversation.', 'disclose_partner:yes', 'good'],
    ['Keep it private', 'You keep it private. It is one more thing to keep.', 'disclose_partner:no'],
  ]),
  scene('med_colleague_leaving', '{peer} has been offered a post across the country: a real step up. They want to know what you think.', [
    ['Tell them to take it', 'They do. You miss them, and are proud of them.', 'talk:encourage', 'good'],
    ['Ask them to stay', 'They think about it for a week.', 'talk:stay'],
  ]),
  scene('med_friend_promoted', 'The post you both wanted has gone to {peer}. They find you before you have to find them.', [
    ['Congratulate them properly', 'They were dreading this conversation. It is easy, because you make it easy.', 'talk:congratulate', 'good'],
    ['Keep your distance for a while', 'It takes months to get back to where you were.', 'talk:distance', 'bad'],
  ]),
  scene('med_mentor_retiring', '{mentor} is retiring after a lifetime at the hospital. The department asks you to say a few words.', [
    ['Say the few words, and say them well', 'You tell the story of your first night on call. {mentor} pretends not to be moved.', 'talk:farewell', 'good'],
    ['Let someone more senior speak', 'You stand at the back and clap longest.', 'talk:farewell'],
  ]),
  scene('med_family_answers', 'A patient\'s family has asked to meet. The outcome was not what anyone hoped, though the care was sound. They want to understand.', [
    ['Meet them, and explain honestly and kindly', 'It is the hardest hour of your month. At the end, they shake your hand.', 'talk:family', 'good'],
    ['Write them a careful letter', 'It answers their questions. It is not the same as being there.', 'talk:letter'],
  ]),
  scene('med_research_offer', 'The hospital is starting a research project in your field and needs a physician to join it: years of work, no promises.', [
    ['Join it', 'You add your name to the protocol.', 'research:join', 'good'],
    ['Not now', 'You have enough on.', 'research:no'],
  ]),
  scene('med_department_divided', 'The department is split over a proposed change to how patients are seen: half think it will help, half think it will not.', [
    ['Bring both sides together to look at the evidence', 'It takes three meetings. The compromise is better than either plan.', 'talk:mediate', 'good'],
    ['Pick a side and argue for it', 'Your side wins, narrowly. Some colleagues are cooler toward you.', 'talk:side'],
  ]),
  scene('med_industry_gift', 'A company whose products you prescribe invites you to speak at a conference in a beautiful city: flights, a hotel, and a generous fee for a short talk.', [
    ['Decline: it is a conflict of interest', 'You decline politely.', 'gift:decline', 'good'],
    ['Accept: everyone goes', 'You accept.', 'gift:accept', 'bad'],
  ]),
  scene('med_alter_record', 'After a case went badly, a senior colleague asks you to "tidy up" a note you wrote that night: change a time, leave out a line.', [
    ['Refuse, and explain why', 'A medical record is what happened, not what we wish had.', 'record:refuse', 'good'],
    ['Do as they ask', 'You change it.', 'record:alter', 'bad'],
  ]),
  scene('med_staffing_shortage', '{hospital} is short of nurses and doctors this year. The rota has gaps, and someone has to decide what gives.', [
    ['Cover extra shifts for a while', 'You cover. The department notices, and so does your sleep.', 'politics:cover'],
    ['Raise it with the chief, with the numbers', 'You bring a page of figures. It moves faster than complaints ever did.', 'politics:data', 'good'],
    ['Escalate it to the hospital board', 'It is not popular with everyone. It is heard.', 'politics:escalate'],
  ]),
  scene('med_budget_dispute', '{hospital} is cutting budgets, and the departments are arguing over who loses what.', [
    ['Propose cuts that do not touch patient care', 'Your proposal is dull and careful, and it is the one they adopt.', 'politics:cut', 'good'],
    ['Defend your own department hard', 'You protect your people this year. Other departments remember.', 'politics:protect'],
  ]),
  // The Story Director's beats (engine/medicine/story.js): each once, each about the real life and its real patients.
  scene('med_first_patient', 'Your first patient of your own: {patient}, {label}. The chart is thin, the waiting room is full, and they are looking at you as if you know what to do.', [
    ['Sit down, introduce yourself, and listen first', 'You learn more in five minutes of listening than in the whole chart. The case is waiting in My Medical Career.', 'skill:communication:1.5', 'good'],
    ['Go straight to the examination', 'Efficient. You will go back for the history.', 'skill:reasoning:0.5'],
  ]),
  scene('med_unexpected_result', 'A result comes back for {patient} that nobody expected, and it does not fit the story you had in your head.', [
    ['Go back to the beginning: history, examination, the differential', 'The answer was in the history all along. Work the case through in My Medical Career.', 'skill:reasoning:2', 'good'],
    ['Repeat the test and hope it was wrong', 'Sometimes it is. This time you will have to think.', 'skill:reasoning:0.5'],
  ]),
  scene('med_senior_advice', '{mentor} stops you in the corridor. "Can I give you one piece of advice? Nobody gave it to me."', [
    ['"Please."', '"Write down what you were worried about, every time. In a year, read it back." You start a notebook that night.', 'skill:professionalism:1.5', 'good'],
    ['Say you are in a hurry', '"Another time, then." There is not another time for a while.', null],
  ]),
  scene('med_patient_returned', '{patient} is back, as planned, and remembers exactly what you said last time.', [
    ['Ask how the plan has been going for them, honestly', 'They tell you what worked and what did not. Follow-up is where care is done.', 'skill:communication:1.5', 'good'],
    ['Pick up where the notes left off', 'Fine. You could have learned more.', null],
  ]),
  scene('med_challenging_dx', '{patient}: {label}. Three people have seen them already, and nobody has an answer.', [
    ['Start again from nothing, as if nobody had seen them', 'A fresh look finds what familiarity missed. The case is in My Medical Career.', 'skill:reasoning:2', 'good'],
    ['Ask a colleague to look with you', 'Two heads, and a better differential.', 'skill:teamwork:1.5', 'good'],
  ]),
  scene('med_consultation', '{patient} needs another specialist\'s opinion: {label}. You write the referral.', [
    ['Write the question you actually need answered, and call them too', 'The consultant calls back within the hour. It saves the patient a week.', 'skill:teamwork:1.5', 'good'],
    ['Send the standard form', 'It gets there. Eventually.', null],
  ]),
  scene('med_handoff', 'Handoff at the end of a long shift: a dozen patients, a tired colleague coming on, and one patient you are worried about.', [
    ['Go through every patient properly, and say out loud who worries you', 'It takes twenty minutes longer. At three in the morning, your colleague is glad.', 'skill:teamwork:2', 'good'],
    ['Give the quick version: you need to go home', 'You go home. You think about that one patient on the drive.', 'skill:professionalism:-1', 'bad'],
  ]),
  scene('med_case_conference', 'Case conference: a difficult case, every department in one room, and the chief asks you to present.', [
    ['Present it straight, including what you got wrong', 'The room respects it. Three people tell you so afterward.', 'skill:integrity:1.5', 'good'],
    ['Present the version that makes the team look good', 'It goes smoothly. Nobody learns much.', null],
  ]),
  scene('med_beat_or', 'The operating room. {patient} is on the list today: {label}. The team is waiting for you to begin.', [
    ['Stop and go through it with the whole team: who everyone is, the patient, the plan', 'It feels slow. It is how operating rooms stay safe. The case is in My Medical Career.', 'skill:teamwork:1.5', 'good'],
    ['Skip ahead: everyone knows the routine', 'Nothing goes wrong today.', 'skill:professionalism:-1', 'bad'],
  ]),
  scene('med_beat_athlete', '{patient} wants to know one thing: when they can play again. It is {label}, and the season starts in a month.', [
    ['Explain honestly what recovery takes, and plan it together', 'They do not like the answer. They trust it.', 'skill:communication:1.5', 'good'],
    ['Tell them what they want to hear', 'They leave happy, for now.', 'skill:integrity:-1.5', 'bad'],
  ]),
  scene('med_beat_child', 'A frightened child, {patient}, and a parent more frightened still: {label}.', [
    ['Kneel down, talk to the child first, then the parent', 'The child stops crying long enough to be examined. The case is in My Medical Career.', 'skill:communication:2', 'good'],
    ['Talk over the child to the parent', 'You get the history. The child gets nothing.', null],
  ]),
  scene('med_beat_emergency', 'An emergency arrives: {patient}, {label}. The doors open and the room fills.', [
    ['Take charge calmly: one voice, clear roles', 'The team settles. The case is in My Medical Career.', 'skill:leadership:1.5', 'good'],
    ['Do everything yourself', 'You are fast. Nobody knows what anybody else is doing.', 'skill:teamwork:-1'],
  ]),
  scene('med_beat_long_term', '{patient} has been coming to see you for a while now: {label}. Some months are better than others.', [
    ['Keep showing up, and say so', 'Continuity is a treatment too.', 'skill:communication:1.5', 'good'],
    ['Suggest they see someone new', 'Sometimes a fresh start helps. Sometimes it is just leaving.', null],
  ]),
  scene('med_beat_newborn', 'A newborn check: {patient}, a few days old, and two exhausted parents with a list of questions.', [
    ['Answer every question, however small', 'They write everything down. They will remember this visit.', 'skill:communication:1.5', 'good'],
    ['Cover the essentials and move on', 'They have more questions in the car.', null],
  ]),
  scene('med_beat_pregnancy', 'A pregnancy that is not going to plan: {patient}, {label}.', [
    ['Explain the options plainly, and let them choose', 'It is their decision, made with good information. The case is in My Medical Career.', 'skill:communication:2', 'good'],
    ['Tell them what you would do', 'They agree, without quite understanding.', null],
  ]),
  scene('med_beat_scan', 'A finding on the images for {patient}: {label}. The team that asked for it is waiting for your report.', [
    ['Call the team, and say what it means and what it does not', 'The report changes the plan. That is what a report is for.', 'skill:teamwork:1.5', 'good'],
    ['Write it up and move to the next one', 'The report is accurate. Someone reads it tomorrow.', null],
  ]),
  scene('med_beat_foot', 'The foot and ankle clinic: {patient}, {label}. They have been walking on it for months.', [
    ['Look at how they walk, and at their shoes, before anything else', 'The answer is half in the shoes. The case is in My Medical Career.', 'skill:reasoning:1.5', 'good'],
    ['Go straight to imaging', 'The pictures are clear. They do not show the gait.', null],
  ]),
  scene('med_beat_specialist', 'A colleague asks for your opinion as the specialist: {patient}, {label}.', [
    ['See the patient yourself before you give it', 'An opinion is worth more with a patient behind it.', 'skill:reasoning:1.5', 'good'],
    ['Advise from the notes', 'Quick. Not quite right.', null],
  ]),
  scene('med_chief_resident', 'You are chief resident: the schedule, the complaints, the new interns, and your own patients still.', [
    ['Make the schedule fair, and say how you did it', 'Nobody loves the schedule. Nobody calls it unfair.', 'skill:leadership:2', 'good'],
    ['Look after your friends first', 'Your friends are pleased. Everyone else notices.', 'skill:integrity:-2', 'bad'],
  ]),
  scene('med_invite_teach', 'The medical school asks whether you would teach a group of students this year.', [
    ['Say yes', 'Every Thursday, six students and a list of questions you have not thought about in years.', 'story:teach', 'good'],
    ['Not this year', 'They will ask again.', null],
  ]),
  scene('med_clinic_idea', 'A colleague who left to open a practice of their own calls you. "You should do it too. It is hard, and it is yours."', [
    ['Start looking at what it would take', 'You open My Medical Career and look at the practice options.', null, 'good'],
    ['Say you are happy where you are', 'You are, mostly.', null],
  ]),
  scene('med_first_month_practice', 'The first month at {clinic}: a new sign on the door, a waiting room that is not yet full, and every bill addressed to you.', [
    ['See every patient as if the practice depends on it', 'It does. Word gets around.', 'skill:communication:1', 'good'],
    ['Spend the quiet hours on the business side', 'The books are in order by the end of the month.', 'skill:management:1.5'],
  ]),
  scene('med_first_hire', '{clinic} needs its first employee. You have never hired anyone before.', [
    ['Hire for kindness and reliability first', 'Run the hiring from Work, Business. Your first hire sets the tone.', 'skill:management:1', 'good'],
    ['Hire whoever is cheapest', 'Savings now. You will see.', null],
  ]),
  scene('med_practice_growing', '{clinic} is full most days, and patients are waiting weeks. You could open a second site.', [
    ['Open a second site', 'You sign the lease.', 'story:expand', 'good'],
    ['Stay one site and do it well', 'Bigger is not always better. You hire one more person instead.', null],
  ]),
  scene('med_hard_year', '{clinic} lost money this year. The accountant would like a word.', [
    ['Look hard at costs, never at patient care', 'You cut what does not touch the patients. It is enough.', 'skill:management:2', 'good'],
    ['See more patients, faster', 'More money. Shorter visits. Patients notice.', 'skill:communication:-1', 'bad'],
  ]),
  scene('med_new_chapter', 'You have practiced medicine for most of your life. Lately you have been wondering what the last chapter should be.', [
    ['Teach: pass on what you know', 'You start mentoring the youngest doctors in the department.', 'skill:leadership:1', 'good'],
    ['Slow down: fewer hours, more life', 'You ask for a lighter schedule. Your family notices before you do.', 'strain:hours'],
    ['Carry on exactly as you are', 'You love this work. There is no rule that says you must stop.', null],
  ]),
  scene('med_partner_offer', '{peer} has been offered a post at {hospital}, in {city}: the job they have wanted for years. It is not where your work is.', [
    ['Move together, and look for a post there', 'You start packing, and applying.', 'partnerOffer:follow', 'good'],
    ['Talk it through properly before anyone decides', 'You sit up late, two nights running.', 'partnerOffer:talk', 'good'],
    ['Ask them to turn it down', 'You ask. They decide.', 'partnerOffer:stay'],
  ]),
  scene('med_former_partner', '{peer}, whom you used to be with, works at the hospital too. You pass in the corridor most days.', [
    ['Keep it civil and professional', 'A nod, a hello, a patient handed over properly. It gets easier.', 'exColleague:civil', 'good'],
    ['Keep your distance', 'You change your route to the cafeteria.', 'exColleague:distance'],
  ]),
  scene('med_couple_schedules', 'You and {peer} work at the same hospital, and this month your rotas never overlap. You have not had dinner together in weeks.', [
    ['Sit down and plan the next month together', 'Two rota swaps and one shared Sunday. It is enough.', 'schedules:talk', 'good'],
    ['Wait for things to calm down', 'They do not, on their own.', 'schedules:wait'],
  ]),
  scene('med_colleague_struggling', '{peer} has not been themselves: short with patients, quiet in the mess, a mistake caught just in time.', [
    ['Take them aside, ask, and help', 'They tell you. You cover two nights and make sure they get proper help. They do not forget it.', 'help:yes', 'good'],
    ['It is not your business', 'Someone else notices, eventually.', 'help:no'],
  ]),
  scene('med_friend_returns', '{peer}, who left years ago for another post, is back: a new job, at the same hospital as you.', [
    ['Pick up where you left off', 'Within a week it is as if they never left.', 'reunion:go', 'good'],
    ['Say hello, and leave it there', 'A friendly nod in the corridor.', 'reunion:later'],
  ]),
  scene('med_boundary', '{mentor}, senior to you, keeps finding reasons to be alone with you, and tonight says something that is not about work. It is not welcome.', [
    ['Say no, clearly, and leave', 'You say it plainly. Nothing about your work depends on them, and nothing will.', 'boundary:refuse', 'good'],
    ['Report it to the hospital', 'You report it. It is handled properly, and you are protected from any consequence for having done so.', 'boundary:report', 'good'],
  ]),
  scene('med_reconcile', 'Years after you argued with {mentor} in front of the whole team, you find yourselves on the same committee.', [
    ['Clear the air', 'You both remember it differently. You agree it does not matter now.', 'reconcile:yes', 'good'],
    ['Keep it professional and no more', 'You work together, correctly and coolly.', 'reconcile:no'],
  ]),
  scene('med_family_patient', '{who} has been diagnosed with {condition}, and turns to the doctor in the family: you. "What should I do? Will you look after me?"', [
    ['Find them the right colleague, and stay family', 'You make the calls. You stay at their side, not at the end of the bed.', 'familyPatient:colleague', 'good'],
    ['Be there with them, and let their doctors be the doctors', 'You go to the appointments and ask the questions they forget.', 'familyPatient:family', 'good'],
    ['Take on their care yourself', 'You say yes before you have thought it through.', 'familyPatient:self', 'bad'],
  ]),
  scene('med_family_ailment', '{who} has {ailment}, and calls the doctor in the family before anyone else: you.', [
    ['Get them seen properly, today', 'You drive them in yourself, and wait in the waiting room like everyone else.', 'familyAilment:seen', 'good'],
    ['Have a look, and tell them what to watch for', 'You look, ask the questions you would ask anyone, and tell them when to go in if it gets worse.', 'familyAilment:look'],
    ['Sort it out yourself, to save them the trip', 'It is quicker. It is also not how it should be done, and you both know it.', 'familyAilment:self', 'bad'],
  ]),
  scene('med_leadership_offer', '{hospital} would like you to become its {post}. More meetings, more responsibility, and fewer patients of your own.', [
    ['Accept', 'You say yes, and look at your calendar with some dread.', 'offer:yes', 'good'],
    ['Decline: you would rather keep seeing patients', 'You thank them, and say no.', 'offer:no'],
  ]),
];
