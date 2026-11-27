// Scenes of a legal career (engine/lawPractice.js queues them, once each when their moment comes, and decides what each
// choice does). The cases themselves, with their filings and days in court, have their own screens.
const l = (value) => ({ type: 'law', value });
const scene = (id, ages, text, choices) => ({ id, category: 'Law', ageRange: ages, queuedOnly: true, text,
  choices: choices.map(([label, value, line, tone = 'neutral']) => ({ label, outcomes: [{ on: 'always', text: line, tone, effects: [l(value)] }] })) });

export default [
  scene('law_first_client', [21, 90], 'Your First Client. {client} sits across the desk, holding a folder of papers too tightly. They want to know what is going to happen.', [
    ['Listen to the whole story first', 'first:listen', 'You put your pen down and listen.'],
    ['Explain how a case like this goes', 'first:explain', 'You walk them through it, step by step.'],
    ['Promise them you will win', 'first:promise', 'You tell them not to worry.', 'bad'],
  ]),
  scene('law_partnership', [28, 90], 'The Partnership Vote. The partners meet next week. Your name is on the list of associates they will consider.', [
    ['Make your case to the partners', 'partner:ask', 'You put your record in front of them.'],
    ['Wait another year', 'partner:wait', 'You decide your record will be stronger next year.'],
  ]),
  scene('law_vacancy', [35, 90], 'The Judicial Vacancy. A judge in {place} is retiring, and the seat is open to experienced lawyers.', [
    ['Apply for the seat', 'vacancy:apply', 'You put your name forward.'],
    ['Not now', 'vacancy:pass', 'You let it go by.'],
  ]),
  scene('law_burnout', [22, 90], 'More Cases Than Hours. Your desk is covered in files, and every one of them is someone\'s worst year.', [
    ['Hand one of the big cases to a colleague', 'burnout:refer', 'You ask for help.'],
    ['Take some time off', 'burnout:leave', 'You book two weeks away.'],
    ['Push through', 'burnout:push', 'You make another pot of coffee.', 'bad'],
  ]),
  // ---------- Law school ----------
  scene('law_first_exam', [20, 90], 'Your First Law School Exam. Tomorrow at nine: {course}. The library is full of people who look calmer than you feel.', [
    ['Study through the night', 'firstExam:allnight', 'You make a pot of coffee and open the casebook again.'],
    ['Go over it with classmates', 'firstExam:group', 'You find the study room with the whiteboard.'],
    ['Get a full night\'s sleep', 'firstExam:sleep', 'You close the book at ten.'],
  ]),
  scene('law_professor', [20, 90], 'A Professor Notices Your Work. Professor {name} stops you after class: your last paper was the best in the section. Would you like to work as a research assistant?', [
    ['Say yes', 'professor:yes', 'You start next week.'],
    ['Thank them, but not this year', 'professor:no', 'You say your courses come first.'],
  ]),
  scene('law_clinic_hard', [20, 90], 'A Difficult Legal Clinic Case. Your clinic client, {client}, asks you to call their landlord yourself and "sort it out like a real lawyer."', [
    ['Take it to your supervisor first', 'clinicHard:supervisor', 'You explain what you may and may not do as a student.'],
    ['Call the landlord yourself', 'clinicHard:beyond', 'You pick up the phone.', 'bad'],
    ['Point them to the tenant help line as well', 'clinicHard:refer', 'You give them the number, and stay on the case.'],
  ]),
  scene('law_graduation', [22, 90], 'Your Graduation. The law school\'s hall, the gowns, your name read out. The bar exam is a few months away.', [
    ['Celebrate with your family', 'graduation:family', 'You let yourself enjoy it.'],
    ['Start bar preparation that evening', 'graduation:prep', 'You go home and open the first practice book.'],
  ]),
  // ---------- Early career ----------
  scene('law_partner_help', [22, 90], 'A Senior Partner Needs Help. {name} leans into your office at six: a brief is due at nine tomorrow, and they are short a pair of hands.', [
    ['Stay and help', 'partnerHelp:stay', 'You order dinner to the office.'],
    ['Say you cannot tonight', 'partnerHelp:no', 'You explain you have plans you cannot move.'],
  ]),
  scene('law_deadline', [22, 90], 'The Filing Deadline. In {title}, the filing is due soon and it is not written yet.', [
    ['Work through the weekend and file it properly', 'deadline:weekend', 'You cancel the weekend.'],
    ['Ask the court for a short extension', 'deadline:extension', 'You file a request for more time.'],
    ['Let the routine version go in', 'deadline:routine', 'You trust the template.'],
  ]),
  scene('law_wont_listen', [22, 90], 'The Client Who Won\'t Listen. {client} wants to do the opposite of what you have advised, again.', [
    ['Explain it again, more simply', 'wontListen:explain', 'You find a different way to say it.'],
    ['Put your advice in writing', 'wontListen:writing', 'You send a clear letter: your advice, and that the decision is theirs.'],
    ['Withdraw from the case', 'wontListen:withdraw', 'You tell them they need another lawyer.'],
  ]),
  scene('law_first_hearing', [22, 90], 'Your First Hearing. Tomorrow you stand up in court for the first time, in {title}.', [
    ['Prepare every answer tonight', 'firstHearing:prepare', 'You rehearse in front of the mirror.'],
    ['Ask your mentor to sit in', 'firstHearing:mentor', 'They say they will be in the back row.'],
    ['Trust yourself and sleep', 'firstHearing:sleep', 'You will be fine. Probably.'],
  ]),
  // ---------- Criminal defense ----------
  scene('law_client_accused', [22, 90], 'A Client Accused. {client} is charged with {charge}. Some people in the office have already decided they did it.', [
    ['Remind yourself: accused is not guilty', 'accused:presume', 'You start where the law starts.'],
    ['Assume the worst and plan a plea', 'accused:assume', 'You start drafting plea terms before the first interview.', 'bad'],
  ]),
  scene('law_identification', [22, 90], 'A Questionable Identification. In {title}, the only eyewitness saw someone at night, from across the street.', [
    ['Hire an expert on eyewitness memory', 'ident:expert', 'You find one who has testified before.'],
    ['Save it for cross-examination', 'ident:cross', 'You make a note for trial.'],
  ]),
  scene('law_plea_offer', [22, 90], 'The Plea Offer. The prosecution has made an offer in {title}. {client} wants to know what you think.', [
    ['Go through it with them, honestly', 'pleaTalk:honest', 'You explain the risks of both roads.'],
    ['Push them to take it', 'pleaTalk:push', 'You tell them it is the only sensible choice.', 'bad'],
  ]),
  // ---------- Prosecution ----------
  scene('law_new_witness', [22, 90], 'A New Witness. In {title}, someone has come forward who says they saw what happened.', [
    ['Interview them properly, and disclose it', 'newWitness:interview', 'You take a careful statement.'],
    ['Leave it: the case is strong enough', 'newWitness:leave', 'You do not follow it up.'],
  ]),
  scene('law_must_dismiss', [22, 90], 'The Case Must Be Dismissed? In {title}, the evidence has fallen apart. What is left would not convince anyone.', [
    ['Drop the charges', 'mustDismiss:dismiss', 'You file to withdraw.'],
    ['Press on anyway', 'mustDismiss:press', 'You decide to see it through.', 'bad'],
  ]),
  scene('law_high_stakes', [25, 90], 'The High-Stakes Trial. {title} starts next week, and the press is outside the courthouse every morning.', [
    ['Prepare, and say nothing to the press', 'highStakes:prepare', 'You keep your head down and your files open.'],
    ['Give an interview', 'highStakes:press', 'You speak to the cameras on the courthouse steps.'],
  ]),
  // ---------- Family ----------
  scene('law_marriage_apart', [22, 90], 'A Marriage Comes Apart. {client} sits across from you, holding their wedding ring in their hand.', [
    ['Listen first', 'marriage:listen', 'You let them tell it.'],
    ['Promise to take them for everything', 'marriage:aggressive', 'You tell them you will make it hurt.', 'bad'],
  ]),
  scene('law_parenting', [22, 90], 'The Parenting Agreement. In {title}, both parents love {child}. Their schedules do not fit.', [
    ['Build the plan around {child}\'s week', 'parenting:child', 'You start from the school timetable.'],
    ['Aim for as much time as you can win', 'parenting:win', 'You count days, not needs.'],
  ]),
  scene('law_settlement_conf', [22, 90], 'The Settlement Conference. In {title}, the judge has asked both sides to try to settle before the hearing.', [
    ['Come prepared with the figures', 'settleConf:prepare', 'You bring every statement, tabbed.'],
    ['Hold out for more', 'settleConf:hold', 'You decide not to move.'],
  ]),
  scene('law_childs_future', [22, 90], 'A Child\'s Future. In {title}, {child} has told you what they want. The hearing is next week.', [
    ['Present {child}\'s wishes, as their attorney', 'childFuture:wishes', 'You make sure the court hears them.'],
    ['Argue what you think is best instead', 'childFuture:own', 'You decide you know better.', 'bad'],
  ]),
  // ---------- Immigration ----------
  scene('law_rfe', [22, 90], 'An Application at Risk. In {title}, the agency has sent a request for evidence. The answer is due soon.', [
    ['Answer it fully, with certified translations', 'rfe:full', 'You gather everything and send it early.'],
    ['Send what you have now', 'rfe:partial', 'You send it as it is.'],
  ]),
  scene('law_hearing_approaches', [22, 90], 'A Hearing Approaches. {client}\'s removal hearing is next month.', [
    ['Prepare the family to testify', 'immHearing:prepare', 'You go through what the judge will ask.'],
    ['Rely on the papers', 'immHearing:papers', 'The documents will have to speak.'],
  ]),
  scene('law_imm_appeal', [22, 90], 'A Chance to Appeal. {title} was denied. There is a short window to appeal.', [
    ['Appeal the decision', 'immAppeal:appeal', 'You draft the notice of appeal.'],
    ['File a new application instead', 'immAppeal:refile', 'You start again, with everything that was missing.'],
    ['Let it rest', 'immAppeal:rest', 'You tell the client the options are gone.'],
  ]),
  // ---------- Senior career ----------
  scene('law_major_client', [30, 90], 'A Major Client Calls. {who} wants you to take their case, and nobody else.', [
    ['Take it', 'major:take', 'You clear your diary.'],
    ['Decline', 'major:decline', 'You recommend a colleague.'],
  ]),
  scene('law_firm_choice', [35, 90], 'The Firm Faces a Difficult Choice. A bad year: the partners must cut costs.', [
    ['Partners take a pay cut', 'firmChoice:pay', 'You go first.'],
    ['Lay off junior staff', 'firmChoice:layoffs', 'The list is drawn up.', 'bad'],
    ['Merge with a larger firm', 'firmChoice:merge', 'You open talks.'],
  ]),
  scene('law_gov_offer', [32, 90], 'An Offer from Government. The Attorney General\'s office asks if you would join as a deputy.', [
    ['Accept', 'govOffer:accept', 'You say yes.'],
    ['Decline', 'govOffer:decline', 'You say you are not ready to leave.'],
  ]),
  scene('law_ag', [38, 90], 'The Attorney General Opportunity. People you trust say you should run for Attorney General.', [
    ['Run', 'ag:run', 'You announce your campaign.'],
    ['Not this time', 'ag:no', 'You say no, for now.'],
  ]),
  scene('law_old_classmate', [30, 90], 'An Old Classmate on the Bench. The judge in {title} is {judge}, who sat next to you in your first year of law school.', [
    ['Tell both sides you studied together', 'classmate:disclose', 'You raise it before anything else.'],
    ['Ask for another judge', 'classmate:recuse', 'You ask, politely, for the case to go elsewhere.'],
    ['Say nothing', 'classmate:silent', 'It was a long time ago.', 'bad'],
  ]),
  scene('law_child_reads', [35, 110], 'In the Old Papers. {kid} found an old news story about you: "{headline}" They want to know what really happened.', [
    ['Tell them the whole story, the hard parts too', 'childReads:tell', 'You sit down with them and tell it from the beginning.', 'good'],
    ['Say it was just your job', 'childReads:modest', 'You shrug. It was a long time ago.'],
    ['Tell them what it taught you about being fair', 'childReads:lesson', 'You tell them what you learned, more than what you won.', 'good'],
  ]),
  scene('law_family_strain', [24, 100], 'Late Again. {name} has stopped asking when you will be home. You have {trials} trials coming, and every one of them is somebody\'s life.', [
    ['Be home for dinner, case or no case', 'strain:home', 'You close the laptop at six.', 'good'],
    ['Ask {name} for patience, and explain', 'strain:ask', 'You sit down and talk it through.'],
    ['Bury yourself in the work', 'strain:work', 'You tell yourself it is only for a few weeks.', 'bad'],
  ]),
  scene('law_retirement', [55, 120], 'The Last Day. {years} years in the law. People will remember {big}. Your office is in boxes.', [
    ['Give a short speech, and thank the clerks', 'retire:speech', 'You stand up at the farewell.', 'good'],
    ['Offer to mentor young lawyers', 'retire:mentor', 'You leave your number with the bar association.', 'good'],
    ['Slip away quietly', 'retire:quiet', 'You let the day pass like any other.'],
  ]),
  scene('law_old_rival', [28, 90], 'An Old Rival. Across the aisle in {title} is {rival}, whom you have faced before.', [
    ['Shake hands and get to work', 'rival:respect', 'Rivals, not enemies.'],
    ['Make it personal', 'rival:personal', 'You have not forgotten last time.', 'bad'],
  ]),
];
