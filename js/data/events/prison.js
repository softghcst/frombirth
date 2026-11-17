// Scenes that only happen inside. Events marked `prison: true` fire while the
// player is locked up, and nothing else does.
import { st, hid, tal, cash, rel, ok, bad, any, chk, need, mem } from './helpers.js';

/** Changes prison respect or conduct. */
const inside = (target, delta) => ({ type: 'prison', target, delta });
const scene = (id, extra, text, choices) => ({ id, category: 'inside', ageRange: [12, 120], prison: true, cooldown: 5, ...extra, text, choices });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  scene('yard_challenge', {}, 'In the yard, someone twice your width blocks your path and says you are sitting on his bench.', [
    { label: 'Stand your ground', check: chk(0.4, { 'stats.health': 0.5, 'talents.sports': 0.3, 'hidden.willpower': 0.3 }), outcomes: [
      ok('You do not move, and you do not blink. After a long moment he laughs and sits down next to you.', inside('respect', 12), st('mood', 4)),
      bad('It is short, and you lose. But you did not back down, and that is noted.', st('health', -12), inside('respect', 4), inside('conduct', -6)),
    ] },
    { label: 'Move, without hurrying', outcomes: [any('You stand, stretch, and walk away as if you were leaving anyway. Nobody is fooled.', 'neutral', inside('respect', -6))] },
    { label: 'Offer him half of it', check: chk(0.45, { 'stats.charm': 0.8 }), outcomes: [
      ok('It gets a laugh from the whole yard. He takes the half.', inside('respect', 5), st('charm', 1)),
      bad('It is not a sharing kind of bench.', st('health', -6), inside('respect', -4)),
    ] },
  ]),
  scene('contraband', { cast: { mate: 'cellmate' } },
    '{mate} has a phone hidden in the mattress, and offers you ten minutes on it for keeping quiet.', [
      { label: 'Keep quiet and make a call home', outcomes: [
        { on: 'always', weight: 3, tone: 'good', text: 'Ten minutes of a voice from outside. It is worth every second.', effects: [st('mood', 9), rel('mate', 8)] },
        { on: 'always', weight: 1, tone: 'bad', text: 'A cell search finds it the next morning. You are both written up.', effects: [inside('conduct', -18), rel('mate', 4), st('mood', -4)] },
      ] },
      { label: 'Keep quiet and stay out of it', outcomes: [any('{mate} nods. You are someone who can be trusted with things.', 'good', rel('mate', 6), inside('respect', 3))] },
      { label: 'Tell an officer', outcomes: [any('The phone is gone by lunchtime. So is your name, in the only way that matters in here.', 'bad', inside('conduct', 15), inside('respect', -25), rel('mate', -40), hid('karma', -2))] },
    ]),
  scene('visiting_day', { cast: { family: 'parent' }, cooldown: 4 },
    '{family} has come three hours on a bus to sit across a table from you for forty minutes.', [
      { label: 'Tell them the truth about how it is', outcomes: [any('{family} holds your hands until the officer says time. They will be back next month.', 'good', rel('family', 10), st('mood', 6),
        mem('family', 'visitedInside', 'They visited you inside, and you told them the truth.'))] },
      { label: 'Say you are fine', outcomes: [any('You both pretend. It is easier, and it is lonelier.', 'neutral', rel('family', 3), st('mood', -2))] },
      { label: 'Refuse the visit', outcomes: [any('You watch from the landing as {family} is told, and turns round, and walks back to the bus.', 'bad', rel('family', -15), st('mood', -6))] },
    ]),
  scene('informant', {},
    'A senior officer calls you into the office and closes the door. A name, he says, in exchange for a word with the parole board.', [
      { label: 'Give him a name', outcomes: [
        { on: 'always', weight: 2, tone: 'neutral', text: 'It is done quietly. Your file gets a note in the margin.', effects: [inside('conduct', 20), hid('karma', -6)] },
        { on: 'always', weight: 1, tone: 'bad', text: 'It is done quietly, and then it is not quiet at all. Everyone knows.', effects: [inside('conduct', 20), inside('respect', -30), st('health', -14), hid('karma', -6)] },
      ] },
      { label: 'Say you see nothing in here', outcomes: [any('He opens the door again. On the wing, somehow, people already know what you said.', 'good', inside('respect', 8), inside('conduct', -4))] },
    ]),
  scene('prison_class', {},
    'A teacher comes in on Tuesdays and is starting a course. There are six places, and one of them could be yours.', [
      { label: 'Sign up and do the work', check: chk(0.65, { 'stats.intellect': 0.4, 'hidden.discipline': 0.5 }), outcomes: [
        ok('You finish it, and they hand you a certificate with your name spelled right.', st('intellect', 6), inside('conduct', 12), st('mood', 5)),
        bad('You last five weeks. It still did you some good.', st('intellect', 2), inside('conduct', 3)),
      ] },
      { label: 'Sign up to get off the wing', outcomes: [any('Two hours a week of somewhere quieter.', 'neutral', st('mood', 3), inside('conduct', 2))] },
      { label: 'Leave it for someone else', outcomes: [any('The list fills up without you.', 'neutral')] },
    ]),
  scene('card_school', {},
    'There is a card game on the landing every evening, played for phone credit and favors.', [
      { label: 'Play straight', check: chk(0.45, { 'stats.intellect': 0.6 }), outcomes: [
        ok('You win more than you lose, and you win it politely.', cash(120), inside('respect', 4)),
        bad('You are out of credit by Thursday.', cash(-60), st('mood', -2)),
      ] },
      { label: 'Cheat', check: chk(0.4, { 'talents.crime': 0.8 }), outcomes: [
        ok('Nobody sees the card come out of your sleeve.', cash(300), tal('crime', 2), hid('karma', -3)),
        bad('Somebody sees the card come out of your sleeve.', st('health', -15), inside('respect', -10), hid('karma', -3)),
      ] },
      { label: 'Watch', outcomes: [any('You learn who bluffs and who does not, which is worth knowing.', 'neutral', st('intellect', 1))] },
    ]),
];
