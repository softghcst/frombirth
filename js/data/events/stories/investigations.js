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

  // ---------- More of the work ----------
  Q('inv_interview_panel', 'The selection panel for {unit}: three senior detectives and a long table. "Tell us about a time your first theory was wrong."', [
    C('Tell them about a case where the evidence changed your mind', 'They wrote that down. One of them nodded.', 'panel:honest'),
    C('Say your first theories are usually right', 'Nobody wrote anything down.', 'panel:boast')]),
  Q('inv_new_poi', 'In {case}, the evidence points to someone new: {person}. Nobody had heard the name before.', [
    C('Find out who they are before deciding anything', 'You started with what the records say about them.', 'poi:check'),
    C('Assume this is the one', '{partner} reminded you that a name is not a suspect.', 'poi:jump')]),
  Q('inv_another_look', '{case} has been sitting still. {partner} suggests going back to the beginning, as if you had never seen the file.', [
    C('Do it: read the file fresh', 'You found a question nobody had asked.', 'look:fresh'),
    C('Stick with the plan', 'The plan stayed the plan.', 'look:stay')]),
  Q('inv_examiner', 'The medical examiner\'s report on {case} is in. Cause and manner of death are set out separately, with what is certain and what is not.', [
    C('Read it with the examiner', 'The examiner explained what the findings can and cannot tell you about who was involved.', 'me:discuss'),
    C('Read it alone', 'You read it twice.', 'me:read')]),
  Q('inv_specialist', 'A specialist joins the team on {case}: {specialist}, who knows {field} better than anyone you have worked with.', [
    C('Ask them to explain it from the start', 'An hour well spent.', 'spec:learn'),
    C('Leave them to it', 'They worked alone, and well.', 'spec:leave')]),
  Q('inv_fed_prosecutor', 'An assistant United States attorney, {prosecutor}, calls about {case}: "Walk me through what you have, and what you do not."', [
    C('Go through it all, including the gaps', 'The call took an hour. The gaps were the useful part.', 'fedpros:full'),
    C('Lead with the strongest evidence', 'The prosecutor asked about the gaps anyway.', 'fedpros:sell')]),
  Q('inv_supervisory', 'A supervisory post has opened in your office. It means running a squad, and fewer cases of your own.', [
    C('Put your name forward', 'You can apply from Career Progress.', 'sup:apply'),
    C('Stay an agent in the field', 'You stayed with the cases.', 'sup:stay')]),
  Q('inv_transfer', 'Headquarters needs agents in {city}. You are on the list for a transfer across the country.', [
    C('Accept the transfer', 'You will report to {city}.', 'transfer:yes'),
    C('Ask to stay, for family reasons', 'They took you off the list, this time.', 'transfer:no')]),
  Q('inv_reassignment', 'You have been reassigned from {old} to {new}, effective Monday. Nobody asked you.', [
    C('Make the best of it', 'New cases, new people. Some of it was interesting.', 'reassign:accept'),
    C('Ask your supervisor why', 'Staffing, they said. It was true.', 'reassign:ask')]),
  Q('inv_defense_challenge', 'The defense in {case} is challenging how a piece of evidence was handled. You will be asked about the custody record.', [
    C('Go through the record exactly as it is, gap and all', 'You explained what was recorded and what was not.', 'defense:honest'),
    C('Say the gap does not matter', 'The judge will decide whether it matters.', 'defense:dismiss')]),
  Q('inv_review_board', 'The complaint about you has reached the review board. You may attend, with a representative, and speak.', [
    C('Attend and answer honestly', 'You answered every question.', 'board:attend'),
    C('Let your representative speak for you', 'Your representative spoke well.', 'board:rep')]),
  Q('inv_new_trial', 'In {case}, kept evidence could now be tested with a method that did not exist when it was tried. Someone was convicted.', [
    C('Open a review', 'You signed out what was kept. The conviction stands while it is reviewed.', 'review:open'),
    C('Leave it for the conviction review unit', 'Someone else may take it up.', 'review:leave')]),
  Q('inv_familiar_name', 'In court on {case}, the lawyer for the other side is {name}, who was in your academy class years ago.', [
    C('Nod hello, and keep it professional', 'Afterward, in the corridor, you caught up for five minutes.', 'familiar:nod'),
    C('Avoid them', 'You took the other staircase.', 'familiar:avoid')]),

  Q('inv_partner_romance', 'You and {partner} are together now, and you also work every case side by side. The department\'s rules say a relationship between partners must be declared.', [
    C('Declare it to your supervisor', 'You told your sergeant. One of you will move to another partnership; the relationship is your own business.', 'romance:declare'),
    C('Keep it quiet', 'Nobody knows. For now.', 'romance:hide')]),

  Q('inv_ancestor_case', 'In the archive you find {case}, from {year}. The investigating officer was {name}: your own family.', [
    C('Read what they wrote', 'Their handwriting is in the margins. They had a question they never answered.', 'ancestor:read'),
    C('Reopen it, if something new can be tested', 'You signed out the box they packed.', 'ancestor:reopen')]),

  // ---------- Across careers ----------
  Q('inv_reporter', 'A reporter, {reporter}, calls about {case}, which is in court. They have questions.', [
    C('Refer them to the press office', 'You said only what is public: the case is before the court.', 'press:refer'),
    C('Tell them what the file shows', 'It is in the paper the next morning, attributed to "a source." It should not have been.', 'press:leak')]),
  // ---------- A homicide, from the first night to the verdict (engine/investigations/drama.js homicideScenes) ----------
  Q('inv_hom_notify', 'Someone has to tell {victim}\'s family. {kin} opens the door before you knock, and already knows from your face.', [
    C('Say it plainly and gently, then stay', 'You said the words, and then you sat with them while they were said back to you. You left a card with your number.', 'hom:notify-gentle'),
    C('Say it, take the details you need, and go', 'You had what you needed in ten minutes. {kin} watched you leave from the doorway.', 'hom:notify-brief')]),
  Q('inv_hom_night', 'The first night of {case}. The scene is taped off, it is starting to rain, and a sergeant wants to move things inside so they do not get wet.', [
    C('Keep the scene as it is until it is documented', 'You stood in the rain while the photographs were taken. Nothing was touched before it was recorded.', 'hom:night-secure'),
    C('Let them move a few things in out of the rain', 'It seemed sensible at the time. Nobody wrote down where everything had been.', 'hom:night-rush')]),
  Q('inv_hom_48', 'Forty-eight hours into {case}. {supervisor} wants a name by the morning briefing. "The chief is asking. Give me something."', [
    C('Give the briefing what the evidence shows, and no more', '"We have persons of interest and a timeline. We do not have a suspect." {supervisor} did not like it. It was true.', 'hom:48-evidence'),
    C('Give them the most likely name', 'A name went up on the board. It is harder to take a name down than to put one up.', 'hom:48-name')]),
  Q('inv_hom_press', 'The department will hold a press conference on {case}. You are asked to stand beside the chief and answer one question.', [
    C('Ask for witnesses, and say nothing about suspects', '"Anyone who was near the street that night, please call us." The phones rang for two days.', 'hom:press-appeal'),
    C('Say an arrest is close', 'The headline the next morning used your words. The case was no closer.', 'hom:press-promise')]),
  Q('inv_hom_vigil', 'The neighbors hold a vigil for {victim} on the street where it happened. Candles, photographs, a song nobody can finish.', [
    C('Go, and stand at the back', 'Nobody made a speech about you. A woman pressed your hand on the way out and told you something she had not told anyone.', 'hom:vigil-go'),
    C('Stay away: it is their evening', 'You drove past later. The candles were still burning.', 'hom:vigil-stay')]),
  Q('inv_hom_funeral', 'At {victim}\'s funeral, {kin} takes you aside. "Will you find who did this? Promise me."', [
    C('Promise only that you will not stop working it', '"I can\'t promise you an arrest. I can promise you I won\'t stop." {kin} nodded, and held on to that.', 'hom:funeral-honest'),
    C('Promise them you will', '{kin} cried with relief. A promise like that is heavy to carry.', 'hom:funeral-promise')]),
  Q('inv_hom_anniversary', 'A year since {victim} died. {case} is still open. {kin} calls, as you knew they would.', [
    C('Take the call, and tell them what has been done', 'You went through the year with them: what was tried, what is still being done.', 'hom:anniv-call'),
    C('Let it go to voicemail', 'The message was short. You listened to it twice.', 'hom:anniv-avoid')]),
  Q('inv_hom_verdict', 'The court has decided {case}: {verdict}. {kin} is in the corridor afterwards.', [
    C('Go and speak with them', 'There was not much to say. You said it anyway, and they thanked you for the year you gave it.', 'hom:verdict-speak'),
    C('Leave by the side door', 'You had another case waiting. {kin} looked for you, then went home.', 'hom:verdict-leave')]),
  Q('inv_family_answers', 'The family in {case} want to know what is happening. They have waited a long time.', [
    C('Meet them, and tell them what can be shared', 'You told them what you could, and why some of it you could not.', 'family:meet'),
    C('Send a short letter', 'They read it many times.', 'family:letter')]),
  Q('inv_witness_remembered', '{witness}, who helped you years ago on another case, has information about {case}. "You treated me decently back then."', [
    C('Thank them, and take a careful statement', 'It went into the file, properly.', 'remembered:thank')]),
];
