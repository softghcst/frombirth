// Scenes about crowns and titles. Three kinds:
//   queued by engine/royalty.js: the palace invitation, the honours letter, the coronation
//   life inside a royal family (isRoyal), where nearly every choice moves the public's opinion
//   life with a noble title (isNoble), and life as a commoner in a country with a crown (monarchy)
// Every house and person is invented.
import { st, hid, cash, ms, ok, bad, any, chk, need, rel, image, meetRoyal, honour, followers, govt } from './helpers.js';

const royal = need('isRoyal', '==', true);
const has = (amount) => need('cashBase', '>=', amount);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Queued by the engine ----------
  {
    id: 'palace_invitation', category: 'royalty', ageRange: [18, 60], queuedOnly: true, cooldown: 1,
    text: 'A stiff cream envelope arrives, with a crest on the back. You are invited to a garden party at the palace.',
    choices: [
      { label: 'Go, and be yourself', check: chk(0.45, { 'stats.charm': 0.6, 'hidden.fame': 0.2 }), outcomes: [
        ok('You end up by the roses, talking for an hour with someone who laughs at all the right moments. It is only when a footman bows that you learn it is {royal}. A week later, a car is sent for you.', meetRoyal('royal'), st('mood', 10), hid('fame', 8)),
        bad('You eat a great many small sandwiches, shake one gloved hand, and go home with a story.', st('mood', 3)),
      ] },
      { label: 'Go, having studied every rule of etiquette', check: chk(0.4, { 'stats.intellect': 0.5, 'hidden.discipline': 0.3 }), outcomes: [
        ok('You bow at the right moment, to the right depth. {royal} notices, is amused, and asks who taught you. You are invited back, alone.', meetRoyal('royal'), st('mood', 9), hid('fame', 8)),
        bad('You are so busy remembering which fork is which that you say nothing worth hearing all afternoon.', st('mood', -2)),
      ] },
      { label: 'Send your regrets', outcomes: [any('You write a polite note. The envelope goes in a drawer, where you look at it now and then.', 'neutral')] },
    ],
  },
  {
    id: 'honours_letter', category: 'royalty', ageRange: [30, 110], queuedOnly: true, once: true,
    text: 'A letter arrives marked "In Confidence". The crown wishes to honour you for what you have done for the country, and asks whether you would accept.',
    choices: [
      { label: 'Accept', outcomes: [any('You kneel on a velvet stool, a sword touches your shoulder, and you rise with a longer name than you came in with.', 'good', honour(), st('mood', 14), hid('fame', 10))] },
      { label: 'Decline, quietly', outcomes: [any('You write back that you did none of it for a title. Nobody ever knows, which is how you wanted it.', 'neutral', hid('karma', 4), st('mood', 2))] },
      { label: 'Decline, and tell the newspapers why', outcomes: [any('Your letter about inherited privilege is printed in full. Half the country cheers and the other half writes to complain.', 'neutral', hid('fame', 8), followers(4000), st('mood', 4))] },
    ],
  },
  {
    id: 'coronation_day', category: 'royalty', ageRange: [0, 120], queuedOnly: true, once: true,
    text: 'It is the morning of your coronation. The crown is heavier than it looks, the abbey is cold, and a billion people are watching.',
    choices: [
      { label: 'Keep every tradition, to the letter', outcomes: [any('Four hours of oil, oaths and trumpets. When the crown is lowered onto your head, the whole country seems to breathe out.', 'good', image(12), st('mood', 10), ms('Crowned in the old way, before the whole world.'))] },
      { label: 'Ask for something smaller and cheaper', outcomes: [any('A shorter service, fewer coaches, and the money given to hospitals instead. The old guard mutters. Most people approve.', 'good', image(7), hid('karma', 8), st('mood', 6))] },
      { label: 'Wave from the balcony until your arm aches', check: chk(0.6, { 'stats.charm': 0.5 }), outcomes: [
        ok('The crowd will not let you go in. You come back out five times.', image(15), st('mood', 14)),
        bad('You are seen to yawn during the anthem. It is the photograph every newspaper uses.', image(-6), st('mood', -4)),
      ] },
    ],
  },

  {
    id: 'heirs_dilemma', category: 'royalty', ageRange: [14, 100], queuedOnly: true, cooldown: 1,
    text: 'Someone just ahead of you in the line of succession has given up their place to live a private life. The family is furious with them, and the newspapers have noticed that you are now a step closer to the throne.',
    choices: [
      { label: 'Stand up for their right to choose, in public', outcomes: [
        { on: 'always', weight: 0.6, tone: 'good', text: 'You say that nobody should be made to live a life they did not choose. The younger half of the country agrees with you, loudly.', effects: [image(7), hid('karma', 5), st('mood', 3)] },
        { on: 'always', weight: 0.4, tone: 'bad', text: 'The older members of the family take it as an attack on everything they have given up themselves. Dinner is very quiet for a year.', effects: [image(3), hid('karma', 5), st('mood', -5)] },
      ] },
      { label: 'Support them privately, and say nothing', outcomes: [any('You send a letter, and help them pack. They never forget it.', 'good', hid('karma', 4), st('mood', 2))] },
      { label: 'Ask them to think again', check: chk(0.2, { 'stats.charm': 0.4 }), outcomes: [
        ok('You talk until four in the morning. They do not change their mind, but they agree to stay for the family\'s big occasions, and that is something.', image(2), st('mood', 2)),
        bad('They hear it as one more person telling them what their duty is. You part badly.', st('mood', -5)),
      ] },
      { label: 'Quietly start preparing for more', outcomes: [any('You ask for the constitutional papers to be sent to your rooms, and begin to read. Somebody notices, and tells somebody else.', 'neutral', st('intellect', 2), hid('discipline', 3), hid('karma', -3), image(-2))] },
    ],
  },

  // ---------- Inside the royal family ----------
  {
    id: 'royal_long_lens', category: 'royalty', ageRange: [16, 80], cooldown: 5, requires: [royal],
    text: 'A photographer with a long lens has caught you on a private beach. The pictures will be in every paper by morning.',
    choices: [
      { label: 'Say nothing and carry on', outcomes: [any('The palace never complains and never explains. The story lasts four days.', 'neutral', image(-3), st('mood', -4))] },
      { label: 'Laugh about it in public', check: chk(0.55, { 'stats.charm': 0.6 }), outcomes: [
        ok('Asked about it at a hospital visit, you say you hope they got your good side. The country decides it likes you.', image(7), st('mood', 5)),
        bad('The joke comes out wrong, and now that is the story instead.', image(-7), st('mood', -5)),
      ] },
      { label: 'Take the newspaper to court', requires: [has(50000)], check: chk(0.5, { 'stats.intellect': 0.3 }), outcomes: [
        ok('You win, and give the damages to charity. Editors are more careful with you afterwards.', cash(-20000), image(4), hid('karma', 4)),
        bad('You lose, and every picture is printed again as evidence.', cash(-50000), image(-8), st('mood', -8)),
      ] },
    ],
  },
  {
    id: 'state_banquet', category: 'royalty', ageRange: [18, 95], cooldown: 6, requires: [royal],
    text: 'At a state banquet you are seated beside a visiting president who is rude to the staff, wrong about everything, and very important to the government.',
    choices: [
      { label: 'Smile for three hours', check: chk(0.7, { 'hidden.discipline': 0.5 }), outcomes: [
        ok('You ask about his grandchildren and laugh at his jokes. A trade deal is signed in the morning.', image(5), st('mood', -4), hid('discipline', 2)),
        bad('Your face gives you away in one photograph, and one photograph is all it takes.', image(-5), st('mood', -5)),
      ] },
      { label: 'Tell him, quietly, how to speak to a waiter', outcomes: [
        { on: 'always', weight: 0.5, tone: 'good', text: 'Someone at the table tells a journalist. By the weekend you are the most popular person in the country.', effects: [image(10), hid('karma', 5), st('mood', 6)] },
        { on: 'always', weight: 0.5, tone: 'bad', text: 'He leaves before the pudding. The prime minister asks for a word.', effects: [image(-6), hid('karma', 4), st('mood', -3)] },
      ] },
      { label: 'Plead a headache and leave early', outcomes: [any('An empty chair at the top table is noticed by everyone.', 'bad', image(-4), st('mood', 2))] },
    ],
  },
  {
    id: 'tell_all_offer', category: 'royalty', ageRange: [21, 90], cooldown: 12, requires: [royal],
    text: 'A publisher offers you {$2000000} for a book about what really goes on behind the palace walls.',
    choices: [
      { label: 'Refuse', outcomes: [any('You send the letter back unanswered. Some things are not for sale.', 'neutral', image(2), hid('discipline', 2))] },
      { label: 'Write it, and hold nothing back', outcomes: [any('It sells four million copies in a week. Your family stops speaking to you, and the public is not sure it likes someone who tells.', 'bad', cash(2000000), image(-22), st('mood', -6), hid('fame', 10), ms('Wrote a book about the royal family.'))] },
      { label: 'Write something gentle about gardens instead', outcomes: [any('A small, kind book about the palace gardens. It sells well enough, and offends nobody.', 'good', cash(60000), image(3), st('mood', 4))] },
    ],
  },
  {
    id: 'protocol_lessons', category: 'royalty', ageRange: [18, 70], once: true, requires: [royal, need('royalBy', '==', 'marriage')],
    text: 'A woman from the palace arrives with a folder. You are to learn how to stand, sit, wave, get out of a car, and whom never to turn your back on.',
    choices: [
      { label: 'Learn every page of it', check: chk(0.65, { 'hidden.discipline': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('By the end of the month you can leave a car in a narrow skirt without a single photograph worth printing.', image(6), hid('discipline', 4), st('mood', -2)),
        bad('You try. At your first engagement you walk ahead of the monarch, and a hundred cameras catch it.', image(-5), st('mood', -5)),
      ] },
      { label: 'Do it your own way', check: chk(0.4, { 'stats.charm': 0.7 }), outcomes: [
        ok('You hug people. You are not supposed to hug people. They adore you for it.', image(11), st('mood', 6)),
        bad('The newspapers call you common, and the family privately agrees.', image(-9), st('mood', -6)),
      ] },
    ],
  },
  {
    id: 'republican_march', category: 'royalty', ageRange: [18, 100], cooldown: 9, requires: [royal],
    text: 'Thousands march past the palace gates with placards asking what, exactly, your family is for.',
    choices: [
      { label: 'Go out and talk to them', check: chk(0.45, { 'stats.charm': 0.5, 'hidden.willpower': 0.3 }), outcomes: [
        ok('You listen for an hour in the rain. You change few minds, but the photograph of you listening changes a great many.', image(10), st('mood', 3)),
        bad('Someone throws an egg. It is a very good shot.', image(-4), st('mood', -8)),
      ] },
      { label: 'Offer to pay tax like everyone else', requires: [has(100000)], outcomes: [any('You hand a tenth of what you have to the treasury, in public. The march next year is half the size.', 'good', cash(-100000), image(12), hid('karma', 6))] },
      { label: 'Stay inside with the curtains drawn', outcomes: [any('The palace has no comment. The marchers notice.', 'bad', image(-6), st('mood', -3))] },
    ],
  },
  {
    id: 'palace_leak', category: 'royalty', ageRange: [18, 95], cooldown: 8, requires: [royal],
    text: 'Something you said in private, about another member of the family, is on the front page word for word. Somebody close to you is talking.',
    choices: [
      { label: 'Find out who', check: chk(0.5, { 'stats.intellect': 0.6 }), outcomes: [
        ok('You tell three people three different stories and wait to see which is printed. Your private secretary clears his desk by lunchtime.', image(2), st('mood', 3), hid('willpower', 3)),
        bad('You accuse the wrong person, who has served the family for forty years. She resigns in tears, and that is printed too.', image(-7), hid('karma', -5), st('mood', -6)),
      ] },
      { label: 'Apologise to the relative', outcomes: [any('It is an uncomfortable tea. You are forgiven, more or less.', 'neutral', image(1), st('mood', -3), hid('karma', 3))] },
      { label: 'Deny you ever said it', outcomes: [
        { on: 'always', weight: 0.5, tone: 'neutral', text: 'The denial holds. Nobody has a recording.', effects: [hid('karma', -3)] },
        { on: 'always', weight: 0.5, tone: 'bad', text: 'Somebody has a recording.', effects: [image(-12), hid('karma', -4), st('mood', -8)] },
      ] },
    ],
  },
  {
    id: 'royal_night_out', category: 'royalty', ageRange: [18, 40], cooldown: 5, requires: [royal],
    text: 'Old friends want you to come out, properly out, the way you used to. Your protection officer advises against it.',
    choices: [
      { label: 'Stay in', outcomes: [any('You watch television in a room with forty-one clocks in it.', 'neutral', st('mood', -5), hid('discipline', 2))] },
      { label: 'Go, and behave', check: chk(0.6, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('Two drinks, a great deal of laughing, home by midnight. Nobody even recognised you in the hat.', st('mood', 9)),
        bad('Two drinks became several. There is a photograph of you leaving, and you do not remember it being taken.', image(-9), st('mood', 2), st('health', -2)),
      ] },
      { label: 'Go, and do not behave', outcomes: [any('It is the best night of your year and the worst front page of your life.', 'bad', image(-16), st('mood', 10), st('health', -4))] },
    ],
  },
  {
    id: 'royal_childhood_cameras', category: 'royalty', ageRange: [5, 12], once: true, requires: [royal],
    text: 'It is your first day at a new school. There are forty photographers at the gate, and your shoes are too new.',
    choices: [
      { label: 'Wave, the way you were shown', outcomes: [any('You give the small wave you practised. It is on the front of every newspaper, and your grandmother keeps the cutting.', 'good', image(4), st('mood', 3))] },
      { label: 'Stick your tongue out', outcomes: [any('It is on the front of every newspaper. The country finds it delightful. Your parents do not.', 'neutral', image(3), st('mood', 6), hid('discipline', -2))] },
      { label: 'Hide behind your mother', outcomes: [any('You hold on to her coat and look at the ground until it is over.', 'neutral', st('mood', -3))] },
    ],
  },
  {
    id: 'royal_teen_rules', category: 'royalty', ageRange: [13, 17], once: true, requires: [royal],
    text: 'Everyone in your class is going to a concert. You may go, the palace says, with two bodyguards and a list of things you are not to do.',
    choices: [
      { label: 'Go with the bodyguards', outcomes: [any('They stand behind you with their arms folded for the whole show. One of them, it turns out, knows all the words.', 'good', st('mood', 5))] },
      { label: 'Climb out of a window and go alone', check: chk(0.4, { 'talents.crime': 0.4, 'stats.intellect': 0.2 }), outcomes: [
        ok('For three hours you are nobody at all. It is wonderful.', st('mood', 12), hid('willpower', 3)),
        bad('A police helicopter is sent up to look for you. The whole school hears about it, and so does the whole country.', image(-5), st('mood', -6)),
      ] },
      { label: 'Stay at home', outcomes: [any('You listen to the record in your room and learn what duty tastes like.', 'neutral', st('mood', -5), hid('discipline', 3))] },
    ],
  },
  {
    id: 'monarch_signs_law', category: 'royalty', ageRange: [18, 110], cooldown: 6, requires: [need('reigning', '==', true), need('recentLaw', '==', true)],
    text: 'The government of {pm} sends a law for your signature: to {law}. You think it is a mistake. By custom, the crown signs whatever the legislature passes.',
    choices: [
      { label: 'Sign it', outcomes: [any('You sign. That is the bargain your family made a long time ago.', 'neutral', st('mood', -5), hid('karma', -2))] },
      { label: 'Sign, and let it be known you were unhappy', check: chk(0.5, { 'stats.intellect': 0.4 }), outcomes: [
        ok('A carefully placed word reaches the right journalist. The law is softened before it comes into force.', image(6), hid('karma', 4)),
        bad('It looks like meddling. The prime minister reminds you, in front of others, what your job is.', image(-7), st('mood', -5)),
      ] },
      { label: 'Refuse to sign', outcomes: [
        { on: 'always', weight: 0.35, tone: 'good', text: 'The country is with you. The government backs down, and you are never quite an ornament again.', effects: [image(14), hid('karma', 8), st('mood', 8), govt('refuseAssent')] },
        { on: 'always', weight: 0.65, tone: 'bad', text: 'It is called the worst constitutional crisis in a century. There is talk, serious talk, of doing without a monarch altogether.', effects: [image(-20), hid('karma', 6), st('mood', -10)] },
      ] },
    ],
  },
  {
    id: 'royal_spouse_strain', category: 'royalty', ageRange: [20, 80], cooldown: 8, cast: { spouse: 'spouse' },
    requires: [royal, need('royalBy', '==', 'marriage')],
    text: 'Life in the palace is harder than either of you expected. You have not eaten a meal alone with {spouse} in two months, and tonight there is another dinner for ninety.',
    choices: [
      { label: 'Cancel it and stay in together', outcomes: [any('Ninety people are disappointed, and one is not. You eat toast in the kitchen and talk until two.', 'good', rel('spouse', 12), image(-3), st('mood', 8))] },
      { label: 'Go, and hold hands under the table', outcomes: [any('It is a small thing. It helps more than you expected.', 'good', rel('spouse', 5), image(2), st('mood', 2))] },
      { label: 'Say this is not what you signed up for', outcomes: [any('It is true, and it lands badly. You sleep in the blue bedroom, of which there are four.', 'bad', rel('spouse', -10), st('mood', -6))] },
    ],
  },

  // ---------- The nobility ----------
  {
    id: 'the_leaking_roof', category: 'royalty', ageRange: [21, 100], cooldown: 9, requires: [need('isNoble', '==', true), need('royalBy', '==', 'birth')],
    text: 'The roof of the family seat is leaking into the long gallery again. The builder sucks his teeth and names a figure: {$180000}.',
    choices: [
      { label: 'Pay it', requires: [has(180000)], outcomes: [any('Four hundred years of your family look down from the walls, dry, and unimpressed.', 'neutral', cash(-180000), st('mood', 2))] },
      { label: 'Open the house to visitors', outcomes: [any('Coaches arrive on Sundays. You sell tea in the stables and hide upstairs. It pays for the lead.', 'neutral', cash(30000), st('mood', -3), hid('fame', 2))] },
      { label: 'Put buckets under it', outcomes: [any('The buckets fill. A ceiling painted in 1740 comes down in the night.', 'bad', st('mood', -8))] },
    ],
  },
  {
    id: 'title_at_the_door', category: 'royalty', ageRange: [18, 95], cooldown: 12, requires: [need('titled', '==', true), need('isRoyal', '==', false)],
    text: 'A restaurant with no tables free finds one the moment it hears your name with the title in front of it. A family that was waiting is asked to wait longer.',
    choices: [
      { label: 'Take the table', outcomes: [any('The food is very good. You do not look towards the door.', 'neutral', st('mood', 3), hid('karma', -3))] },
      { label: 'Give it to the family', outcomes: [any('You say there has been a mistake, and wait at the bar like everyone else.', 'good', hid('karma', 5), st('mood', 4))] },
    ],
  },

  // ---------- Commoners in a country with a crown ----------
  {
    id: 'royal_visit_to_town', category: 'royalty', ageRange: [6, 90], cooldown: 15, requires: [need('monarchy', '==', true), need('titled', '==', false)],
    text: 'A member of the royal family is coming to open something in {city}. The streets are being swept and there are flags in the shop windows.',
    choices: [
      { label: 'Wait at the barrier with a flag', outcomes: [
        { on: 'always', weight: 0.8, tone: 'good', text: 'You wait three hours for a car that passes in six seconds. Somebody inside it waves, perhaps at you.', effects: [st('mood', 4)] },
        { on: 'always', weight: 0.2, tone: 'good', text: 'The car stops. A hand is held out, and it is your hand that is shaken. You tell the story for years.', effects: [st('mood', 10), hid('fame', 1)] },
      ] },
      { label: 'Stay at home', outcomes: [any('You watch it on the local news and recognise half the crowd.', 'neutral')] },
      { label: 'Hold up a sign asking what they cost', outcomes: [any('A policeman asks you, quite politely, to stand somewhere else.', 'neutral', hid('willpower', 2), st('mood', 1))] },
    ],
  },
  {
    id: 'royal_wedding_on_tv', category: 'royalty', ageRange: [8, 100], cooldown: 20, requires: [need('monarchy', '==', true), need('isRoyal', '==', false)],
    text: 'There is a royal wedding today. The whole country has the day off and every street has a party.',
    choices: [
      { label: 'Go to the street party', outcomes: [any('Paper plates, bunting, and a neighbour you have never spoken to who turns out to be wonderful company.', 'good', st('mood', 7), st('charm', 1))] },
      { label: 'Watch every minute on television', outcomes: [any('You have opinions about the dress, the hats and the uncle. So does everyone.', 'good', st('mood', 4))] },
      { label: 'Use the day off to do nothing royal at all', outcomes: [any('The roads are empty and the hills are quiet. A fine day.', 'good', st('mood', 5), st('health', 1))] },
    ],
  },
];
