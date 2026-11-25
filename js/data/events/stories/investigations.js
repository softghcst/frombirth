// STORYLINE: investigative careers. Never drawn at random: engine/investigations/drama.js queues
// these from the saved records (a real offer, a real partner, a real case), once each where it is
// a first, and their choices go back to it through the `inv` effect. The characters, places and
// cases are the game's own.
const e = (value) => ({ type: 'inv', value });
const out = (text, ...effects) => [{ on: 'always', text, effects }];
const Q = (id, text, choices, o = {}) => ({ id, category: 'career', ageRange: [16, 120], queuedOnly: true, cooldown: 0, ...o, text, choices });
const C = (label, text, value) => ({ label, outcomes: out(text, e(value)) });

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  // ---------- Early career ----------
  Q('inv_acceptance', 'The letter from {agency} is on the table: you have been offered a place at the academy.', [
    C('Accept the place', 'You signed and posted the acceptance the same afternoon.', 'offer:accept'),
    C('Turn it down', 'You wrote a polite letter declining.', 'offer:decline')]),
  Q('inv_first_day', 'Your first day at the academy. {classmate} takes the desk next to yours and asks if you have any idea what you are doing.', [
    C('Admit you have no idea either', 'You laughed about it at lunch. By the end of the week you were studying together.', 'firstday:friend'),
    C('Keep your head down and take notes', 'You filled a notebook before noon.', 'firstday:study')]),
  Q('inv_mentor', 'Your field training officer, {fto}, has been doing this for years. "I will tell you what I tell everyone: write down what you saw, not what you think happened."', [
    C('Ask how they learned the job', 'An hour of stories, and two pieces of advice you will keep for years.', 'mentor:listen'),
    C('Tell them you learned that at the academy', '{fto} smiled thinly. "Then this will be easy for you."', 'mentor:brush')]),
  Q('inv_field_eval', '{fto} has written your field training evaluation. Most of it is good. One line is not: "Reports are thorough but slow; misses times."', [
    C('Ask what to change', '{fto} showed you how they write times as they happen, not after.', 'eval:learn'),
    C('Argue the point', 'You argued. {fto} wrote that down too.', 'eval:argue')]),
  Q('inv_first_report', 'Your first report on your own: a break-in at a corner shop. The owner is sure who did it. You did not see anything yourself.', [
    C('Write what you saw and what you were told, separately', 'Facts in one place, claims in another. Your sergeant initialed it without changes.', 'report:clean'),
    C('Write the owner\'s suspicion as fact', 'Your sergeant sent it back: "Did you see this, or did he tell you?"', 'report:sloppy')]),
  Q('inv_difficult_conversation', 'A man shouting in a parking lot, frightened more than angry. Everyone is watching you.', [
    C('Slow it down: lower your voice, give him space', 'It took ten minutes. He went home.', 'talk:calm'),
    C('Call for a supervisor and wait', 'Your sergeant arrived and handled it the same way you would have, eventually.', 'talk:support')]),
  Q('inv_detective_opens', 'A detective seat has opened in {unit}. Your sergeant mentions it, and says nothing else.', [
    C('Start preparing an application', 'You started reading old case files on your own time.', 'vacancy:prepare'),
    C('Not yet: you want more time on patrol', 'There will be other seats.', 'vacancy:wait')]),
  Q('inv_new_partner', 'Your new partner is {partner}. They look at you across two desks pushed together and say, "So. How do you like your coffee, and how do you write your notes?"', [
    C('Talk through how you each work', 'You agreed on a system. It held up for years.', 'partner:work'),
    C('Keep it professional for now', '{partner} shrugged. Trust is earned.', 'partner:cool')]),

  // ---------- Cases ----------
  Q('inv_first_lead', 'Your first case: {case}. The file is thin, and it is yours.', [
    C('Start with what is documented', 'You read every page twice before talking to anyone.', 'case:read'),
    C('Ask {partner} where they would start', '"With what we know, not what we think," said {partner}.', 'case:ask')]),
  Q('inv_witness_forward', 'Someone has called about {case}. {witness} saw something, and was not sure it mattered.', [
    C('Thank them, and arrange to talk properly', 'You set a time to talk, at their pace.', 'witness:thank'),
    C('Ask them to come in today', 'They came in, a little rattled by the hurry.', 'witness:rush')]),
  Q('inv_lab_arrives', 'The laboratory report on {case} is back: {result}', [
    C('Read it with the analyst, line by line', 'The analyst explained what the result can and cannot show.', 'lab:discuss'),
    C('Note it in the file and move on', 'It went in the file.', 'lab:file')]),
  Q('inv_prosecutor_more', '{prosecutor} has sent the {case} file back: "Not yet. I need more before I can charge anyone."', [
    C('Ask exactly what is missing', '{prosecutor} told you, plainly. Some of it you can get.', 'pros:ask'),
    C('Push for charges anyway', '{prosecutor} said no more firmly the second time.', 'pros:push')]),
  Q('inv_doesnt_fit', 'In {case}, the evidence does not support what you first thought. {cleared} is no longer a person of interest.', [
    C('Write it up plainly and look elsewhere', 'You closed one door and opened another.', 'fit:accept'),
    C('Keep {cleared} in mind anyway', 'You kept a note. The evidence did not change.', 'fit:hold')]),
  Q('inv_report_due', 'The report on {case} is overdue. Your sergeant asks for it by Friday.', [
    C('Stay late and write it properly', 'It was late, and it was right.', 'due:write'),
    C('Ask for another week', 'Your sergeant gave you a week, and a look.', 'due:extend')]),
  Q('inv_witness_changes', '{witness}, asked again about {case}, now says they may have been wrong. Their first account named someone.', [
    C('Record the change accurately, and tell the prosecutor', 'The change went into the file and to the prosecutor the same day. That is the rule, and it is right.', 'change:disclose'),
    C('Leave the first statement as it is', 'You did not write it down. It does not stop being true.', 'change:hide')]),
  Q('inv_cleared', 'Because of your work on {case}, someone who was suspected has been cleared. They will never know your name.', [
    C('That is the job', 'You went back to the file.', 'cleared:ok')]),
  Q('inv_closed', '{case} is closed. The file goes to the archive with every page in it.', [
    C('Write a short note for whoever reads it next', 'Three lines on what you would check if anything new ever comes in.', 'closed:note'),
    C('Let it go', 'You let it go.', 'closed:go')]),
  Q('inv_cold', '{case} has gone cold. Nothing new in three years. It is set aside, not closed.', [
    C('Keep a copy of your notes', 'You kept them in a drawer.', 'cold:keep'),
    C('Move on', 'There are other cases.', 'cold:go')]),
  Q('inv_breakthrough', 'A cold case, {case}, from {years} years ago: a laboratory method that did not exist then could test what was kept.', [
    C('Reopen it', 'You signed out the box from the archive.', 'cold:reopen'),
    C('Leave it for now', 'Someone else may get to it.', 'cold:leave')]),

  // ---------- Federal ----------
  Q('inv_background', 'The {agency} background investigator has spoken to your old neighbors, your old boss and your bank. They have a few questions for you.', [
    C('Answer everything fully', 'It took two hours. You held nothing back.', 'bg:honest'),
    C('Leave out something embarrassing', 'You left it out. Background investigators find things.', 'bg:omit')]),
  Q('inv_field_office', 'Your assignment: {office}. It is not the city you hoped for.', [
    C('Pack up and go', 'You started looking for an apartment that night.', 'office:go'),
    C('Ask about a hardship exception', 'They listened. The assignment stands, for now.', 'office:ask')]),
  Q('inv_task_force', 'A multi-agency task force is forming on {case}: local detectives and federal agents, one case file.', [
    C('Join it', 'You moved your desk to the task force room.', 'tf:join'),
    C('Stay on your own cases', 'The task force went ahead without you.', 'tf:stay')]),
  Q('inv_jurisdiction', 'Two agencies both think {case} is theirs. The meeting is going in circles.', [
    C('Propose one lead agency and shared access', 'It took an afternoon. It worked.', 'jur:share'),
    C('Defend your agency\'s claim', 'You won the argument and lost some goodwill.', 'jur:fight')]),
  Q('inv_hq_offer', 'Headquarters has asked whether you would consider a supervisory post. It would mean a move, and less casework.', [
    C('Say you are interested', 'You were added to the list for the next opening.', 'hq:yes'),
    C('Say you would rather stay in the field', 'They respected that.', 'hq:no')]),

  // ---------- Workplace and personal ----------
  Q('inv_partner_promoted', '{partner} has been promoted. They will not be your partner any more; they will be your supervisor.', [
    C('Congratulate them, and mean it', '{partner} looked relieved. "I was worried how you would take it."', 'promo:glad'),
    C('Congratulate them, and keep your distance', 'Things were a little formal after that.', 'promo:cool')]),
  Q('inv_case_divides', 'The team is split on {case}: half think the obvious explanation is right, half do not.', [
    C('Lay out what the evidence actually shows', 'It did not settle the argument, but it moved it to the right place.', 'divide:evidence'),
    C('Side with the majority', 'The meeting ended sooner.', 'divide:side')]),
  Q('inv_difficult_supervisor', 'Your supervisor, {supervisor}, wants faster results and says so in front of everyone.', [
    C('Ask for ten minutes in private', 'You explained the caseload. {supervisor} listened, a little.', 'sup:talk'),
    C('Say nothing and work longer hours', 'You worked longer. You were tired.', 'sup:endure')]),
  Q('inv_mentor_retiring', '{mentor} is retiring. There is cake in the break room, and a speech nobody wants to give.', [
    C('Give the speech', 'You told the story about your first week. Everyone laughed. {mentor} did not, quite.', 'retire:speech'),
    C('Shake their hand and say thank you', 'It was enough.', 'retire:thanks')]),
  Q('inv_academy_friend', '{classmate}, from your academy class, gets in touch out of the blue. It has been years.', [
    C('Meet for a drink', 'You talked about everyone you started with.', 'friend:meet'),
    C('Reply kindly, but leave it there', 'A few messages, then quiet.', 'friend:reply')]),
  Q('inv_two_careers', 'Your assignment means moving. {spouse} has a job here they love.', [
    C('Talk it through together, honestly', 'No answer that night. But you talked.', 'move:talk'),
    C('Tell them the job comes first', '{spouse} went quiet.', 'move:job')]),
  Q('inv_new_chief', '{agency} has a new chief, {chief}. Memos about "new priorities" arrive by the dozen.', [
    C('Read them, and keep doing good work', 'Most of it changed nothing you did.', 'chief:steady'),
    C('Ask for a meeting to raise a concern', '{chief} heard you out.', 'chief:meet')]),
  Q('inv_complaint', 'A complaint has been made about your conduct. Professional standards will look into it. It is an allegation, not a finding.', [
    C('Cooperate fully', 'You gave them your notes and your account.', 'complaint:cooperate'),
    C('Get advice from your representative first', 'Your representative sat in on the interview.', 'complaint:rep')]),
  Q('inv_longtime_partner', 'You and {partner} have worked together for {years} years. You can finish each other\'s reports.', [
    C('Tell them it has been the best part of the job', '{partner} pretended not to be moved.', 'long:say'),
    C('Buy them lunch, and say nothing', 'Lunch said it.', 'long:lunch')]),
  Q('inv_job_offer', 'A private investigation agency wants someone with your experience. Better hours, less authority, no badge.', [
    C('Think about it seriously', 'You looked into what a license takes.', 'offer:think'),
    C('Say no', 'You said no.', 'offer:no')]),
  Q('inv_friendship_pressure', '{partner} asks you to back their version of an incident you did not see clearly.', [
    C('Say you can only say what you saw', '{partner} was angry for a week. Then they said you were right.', 'pressure:honest'),
    C('Back them up', 'Your account and theirs now match. Yours is not true.', 'pressure:lie')]),
  Q('inv_stayed_with_you', 'Years on, you still think about {case}. Some cases never close for the person who worked them.', [
    C('Call whoever has the file now', 'They promised to look at it again.', 'stayed:call'),
    C('Let it rest', 'You let it rest.', 'stayed:rest')]),

  // ---------- Across careers ----------
  Q('inv_reporter', 'A reporter, {reporter}, calls about {case}, which is in court. They have questions.', [
    C('Refer them to the press office', 'You said only what is public: the case is before the court.', 'press:refer'),
    C('Tell them what the file shows', 'It is in the paper the next morning, attributed to "a source." It should not have been.', 'press:leak')]),
  Q('inv_family_answers', 'The family in {case} want to know what is happening. They have waited a long time.', [
    C('Meet them, and tell them what can be shared', 'You told them what you could, and why some of it you could not.', 'family:meet'),
    C('Send a short letter', 'They read it many times.', 'family:letter')]),
  Q('inv_witness_remembered', '{witness}, who helped you years ago on another case, has information about {case}. "You treated me decently back then."', [
    C('Thank them, and take a careful statement', 'It went into the file, properly.', 'remembered:thank')]),
];
