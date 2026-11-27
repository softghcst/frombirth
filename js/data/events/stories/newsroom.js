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
  scene('jn_colleague_spark', 'Late in the newsroom again, {first} brings you a coffee and stays to talk. It is not the first time, and it is not about work.', [
    ['Ask {first} out', 'You ask. It is up to them.', 'spark:ask'],
    ['Keep it a friendship', 'Some colleagues are friends for life. That is plenty.', 'spark:friends', 'good'],
  ]),
  scene('jn_first_assignment', '{editor} drops a folder on your desk. "Your first one. Ring people, read things, write it straight. Ask if you get stuck."', [
    ['Ask how they would start', '{editor} talks you through it for ten minutes, which is ten more than they had.', 'first:ask', 'good'],
    ['Work it out yourself', 'You make mistakes, and learn from every one.', 'first:alone'],
  ]),
  scene('jn_interview_wrong', 'Someone you asked for an interview has turned you down, sharply. A colleague suggests turning up at their door anyway.', [
    ['Respect the no', 'There are other ways to report a story.', 'refused:respect', 'good'],
    ['Turn up at their door', 'It does not go well, and people hear about it.', 'refused:press', 'bad'],
  ]),
  scene('jn_tip_arrives', 'An envelope with no name on it arrives at the newsroom, addressed to you. Inside, a few pages and a phone number.', [
    ['Look into it', 'You start making calls. It may be nothing.', 'tip:take'],
    ['Leave it', 'You have enough on.', 'tip:pass'],
  ]),
  scene('jn_award_night', 'Black tie, a long dinner, and your name read out: the {prize}.', [
    ['Thank your editor and your sources', 'The newsroom table cheers loudest.', 'award:thank', 'good'],
    ['Keep it short and go back to work', 'The trophy goes on the shelf above your desk.', 'award:quiet', 'good'],
  ]),
  scene('jn_deadline', '"{title}" is due, and it is not ready.', [
    ['Work through the night', 'It gets done. You are wrecked.', 'deadline:push'],
    ['Ask your editor for more time', 'Better late than wrong.', 'deadline:ask', 'good'],
  ]),
  scene('jn_viral', 'A clip from {show} is everywhere online: the guest\'s answer to one plain question.', [
    ['Enjoy it', 'Your phone does not stop for a week.', 'viral:enjoy', 'good'],
    ['Remind people of the full interview', 'The whole thing says more than the clip.', 'viral:back', 'good'],
  ]),
  scene('jn_first_byline', 'There it is, in {outlet}: "{headline}", and under it, your name.', [
    ['Cut it out and keep it', 'It goes in a drawer, where you will find it in forty years.', 'byline:frame', 'good'],
    ['Get on with the next one', 'A byline is a beginning.', 'byline:work'],
  ]),
  scene('jn_two_sources', 'Two people tell you opposite things about "{title}". Both sound sure.', [
    ['Keep digging for a record', 'If there is a record, it will settle it.', 'disagree:dig', 'good'],
    ['Go with the one who sounds surer', 'Sounding sure is not evidence.', 'disagree:pick', 'bad'],
  ]),
  scene('jn_no_comment', '{subject} will not answer your calls. Your deadline will not wait for them.', [
    ['Say plainly that they did not respond', 'Readers can judge a silence for themselves.', 'nocomment:note', 'good'],
    ['Try once more, in person', 'Their office takes your card.', 'nocomment:chase'],
  ]),
  scene('jn_headline_debate', '{editor} wants a punchier headline on your story. The punchier one says a little more than the story does.', [
    ['Keep it accurate', 'Fewer clicks, no complaints.', 'headline:straight', 'good'],
    ['Go with the punchier one', 'More people read it. Some of them notice.', 'headline:punchy'],
  ]),
  scene('jn_correction', 'A correction runs under "{headline}". Colleagues are kind about it, mostly.', [
    ['Own it, and work out what went wrong', 'You change how you check that kind of thing.', 'correction:own', 'good'],
    ['Keep your head down', 'It passes. Something of it stays.', 'correction:quiet'],
  ]),
  scene('jn_one_editor_job', 'An editor\'s job is opening at {outlet}, one only. {first} wants it too.', [
    ['Go for it', 'It may be awkward with {first} for a while.', 'editorjob:go'],
    ['Back {first} for it', '{first} will not forget it.', 'editorjob:back', 'good'],
  ]),
  scene('jn_divided', 'A story has split the newsroom at {outlet}: half think it should run, half think it is not ready.', [
    ['Say what you think in the meeting', 'Not everyone agrees with you. Everyone heard you.', 'divided:speak'],
    ['Stay out of it', 'It is not your story.', 'divided:out'],
  ]),
  scene('jn_new_generation', 'A new junior reporter keeps asking you how to do things, which is to say how you learned to do them.', [
    ['Take them under your wing', 'You remember someone doing the same for you.', 'mentor:yes', 'good'],
    ['Point them to the style guide', 'You have a lot on.', 'mentor:no'],
  ]),
  scene('jn_first_live', 'Your first live report: "{headline}". The red light comes on.', [
    ['Breathe, and say it plainly', 'Afterwards, your hands shake a little. Nobody watching could tell.', 'live:steady', 'good'],
    ['Rush it', 'You get through it. You watch it back once, and never again.', 'live:shaky'],
  ]),
  scene('jn_breaking', 'Something is happening across the city and {outlet} wants you on air now, before anything is confirmed.', [
    ['Say only what is confirmed', '"We do not know yet" is a true sentence.', 'breaking:confirmed', 'good'],
    ['Fill the air with what people are saying', 'Some of it turns out wrong, on the record.', 'breaking:guess', 'bad'],
  ]),
  scene('jn_national_offer', 'A national network has been watching {show}. They want you to anchor their evening news.', [
    ['Take it', 'Your face goes national.', 'national:take', 'good'],
    ['Stay with your newsroom', 'Your viewers here would miss you.', 'national:stay'],
  ]),
  scene('jn_investor', 'An investor wants a share of {outlet}: {amount} now, for a quarter of its profits after.', [
    ['Take the money', 'The investment helps you grow.', 'investor:take', 'good'],
    ['Take more money, and their wish for "punchier" stories', 'More readers for a while, and less trust.', 'investor:take_push'],
    ['Keep it yours', 'You thank them, and keep every share.', 'investor:no'],
  ]),
  scene('jn_first_hire', '{first} turns up for their first day at {outlet}, the first person you have ever hired.', [
    ['Show them around yourself', '{first} will remember the welcome.', 'hire:welcome', 'good'],
    ['Hand them the style guide', 'There is work to do.', 'hire:brief'],
  ]),
  scene('jn_expands', '{outlet} has outgrown its first office. Somebody brings cake to the new one.', [
    ['Make a speech', 'Short, and nobody minds.', 'expand:celebrate', 'good'],
    ['Look over the new costs', 'Bigger costs more.', 'expand:careful'],
  ]),
  scene('jn_old_editor', '{editor}, your old editor, calls. {first} remembers your work, and has put in a word for you at {outlet}. There is a desk there if you want it.', [
    ['Take it', 'You pack up your desk, and send {first} a thank-you note.', 'oldeditor:yes', 'good'],
    ['Thank them, and stay', '{first} understands, and you stay in touch.', 'oldeditor:no'],
  ]),
  scene('jn_war_assignment', 'Your editor at {outlet} asks whether you will report on the city during {war}: the families, the shortages, the notices. Nobody has to say yes.', [
    ['Take it', 'You will report from home. The censor will read it first.', 'war:yes'],
    ['Say no', 'Your editor nods. There are other stories.', 'war:no'],
  ]),
  scene('jn_owner_pressure', 'Word comes down from the people who own {outlet}: could the story about {subject} be "less harsh"? Nobody says what happens if it is not.', [
    ['Decline, and write down why', 'You keep a note of the request and your answer. Your editor backs you.', 'owner:decline', 'good'],
    ['Ask for a proper editorial review', 'The story is read again on its evidence. What holds up stays.', 'owner:review', 'good'],
    ['Soften it', 'It runs a little gentler than the evidence. You know it, and so do some readers.', 'owner:soften', 'bad'],
  ]),
  scene('jn_idol_interview', 'Twenty minutes with {idol} of {group}, a manager by the door and a list of approved topics on the table.', [
    ['Ask about the music', '{idol} lights up talking about the recording. It is the best quote you get all year.', 'idol:music', 'good'],
    ['Ask about the dating rumor', 'The manager ends the interview. A rumor is still a rumor.', 'idol:rumor', 'bad'],
  ]),
  scene('jn_athlete_win', 'The dressing room after the win: noise, steam, and {athlete} ready to talk.', [
    ['Ask about the game', 'You get the quote everyone else wanted.', 'athlete:fair', 'good'],
    ['Ask about the injury people are whispering about', '"That is private." It is, and they walk off.', 'athlete:injury', 'bad'],
  ]),
  scene('jn_premiere', 'The premiere of {title}: a red carpet, free drinks, and a director who is very charming to the press.', [
    ['Write what you thought, plainly', 'Readers can trust a review that could have gone either way.', 'premiere:honest', 'good'],
    ['Be kind: they were so nice', 'The review is warmer than the film.', 'premiere:kind'],
  ]),
  scene('jn_guest_changes', 'Live on {show}, a guest says the opposite of what they told you last year, and looks straight at the camera.', [
    ['Put the earlier answer to them, calmly', 'They explain the change. Viewers can judge.', 'guest:correct', 'good'],
    ['Let it go and move on', 'Nobody notices. You do.', 'guest:let'],
  ]),
  scene('jn_old_case', 'A case you covered in {year} is back in the news. "{headline}" is still in the archive, as it ran.', [
    ['Read it again, carefully', 'It holds up better than you feared, and you remember the people in it.', 'oldcase:reread', 'good'],
    ['Leave it to the people covering it now', 'It was a long time ago.', 'oldcase:leave'],
  ]),
  scene('jn_legal_letter', 'A lawyer\'s letter arrives about "{headline}": it says the story was wrong, and demands a retraction.', [
    ['Go back through your notes, point by point', 'What the evidence holds stays. What it does not is corrected.', 'letter:review', 'good'],
    ['Ignore it', 'Letters like this come in all the time.', 'letter:ignore'],
  ]),
  scene('jn_press_request', '{reporter}, a reporter at {outlet}, asks for an interview about {topic}.', [
    ['Talk to them, on the record', 'You answer their questions plainly. The piece runs with your words in it.', 'press:talk', 'good'],
    ['Give a short statement', 'A line, and nothing more. They print it.', 'press:brief'],
    ['Decline', 'That is your right. The story runs from the public record, saying you declined to comment.', 'press:decline'],
  ]),
  scene('jn_retirement_interview', 'After {years} years in journalism, a young reporter asks to interview you about your career, and whether you are thinking of stopping.', [
    ['Say yes, it is time', 'Your last byline is an interview, about you. Fitting.', 'retire:yes', 'good'],
    ['Say there are stories left', 'There are.', 'retire:no'],
  ]),
];
