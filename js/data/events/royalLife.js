// Royal life, part two: the press, love, and children.
//   The press: stories and rumours. story(label, truth, heat) puts something
//   in the newspapers; `truth` is whether it happened. Denying a rumour works;
//   denying the truth can come back. pressTone/family move the other meters.
//   Love: a secret romance for someone born royal, and what follows.
//   Children: an heir with a mind of their own.
import { st, hid, cash, flag, ok, bad, any, chk, need, rel, image, family, press, story, coolStory, addNpc, kinOut, mem } from './helpers.js';

const royal = need('isRoyal', '==', true);
const born = [royal, need('royalBy', '==', 'birth')];
const single = [need('roles', 'lacks', 'spouse'), need('roles', 'lacks', 'partner')];
const has = (amount) => need('cashBase', '>=', amount);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- The press ----------
  {
    id: 'press_rumour_feud', category: 'royalty', ageRange: [18, 95], cooldown: 9, requires: [royal],
    text: 'A newspaper reports, on the word of "a palace insider", that you have fallen out badly with another member of the family and no longer speak. There is not a word of truth in it.',
    choices: [
      { label: 'Say nothing', outcomes: [any('The palace does not comment on gossip. With nothing to feed on, the story is gone in a week.', 'neutral', story('a supposed family feud', false, 12))] },
      { label: 'Be seen together, laughing', outcomes: [any('A walk in the park, a shared joke, forty photographers. The newspaper prints the picture without mentioning what it said on Tuesday.', 'good', image(3), press(2), family(2))] },
      { label: 'Deny it in a statement', outcomes: [any('A short, cold denial. Since it is not true, nobody can prove otherwise, though some wonder why you bothered.', 'neutral', story('a supposed family feud', false, 20), press(-2))] },
      { label: 'Find out who the insider is', check: chk(0.4, { 'stats.intellect': 0.5 }), outcomes: [
        ok('A footman with debts. He is found a post a long way from the palace, and the stories dry up.', press(3), hid('willpower', 2)),
        bad('The hunt for the leak becomes the story. "Palace in turmoil," says the same newspaper.', story('a hunt for a palace leak', true, 30), press(-5)),
      ] },
    ],
  },
  {
    id: 'press_rumour_romance', category: 'royalty', ageRange: [18, 60], cooldown: 10, requires: [royal],
    text: 'A magazine has a blurred photograph of you leaving a restaurant, and a headline about a "mystery companion". The companion is your cousin\'s accountant, and you were discussing a charity.',
    choices: [
      { label: 'Laugh, and name the charity', outcomes: [any('You thank the magazine for the publicity and give the charity\'s address. Donations double.', 'good', image(4), press(3), hid('karma', 2))] },
      { label: 'Deny it', outcomes: [any('It is not true, and you say so. The magazine prints the denial on page nineteen.', 'neutral', story('a rumored romance', false, 16))] },
      { label: 'Ignore it', outcomes: [any('The accountant is rather flattered. Nobody else remembers it by the weekend.', 'neutral', story('a rumored romance', false, 8))] },
    ],
  },
  {
    id: 'press_spending', category: 'royalty', ageRange: [21, 95], cooldown: 8, requires: [royal, has(400000)],
    text: 'A newspaper has added up what you spent this year: the clothes, the travel, the redecorated rooms. The figure is accurate, and it is on the front page beside a photograph of a food bank.',
    choices: [
      { label: 'Give a large sum away, quietly', requires: [has(600000)], outcomes: [any('You say nothing and write a check. It comes out anyway, a month later, and does you more good than any statement.', 'good', cash(-200000), image(6), hid('karma', 8), story('your spending', true, 14))] },
      { label: 'Apologize, and promise to cut back', outcomes: [any('A short statement: they have a point, and you will do better. The family thinks you gave in too easily. The public does not.', 'good', image(3), family(-4), press(4), story('your spending', true, 18))] },
      { label: 'Say it is your own money', outcomes: [any('It is your own money, and saying so is a mistake. The photograph of the food bank is printed again.', 'bad', image(-8), press(-6), story('your spending', true, 45))] },
      { label: 'Deny the figures', outcomes: [any('The newspaper prints the receipts.', 'bad', image(-10), press(-10), story('your spending, and your denial of it', true, 60), hid('karma', -4))] },
    ],
  },
  {
    id: 'press_interview_offer', category: 'royalty', ageRange: [21, 90], cooldown: 12, requires: [royal, need('royal.press', '<=', 50)],
    text: 'With the newspapers against you, a respected broadcaster offers an hour, unedited, to put your side. The family is firmly against it.',
    choices: [
      { label: 'Do it', check: chk(0.5, { 'stats.charm': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('You are frank, funny and a little sad, and the country sees a person where there had been a headline. The family watches in silence.', image(12), press(10), family(-8), coolStory(-30)),
        bad('One answer goes wrong, and it is the only one anybody quotes.', image(-8), press(-6), family(-10), story('a disastrous interview', true, 40)),
      ] },
      { label: 'Decline, as the family asks', outcomes: [any('You keep the old rule: never complain, never explain. The family is grateful. The newspapers carry on.', 'neutral', family(6))] },
      { label: 'Write something yourself instead', outcomes: [any('Eight hundred words, in your own hand, about what it is like. It is quoted for a week, mostly kindly.', 'good', image(4), press(5), family(-2), coolStory(-12))] },
    ],
  },
  {
    id: 'press_ex_sells_story', category: 'royalty', ageRange: [20, 80], cooldown: 15, cast: { ex: 'ex' }, requires: [royal],
    text: '{ex} has sold a story to a Sunday newspaper: three pages on what you are really like behind closed doors. Most of it is true, and some of it is unkind.',
    choices: [
      { label: 'Say nothing, ever', outcomes: [any('You do not read it, or say you do not. It is the dignified thing, and it costs you a bad week.', 'neutral', image(-3), story('an ex telling all', true, 30), st('mood', -6), family(2))] },
      { label: 'Telephone {ex}', check: chk(0.4, { 'stats.charm': 0.4, 'cast.ex.relationship': 0.6 }), outcomes: [
        ok('It was the money, {ex} says, and they are sorry. The second installment never appears.', coolStory(-25), rel('ex', 8), st('mood', 2)),
        bad('The call itself is in next Sunday\'s paper.', image(-6), press(-5), story('an ex telling all', true, 50), st('mood', -8)),
      ] },
      { label: 'Have the lawyers stop the next installment', requires: [has(60000)], outcomes: [any('An injunction, granted at midnight. Everyone now wants to know what was in it.', 'bad', cash(-60000), press(-8), story('what the court would not let be printed', true, 45))] },
    ],
  },

  // ---------- Love ----------
  {
    id: 'royal_secret_love', category: 'royalty', ageRange: [18, 34], once: true, requires: [...born, ...single],
    text: 'At a friend\'s kitchen table you meet someone who has no idea who you are for almost an hour, and does not change in the slightest when they find out. They are a student, with a part-time job and a bicycle.',
    choices: [
      { label: 'See them again, and tell nobody', outcomes: [any('You meet {love} in cafés where nobody looks up, and learn what it is to be ordinary for an afternoon. It cannot stay secret for ever. For now, it is yours.', 'good',
        addNpc('partner', 'love', { relationship: 72, ageOffset: 0, attracted: true, memory: ['secretRoyal', 'You saw them in secret, before anyone at the palace knew.'] }), flag('secretLove'), st('mood', 12))] },
      { label: 'See them again, openly', outcomes: [any('You take {love} to the opera, in the family box. By the interval the whole house is looking the wrong way.', 'neutral',
        addNpc('partner', 'love', { relationship: 66, ageOffset: 0, attracted: true }), family(-8), image(4), story('who you are seeing', true, 30), st('mood', 8))] },
      { label: 'Leave it as a good evening', outcomes: [any('You cycle nowhere. You think about that kitchen for a long time.', 'neutral', st('mood', -4), hid('discipline', 2))] },
    ],
  },
  {
    id: 'royal_love_found_out', category: 'royalty', ageRange: [18, 60], queuedOnly: true, once: true,
    text: 'The household has learned that you have been seeing {love} in secret. Your private secretary puts a folder on the desk: photographs, dates, the name of the café. "The family," he says, "would like to know your intentions."',
    choices: [
      { label: 'Confirm it to the world', outcomes: [
        { on: 'always', weight: 0.6, tone: 'good', text: 'A short statement, and a photograph of the two of you that you chose yourselves. The country is charmed. The family is not, yet.', effects: [image(8), family(-10), press(4), story('your relationship', true, 25), rel('love', 10), flag('secretLove', false), mem('love', 'stoodByThem', 'You told the world about them when the palace wanted silence.')] },
        { on: 'always', weight: 0.4, tone: 'neutral', text: 'The statement goes out. Within a day there are reporters at {love}\'s lectures and outside their mother\'s house.', effects: [image(4), family(-10), story('your relationship', true, 45), rel('love', -6), flag('secretLove', false), mem('love', 'stoodByThem', 'You told the world about them when the palace wanted silence.')] },
      ] },
      { label: 'Carry on, more carefully', outcomes: [any('Different cafés, borrowed cars. The folder on the desk gets thicker, and one day it will reach a newspaper.', 'neutral', family(-5), story('a secret relationship', true, 20), rel('love', 3))] },
      { label: 'End it, as the family wishes', outcomes: [any('You tell {love} in a car park, because there is nowhere else. They say they understand, and that is the worst part.', 'bad', family(10), st('mood', -18), rel('love', -40), flag('secretLove', false), hid('willpower', -3), mem('love', 'gaveThemUp', 'You ended it when the palace told you to.'))] },
      { label: 'Tell the family it is not their decision', outcomes: [any('It is the first time you have ever said no to them. There is a long silence, and then your allowance is "under review".', 'neutral', family(-18), hid('willpower', 6), rel('love', 8), st('mood', 4), flag('secretLove', false), mem('love', 'stoodByThem', 'You defied your family for them.'))] },
    ],
  },
  {
    id: 'royal_partner_scrutiny', category: 'royalty', ageRange: [20, 70], cooldown: 10, cast: { love: 'spouse' }, requires: born, castRequires: [need('cast.love.flags.royal', '==', 0)],
    text: 'The newspapers have gone through {love}\'s whole life: old school reports, a cousin with a conviction, a photograph from a party at nineteen. {love} married you, not the country, and is finding out that there is no difference.',
    choices: [
      { label: 'Stand beside them, in public', outcomes: [any('You say that the person you married is the best thing that has happened to this family in a century. It is quoted everywhere, and {love} keeps the cutting.', 'good', rel('love', 12), image(4), press(-3), family(-2))] },
      { label: 'Ask the palace to protect them', check: chk(0.45, { 'royal.family': 0.8 }), outcomes: [
        ok('The household closes around {love} as if they had been born to it. The worst of the stories stop.', rel('love', 8), coolStory(-20), family(2)),
        bad('The household says that this is what marrying in means, and that everyone before them managed.', rel('love', -8), family(-4), st('mood', -5)),
      ] },
      { label: 'Tell them it will pass', outcomes: [any('It does pass. {love} remembers that they got through it alone.', 'bad', rel('love', -12), st('mood', -3))] },
    ],
  },

  // ---------- Children ----------
  {
    id: 'heir_refuses_training', category: 'royalty', ageRange: [30, 80], cooldown: 8, cast: { kid: 'child' }, requires: [royal],
    castRequires: [need('cast.kid.age', '>=', 12), need('cast.kid.age', '<=', 17), need('cast.kid.flags.royal', '>=', 1)],
    text: '{kid} has walked out of a constitutional history lesson and locked the door. Through it, you are told that nobody asked them whether they wanted any of this.',
    choices: [
      { label: 'Sit on the floor outside and listen', outcomes: [any('An hour, through a door. Nobody asked you either, you say. It is the first time {kid} has heard you admit it.', 'good', rel('kid', 12), hid('karma', 3), st('mood', 2))] },
      { label: 'Cut the lessons by half', outcomes: [any('{kid} gets Wednesdays back, and a say in what is taught. The household disapproves. The lessons that are left go better.', 'good', rel('kid', 8), family(-4))] },
      { label: 'Say that duty is not a choice', outcomes: [any('It is what was said to you. {kid} comes out, goes back to the lesson, and does not speak at dinner for a month.', 'bad', rel('kid', -14), family(3), hid('discipline', 1))] },
    ],
  },
  {
    id: 'child_wants_other_life', category: 'royalty', ageRange: [38, 90], cooldown: 12, cast: { kid: 'child' }, requires: [royal],
    castRequires: [need('cast.kid.age', '>=', 17), need('cast.kid.age', '<=', 26), need('cast.kid.flags.royal', '>=', 1)],
    text: '{kid} does not want to cut ribbons. {kid} wants to study music, in another country, under another name, and has already been offered a place.',
    choices: [
      { label: 'Give your blessing', outcomes: [any('You see {kid} off at an ordinary station with an ordinary suitcase. The family says you are too soft. You have never seen your child so happy.', 'good', rel('kid', 16), family(-8), image(3), st('mood', 5))] },
      { label: 'Allow it, with duties in the holidays', outcomes: [any('A bargain: term-time for music, summers for the family. It satisfies nobody completely, which is how you know it is fair.', 'neutral', rel('kid', 6), family(-2))] },
      { label: 'Refuse', outcomes: [any('The place goes to someone else. {kid} carries out every engagement that year without one mistake, and without once looking at you.', 'bad', rel('kid', -22), family(5), hid('karma', -4))] },
    ],
  },
  {
    id: 'child_wants_to_renounce', category: 'royalty', ageRange: [42, 100], cooldown: 20, cast: { kid: 'child' }, requires: [royal],
    castRequires: [need('cast.kid.age', '>=', 21), need('cast.kid.age', '<=', 45), need('cast.kid.flags.royal', '>=', 1), need('cast.kid.relationship', '<=', 70)],
    text: '{kid} asks to see you alone, and says it straight out: they want to give up their title and their place in the line, and live as a private person. They are not asking permission. They would like your blessing.',
    choices: [
      { label: 'Give it', outcomes: [any('You hold {kid} for a long time. The announcement is made on a Friday. The line of succession is one name shorter, and your child is free.', 'good', kinOut('kid'), rel('kid', 20), family(-10), image(-2), hid('karma', 6))] },
      { label: 'Ask them to wait a year', check: chk(0.45, { 'cast.kid.relationship': 0.8, 'stats.charm': 0.2 }), outcomes: [
        ok('A year, {kid} agrees, for your sake. In that year something shifts, and they do not raise it again.', rel('kid', 6), family(3)),
        bad('{kid} waits the year, to the day, and then goes without your blessing.', kinOut('kid'), rel('kid', -10), family(-6)),
      ] },
      { label: 'Forbid it', outcomes: [any('You cannot forbid it, and you both know that. {kid} goes anyway. The statement does not mention you.', 'bad', kinOut('kid'), rel('kid', -30), family(2), image(-4), st('mood', -10))] },
    ],
  },
  {
    id: 'heir_marries_for_love', category: 'royalty', ageRange: [42, 100], cooldown: 20, cast: { kid: 'child' }, requires: [royal],
    castRequires: [need('cast.kid.age', '>=', 22), need('cast.kid.age', '<=', 40), need('cast.kid.flags.royal', '>=', 1)],
    text: '{kid} wants to marry someone the family thinks entirely unsuitable: no title, no money, and a past the newspapers will enjoy. {kid} has asked you first, before the rest of them.',
    choices: [
      { label: 'Take their side against the family', outcomes: [any('You remember what was said about people you loved. You tell the family the matter is settled. The wedding is small, and you give the first toast.', 'good', rel('kid', 18), family(-10), image(5), hid('karma', 4))] },
      { label: 'Ask to meet them first', outcomes: [any('An awkward lunch becomes a long one. By the end you understand. You tell the family you have no objection, and mean it.', 'good', rel('kid', 10), family(-4), st('mood', 3))] },
      { label: 'Side with the family', outcomes: [any('{kid} listens to all the reasons, and marries them anyway, in a register office, without you there.', 'bad', rel('kid', -26), family(6), st('mood', -8))] },
    ],
  },
  {
    id: 'royal_children_quarrel', category: 'royalty', ageRange: [45, 100], cooldown: 15, cast: { elder: 'child', younger: 'child' }, requires: [royal],
    castRequires: [need('cast.elder.age', '>=', 18), need('cast.younger.age', '>=', 18)],
    text: 'Your children have fallen out over what the family is for. {elder} wants it kept as it is. {younger} says it must change or it will not last, and said so to a journalist. Each has come to you separately, wanting you on their side.',
    choices: [
      { label: 'Make them have it out in front of you', check: chk(0.5, { 'stats.charm': 0.4, 'cast.elder.relationship': 0.3, 'cast.younger.relationship': 0.3 }), outcomes: [
        ok('It takes an evening and gets loud. But they are arguing with each other again, instead of about each other, and that is how it mends.', rel('elder', 6), rel('younger', 6), family(3)),
        bad('It gets loud and stays loud. {younger} leaves before the pudding.', rel('elder', -4), rel('younger', -8), story('a quarrel between your children', true, 25)),
      ] },
      { label: 'Tell {younger} they have a point', outcomes: [any('You say that an institution which cannot change is a museum. {younger} is astonished. {elder} is hurt.', 'neutral', rel('younger', 12), rel('elder', -10), image(4), family(-5))] },
      { label: 'Tell {elder} they are right', outcomes: [any('You say that what has lasted a thousand years should not be redesigned in an interview. {elder} is relieved. {younger} is not surprised.', 'neutral', rel('elder', 10), rel('younger', -12), family(5), image(-2))] },
    ],
  },
];
