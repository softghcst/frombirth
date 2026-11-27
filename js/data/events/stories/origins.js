// The scenes of adoption and birth families (engine/origins.js). Never drawn: each is queued by the engine when the
// world makes it true, and what it reveals is already in the save before it is shown. Results come one a year.
import { any } from '../helpers.js';

const fx = (id, i) => ({ type: 'origins', value: `${id}:${i}` });
/** A scene: [label, what happens, tone] per choice. */
const S = (id, text, choices, extra = {}) => ({ id, category: 'family', ageRange: [0, 120], queuedOnly: true, text, ...extra,
  choices: choices.map(([label, line, tone = 'neutral'], i) => ({ label, outcomes: [any(line, tone, fx(id, i))] })) });

export default [
  S('org_story', 'The Story of Your Adoption. {parents} sit with you and a box of photographs, and tell you a story you will hear many times: how you were born, and how you came home to them.', [
    ['Ask a hundred questions', 'They answer every one they can, and say so when they cannot.', 'good'],
    ['Just listen', 'You lean against them and listen to the whole thing.', 'good'],
    ['Go back to playing', 'You nod, and go back to your blocks. It is a story; it is yours. There is time.']]),
  S('org_learn_late', 'Learning About Your Origins. {parents} ask to talk, in the voice that means something important. They tell you that you were adopted, and that they should have told you sooner.', [
    ['Ask them everything', 'They tell you all they know. Some of it they have been waiting years to say.'],
    ['Say you need time to think', 'They say of course. They are there when you are ready.'],
    ['Ask why they waited', 'They try to explain. They were afraid of getting it wrong. It is not a good enough reason, and they know it.', 'bad']]),
  S('org_question', 'A Question About Your Birth Parents. At bedtime, out of nowhere, you ask: "Do you think my birth mother thinks about me?"', [
    ['Ask what they know about her', 'They sit on the end of the bed and tell you.'],
    ['Ask if they think about her too', '"Often," they say. "Every birthday."', 'good'],
    ['Let it go for now', 'You fall asleep before they can answer. Some questions keep.']]),
  S('org_photo', 'The Old Photograph. In a drawer you find {photo}.', [
    ['Ask your parents about it', 'They tell you where it came from, and let you keep it.', 'good'],
    ['Put it back carefully', 'You put it back exactly where it was. You know where it is.'],
    ['Keep it in your room', 'It goes in the frame on your shelf. Nobody minds.', 'good']]),
  S('org_conversation', 'A Family Conversation. A school project on family trees turns into a real conversation over dinner. {parents} put their forks down and ask what you would like to know.', [
    ['Ask what they know', 'They tell you, and the dishes wait.'],
    ['Tell them how you feel about it', 'You say it is complicated, and that you love them. They say both of those can be true.', 'good'],
    ['Say you are fine, really', 'You are, mostly. They leave the door open.']]),
  S('org_should', 'Should I Search? You are old enough now to look for your birth family yourself, if you want to. Some days you want to know everything. Some days you are not sure.', [
    ['Start looking into it', 'You find out what you would have to do, and where to begin.'],
    ['Not now', 'Not now. Maybe not ever. Maybe next year.'],
    ['You are happy with what you know', 'You know who your family is. That is enough for now.', 'good']]),
  S('org_agency', 'The Agency Responds. {what}', [
    ['Read it again, slowly', 'You read every line twice.'],
    ['Put it away for now', 'You fold it back into the envelope. It will keep.']]),
  S('org_match', 'A Possible Family Match. {how}', [
    ['Look at the profile', 'A name, a city, a percentage. You can ask for contact from My Origins, through the service. They will decide for themselves.'],
    ['Close it, for now', 'You close the message. It will still be there.']]),
  S('org_sibling', 'A Birth Sibling. {how} If it is what it looks like, you have a brother or a sister you have never met.', [
    ['Look at the profile', 'You look for a long time. You can ask for contact from My Origins; whether they want it is theirs to say.'],
    ['Close it, for now', 'You close the message. It will still be there.']]),
  S('org_letter', 'The Letter. A letter from {them}, {how}. It is three pages long. Some of it is hard to read, and some of it is very easy.', [
    ['Write back', 'You start a reply that night, and finish it a week later.', 'good'],
    ['Put it away for now', 'You put it somewhere safe. You are not ready yet, and that is allowed.']],
  { notice: { who: 'them', emoji: '✉️', title: 'A letter' } }),
  S('org_reach', 'A Relative Wants to Talk. A message arrives from {them}, who says they are your {rel}. They would like to know you, if you would like that too.', [
    ['Agree to meet', 'You write back yes.', 'good'],
    ['Suggest writing first', 'You suggest letters first. It feels safer.'],
    ['Say not now', 'You say not now.'],
    ['Ask not to be contacted', 'You ask them not to contact you again.']],
  { notice: { who: 'them', emoji: '💌', title: 'Someone from your birth family' } }),
  S('org_privacy', 'A Request for Privacy. {what}', [
    ['Respect it', 'You respect it. It does not say anything about you; it says where they are.'],
    ['Leave a letter on file, in case', 'You write the letter you would have sent.'],
    ['Take a break from searching', 'You put the folder away for a while.']]),
  S('org_meet', 'The First Meeting. You meet {them}, {how}, at a quiet café. You spot each other before either of you is ready.', [
    ['Hug them', 'You hug, awkwardly, and then less awkwardly.', 'good'],
    ['Shake hands and sit down', 'You sit, and talk for three hours, and order nothing.'],
    ['Keep it short', 'An hour is enough for a first time. You agree to talk again.']],
  { notice: { who: 'them', emoji: '☕', title: 'The first meeting' } }),
  S('org_complicated', 'A Complicated Reunion. {what}', [
    ['Try again, gently', 'You send a short message: you would like to try again, when they are ready.'],
    ['Take a break', 'You step back. You are allowed to.'],
    ['Accept it as it is', 'It is what it is. Not every story ends where you hoped.']]),
  S('org_time', 'The Relationship Takes Time. It has been a few years since you first met {them}. You are not what the films promise. You are something: birthdays remembered, a call now and then.', [
    ['Make more of an effort', 'You call more. They notice.', 'good'],
    ['Let it be what it is', 'It is enough as it is.']]),
  S('org_past', 'A Relative from the Past. For your {age}th birthday, {them} comes, and stands a little apart at first, and then not.', [
    ['Introduce them to everyone', 'You introduce them to everyone, and your parents shake their hand for a long time.', 'good'],
    ['Spend a quiet moment together', 'Later you sit on the steps together. Neither of you says much. It is a good evening.', 'good']]),
  S('org_boundaries', 'Choosing Your Own Family Boundaries. You and {them} have not spoken in a long time. Nobody decided it; it just happened.', [
    ['Reach out', 'You send a message.'],
    ['Let it rest', 'You let it rest. That is a choice too.'],
    ['Think about it', 'You think about it. There is no deadline.']]),
  S('org_unanswered', 'An Answer You Never Found. {what}', [
    ['Keep the folder open', 'You keep looking, now and then. Records change; people change their minds.'],
    ['Make peace with not knowing', 'Some answers are not there to find. You have the life you have, and the people in it.', 'good']]),
  S('org_share', 'Sharing Your Story. {them} asks where you were born, and you find yourself telling them all of it: your parents, your birth family, the years of looking.', [
    ['Tell them everything', 'They listen with their whole face.', 'good'],
    ['Tell them the short version', 'The short version, for now. The rest when they are older.']]),
];
