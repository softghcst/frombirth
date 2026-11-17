import { st, hid, cash, rel, flag, cond, heat, count, ms, addNpc, death, ok, bad, any, chk, need } from './helpers.js';

const has = (amount) => need('cashBase', '>=', amount);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'charity_collector', category: 'adult', ageRange: [18, 95],
    text: 'A collector for the children\'s hospital stops you outside the station.',
    choices: [
      { label: 'Give {$50}', requires: [has(50)], outcomes: [any('They thank you by name after reading it off your card.', 'good', cash(-50), hid('karma', 8), st('mood', 4), count('donated', 50))] },
      { label: 'Give your loose change', requires: [has(3)], outcomes: [any('A few coins rattle into the bucket.', 'good', cash(-3), hid('karma', 3), count('donated', 3))] },
      { label: 'Say "not today"', outcomes: [any('They are already talking to the next person.', 'neutral')] },
      { label: 'Lecture them about overheads', outcomes: [any('You talk for six minutes. Nobody enjoys it, including you.', 'bad', hid('karma', -4), st('charm', -1))] },
    ],
  },
  {
    id: 'jury_summons', category: 'adult', ageRange: [18, 70], cooldown: 20,
    text: 'A letter arrives: you have been called for jury service.',
    choices: [
      { label: 'Serve and take it seriously', outcomes: [any('Two long weeks. You argue a nervous jury round to the right verdict.', 'good', hid('karma', 6), st('intellect', 2))] },
      { label: 'Invent a reason to get out of it', check: chk(0.5, { 'stats.intellect': 0.4, 'talents.acting': 0.4 }), outcomes: [
        ok('Your letter about a "pre-booked surgical procedure" is accepted.', hid('karma', -3)),
        bad('The court asks for proof. You pay a {$250} fine and serve anyway.', cash(-250), hid('karma', -3), st('mood', -4)),
      ] },
      { label: 'Go, but nap through it', outcomes: [any('The judge wakes you personally. It makes the local paper.', 'bad', st('charm', -2), hid('karma', -4), st('mood', -3))] },
    ],
  },
  {
    id: 'friend_loan', category: 'adult', ageRange: [18, 65], cast: { pal: 'friend' },
    text: '{pal} is short on rent and asks to borrow {$500}.',
    choices: [
      { label: 'Lend it', requires: [has(500)], check: chk(0.6, { 'hidden.karma': 0.3 }), outcomes: [
        ok('{pal} pays back every bit within the year, plus dinner.', hid('karma', 5), rel('pal', 12)),
        bad('You never see the money again, and {pal} gets harder to reach.', cash(-500), hid('karma', 5), rel('pal', -10), st('mood', -4)),
      ] },
      { label: 'Say you cannot right now', outcomes: [any('{pal} says it is fine. It is a bit less fine than before.', 'neutral', rel('pal', -5))] },
      { label: 'Tell them to sort their life out', outcomes: [any('{pal} hangs up on you.', 'bad', rel('pal', -25), hid('karma', -5))] },
    ],
  },
  {
    id: 'cousin_pitch', category: 'adult', ageRange: [20, 65], cooldown: 15,
    text: 'A cousin corners you at a barbecue with "a guaranteed thing". The buy-in is {$1000}.',
    choices: [
      { label: 'Invest', requires: [has(1000)], check: chk(0.25, { 'stats.intellect': 0.3 }), outcomes: [
        ok('Against all reason it pays out. You get {$3500} back.', cash(2500), st('mood', 8)),
        bad('The "warehouse" turns out to be a lock-up full of unsold fidget toys.', cash(-1000), st('mood', -7)),
      ] },
      { label: 'Ask hard questions', check: chk(0.6, { 'stats.intellect': 0.7 }), outcomes: [
        ok('Three questions in, the pitch collapses. Your cousin goes to find someone else.', st('intellect', 2)),
        bad('The answers sound convincing. You almost reach for your wallet before walking off.', st('mood', -1)),
      ] },
      { label: 'Change the subject', outcomes: [any('You ask about the potato salad and escape.', 'neutral')] },
    ],
  },
  {
    id: 'lost_tourist', category: 'adult', ageRange: [16, 90],
    text: 'A tourist with a paper map asks you the way to the museum in {city}.',
    choices: [
      { label: 'Walk them there', outcomes: [any('It is ten minutes out of your way. They insist on a photo with you.', 'good', hid('karma', 5), st('mood', 3))] },
      { label: 'Point vaguely', outcomes: [any('They head off in roughly the right direction.', 'neutral', hid('karma', 1))] },
      { label: 'Send them the wrong way', outcomes: [any('You watch them march confidently toward the ring road.', 'bad', hid('karma', -7), hid('crazy', 2))] },
    ],
  },
  {
    id: 'wedding_speech', category: 'adult', ageRange: [20, 55], cast: { pal: 'friend' }, cooldown: 15,
    text: '{pal} is getting married and asks you to give a speech.',
    choices: [
      { label: 'Write something heartfelt', check: chk(0.55, { 'stats.charm': 0.6, 'stats.intellect': 0.3 }), outcomes: [
        ok('There is not a dry eye in the marquee. {pal} hugs you for a long time.', rel('pal', 15), st('charm', 3), st('mood', 6)),
        bad('You lose your place, repeat a paragraph, and sit down to polite applause.', rel('pal', 3), st('mood', -3)),
      ] },
      { label: 'Roast them', check: chk(0.4, { 'stats.charm': 0.8 }), outcomes: [
        ok('The room is in tears of laughter. Even the in-laws.', rel('pal', 10), st('charm', 4), st('mood', 7)),
        bad('The ex-girlfriend joke lands in total silence.', rel('pal', -20), st('charm', -3), st('mood', -6)),
      ] },
      { label: 'Politely decline', outcomes: [any('{pal} understands, mostly.', 'neutral', rel('pal', -4))] },
    ],
  },
  {
    id: 'chest_pain', category: 'adult', ageRange: [30, 75], cooldown: 12,
    text: 'You have had a tight feeling in your chest on and off all week.',
    choices: [
      { label: 'See a doctor ({$200})', requires: [has(200)], outcomes: [
        { on: 'always', weight: 3, tone: 'good', text: 'It is a strained muscle. The doctor also catches something early and sorts it.', effects: [cash(-200), st('health', 6), st('mood', 3)] },
        { on: 'always', weight: 1, tone: 'bad', text: 'The tests show high blood pressure. At least now you know.', effects: [cash(-200), cond('high_bp')] },
      ] },
      { label: 'Ignore it', check: chk(0.6, { 'stats.health': 0.6 }), outcomes: [
        ok('It fades by the weekend.', hid('willpower', 1)),
        bad('It gets worse. A lot worse. You are diagnosed with heart disease in an ambulance.', cond('heart_disease'), st('health', -12), st('mood', -8)),
      ] },
      { label: 'Look it up online', outcomes: [any('According to the internet you have between four and eleven fatal conditions.', 'bad', st('mood', -6), hid('crazy', 2))] },
    ],
  },
  {
    id: 'road_rage', category: 'adult', ageRange: [18, 80],
    text: 'A driver cuts across you, then leans on the horn as if it were your fault.',
    choices: [
      { label: 'Wave and let it go', outcomes: [any('You breathe out. The song on the radio is a good one.', 'good', hid('discipline', 3), st('mood', 1))] },
      { label: 'Shout something unrepeatable', outcomes: [any('It helps for about four seconds.', 'neutral', st('mood', -2), hid('karma', -2))] },
      { label: 'Follow them', check: chk(0.5, { 'hidden.discipline': 0.5 }), outcomes: [
        ok('Two streets later you come to your senses and turn round.', hid('crazy', 3)),
        bad('They get out at the lights. So do you. You come home with a black eye.', st('health', -8), st('mood', -6), hid('crazy', 5), heat(10)),
        { on: 'fail', weight: 0.08, text: 'You run a red light chasing them and a lorry does not see you.', effects: [death('a road rage collision')] },
      ] },
    ],
  },
  {
    id: 'scratch_ticket', category: 'adult', ageRange: [18, 95], cooldown: 5,
    text: 'The newsagent has a new scratch card by the till. Top prize {$50000}.',
    choices: [
      { label: 'Buy one ({$5})', requires: [has(5)], outcomes: [
        { on: 'always', weight: 800, tone: 'neutral', text: 'Nothing. Silver dust all over your sleeve.', effects: [cash(-5), count('gambled', 5)] },
        { on: 'always', weight: 180, tone: 'good', text: 'You win {$20}!', effects: [cash(15), st('mood', 3), count('gambled', 5)] },
        { on: 'always', weight: 19, tone: 'good', text: 'Three matching symbols. You win {$1000}!', effects: [cash(995), st('mood', 10), count('gambled', 5)] },
        { on: 'always', weight: 1, tone: 'good', text: 'You check it four times. You have won {$50000}.', effects: [cash(49995), st('mood', 25), count('gambled', 5), ms('Won a scratch card jackpot.')] },
      ] },
      { label: 'Buy ten ({$50})', requires: [has(50)], outcomes: [
        { on: 'always', weight: 55, tone: 'bad', text: 'Ten cards, {$10} back in total.', effects: [cash(-40), st('mood', -3), count('gambled', 50)] },
        { on: 'always', weight: 35, tone: 'neutral', text: 'You win {$60} across the lot. Basically even.', effects: [cash(10), count('gambled', 50)] },
        { on: 'always', weight: 9.9, tone: 'good', text: 'The seventh card pays {$1000}!', effects: [cash(950), st('mood', 10), count('gambled', 50)] },
        { on: 'always', weight: 0.1, tone: 'good', text: 'The last card. All three symbols. {$50000}.', effects: [cash(49950), st('mood', 25), count('gambled', 50), ms('Won a scratch card jackpot.')] },
      ] },
      { label: 'Keep your money', outcomes: [any('You buy a newspaper instead.', 'neutral', hid('discipline', 1))] },
    ],
  },
  {
    id: 'school_reunion', category: 'adult', ageRange: [26, 60], cooldown: 15,
    text: 'An invitation arrives for your school reunion.',
    choices: [
      { label: 'Go and catch up properly', outcomes: [any('You end up talking all night with {pal}, whom you barely knew back then.', 'good', addNpc('friend', 'pal'), st('mood', 6))] },
      { label: 'Go and exaggerate', check: chk(0.5, { 'talents.acting': 0.5, 'stats.charm': 0.4 }), outcomes: [
        ok('By midnight half the room believes you run a vineyard.', st('mood', 5), hid('karma', -3)),
        bad('Someone looks you up on their phone at the table.', st('mood', -7), st('charm', -2)),
      ] },
      { label: 'Stay home', outcomes: [any('You look at the photos online afterwards. Everyone got old.', 'neutral', st('mood', -1)), any('Someone sends you the group photograph afterwards. Everyone got old.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'midlife_itch', category: 'adult', ageRange: [38, 52], once: true, weight: 2,
    text: 'You catch your reflection in a shop window and wonder where the time went.',
    choices: [
      { label: 'Buy something loud and fast ({$8000})', requires: [has(8000)], outcomes: [any('A motorbike. You ride it nine times. Each one is wonderful.', 'good', cash(-8000), st('mood', 12), hid('crazy', 3))] },
      { label: 'Start running', check: chk(0.6, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('A year later you finish a half marathon and cry at the line.', st('health', 10), st('mood', 8), st('charm', 3), hid('discipline', 5), ms('Ran a half marathon.')),
        bad('The shoes are worn twice and now live under the stairs.', st('mood', -3)),
      ] },
      { label: 'Talk to someone about it ({$600})', requires: [has(600)], outcomes: [any('A few months of honest conversation. Things feel lighter.', 'good', cash(-600), st('mood', 10), hid('crazy', -5))] },
      { label: 'Push the thought away', outcomes: [any('It comes back most Sunday evenings.', 'neutral', st('mood', -5))] },
    ],
  },
  {
    id: 'noisy_neighbour', category: 'adult', ageRange: [18, 85],
    text: 'Your neighbour has taken up the drums. They practise at midnight.',
    choices: [
      { label: 'Knock and ask nicely', check: chk(0.55, { 'stats.charm': 0.6 }), outcomes: [
        ok('They had no idea the walls were so thin. They move the kit and bring round a cake.', st('mood', 5), hid('karma', 3)),
        bad('They say "it\'s a free country" and close the door.', st('mood', -4)),
      ] },
      { label: 'Report them', outcomes: [any('An official letter does the job. They no longer say hello.', 'neutral', st('mood', 2), st('charm', -1))] },
      { label: 'Retaliate with opera at 6 a.m.', outcomes: [any('It becomes a war. Neither of you sleeps for a month.', 'bad', st('health', -3), st('mood', -3), hid('crazy', 4), hid('karma', -3))] },
      { label: 'Buy earplugs', outcomes: [any('Problem solved for the price of a sandwich.', 'good', hid('discipline', 2))] },
    ],
  },
];
