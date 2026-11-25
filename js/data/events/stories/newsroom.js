// The newsroom's people and moments: sent by the journalism engine (engine/journalism.js sceneOptions), at most one a
// year, each only when it is true of this life (a real editor, a real colleague, a story that really ran). Each answer
// goes back to the engine (effect type 'journalism').
import { any, st } from '../helpers.js';

const jn = (value) => ({ type: 'journalism', value });
const scene = (id, text, choices) => ({ id, category: 'career', ageRange: [16, 100], queuedOnly: true, text,
  choices: choices.map(([label, line, value, tone = 'neutral', ...more]) => ({ label, outcomes: [any(line, tone, jn(value), ...more)] })) });

export default [
  scene('jn_editor_notes', '{editor} hands your draft back covered in red ink. "Good bones. Now make it true all the way through."', [
    ['Take the notes', 'You rewrite it. It is better, and you both know it.', 'notes:take', 'good'],
    ['Argue for your version', '{editor} hears you out, and does not budge.', 'notes:argue'],
  ]),
  scene('jn_rival_exclusive', '{rival} has the story you were chasing, and it runs on the front page tomorrow. {first} catches your eye across the newsroom.', [
    ['Congratulate them', 'You mean it. {first} looks surprised, then pleased.', 'rival:congratulate', 'good'],
    ['Suggest working the follow-up together', '{first} thinks about it, and says yes.', 'rival:team', 'good'],
    ['Resolve to beat them next time', 'You will. Or they will. That is the job.', 'rival:compete'],
  ]),
  scene('jn_offer_elsewhere', 'An editor from {outlet} calls. They have been reading your work, and there is a desk for you if you want it.', [
    ['Take it', 'You hand in your notice, and pack the plant on your desk.', 'offer:take', 'good'],
    ['Stay where you are', 'You thank them. Your editor hears about it, and does not forget that you stayed.', 'offer:stay'],
  ]),
  scene('jn_paper_trouble', 'The staff meeting at {outlet} is about money: fewer readers, fewer advertisers, and a long silence after the numbers.', [
    ['Stay and do the work', 'Small newsrooms survive on people who stay.', 'trouble:stay', 'good'],
    ['Start quietly looking elsewhere', 'Nobody blames you. You keep your clips up to date.', 'trouble:leave'],
  ]),
  scene('jn_advertiser', 'A big advertiser in {outlet} asks, over lunch, whether you might write "something positive" about their new branch.', [
    ['Decline politely', 'Advertising and reporting stay apart. They take it well enough.', 'ad:decline', 'good'],
    ['Tell your editor about the request', 'Your editor thanks you, and has a word with the advertising desk.', 'ad:editor', 'good'],
    ['Write it', 'It runs. It reads like an advert, because it is one.', 'ad:go', 'bad'],
  ]),
  scene('jn_friend_subject', 'A story on your desk turns out to involve {friend}, a friend of yours.', [
    ['Tell your editor and hand it on', 'Someone else takes it. That is how it should work.', 'friend:disclose', 'good'],
    ['Write it yourself', 'You tell yourself you can be fair. Readers who find out may not agree.', 'friend:write'],
  ]),
  scene('jn_reader_letter', 'A reader writes about "{headline}": it mattered to them, and they wanted you to know.', [
    ['Write back', 'You answer by hand. It takes longer than the story did.', 'letter:answer', 'good', st('mood', 2)],
    ['Pin it above your desk', 'It stays there for years.', 'letter:keep', 'good'],
  ]),
  scene('jn_source_returns', '{source}, who you quoted in "{headline}" years ago, gets in touch. They have something new, and they trust you with it.', [
    ['Hear them out', 'You make notes. It might be a story.', 'source:listen', 'good'],
    ['Say you are busy', 'They understand.', 'source:pass'],
  ]),
  scene('jn_new_editor', '{editor} is retiring. There is cake, a speech, and a new name on the editor\'s door from Monday.', [
    ['Welcome the new editor', 'A new editor, a new set of habits to learn.', 'editor:welcome', 'good'],
  ]),
  scene('jn_anchor_audition', '{outlet} is looking for a new anchor, and the news director asks whether you want to audition.', [
    ['Audition', 'Lights, a script, and a camera that does not blink.', 'anchor:try'],
    ['Stay a reporter', 'You like being out on the story.', 'anchor:no'],
  ]),
  scene('jn_retirement_interview', 'After {years} years in journalism, a young reporter asks to interview you about your career, and whether you are thinking of stopping.', [
    ['Say yes, it is time', 'Your last byline is an interview, about you. Fitting.', 'retire:yes', 'good'],
    ['Say there are stories left', 'There are.', 'retire:no'],
  ]),
];
