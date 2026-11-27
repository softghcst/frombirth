// What the player can do with the people in their life, by who they are to
// each other: a parent, a sibling, a friend, a partner, a child, a grandparent.
// The everyday actions everyone shares (talk, a gift, an argument) are in
// engine/relationships.js; romance in engine/romance.js; relationships beyond one
// partner, and the terms of the main one, in engine/bonds.js. These are the rest.
//
// Each action is once a year per person, like the others. Many leave a memory on
// the person (npc.memories), which their profile shows and later stories can use.
// Parents and partners also keep `meters.trust`, apart from how close you are:
// a parent can love you and still not believe a word you say.
import { rng } from '../rng.js';
import { clamp, localMoney, localCost, fmtMoney } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { remember, hasMemory } from './conditions.js';
import { spendAction } from './relationships.js';
import { may } from './rules.js';
import { techAvailable } from './digital/tech.js';
import { getEra, atWar } from './history.js';
import { familyAdopts } from './animalCare.js';
import { lendMoney } from './family.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { makeNpc } from './npcFactory.js';
import { breakUp, divorce } from './romance.js';
import { bonds as relationships } from './bonds.js';
import { storyBeat } from './storyDirector.js';
import { arrangement as blendedArrangement, askToLiveWith, askToSeeMore } from './blended.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const npcs = () => store.state.npcs;
const mine = (role) => player().npcIds.map((id) => npcs()[id]).filter((n) => n?.alive && (Array.isArray(role) ? role.includes(n.role) : n.role === role));
const bump = (n, d) => { n.meters.relationship = clamp(n.meters.relationship + Math.round(d)); };
const mood = (d) => { const p = player(); p.stats.mood = clamp(p.stats.mood + Math.round(d)); };
const hidden = (k, d) => { const p = player(); p.hidden[k] = clamp((p.hidden[k] ?? 50) + Math.round(d)); };
const skill = (k, d) => { const p = player(); p.skills ??= {}; p.skills[k] = clamp((p.skills[k] ?? 0) + Math.round(d)); };
const has = (techId) => techAvailable(techId, store.state.year, player().countryId);
const pay = (base) => localCost(base, country());
const money = (amount) => fmtMoney(amount, country());
const he = (n) => (n.gender === 'male' ? 'he' : n.gender === 'female' ? 'she' : 'they');
const him = (n) => (n.gender === 'male' ? 'him' : n.gender === 'female' ? 'her' : 'them');
const his = (n) => (n.gender === 'male' ? 'his' : n.gender === 'female' ? 'her' : 'their');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** How far a parent or partner believes the player: 0 to 100, apart from how close they are. */
export const trustOf = (n) => (n.meters.trust ??= 60);
const trust = (n, d) => { n.meters.trust = clamp(trustOf(n) + Math.round(d)); };
/** True for the people who keep a trust meter. */
export const keepsTrust = (n) => ['parent', 'partner', 'spouse'].includes(n.role);

/** A chance that leans on how close the two are and on the player's charm. */
const odds = (base, n) => clamp(base + (n.meters.relationship - 50) / 200 + (player().stats.charm - 50) / 300, 0.05, 0.95);
/** How easygoing a parent is: generous and a little wild say yes, careful and tight say no. */
const easygoing = (n) => clamp(0.35 + (n.meters.generosity - 50) / 200 + (n.meters.crazy - 30) / 200 + (trustOf(n) - 60) / 150, 0.08, 0.9);
const atHome = () => !!player().flags.livesWithParents;
const takeFrom = (n, amount) => { if (n.life) n.life.savings = Math.max(0, (n.life.savings ?? 0) - amount); else if (n.savings != null) n.savings = Math.max(0, n.savings - amount); };
const giveTo = (n, amount) => { if (n.life) n.life.savings = (n.life.savings ?? 0) + amount; else n.savings = (n.savings ?? 0) + amount; };
const spend = (amount, why) => { const p = player(); if (p.finance.cash < amount) return result(false, `${why} would cost ${money(amount)}. You have ${money(Math.max(0, p.finance.cash))}.`, 'neutral'); p.finance.cash -= amount; return null; };

const PARENT = ['parent'];
const SIBLING = ['sibling'];
const STEP = ['stepparent'];
const CARED = ['fosterchild', 'ward', 'stepchild'];
const STEPSIB = ['stepsibling'];
/** What a sleepover can be. `if`: only where it makes sense (video games need a television, from 1980). */
const SLEEPOVER = [
  { id: 'movie', label: 'Movie marathon', text: '{name} slept over and you watched a film, then half of another, and fell asleep on the floor.', memory: 'a movie and a floor full of popcorn.' },
  { id: 'games', label: 'Gaming night', if: () => has('television') && store.state.year >= 1980, text: 'You and {name} played video games until somebody\'s parent said lights out, twice.', memory: 'video games until lights out.' },
  { id: 'bake', label: 'Make cookies', text: 'You and {name} baked cookies. Some were burned, most were eaten raw, and the kitchen will never be the same.', memory: 'cookies, mostly eaten raw.' },
  { id: 'camp', label: 'Sleep out in a tent', text: 'You and {name} pitched a tent outside, and talked in it until it got light.', memory: 'a night in a tent outside.', mood: 8 },
  { id: 'fort', label: 'Blanket fort', text: 'You and {name} built a blanket fort out of every cushion in the house, and slept in it.', memory: 'a blanket fort.' },
  { id: 'ghost', label: 'Ghost stories by flashlight', text: 'You and {name} told ghost stories with a flashlight. Nobody admitted being scared. Everyone was.', memory: 'ghost stories by flashlight.', mood: 4 },
];
/** Scenes that can happen during the night (data/events/stories/sleepover.js). */
const SLEEPOVER_SCENES = ['sleepover_board_game', 'sleepover_prank_call', 'sleepover_sneak_out', 'sleepover_secret'];
export const SLEEPOVER_IDS = SLEEPOVER.map((a) => a.id);

const FRIEND = ['friend', 'classmate'];
const PARTNER = ['partner', 'spouse'];
const CHILD = ['child'];
const GRAND = ['grandparent'];

/**
 * Every action. `age` is the player's age, `them` the other person's. `if` adds any
 * further condition. `options` (when given) asks the player to choose first.
 * `run` does it and returns the text, and sometimes a tone.
 */
export const BONDS = [
  // ---------- Parents, when you are small ----------
  { id: 'hug', group: 'together', roles: PARENT, age: [2, 7], label: 'Ask for a hug',
    run: (n) => { bump(n, rng.int(4, 8)); mood(4); return `${n.firstName} scooped you up. For a minute, nothing in the world was wrong.`; } },
  { id: 'story', group: 'together', roles: PARENT, age: [2, 8], label: 'Ask for a bedtime story',
    run: (n) => { bump(n, rng.int(3, 6)); mood(3); player().stats.intellect = clamp(player().stats.intellect + 1);
      return rng.pick([`${n.firstName} read the same book again, doing all the voices.`, `${n.firstName} made up a story about a dragon who was afraid of the dark. You fell asleep before the end.`, `${n.firstName} read until ${he(n)} was yawning more than you were.`]); } },
  { id: 'askPet', group: 'ask', roles: PARENT, age: [4, 17], if: () => atHome(), label: 'Ask for a pet',
    run: (n) => {
      if (!rng.chance(easygoing(n))) { mood(-2); return { text: `${n.firstName} said no: "Who do you think will walk it?" Maybe next year.`, tone: 'neutral' }; }
      const r = familyAdopts();
      if (!r.ok) return { text: r.text, tone: 'neutral' };
      bump(n, 4); mood(8); remember(n, 'gavePet', 'Said yes when you begged for a pet.');
      return r.text;
    } },
  { id: 'stayUp', group: 'ask', roles: PARENT, age: [5, 12], if: () => atHome(), label: 'Ask to stay up late',
    run: (n) => (rng.chance(easygoing(n)) ? (mood(4), `${n.firstName} said yes, just this once. You lasted until ten and pretended you were not tired.`)
      : (mood(-1), { text: `"Bed," said ${n.firstName}. There was no arguing with that voice.`, tone: 'neutral' })) },
  { id: 'friendsHouse', group: 'ask', roles: PARENT, age: [5, 13], if: () => atHome() && mine(FRIEND).length > 0, label: 'Ask to go to a friend\'s house',
    run: (n) => {
      const f = rng.pick(mine(FRIEND));
      if (!rng.chance(easygoing(n) + 0.2)) return { text: `${n.firstName} said not this weekend. ${f.firstName} will have to wait.`, tone: 'neutral' };
      bump(f, rng.int(4, 8)); mood(4);
      return `${n.firstName} dropped you at ${f.firstName}'s and picked you up after dinner. You want to live there now.`;
    } },
  { id: 'chores', group: 'help', roles: PARENT, age: [5, 17], if: () => atHome(), label: 'Help around the house',
    run: (n) => { bump(n, rng.int(3, 7)); hidden('discipline', 2); player().flags.choresYear = store.state.year;
      return rng.pick([`You did the dishes without being asked. ${n.firstName} checked your temperature.`, `You helped ${n.firstName} with the yard all Saturday.`, `You folded the laundry. Badly, but you did it.`]); } },
  { id: 'pocketMoney', group: 'ask', roles: PARENT, age: [6, 17], if: () => atHome(), label: 'Ask for pocket money',
    run: (n) => {
      const p = player();
      const chores = p.flags.choresYear === store.state.year;
      if (!rng.chance(clamp(easygoing(n) + (chores ? 0.3 : 0) + (n.meters.money - 50) / 200, 0.1, 0.95))) return { text: `${n.firstName} said money does not grow on trees${chores ? ', but promised to think about it' : ', and you could start by helping around the house'}.`, tone: 'neutral' };
      const amount = localMoney(Math.round(rng.int(2, 6) * 26 * (0.6 + n.meters.money / 100) * (chores ? 1.5 : 1) * (p.age >= 13 ? 2 : 1)), country());
      takeFrom(n, amount); p.finance.cash += amount;
      return `${n.firstName} agreed to an allowance${chores ? ' for the chores' : ''}: ${money(amount)} over the year.`;
    } },
  { id: 'tell', group: 'conflict', roles: PARENT, age: [4, 14], if: () => mine(SIBLING).some((s) => s.age < 25), label: 'Tell on your sibling',
    run: (n) => { const s = rng.pick(mine(SIBLING).filter((x) => x.age < 25)); bump(n, 1); bump(s, -rng.int(6, 12)); hidden('karma', -2);
      return { text: `You told ${n.firstName} what ${s.firstName} did. ${s.firstName} got in trouble, and knows exactly who to thank.`, tone: 'neutral' }; } },
  { id: 'lie', group: 'conflict', roles: PARENT, age: [6, 17], danger: true, label: 'Lie to them',
    run: (n) => {
      const caught = rng.chance(clamp(0.35 + (n.meters.intellect - player().stats.charm) / 150, 0.1, 0.8));
      hidden('karma', -2);
      if (caught) { trust(n, -15); bump(n, -5); return { text: `${n.firstName} knew. ${cap(he(n))} did not even shout, which was worse. ${cap(he(n))} will check your story for a while now.`, tone: 'bad' }; }
      trust(n, -3); mood(2); return { text: `${n.firstName} believed you. You feel less good about it than you expected.`, tone: 'neutral' };
    } },

  // ---------- Parents, when you are a teenager ----------
  { id: 'curfew', group: 'ask', roles: PARENT, age: [13, 17], if: () => atHome(), label: 'Ask for a later curfew',
    run: (n) => (rng.chance(clamp((trustOf(n) - 30) / 70, 0.05, 0.9)) ? (trust(n, 2), mood(4), `${n.firstName} agreed to an hour later. "Break it once and it is ten o'clock again."`)
      : { text: `${n.firstName} said no. "When I can trust you, we will talk about it."`, tone: 'neutral' }) },
  { id: 'car', group: 'ask', roles: PARENT, age: [16, 25], if: () => !!player().flags.canDrive && atHome(), label: 'Ask to borrow the car',
    run: (n) => {
      if (!rng.chance(clamp((trustOf(n) - 25) / 70, 0.05, 0.9))) return { text: `${n.firstName} held on to the keys. "Not tonight."`, tone: 'neutral' };
      mood(6);
      if (rng.chance(0.08)) { trust(n, -10); return { text: `${n.firstName} lent you the car. You brought it back with a dent in the bumper and a story nobody believed.`, tone: 'bad' }; }
      trust(n, 3); return `${n.firstName} lent you the car. You brought it back clean, full of gas, on time. ${cap(he(n))} noticed.`;
    } },
  { id: 'party', group: 'ask', roles: PARENT, age: [13, 17], if: () => atHome(), label: 'Ask to go to a party',
    run: (n) => {
      if (!rng.chance(clamp((trustOf(n) - 25) / 70 + 0.1, 0.05, 0.9))) return { text: `"Whose party? Whose parents? No."`, tone: 'neutral' };
      mood(7); for (const f of mine(FRIEND).slice(0, 3)) bump(f, 2);
      return `${n.firstName} said yes, and to call if you needed a ride, no questions asked. It was a good party.`;
    } },
  { id: 'crush', group: 'talk', roles: PARENT, age: [11, 17], label: 'Talk about a crush',
    run: (n) => (rng.chance(odds(0.55, n)) ? (bump(n, 6), mood(3), remember(n, 'crushTalk', 'You told them about your first crush, and they did not laugh.'), `${n.firstName} listened, and did not laugh, and told you about ${his(n)} own first crush. It was mortifying and nice.`)
      : (bump(n, 1), { text: `${n.firstName} got far too excited and asked for a name. You will never do that again.`, tone: 'neutral' })) },
  { id: 'sneakOut', group: 'conflict', roles: PARENT, age: [13, 17], danger: true, if: () => atHome(), label: 'Sneak out at night',
    run: (n) => {
      hidden('crazy', 2);
      if (rng.chance(clamp(0.3 + (n.meters.intellect - 50) / 200, 0.15, 0.6))) { trust(n, -20); bump(n, -6); player().flags.groundedYear = store.state.year;
        return { text: `${n.firstName} was waiting in the kitchen with the light off. You are grounded, and the window is now nailed shut.`, tone: 'bad' }; }
      mood(7); trust(n, -2); return { text: 'You climbed out, met up with friends, and climbed back in before dawn. Nobody knows. Yet.', tone: 'neutral' };
    } },
  { id: 'teach', group: 'together', roles: PARENT, age: [9, 25], label: 'Ask them to teach you something',
    options: (n) => {
      const p = player();
      const job = n.occupation;
      return [
        { value: 'cook', label: 'How to cook', sub: 'Their best dishes, and how not to burn the rice.' },
        ...(p.age >= 15 && !p.flags.canDrive ? [{ value: 'drive', label: 'How to drive', sub: 'Practice before the test: in the parking lot first.' }] : []),
        { value: 'fix', label: 'How to fix things', sub: 'A dripping tap, a flat tire, a wobbly chair.' },
        ...(job ? [{ value: 'trade', label: `What they do as ${/^[aeiou]/i.test(job) ? 'an' : 'a'} ${job}`, sub: 'A day at work with them.' }] : []),
      ];
    },
    run: (n, opt) => {
      const p = player();
      bump(n, rng.int(4, 8));
      if (opt === 'cook') { skill('cooking', rng.int(8, 14)); remember(n, 'taughtCooking', 'Taught you to cook.'); return `${n.firstName} taught you to make ${his(n)} best dish. You will make it for the rest of your life.`; }
      if (opt === 'drive') { p.flags.drivePractice = (p.flags.drivePractice ?? 0) + 1; remember(n, 'taughtDriving', 'Taught you to drive.'); return `${n.firstName} took you to an empty parking lot and only gripped the dashboard twice. Your test will go better for it.`; }
      if (opt === 'fix') { skill('handy', rng.int(8, 14)); remember(n, 'taughtFixing', 'Showed you how to fix things.'); return `${n.firstName} showed you how to fix things with the patience of someone who has fixed everything twice.`; }
      p.flags.shadowed = { job: n.occupation, year: store.state.year }; player().stats.intellect = clamp(p.stats.intellect + 2);
      remember(n, 'tookToWork', `Took you to work to see what a ${n.occupation} does.`);
      return `You spent a day at work with ${n.firstName}. ${cap(he(n))} is different there: good at it, and proud of it.`;
    } },

  // ---------- Parents, when you are grown ----------
  { id: 'callHome', group: 'together', roles: PARENT, age: [18, 120], if: () => !atHome(),
    label: () => (has('landline') ? 'Call home' : 'Write home'),
    run: (n) => { bump(n, rng.int(3, 7)); mood(2);
      return has('landline') ? rng.pick([`You called ${n.firstName}. An hour went by on nothing much, and it was exactly right.`, `${n.firstName} picked up on the first ring, as if ${he(n)} had been waiting.`])
        : `You wrote ${n.firstName} a long letter. The answer came three weeks later, with news of everyone.`; } },
  { id: 'visitHome', group: 'together', roles: PARENT, age: [18, 120], if: (n) => !atHome() && !n.flags.livesWithPlayer, label: 'Visit for the weekend',
    run: (n) => { bump(n, rng.int(5, 10)); mood(4); return rng.pick([`You went home for the weekend. Your old room is a gym now, but the cooking is the same.`, `${n.firstName} made your favorite dinner and sent you back with leftovers for a week.`]); } },
  { id: 'trip', group: 'together', roles: PARENT, age: [20, 120], if: () => !atHome(), label: () => `Take them on a trip (${money(pay(900))})`,
    run: (n) => { const no = spend(pay(900), 'A trip'); if (no) return no; bump(n, rng.int(8, 14)); mood(6); remember(n, 'tookOnTrip', 'You took them on a trip they still talk about.');
      return `You took ${n.firstName} somewhere ${he(n)} had always wanted to see. ${cap(he(n))} showed the photos to everyone for a year.`; } },
  { id: 'payBill', group: 'help', roles: PARENT, age: [20, 120], if: (n) => !atHome() && n.meters.money < 55, label: () => `Pay a bill for them (${money(pay(600))})`,
    run: (n) => { const no = spend(pay(600), 'That bill'); if (no) return no; giveTo(n, pay(600)); bump(n, rng.int(5, 9)); hidden('karma', 2);
      return `You quietly paid ${n.firstName}'s overdue bill. ${cap(he(n))} pretended to be cross about it.`; } },
  { id: 'moveIn', group: 'help', roles: PARENT, age: [25, 120], them: [62, 130], if: (n) => !atHome() && !n.flags.livesWithPlayer, label: 'Ask them to move in with you',
    run: (n) => {
      if (!rng.chance(odds(0.35, n) + (n.meters.health < 50 ? 0.25 : 0))) return { text: `${n.firstName} thanked you, and said ${he(n)} is not ready to give up ${his(n)} own front door.`, tone: 'neutral' };
      n.flags.livesWithPlayer = store.state.year; bump(n, 10); remember(n, 'movedIn', 'Came to live with you in old age.');
      return `${n.firstName} moved in with you. The kitchen is ${his(n)} kitchen now, apparently.`;
    } },
  { id: 'familyHistory', group: 'talk', roles: [...PARENT, ...GRAND], age: [10, 120], label: 'Ask about the family history',
    run: (n) => {
      const p = player();
      const youth = store.state.year - n.age + 18;
      const era = getEra(youth);
      const war = atWar(n.bornIn ?? p.countryId, youth) || atWar(n.bornIn ?? p.countryId, youth + 4);
      const from = n.bornIn && n.bornIn !== p.countryId ? ' and about the country the family came from' : '';
      const elders = mine('grandparent').filter((g) => g.id !== n.id).map((g) => g.firstName);
      bump(n, rng.int(4, 8)); remember(n, 'familyHistory', 'Told you the family history.');
      p.flags.knowsFamilyHistory = true;
      return `${n.firstName} talked about growing up in ${era.name.toLowerCase().replace(/^the /, 'the ')}${war ? ', with a war on' : ''}${from}${elders.length ? `, and about ${elders.join(' and ')} when they were young` : ''}. You wrote some of it down.`;
    } },
  { id: 'advice', group: 'talk', roles: [...PARENT, ...GRAND], age: [14, 120], label: 'Ask for advice',
    run: (n) => {
      const p = player();
      const single = !mine(PARTNER).length;
      const debt = (p.finance.loans ?? []).reduce((s, l) => s + (l.principal ?? 0), 0) > p.finance.cash;
      const work = p.career?.careerId && (p.career.performance ?? 50) < 45;
      bump(n, rng.int(2, 5)); mood(3);
      const line = debt ? '"Pay off what you owe before you buy anything you want."'
        : work ? '"Do the job in front of you well. People notice, even when it feels like they do not."'
        : single && p.age >= 22 ? '"Go where people are. Nobody ever met anyone at home on the couch."'
        : p.education?.enrolled ? '"Finish what you started. The certificate opens doors."'
        : '"Be kind, save something every month, and call your mother."';
      return `${n.firstName} thought about it for a long time. ${line}`;
    } },
  { id: 'forgive', group: 'talk', roles: PARENT, age: [16, 120], if: (n) => n.meters.relationship < 45, label: 'Forgive them',
    run: (n) => { bump(n, rng.int(8, 15)); hidden('karma', 4); mood(4); remember(n, 'forgiven', 'You forgave them for the past.');
      return `You told ${n.firstName} you forgive ${him(n)}. Neither of you knew what to do with your hands. It was a start.`; } },
  { id: 'confront', group: 'conflict', roles: PARENT, age: [16, 120], if: (n) => n.meters.relationship < 50, danger: true, label: 'Confront them about the past',
    run: (n) => {
      if (rng.chance(odds(0.35, n))) { bump(n, rng.int(6, 12)); remember(n, 'apologized', 'Apologized, at last, for the past.'); return `It was the hardest conversation you have ever had. At the end of it, ${n.firstName} said sorry. ${cap(he(n))} meant it.`; }
      bump(n, -rng.int(6, 12)); mood(-4); return { text: `${n.firstName} would not hear it. You left with nothing settled and everything said.`, tone: 'bad' };
    } },
  { id: 'introduce', group: 'talk', roles: PARENT, age: [14, 120], if: (n) => mine(PARTNER).some((x) => !x.flags.metParents?.includes(n.id)), label: 'Introduce your partner',
    run: (n) => introduceToParent(n, mine(PARTNER).find((x) => !x.flags.metParents?.includes(n.id))) },

  // ---------- Siblings ----------
  { id: 'play', group: 'together', roles: SIBLING, age: [3, 14], them: [2, 17], label: 'Play together',
    run: (n) => { bump(n, rng.int(4, 8)); mood(3); return rng.pick([`You and ${n.firstName} built a fort out of every cushion in the house.`, `You and ${n.firstName} played until someone cried. It was not you.`, `You and ${n.firstName} invented a game with rules only the two of you understand.`]); } },
  { id: 'prank', group: 'together', roles: SIBLING, age: [5, 20], label: 'Play a prank on them',
    run: (n) => (rng.chance(0.6) ? (bump(n, rng.int(1, 4)), mood(4), `You filled ${n.firstName}'s shoes with shaving foam. ${cap(he(n))} laughed eventually, and is planning revenge.`)
      : (bump(n, -rng.int(3, 7)), { text: `Your prank on ${n.firstName} went wrong, and you were the one who got wet.`, tone: 'neutral' })) },
  { id: 'fight', group: 'conflict', roles: SIBLING, age: [4, 17], danger: true, if: (n) => n.age < 25, label: 'Fight over something',
    run: (n) => {
      bump(n, -rng.int(4, 9));
      const parent = rng.pick(mine(PARENT).length ? mine(PARENT) : [null]);
      if (!parent) return { text: `You and ${n.firstName} fought over the remote until it broke.`, tone: 'bad' };
      const yours = rng.chance(0.5);
      bump(parent, yours ? 1 : -2);
      return { text: `You and ${n.firstName} fought over the front seat. ${parent.firstName} took ${yours ? 'your side, which made it worse' : `${n.firstName}'s side, which was unfair`}.`, tone: 'bad' };
    } },
  { id: 'blame', group: 'conflict', roles: SIBLING, age: [5, 17], danger: true, if: (n) => n.age < 25 && mine(PARENT).length > 0, label: 'Blame them for something you did',
    run: (n) => {
      hidden('karma', -4);
      const parent = rng.pick(mine(PARENT));
      if (rng.chance(0.35)) { trust(parent, -10); bump(n, -6); return { text: `${parent.firstName} worked out it was you. Now you are in trouble twice: once for the vase, once for lying.`, tone: 'bad' }; }
      bump(n, -rng.int(8, 14)); return { text: `${n.firstName} got the blame for the broken vase. ${cap(he(n))} knows, and will remember.`, tone: 'bad' };
    } },
  { id: 'borrow', group: 'ask', roles: SIBLING, age: [6, 30], label: 'Borrow their stuff',
    run: (n) => (rng.chance(odds(0.5, n)) ? (mood(2), `${n.firstName} let you borrow ${his(n)} best jacket. You gave it back with only a small stain.`)
      : (bump(n, -2), { text: `"Ask me again and I will tell everyone what you did last summer," said ${n.firstName}.`, tone: 'neutral' })) },
  { id: 'secret', group: 'talk', roles: [...SIBLING, ...FRIEND], age: [8, 120], label: 'Share a secret',
    run: (n) => {
      if (rng.chance(n.meters.relationship >= 50 ? 0.9 : 0.55)) { bump(n, rng.int(5, 9)); n.flags.knowsSecret = true; remember(n, 'sharedSecret', 'You trusted them with a secret.'); return `You told ${n.firstName} something you have never told anyone. ${cap(he(n))} kept it.`; }
      bump(n, -2); mood(-6); return { text: `You told ${n.firstName} a secret. By Friday, half the school knew.`, tone: 'bad' };
    } },
  { id: 'theirSecret', group: 'talk', roles: [...SIBLING, ...FRIEND], age: [8, 120], label: 'Ask what is on their mind',
    run: (n) => {
      const trouble = n.meters.health < 45 ? 'they have not been well, and have not told anyone'
        : n.life?.job === null && n.age >= 22 ? 'they lost their job and are ashamed of it'
        : n.meters.money < 25 ? 'money is tight, tighter than they let on'
        : n.meters.crazy > 70 ? 'they have been struggling, more than they show'
        : null;
      bump(n, rng.int(4, 8)); remember(n, 'keptTheirSecret', 'You listened, and kept what they told you.');
      return trouble ? `${n.firstName} told you ${trouble}. You promised to keep it to yourself, and you will.` : `${n.firstName} talked about nothing in particular for an hour, then thanked you as if it had been something.`;
    } },
  // ---------- A child in your care (engine/fostering.js) ----------
  { id: 'careTime', group: 'together', roles: CARED, age: [21, 120], label: 'Do something together',
    run: (n) => { bump(n, rng.int(3, 6)); mood(2); return rng.pick([`You and ${n.firstName} went to the park and stayed until the lights came on.`, `${n.firstName} showed you a game. You lost, repeatedly, and ${he(n)} laughed for the first time in a while.`, `You and ${n.firstName} cooked together. It was mostly ${n.firstName}'s idea.`]); } },
  { id: 'careHomework', group: 'together', roles: CARED, age: [21, 120], if: (n) => n.age >= 6 && n.age <= 17, label: 'Help with homework',
    run: (n) => { bump(n, rng.int(2, 5)); n.meters.intellect = clamp(n.meters.intellect + 1); return `You sat with ${n.firstName} over homework. ${cap(he(n))} got further than ${he(n)} expected.`; } },
  { id: 'careFamily', group: 'talk', roles: ['fosterchild', 'ward'], age: [21, 120], label: 'Talk about their family',
    run: (n) => { bump(n, rng.int(3, 6)); for (const id of n.parentIds ?? []) { const x = npcs()[id]; if (x?.alive) x.meters.relationship = clamp(x.meters.relationship + 2); }
      return `${n.firstName} talked about home. You listened, and helped ${him(n)} make a card for ${his(n)} family.`; } },
  // ---------- A blended family (engine/blended.js) ----------
  { id: 'askLiveWith', group: 'ask', roles: PARENT, age: [12, 17], if: (n) => !!n.flags.livesApart && !!blendedArrangement(), label: 'Ask to live with them',
    run: (n) => { const r = askToLiveWith(n.id); return { text: r.text, tone: r.tone }; } },
  { id: 'seeMore', group: 'ask', roles: PARENT, age: [6, 17], if: (n) => !!n.flags.livesApart && !!blendedArrangement(), label: 'Ask to see them more often',
    run: (n) => { const r = askToSeeMore(n.id); return { text: r.text, tone: r.tone }; } },
  { id: 'stepTime', group: 'together', roles: STEP, age: [3, 120], label: 'Spend time together',
    run: (n) => { bump(n, rng.int(3, 7)); mood(2); remember(n, 'stepTime', 'Spent an afternoon with you, just the two of you.');
      return rng.pick([`You and ${n.firstName} went for a long walk and found you had more to say than you expected.`, `${n.firstName} taught you to make something ${he(n)} grew up eating. It was better than you said it was.`, `You watched a game with ${n.firstName}. Neither of you cared who won.`]); } },
  { id: 'stepSchool', group: 'talk', roles: STEP, age: [6, 17], label: 'Talk about school',
    run: (n) => { bump(n, rng.int(2, 5)); return `${n.firstName} asked about school, and remembered the names from last time.`; } },
  { id: 'stepHelp', group: 'ask', roles: STEP, age: [8, 30], label: 'Ask for help with something',
    run: (n) => (rng.chance(clamp(0.45 + (n.meters.relationship - 40) / 120, 0.15, 0.9)) ? (bump(n, rng.int(4, 8)), trust(n, 3), `${n.firstName} helped, without making a thing of it.`)
      : { text: `${n.firstName} tried to help. It came out more like advice than you wanted.`, tone: 'neutral' }) },
  { id: 'stepBoundary', group: 'talk', roles: STEP, age: [10, 120], label: 'Set a boundary',
    run: (n) => { trust(n, 2); bump(n, rng.chance(0.6) ? 2 : -2); return `You told ${n.firstName}, calmly, what you needed from ${him(n)}. ${cap(he(n))} took it better than you feared.`; } },
  { id: 'stepSibTime', group: 'together', roles: STEPSIB, age: [3, 120], label: 'Spend time together',
    run: (n) => { bump(n, rng.int(4, 8)); mood(2); return rng.pick([`You and ${n.firstName} stayed up talking about your parents. You agreed on more than you expected.`, `You and ${n.firstName} found a game you both like.`, `${n.firstName} showed you a song. You pretended not to like it, then played it twice.`]); } },
  { id: 'stepSibHomework', group: 'together', roles: STEPSIB, age: [7, 18], if: (n) => n.age >= 6 && n.age <= 18, label: 'Help each other with homework',
    run: (n) => { bump(n, rng.int(3, 6)); player().stats.intellect = clamp(player().stats.intellect + 1); return `You and ${n.firstName} got through the homework together, mostly.`; } },
  { id: 'stepSibTalk', group: 'conflict', roles: STEPSIB, age: [6, 120], label: 'Talk out a disagreement',
    run: (n) => { const ok = rng.chance(clamp(0.5 + (n.meters.relationship - 40) / 120, 0.2, 0.9)); bump(n, ok ? 6 : -2); return ok ? `You and ${n.firstName} talked it through. You both said sorry, at about the same time.` : { text: `You and ${n.firstName} did not settle it. Not yet.`, tone: 'neutral' }; } },
  { id: 'teamUp', group: 'together', roles: SIBLING, age: [8, 17], if: (n) => n.age < 25 && mine(PARENT).length > 0, label: 'Team up against your parents',
    run: (n) => { bump(n, rng.int(6, 10)); for (const pa of mine(PARENT)) trust(pa, -3); mood(3);
      return `You and ${n.firstName} put on a united front about the vacation. You lost, but you lost together.`; } },
  { id: 'compete', group: 'together', roles: SIBLING, age: [8, 40], label: 'Challenge them',
    run: (n) => {
      const won = rng.chance(clamp(0.5 + (player().stats.intellect - n.meters.intellect) / 200, 0.2, 0.8));
      hidden('discipline', 2); bump(n, won ? -1 : 2);
      return won ? { text: `You beat ${n.firstName} at chess, at running, and at the dishwasher argument. ${cap(he(n))} wants a rematch.`, tone: 'good' }
        : { text: `${n.firstName} won. Again. You have started training in secret.`, tone: 'neutral' };
    } },
  { id: 'drinks', group: 'together', roles: [...SIBLING, ...FRIEND], age: [18, 120], them: [18, 130], if: () => may('drink').ok, label: 'Go for a drink',
    run: (n) => { bump(n, rng.int(4, 8)); mood(4); return rng.pick([`You and ${n.firstName} closed the bar talking about everything.`, `One drink with ${n.firstName} turned into four, and into the best evening in months.`]); } },
  { id: 'helpMove', group: 'help', roles: [...SIBLING, ...FRIEND], age: [16, 80], them: [18, 80], label: 'Help them move',
    run: (n) => { bump(n, rng.int(6, 10)); n.flags.owesFavor = store.state.year; remember(n, 'helpedMove', 'Helped them move, and carried the piano.');
      return `You spent a Saturday carrying ${n.firstName}'s boxes up three flights of stairs. ${cap(he(n))} owes you one.`; } },
  { id: 'lend', group: 'help', roles: [...SIBLING, ...FRIEND], age: [18, 120], them: [18, 130], label: () => `Lend them money (${money(pay(1000))})`,
    run: (n) => { const r = lendMoney(n.id, pay(1000), 2); return r.ok ? r.text : { text: r.text, tone: 'neutral' }; } },
  { id: 'godparent', group: 'help', roles: SIBLING, age: [18, 120], if: (n) => (n.life?.kids ?? 0) > 0 && !n.flags.godparent, label: 'Offer to be godparent to their child',
    run: (n) => {
      if (!rng.chance(odds(0.55, n))) return { text: `${n.firstName} was touched, but has already asked someone else.`, tone: 'neutral' };
      n.flags.godparent = store.state.year; bump(n, 8); remember(n, 'godparent', 'Asked you to be godparent to their child.');
      const kid = godchildFor(n);
      milestone(`Became godparent to ${kid.firstName}, ${n.firstName}'s ${kid.gender === 'male' ? 'son' : kid.gender === 'female' ? 'daughter' : 'child'}.`, 'family');
      return `${n.firstName} said yes, and cried a little. You are godparent to little ${kid.firstName} now.`;
    } },
  { id: 'estate', group: 'talk', roles: SIBLING, age: [18, 120], them: [18, 130], if: () => mine(PARENT).length < 2 && player().npcIds.some((id) => npcs()[id]?.role === 'parent' && !npcs()[id].alive), label: 'Talk about your parents\' estate',
    run: (n) => (rng.chance(odds(0.5, n)) ? (bump(n, 6), remember(n, 'settledEstate', 'You settled your parents\' things between you without a fight.'), `You and ${n.firstName} went through the house together, and split things without a cross word. Mostly.`)
      : (bump(n, -10), { text: `It started with the good china and ended with neither of you speaking. Families and inheritances.`, tone: 'bad' })) },

  // ---------- Friends ----------
  { id: 'hangOut', group: 'together', roles: FRIEND, age: [3, 120],
    label: () => { const a = player().age; return a < 10 ? 'Play at the playground' : a < 16 ? (has('television') && store.state.year >= 1980 ? 'Play video games' : 'Hang out in town') : a < 25 ? 'Hang out' : 'Meet for coffee'; },
    run: (n) => { bump(n, rng.int(4, 8)); mood(3); const a = player().age;
      return a < 10 ? `You and ${n.firstName} spent the afternoon on the swings arguing about who could go higher.`
        : a < 16 ? `You and ${n.firstName} spent the afternoon doing nothing much, which was the point.`
        : `You and ${n.firstName} caught up properly for the first time in ages.`; } },
  // A sleepover: an activity picked from a dropdown (ui select dialog), and now and then a scene during the night.
  { id: 'sleepover', group: 'together', roles: FRIEND, age: [7, 14], them: [6, 16], if: () => atHome(), label: 'Have a sleepover',
    select: (n) => ({ emoji: '🌙', eyebrow: 'Friends', title: 'Sleepover', body: `${n.firstName} could stay the night. What is the plan?`, label: 'The plan', button: `Invite ${n.firstName}` }),
    options: () => SLEEPOVER.filter((a) => !a.if || a.if()).map((a) => ({ value: a.id, label: a.label })),
    run: (n, option) => {
      const a = SLEEPOVER.find((x) => x.id === option) ?? SLEEPOVER[0];
      // Most friends say yes; a friend who is not close may have other plans.
      if (!rng.chance(clamp(0.55 + n.meters.relationship / 160, 0.4, 0.97))) { bump(n, -1); return { ok: true, text: `${n.firstName} cannot come this time: ${rng.pick(['a family thing', 'too much homework', 'their parents said no', 'they have a cold'])}.`, tone: 'neutral' }; }
      bump(n, rng.int(6, 10)); mood(a.mood ?? 6);
      remember(n, 'sleepover', `Stayed over at your place: ${a.memory}`);
      if (rng.chance(0.4)) store.state.pendingEvents.push({ id: rng.pick(SLEEPOVER_SCENES), cast: { pal: n.id } });
      return a.text.replace(/\{name\}/g, n.firstName);
    } },
  { id: 'askHelp', group: 'ask', roles: FRIEND, age: [6, 120], label: 'Ask for help',
    options: (n) => {
      const p = player();
      const job = n.life?.job?.careerId && CAREER_BY_ID[n.life.job.careerId];
      return [
        ...(p.education?.enrolled ? [{ value: 'study', label: 'Help with your studies', sub: 'They explain what you missed.' }] : []),
        ...(p.age >= 18 ? [{ value: 'move', label: 'Help you move', sub: 'A van, a Saturday, and pizza after.' }] : []),
        ...(job && p.age >= 16 ? [{ value: 'reference', label: `Put in a word for you at work`, sub: `They work as ${/^[aeiou]/i.test(n.life.job.title ?? '') ? 'an' : 'a'} ${n.life.job.title ?? job.name}.` }] : []),
        { value: 'listen', label: 'Just listen', sub: 'You need to talk something through.' },
      ];
    },
    run: (n, opt) => {
      const p = player();
      const owed = n.flags.owesFavor != null;
      if (!rng.chance(odds(owed ? 0.75 : 0.5, n))) { bump(n, -2); return { text: `${n.firstName} could not, this time. ${cap(he(n))} said sorry twice.`, tone: 'neutral' }; }
      if (owed) delete n.flags.owesFavor;
      bump(n, 2);
      if (opt === 'study') { p.stats.intellect = clamp(p.stats.intellect + 2); return `${n.firstName} explained it in ten minutes, after your teacher failed for a month.`; }
      if (opt === 'move') { mood(3); return `${n.firstName} turned up with a van and two more friends. Your move took an afternoon.`; }
      if (opt === 'reference') { (p.flags.referrals ??= {})[n.life.job.careerId] = p.age; return `${n.firstName} put in a word for you where ${he(n)} works. If you apply there soon, it will count.`; }
      mood(5); return `${n.firstName} listened until you had worked it out yourself. That is what friends are for.`;
    } },
  { id: 'offerHelp', group: 'help', roles: FRIEND, age: [8, 120], label: 'Offer to help them',
    run: (n) => { bump(n, rng.int(5, 9)); hidden('karma', 2); n.flags.owesFavor = store.state.year; remember(n, 'helpedThem', 'Helped them when they needed it.');
      return `You helped ${n.firstName} with something ${he(n)} could not manage alone. ${cap(he(n))} will not forget it.`; } },
  { id: 'risky', group: 'conflict', roles: FRIEND, age: [10, 120], danger: true, label: 'Do something risky together',
    options: () => {
      const p = player();
      return [
        ...(p.education?.enrolled && p.age < 18 ? [{ value: 'skip', label: 'Skip school', sub: 'A whole day of freedom, if nobody calls home.' }] : []),
        { value: 'shoplift', label: 'Steal something small from a store', sub: 'For the thrill of it. It is a crime.' },
        ...(p.age >= 18 ? [{ value: 'roadTrip', label: 'A road trip with no plan', sub: `About ${money(pay(400))}.` }] : []),
        { value: 'dare', label: 'Take a dare', sub: 'Climb the water tower. Jump off the bridge.' },
      ];
    },
    run: (n, opt) => {
      const p = player();
      bump(n, rng.int(4, 8)); hidden('crazy', 3);
      if (opt === 'roadTrip') { const no = spend(pay(400), 'The trip'); if (no) return no; mood(8); remember(n, 'roadTrip', 'Went on a road trip with you, no plan, no regrets.'); return `You and ${n.firstName} drove until the road ran out. Best week of the year.`; }
      if (opt === 'skip') {
        if (rng.chance(0.35)) { for (const pa of mine(PARENT)) trust(pa, -8); return { text: 'The school called home. You and your parents had a long talk at the kitchen table.', tone: 'bad' }; }
        mood(6); return { text: `You and ${n.firstName} spent the day at the lake. Nobody called home.`, tone: 'neutral' };
      }
      if (opt === 'shoplift') {
        hidden('karma', -5);
        if (rng.chance(0.3)) { p.legal.heat = clamp((p.legal.heat ?? 0) + 15); for (const pa of mine(PARENT)) trust(pa, -12); return { text: 'A guard stopped you at the door. They let you go with a warning and a photo on the wall. Your parents were called.', tone: 'bad' }; }
        mood(3); return { text: `You walked out with a candy bar you did not even want. ${n.firstName} was impressed. You feel strange about it.`, tone: 'neutral' };
      }
      if (rng.chance(0.12)) { p.stats.health = clamp(p.stats.health - rng.int(8, 15)); return { text: 'You took the dare and broke your arm. The cast has thirty signatures.', tone: 'bad' }; }
      mood(6); return `You took the dare. ${n.firstName} will be telling that story at your wedding.`;
    } },
  { id: 'travel', group: 'together', roles: FRIEND, age: [18, 120], them: [18, 130], label: () => `Go traveling together (${money(pay(1500))})`,
    run: (n) => { const no = spend(pay(1500), 'The trip'); if (no) return no; bump(n, rng.int(10, 15)); mood(8); remember(n, 'traveled', 'Traveled with you, and came back still friends.');
      return `You and ${n.firstName} went away for two weeks. You came back still friends, which is the real test.`; } },
  { id: 'setUp', group: 'help', roles: FRIEND, age: [16, 120], them: [16, 130], if: (n) => !n.flags.partnerId && singles(n).length > 0, label: 'Set them up with someone',
    options: (n) => singles(n).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}`, sub: `${cap(s.role)}, ${s.age}` })),
    run: (n, opt) => {
      const other = npcs()[opt];
      if (!other) return result(false, 'They are not around.', 'neutral');
      if (rng.chance(0.4)) { n.flags.partnerId = other.id; other.flags.partnerId = n.id; bump(n, 8); bump(other, 6); remember(n, 'setUp', `You introduced them to ${other.firstName}.`);
        return `You set ${n.firstName} up with ${other.firstName}. They have been inseparable since. You will be taking credit at the wedding.`; }
      bump(n, -1); return { text: `${n.firstName} and ${other.firstName} had one painful dinner. Both of them have asked you never to do that again.`, tone: 'neutral' };
    } },
  { id: 'project', group: 'together', roles: FRIEND, age: [12, 120], label: 'Start something together',
    options: () => [
      { value: 'band', label: 'A band', sub: 'Practice in the garage, gigs at the community center.' },
      ...(has('video_share') ? [{ value: 'channel', label: 'A channel online', sub: 'Videos, the two of you, every week.' }] : [{ value: 'zine', label: 'A newsletter', sub: 'Typed, copied, handed out at school.' }]),
      ...(player().age >= 18 ? [{ value: 'business', label: 'A small business on the side', sub: 'Weekends only, at first.' }] : []),
    ],
    run: (n, opt) => {
      const p = player();
      bump(n, rng.int(5, 10)); remember(n, `project_${opt}`, `Started ${opt === 'band' ? 'a band' : opt === 'business' ? 'a business' : opt === 'channel' ? 'a channel' : 'a newsletter'} with you.`);
      p.flags.projects = [...(p.flags.projects ?? []), { kind: opt, withId: n.id, year: store.state.year }];
      const good = rng.chance(clamp(0.35 + ((p.talents?.music ?? 50) - 50) / 200 + (p.stats.charm - 50) / 300, 0.15, 0.75));
      if (opt === 'business') {
        if (good) { const made = localMoney(rng.int(300, 1500), country()); p.finance.cash += made; return `You and ${n.firstName} started selling on weekends. It made ${money(made)} this year, and a lot of arguments about spreadsheets.`; }
        return { text: `You and ${n.firstName} tried a business on the side. It cost more time than it made, but you learned a lot.`, tone: 'neutral' };
      }
      if (good) { mood(7); return opt === 'band' ? `You and ${n.firstName} started a band. Your first gig had forty people, and twelve of them were not related to you.` : `You and ${n.firstName} started it. People actually read it. Watch it. Talk about it.`; }
      mood(3); return { text: `You and ${n.firstName} gave it a real try. It did not take off, but it was the most fun you had all year.`, tone: 'neutral' };
    } },
  { id: 'introduceFriends', group: 'together', roles: FRIEND, age: [8, 120], if: (n) => mine(FRIEND).some((f) => f.id !== n.id && (!n.flags.circle || f.flags.circle !== n.flags.circle)), label: 'Introduce them to your other friends',
    run: (n) => {
      const p = player();
      const circle = n.flags.circle ?? `circle_${n.id}`;
      const others = mine(FRIEND).filter((f) => f.id !== n.id && f.flags.circle !== circle).slice(0, 3);
      n.flags.circle = circle;
      if (rng.chance(0.75)) { for (const f of others) { f.flags.circle = circle; bump(f, 2); } bump(n, 3); mood(4); (p.flags.circles ??= {})[circle] = store.state.year;
        return `${n.firstName} met ${others.map((f) => f.firstName).join(' and ')}. By the end of the night it was a group, and the group has a chat.`; }
      return { text: `${n.firstName} and ${others[0]?.firstName ?? 'the others'} did not click. You will keep them apart.`, tone: 'neutral' };
    } },
  { id: 'message', group: 'talk', roles: [...FRIEND, ...SIBLING, ...PARENT, ...PARTNER, ...CHILD, ...GRAND], age: [10, 120], them: [8, 130], if: () => has('mobile'), label: 'Send them a message',
    run: (n) => { bump(n, rng.int(1, 4)); return rng.pick([`You sent ${n.firstName} a message out of nowhere. ${cap(he(n))} wrote back within a minute.`, `You sent ${n.firstName} a photo that reminded you of ${him(n)}. ${cap(he(n))} sent back six laughing faces.`]); } },
  { id: 'videoCall', group: 'together', roles: [...FRIEND, ...SIBLING, ...PARENT, ...PARTNER, ...CHILD, ...GRAND], age: [6, 120], them: [4, 130], if: (n) => has('video_call') && (!!n.flags.abroad || !atHome()), label: 'Video call them',
    run: (n) => { bump(n, rng.int(3, 7)); mood(2); return `You and ${n.firstName} talked on video for an hour. ${n.age >= 70 ? `${cap(he(n))} held the phone too close the whole time.` : 'It is not the same as being there, but it is close.'}`; } },
  { id: 'drift', group: 'conflict', roles: FRIEND, age: [8, 120], danger: true, label: 'Let the friendship fade',
    run: (n) => {
      const p = player();
      n.flags.drifted = { year: store.state.year, by: 'you' };
      p.npcIds = p.npcIds.filter((id) => id !== n.id);
      return { text: `You stopped answering ${n.firstName}'s messages, and after a while they stopped coming. No fight, no ending. Just distance.`, tone: 'neutral' };
    } },

  // ---------- Partners ----------
  { id: 'cuddle', group: 'together', roles: PARTNER, age: [14, 120], label: 'Cuddle up',
    run: (n) => { bump(n, rng.int(3, 7)); mood(4); return `You and ${n.firstName} stayed on the couch all evening. Neither of you moved when the show ended.`; } },
  { id: 'iLoveYou', group: 'talk', roles: PARTNER, age: [14, 120], if: (n) => !hasMemory(n, 'saidLove'), label: 'Say "I love you"',
    run: (n) => {
      if (rng.chance(clamp((n.meters.relationship - 30) / 60, 0.1, 0.95))) { bump(n, 10); trust(n, 5); remember(n, 'saidLove', 'Said "I love you" back.'); milestone(`Said "I love you" to ${n.firstName}.`, 'love'); return `You said it. ${n.firstName} said it back before you had finished.`; }
      bump(n, -3); mood(-6); remember(n, 'saidLove', 'You said "I love you" first. They were not ready.'); return { text: `You said it. ${n.firstName} said "thank you." You will both be thinking about that for a while.`, tone: 'bad' };
    } },
  { id: 'cook', group: 'together', roles: PARTNER, age: [16, 120], label: 'Cook dinner together',
    run: (n) => { bump(n, rng.int(3, 7)); skill('cooking', 2); mood(3); return rng.pick([`You and ${n.firstName} made dinner together. Nobody followed the recipe, and it was delicious.`, `You cooked with ${n.firstName}. There was flour on the ceiling. You are not sure how.`]); } },
  { id: 'nightIn', group: 'together', roles: PARTNER, age: [14, 120],
    label: () => (has('television') ? 'Movie night at home' : has('radio') ? 'An evening by the radio' : 'Read together by the fire'),
    run: (n) => { bump(n, rng.int(3, 6)); mood(3); return has('television') ? `You and ${n.firstName} argued about what to watch for longer than the movie lasted.` : has('radio') ? `You and ${n.firstName} listened to the evening play, and guessed the ending wrong.` : `You and ${n.firstName} read by the fire, reading the good parts aloud.`; } },
  { id: 'meetFamily', group: 'together', roles: ['partner'], age: [14, 120], if: (n) => !n.flags.metTheirFamily, label: 'Meet their family',
    run: (n) => {
      n.flags.metTheirFamily = store.state.year;
      if (rng.chance(odds(0.55, n))) { bump(n, 8); remember(n, 'metTheirFamily', 'You met their family, and their family liked you.'); return `${n.firstName}'s family liked you. ${cap(his(n))} mother asked when you are coming back.`; }
      bump(n, -2); return { text: `Dinner with ${n.firstName}'s family was stiff. Someone asked what you earn. It will take time.`, tone: 'neutral' };
    } },
  { id: 'bringHome', group: 'together', roles: PARTNER, age: [14, 120], if: (n) => mine(PARENT).some((pa) => !n.flags.metParents?.includes(pa.id)), label: 'Bring them home to your parents',
    run: (n) => introduceToParent(mine(PARENT).find((pa) => !n.flags.metParents?.includes(pa.id)), n) },
  { id: 'moveInTogether', group: 'together', roles: ['partner'], age: [18, 120], them: [18, 130], if: (n) => !n.flags.livingTogether, label: 'Move in together',
    run: (n) => {
      if (!rng.chance(clamp((n.meters.relationship - 35) / 50, 0.1, 0.95))) { bump(n, -3); return { text: `${n.firstName} said ${he(n)} is not ready yet. It stung.`, tone: 'neutral' }; }
      n.flags.livingTogether = store.state.year; player().flags.livesWithParents = false; bump(n, 8); remember(n, 'movedInTogether', 'Moved in with you.'); milestone(`Moved in with ${n.firstName}.`, 'love');
      return `You and ${n.firstName} moved in together. Two of everything, and one of you will have to give up the ugly lamp.`;
    } },
  { id: 'future', group: 'talk', roles: PARTNER, age: [18, 120], label: 'Talk about the future',
    options: () => [
      { value: 'kids', label: 'Whether to have children' },
      { value: 'where', label: 'Where to live' },
      { value: 'marriage', label: 'Marriage' },
    ],
    run: (n, opt) => {
      n.flags.views ??= {};
      n.flags.views[opt] ??= rng.pick(opt === 'kids' ? ['yes', 'yes', 'no', 'later'] : opt === 'where' ? ['here', 'here', 'away', 'the country'] : ['yes', 'yes', 'someday', 'no']);
      const view = n.flags.views[opt];
      const agree = rng.chance(0.6);
      bump(n, agree ? 5 : -3);
      if (!agree) n.flags.friction = (n.flags.friction ?? 0) + 1;
      const words = { kids: { yes: 'wants children, soon', no: 'does not want children', later: 'wants children, but not yet' },
        where: { here: 'wants to stay where you are', away: 'dreams of moving abroad', 'the country': 'wants a house in the country' },
        marriage: { yes: 'wants to get married', someday: 'wants to marry, someday', no: 'does not believe in marriage' } }[opt][view];
      return agree ? `${n.firstName} ${words}. So do you, more or less. It felt like a plan.` : { text: `${n.firstName} ${words}. You are not sure you do. It will come up again.`, tone: 'neutral' };
    } },
  { id: 'surprise', group: 'together', roles: PARTNER, age: [14, 120], label: () => `Plan a surprise (${money(pay(150))})`,
    run: (n) => { const no = spend(pay(150), 'The surprise'); if (no) return no; bump(n, rng.int(6, 11)); mood(4);
      return rng.pick([`You planned a surprise picnic for ${n.firstName}. ${cap(he(n))} cried, then ate most of the cake.`, `You booked the restaurant from your first date. ${n.firstName} remembered the table.`]); } },
  { id: 'checkPhone', group: 'conflict', roles: PARTNER, age: [16, 120], danger: true, if: () => has('mobile'), label: 'Look through their phone',
    run: (n) => {
      hidden('karma', -2);
      const found = n.flags.affair && rng.chance(0.6);
      if (rng.chance(0.35)) { trust(n, -15); bump(n, -10); return { text: `${n.firstName} caught you with ${his(n)} phone. "If you do not trust me, what are we doing?"`, tone: 'bad' }; }
      if (found) { bump(n, -15); affairOut(n, 'with_affair_found'); return { text: `You found messages you cannot unsee. ${n.firstName} has been seeing someone.`, tone: 'bad' }; }
      return { text: `You found nothing, except that ${n.firstName} calls you something very silly in ${his(n)} contacts. You feel terrible.`, tone: 'neutral' };
    } },
  { id: 'confess', group: 'talk', roles: PARTNER, age: [16, 120], label: 'Confess something',
    run: (n) => (rng.chance(odds(0.55, n)) ? (trust(n, 8), bump(n, 4), `You told ${n.firstName} the thing you had been carrying. ${cap(he(n))} was quiet, then held your hand. It is lighter now.`)
      : (trust(n, -8), bump(n, -6), { text: `You told ${n.firstName}. ${cap(he(n))} needed a walk, alone. It will take time.`, tone: 'bad' })) },
  { id: 'askFaithful', group: 'talk', roles: PARTNER, age: [16, 120], label: 'Ask if they are being faithful',
    run: (n) => {
      if (n.flags.affair && rng.chance(0.5)) { bump(n, -12); trust(n, -5); affairOut(n, 'with_affair_found'); return { text: `${n.firstName} could not look at you. Then ${he(n)} told you everything.`, tone: 'bad' }; }
      trust(n, -4); bump(n, -3); return { text: `${n.firstName} looked hurt that you had to ask. "Of course I am."`, tone: 'neutral' };
    } },
  { id: 'counseling', group: 'help', roles: PARTNER, age: [18, 120], if: (n) => n.meters.relationship < 55 || (n.flags.friction ?? 0) >= 2, label: () => `Go to couples counseling (${money(pay(1200))})`,
    run: (n) => {
      const no = spend(pay(1200), 'A year of counseling'); if (no) return no;
      if (rng.chance(0.7)) { bump(n, rng.int(10, 18)); trust(n, 10); n.flags.friction = 0; remember(n, 'counseling', 'Went to counseling with you, and it helped.'); return `Counseling with ${n.firstName} was hard, then helpful. You argue better now, which is not nothing.`; }
      bump(n, 2); return { text: `You and ${n.firstName} sat through a year of counseling. Some of it helped. Some of it showed you how far apart you are.`, tone: 'neutral' };
    } },
  { id: 'renewVows', group: 'together', roles: ['spouse'], age: [28, 120], if: (n) => n.marriedAtAge != null && player().age - n.marriedAtAge >= 10 && !hasMemory(n, 'renewedVows'), label: () => `Renew your vows (${money(pay(2500))})`,
    run: (n) => { const no = spend(pay(2500), 'The ceremony'); if (no) return no; bump(n, 12); trust(n, 5); mood(10); remember(n, 'renewedVows', 'Renewed your vows, years on.'); milestone(`Renewed vows with ${n.firstName}.`, 'love');
      return `You and ${n.firstName} said it all again, ${player().age - n.marriedAtAge} years on. You meant it more this time.`; } },
  { id: 'takeBreak', group: 'conflict', roles: ['partner'], age: [16, 120], danger: true, label: 'Ask to take a break',
    run: (n) => { bump(n, -15); n.flags.onBreak = store.state.year; mood(-4);
      return { text: `You and ${n.firstName} are on a break. Nobody is sure what that means, least of all the two of you.`, tone: 'bad' }; } },

  // ---------- Your children ----------
  { id: 'readTo', group: 'together', roles: CHILD, age: [14, 120], them: [0, 8], label: 'Read to them',
    run: (n) => { bump(n, rng.int(4, 7)); n.meters.intellect = clamp(n.meters.intellect + 1); remember(n, 'readTo', 'You read to them every night when they were small.');
      return `You read to ${n.firstName} until ${he(n)} fell asleep on your arm. You stayed put.`; } },
  { id: 'teachKid', group: 'together', roles: CHILD, age: [16, 120], them: [3, 12], label: 'Teach them something',
    options: (n) => [
      ...(n.age >= 4 && !hasMemory(n, 'taughtBike') ? [{ value: 'bike', label: 'To ride a bike' }] : []),
      ...(!hasMemory(n, 'taughtSwim') ? [{ value: 'swim', label: 'To swim' }] : []),
      { value: 'read', label: 'To read better' },
    ],
    run: (n, opt) => {
      bump(n, rng.int(5, 9));
      if (opt === 'bike') { remember(n, 'taughtBike', 'You taught them to ride a bike, running behind and letting go.'); return `You ran behind ${n.firstName} holding the seat, then let go. ${cap(he(n))} did not notice for ten whole yards.`; }
      if (opt === 'swim') { n.meters.health = clamp(n.meters.health + 2); remember(n, 'taughtSwim', 'You taught them to swim.'); return `${n.firstName} swam a width of the pool without the float. You cheered loud enough to embarrass everyone.`; }
      n.meters.intellect = clamp(n.meters.intellect + 2); return `You and ${n.firstName} read together every evening. ${cap(he(n))} reads to you now.`;
    } },
  { id: 'specialDay', group: 'together', roles: CHILD, age: [16, 120], them: [2, 17], label: () => `Take them somewhere special (${money(pay(250))})`,
    run: (n) => { const no = spend(pay(250), 'A day out'); if (no) return no; bump(n, rng.int(6, 11)); mood(5); remember(n, 'specialDay', 'You took them somewhere they will never forget.');
      return rng.pick([`You took ${n.firstName} to the zoo. ${cap(he(n))} only wanted to see the penguins, four times.`, `You took ${n.firstName} to the beach. ${cap(he(n))} fell asleep in the car home with sand in ${his(n)} hair.`]); } },
  { id: 'rules', group: 'talk', roles: CHILD, age: [20, 120], them: [8, 17], label: 'Set the house rules',
    options: () => [{ value: 'strict', label: 'Strict', sub: 'A curfew, screen limits, chores.' }, { value: 'fair', label: 'Fair', sub: 'A few rules that matter, explained.' }, { value: 'loose', label: 'Easygoing', sub: 'They know what is right.' }],
    run: (n, opt) => { n.flags.houseRules = opt; bump(n, opt === 'strict' ? -4 : opt === 'loose' ? 4 : 2); n.meters.crazy = clamp(n.meters.crazy + (opt === 'loose' ? 4 : opt === 'strict' ? -3 : -1));
      return opt === 'strict' ? { text: `${n.firstName} called the new rules "a prison." ${cap(he(n))} is home by nine, though.`, tone: 'neutral' } : opt === 'loose' ? `${n.firstName} likes the new rules. That may be the problem.` : `You and ${n.firstName} agreed on a few rules. ${cap(he(n))} even keeps most of them.`; } },
  { id: 'ground', group: 'conflict', roles: CHILD, age: [20, 120], them: [7, 17], danger: true, label: 'Ground them',
    run: (n) => { bump(n, -rng.int(4, 8)); n.meters.crazy = clamp(n.meters.crazy - 3); n.flags.groundedYear = store.state.year;
      return { text: `${n.firstName} is grounded for two weeks. The door has been slammed at least six times.`, tone: 'neutral' }; } },
  { id: 'theTalk', group: 'talk', roles: CHILD, age: [24, 120], them: [10, 15], if: (n) => !hasMemory(n, 'theTalk'), label: 'Have "the talk"',
    run: (n) => { bump(n, 2); remember(n, 'theTalk', 'You gave them "the talk." Neither of you has recovered.');
      return `You sat ${n.firstName} down for "the talk." ${cap(he(n))} already knew most of it, and told you so, loudly.`; } },
  { id: 'firstCar', group: 'help', roles: CHILD, age: [34, 120], them: [17, 40], if: (n) => !hasMemory(n, 'helpedStart'), label: () => `Help them buy a first car or home (${money(pay(6000))})`,
    run: (n) => { const no = spend(pay(6000), 'That help'); if (no) return no; giveTo(n, pay(6000)); bump(n, rng.int(8, 14)); remember(n, 'helpedStart', 'Helped them buy their first car or home.');
      return `You helped ${n.firstName} with the deposit. ${cap(he(n))} tried to refuse, then hugged you for a long time.`; } },
  { id: 'babysit', group: 'help', roles: CHILD, age: [36, 120], them: [18, 80], if: () => mine(['grandchild']).some((g) => g.age < 12), label: 'Babysit your grandchildren',
    run: (n) => { bump(n, rng.int(5, 9)); for (const g of mine(['grandchild']).filter((g) => g.age < 12)) bump(g, rng.int(4, 8)); mood(4);
      return `You had the grandchildren for the weekend, so ${n.firstName} could rest. They ate sugar for breakfast. Do not tell ${n.firstName}.`; } },

  // ---------- A godchild ----------
  { id: 'godchildGift', group: 'help', roles: ['niece'], age: [18, 120], them: [0, 17], if: (n) => !!n.flags.godchild, label: () => `A birthday present for your godchild (${money(pay(60))})`,
    run: (n) => { const no = spend(pay(60), 'The present'); if (no) return no; bump(n, rng.int(5, 9)); const pa = npcs()[n.flags.parentId]; if (pa?.alive) bump(pa, 2);
      return rng.pick([`You sent ${n.firstName} a present ${he(n)} has not put down since.`, `${n.firstName} opened your present, and the thank-you drawing is on your fridge.`]); } },
  { id: 'godchildDay', group: 'together', roles: ['niece'], age: [18, 120], them: [3, 17], if: (n) => !!n.flags.godchild, label: 'Take your godchild out for the day',
    run: (n) => { bump(n, rng.int(6, 10)); mood(4); remember(n, 'godparentDay', 'Their godparent took them out, just the two of them.');
      return `You took ${n.firstName} out for the day: the park, ice cream, and a long list of questions about everything.`; } },
  { id: 'godchildAdvice', group: 'talk', roles: ['niece'], age: [25, 120], them: [13, 40], if: (n) => !!n.flags.godchild, label: 'Be someone they can talk to',
    run: (n) => { bump(n, rng.int(5, 9)); remember(n, 'godparentTalk', 'Could tell their godparent things they could not tell their parents.');
      return `${n.firstName} told you things ${he(n)} cannot tell ${his(n)} parents. You listened, and kept them.`; } },

  // ---------- Grandparents ----------
  { id: 'visitGrand', group: 'together', roles: GRAND, age: [3, 120], label: 'Visit them',
    run: (n) => { bump(n, rng.int(5, 9)); mood(3); return rng.pick([`You visited ${n.firstName}. There were cookies, and a story about the old neighbors.`, `${n.firstName} was so pleased to see you that ${he(n)} forgot what ${he(n)} was about to say, twice.`]); } },
  { id: 'oldDays', group: 'talk', roles: GRAND, age: [6, 120], label: 'Ask about the old days',
    run: (n) => {
      const born = store.state.year - n.age;
      const youth = born + 15;
      const era = getEra(youth);
      const war = atWar(n.bornIn ?? player().countryId, youth) || atWar(n.bornIn ?? player().countryId, youth + 5);
      bump(n, rng.int(5, 9)); remember(n, 'oldDays', 'Told you what life was like when they were young.');
      const then = youth < 1920 ? 'no cars on the street, and a doctor who came on a horse'
        : youth < 1950 ? 'the radio in the evening, and money so tight that an orange was a treat'
        : youth < 1975 ? 'the first television on the street, and the whole road crowded around it'
        : youth < 2000 ? 'the first computer at school, and phones with cords'
        : 'when phones did not do anything clever yet';
      return `${n.firstName} told you about growing up in ${era.name.toLowerCase().replace(/^the /, 'the ')}: ${then}${war ? ', and the war, which ' + he(n) + ' does not talk about much' : ''}.`;
    } },
  { id: 'techHelp', group: 'help', roles: GRAND, age: [8, 120], them: [55, 130], if: () => newestTech() != null, label: () => `Help them with ${newestTech()?.toLowerCase() ?? 'technology'}`,
    run: (n) => { bump(n, rng.int(5, 9)); n.flags.techHelped = store.state.year;
      return `You spent an afternoon showing ${n.firstName} ${newestTech()?.toLowerCase() ?? 'how it works'}. ${cap(he(n))} wrote every step down on a card, and will call you tomorrow anyway.`; } },
  { id: 'recipe', group: 'talk', roles: GRAND, age: [8, 120], if: () => !player().flags.familyRecipe, label: 'Learn their recipe',
    run: (n) => {
      const dish = rng.pick(['apple cake', 'Sunday stew', 'soup for when you are sick', 'holiday bread', 'meatballs', 'dumplings', 'rice pudding']);
      player().flags.familyRecipe = { dish, from: n.id, name: n.firstName, year: store.state.year }; skill('cooking', 4);
      bump(n, rng.int(6, 10)); remember(n, 'recipe', `Taught you the family ${dish}.`);
      return `${n.firstName} taught you the family ${dish}. Nothing is measured: "until it looks right." It is yours to pass on now.`;
    } },
  { id: 'lookAfter', group: 'help', roles: [...GRAND, ...PARENT], age: [12, 120], them: [60, 130], if: (n) => n.meters.health < 55, label: 'Look after them while they are unwell',
    run: (n) => { bump(n, rng.int(8, 14)); n.meters.health = clamp(n.meters.health + rng.int(2, 5)); mood(-2); hidden('karma', 3); remember(n, 'lookedAfter', 'You looked after them when they were ill.');
      return `You looked after ${n.firstName} for weeks: soup, pills, the crossword. ${cap(he(n))} is a little better, and very grateful.`; } },
];

const BY_ID = Object.fromEntries(BONDS.map((b) => [b.id, b]));

/** Single people the player knows, who could be set up with this friend. */
function singles(n) {
  const taken = new Set(Object.values(npcs()).filter((x) => x.flags?.partnerId).map((x) => x.id));
  return mine(['friend', 'classmate', 'coworker', 'colleague']).filter((x) => x.id !== n.id && !taken.has(x.id) && Math.abs(x.age - n.age) <= 10 && x.age >= 16 && !x.life?.married).slice(0, 6);
}

/** The newest kind of technology an older person might need a hand with. */
function newestTech() {
  const order = [['smartphone', 'The smartphone'], ['video_call', 'Video calls'], ['social', 'Social media'], ['web', 'The internet'], ['pc', 'The computer'], ['television', 'The television'], ['landline', 'The telephone']];
  return order.find(([id]) => has(id))?.[1] ?? null;
}

/** A partner meets one of the player's parents. Both sides remember it. */
function introduceToParent(parent, partner) {
  if (!parent || !partner) return result(false, 'There is nobody to introduce.', 'neutral');
  partner.flags.metParents = [...(partner.flags.metParents ?? []), parent.id];
  const approve = rng.chance(clamp(0.45 + (partner.meters.charm - 50) / 150 + (parent.meters.relationship - 50) / 200, 0.1, 0.9));
  if (approve) {
    bump(parent, 3); bump(partner, 4); partner.flags.parentsApprove = true;
    remember(partner, `met_${parent.id}`, `Met your ${parent.gender === 'male' ? 'father' : parent.gender === 'female' ? 'mother' : 'parent'}, who liked them.`);
    return result(true, `${parent.firstName} liked ${partner.firstName} at once. By dessert they were telling stories about you.`);
  }
  bump(parent, -2); bump(partner, -3); partner.flags.parentsApprove = false;
  return result(true, `${parent.firstName} was polite to ${partner.firstName}, in the way that is worse than rude. You will hear about it.`, 'neutral');
}

/** Whether an action can be offered for this person now. */
function fits(b, n) {
  const p = player();
  if (!n?.alive || !b.roles.includes(n.role)) return false;
  if (b.age && (p.age < b.age[0] || p.age > b.age[1])) return false;
  if (b.them && (n.age < b.them[0] || n.age > b.them[1])) return false;
  if (p.legal?.incarceration && b.group !== 'talk') return false;
  if (b.if && !b.if(n, p)) return false;
  if (b.options && !b.options(n, p).length) return false;
  return true;
}

/**
 * The actions this person's role and age open up now.
 * @returns {{id:string, label:string, group:string, danger?:boolean, done?:boolean}[]}
 */
export function bondActions(n) {
  return BONDS.filter((b) => fits(b, n)).map((b) => ({ id: `with:${b.id}`, label: typeof b.label === 'function' ? b.label(n) : b.label, group: b.group,
    danger: !!b.danger, done: n.flags.acts?.[`with:${b.id}`] === player().age }));
}

/** How the choice is asked, when an action asks it with a dropdown dialog: {emoji, eyebrow, title, body, label, button}. */
export function bondSelect(npcId, id) {
  const b = BY_ID[id.replace(/^with:/, '')];
  const n = npcs()[npcId];
  return b?.select && n ? b.select(n) : null;
}

/** The choices an action asks for first, if any. */
export function bondOptions(npcId, id) {
  const b = BY_ID[id.replace(/^with:/, '')];
  const n = npcs()[npcId];
  return b?.options && n ? b.options(n, player()) : null;
}

/**
 * Does one. Once a year with each person.
 * @returns {{ok:boolean, text:string, tone:string}}
 */
export function doBond(npcId, id, option) {
  const b = BY_ID[id.replace(/^with:/, '')];
  const n = npcs()[npcId];
  if (!b || !n) return result(false, 'That is not something you can do.', 'neutral');
  if (!fits(b, n)) return result(false, `That is not something you can do with ${n.firstName} now.`, 'neutral');
  if (b.options && !b.options(n, player()).some((o) => o.value === option && !o.disabled)) return result(false, 'Choose one of the options.', 'neutral');
  if (!spendAction(n, `with:${b.id}`)) return result(false, `You already did that with ${n.firstName} this year.`, 'neutral');
  const out = b.run(n, option);
  const r = typeof out === 'string' ? result(true, out) : out.ok === false ? out : result(true, out.text, out.tone ?? 'good');
  if (r.ok === false && n.flags.acts) delete n.flags.acts[`with:${b.id}`]; // nothing happened: it can be tried again
  if (r.ok) log(r.text, 'system', r.tone);
  return r;
}

/** Where each of the older actions belongs, so the profile can show them in the same groups. */
export const GROUP_OF = {
  spendTime: 'together', treat: 'together', talk: 'talk', compliment: 'talk', gift: 'help', askMoney: 'ask', makePeace: 'talk',
  argue: 'conflict', insult: 'conflict', askOut: 'love', date: 'love', hookUp: 'love', propose: 'love', wedding: 'love', breakUp: 'conflict',
  divorce: 'conflict', baby: 'love', encourage: 'help', homework: 'help', schoolEvent: 'together', kidTutor: 'help', kidSchool: 'help', uniPlans: 'talk',
  talkIdentity: 'talk', visitInside: 'together',
  // Relationships and their terms (engine/bonds.js): what you do together, what is agreed between you, what you give.
  bondTime: 'love', bondIntimate: 'love', bondOfficial: 'terms', bondExclusive: 'terms', bondOpen: 'terms', bondConfess: 'terms', bondControl: 'terms',
  askSecret: 'terms', askCasual: 'terms', askFwb: 'terms', askOneNight: 'terms', bondEnd: 'conflict',
  bondGift: 'gifts', bondTrip: 'gifts', bondTransfer: 'gifts', bondHouse: 'gifts', bondUnhouse: 'gifts',
  writeInside: 'talk', encourageCare: 'help', goWithCare: 'help', askCare: 'ask', helpCare: 'help', visitCare: 'together',
};
export const GROUPS = [['together', 'Together'], ['talk', 'Talk'], ['love', 'Romance'], ['terms', 'Between you'], ['gifts', 'Gifts and trips'], ['ask', 'Ask'], ['help', 'Help'], ['conflict', 'Hard moments'], ['more', 'More']];

// ---------- A godchild ----------

/** The sibling's child the player is godparent to: one of their children, now someone in the player's life. */
function godchildFor(sib) {
  const p = player();
  const n = makeNpc({ role: 'niece', countryId: sib.bornIn ?? p.countryId, age: rng.int(0, Math.max(0, Math.min(6, sib.age - 18))), relationship: 70, lastName: sib.lastName });
  n.flags.parentId = sib.id;
  n.flags.godchild = store.state.year;
  n.flags.title = n.gender === 'male' ? 'Godson' : n.gender === 'female' ? 'Goddaughter' : 'Godchild';
  store.state.npcs[n.id] = n; p.npcIds.push(n.id);
  remember(n, 'godchild', 'You are their godparent.');
  return n;
}

// ---------- The year, between the player's own actions ----------

// An affair that has come out is a consequence and always plays; friendship stories are paced (engine/storyDirector.js).
const queue = (id, cast) => { const st = store.state; if (!st.pendingEvents.some((x) => x.id === id)) storyBeat(id, cast, { source: 'friends', must: id.startsWith('with_affair') }); };

/** An affair that has come out: the player decides what happens (with_affair_*). */
function affairOut(n, scene) {
  if (!n.flags.affair || n.flags.affair.out) return;
  n.flags.affair.out = store.state.year;
  trust(n, -25);
  queue(scene, { partner: n.id, words: { time: years(store.state.year - n.flags.affair.since) } });
}
const years = (k) => (k <= 0 ? 'a few months' : k === 1 ? 'about a year' : `${k} years`);

/**
 * Once a year: partners who stray (and sometimes confess, or are found out), and the
 * groups of friends the player has brought together, who have lives as a group.
 */
export function tickTogether() {
  const st = store.state;
  const p = player();
  if (!p?.alive) return;
  const y = st.year;
  // Partners. An open relationship has no affairs, only arrangements.
  for (const n of mine(PARTNER)) {
    if (n.flags.open || relationships().some((x) => x.npcId === n.id && x.type === 'primary' && x.status === 'active' && x.open)) continue;
    const a = n.flags.affair;
    if (!a) {
      const risk = clamp(0.006 + (55 - n.meters.relationship) / 900 + (n.flags.friction ?? 0) * 0.006 + (n.meters.crazy - 50) / 2500 + (60 - trustOf(n)) / 3000, 0.002, 0.06);
      if (n.age >= 18 && rng.chance(risk)) n.flags.affair = { since: y };
      continue;
    }
    if (a.out) continue;
    bump(n, -rng.int(1, 4));
    // It comes out (someone sees them), they confess, or it ends quietly and is never known.
    if (rng.chance(0.18)) affairOut(n, 'with_affair_found');
    else if (rng.chance(clamp(0.05 + (n.meters.relationship - 40) / 300 + (n.meters.generosity - 50) / 400, 0.02, 0.2))) affairOut(n, 'with_affair_confession');
    else if (rng.chance(0.2)) { delete n.flags.affair; n.flags.hadAffair = y; }
  }
  // Friend groups.
  for (const circle of Object.keys(p.flags.circles ?? {})) {
    const members = mine(FRIEND).filter((f) => f.flags.circle === circle);
    if (members.length < 2) { if (!members.length) delete p.flags.circles[circle]; continue; }
    if (!rng.chance(0.4)) continue;
    const a = rng.pick(members);
    const b2 = rng.pick(members.filter((m) => m.id !== a.id));
    const kinds = ['with_circle_night', 'with_circle_night', ...(p.age >= 10 ? ['with_circle_rift'] : []), ...(p.age >= 16 ? ['with_circle_trip', 'with_circle_news'] : [])];
    const id = rng.pick(kinds);
    const words = { group: members.map((m) => m.firstName).join(', '), cost: money(pay(350)), news: rng.pick(a.age >= 22 ? ['an engagement', 'a baby on the way', 'a new job abroad', 'a house of their own'] : ['a place at the college they wanted', 'their first real job', 'a part in the school play']) };
    queue(id, { a: a.id, b: b2.id, words });
    break; // one group scene a year is plenty
  }
}

/** A missed wedding anniversary, from the year that just ended (engine/moments.js): a scene, sometimes. */
export function missedAnniversary(spouse, yrs, round) {
  if (!spouse?.alive || (!round && !rng.chance(0.4))) return;
  const ord = (k) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[k % 10] ?? 'th')}`;
  queue('with_forgot_anniversary', { spouse: spouse.id, words: { years: ord(yrs) } });
}

/** What the player chose in one of the scenes above. */
export function togetherChoice(value, cast = {}) {
  const [what, how] = value.split(':');
  const p = player();
  if (what === 'affair') {
    const n = npcs()[cast.partner];
    if (!n?.alive) return null;
    n.flags.hadAffair = n.flags.affair?.since ?? store.state.year;
    delete n.flags.affair;
    if (how === 'forgive') { trust(n, 5); bump(n, 6); hidden('karma', 3); remember(n, 'forgivenAffair', 'You forgave them for an affair.'); return null; }
    if (how === 'counsel') {
      const cost = pay(1200);
      if (p.finance.cash >= cost) { p.finance.cash -= cost; trust(n, 15); bump(n, 10); n.flags.friction = 0; remember(n, 'counseling', 'Went to counseling with you, after the affair.'); return `A year of counseling, ${money(cost)}. It is not the same as before. Some days it is better.`; }
      trust(n, 5); return 'You could not afford a counselor, so you talked at the kitchen table instead. Some of it helped.';
    }
    if (how === 'space') { bump(n, -6); n.flags.onBreak = store.state.year; return null; }
    const r = n.role === 'spouse' ? divorce(n.id) : breakUp(n.id);
    return r?.text ?? null;
  }
  if (what === 'circle') {
    const a = npcs()[cast.a]; const b2 = npcs()[cast.b];
    const all = a?.flags.circle ? mine(FRIEND).filter((f) => f.flags.circle === a.flags.circle) : [a, b2].filter(Boolean);
    if (how === 'host') { const cost = pay(120); if (p.finance.cash >= cost) p.finance.cash -= cost; for (const f of all) bump(f, rng.int(4, 8)); mood(6); return null; }
    if (how === 'go') { for (const f of all) bump(f, rng.int(2, 6)); mood(5); return null; }
    if (how === 'skip') { for (const f of all) bump(f, -1); return null; }
    if (how === 'sideA' || how === 'sideB') {
      const [win, lose] = how === 'sideA' ? [a, b2] : [b2, a];
      if (win) bump(win, 8); if (lose) { bump(lose, -12); if (lose.meters.relationship < 25) { delete lose.flags.circle; return `${lose.firstName} has left the group.`; } }
      return null;
    }
    if (how === 'mediate') {
      if (rng.chance(odds(0.45, a ?? b2))) { for (const f of all) bump(f, 4); if (a) remember(a, 'mediated', 'You got the group back together after a falling out.'); return 'By the end of the evening they were laughing about it. The group is whole again.'; }
      if (a) bump(a, -3); if (b2) bump(b2, -3); return 'It went badly. Now they are both a little annoyed with you, too.';
    }
    if (how === 'neutral') { if (a) bump(a, -2); if (b2) bump(b2, -2); return null; }
    if (how === 'trip') { const cost = pay(350); if (p.finance.cash < cost) { for (const f of all) bump(f, -1); return 'In the end you could not afford it, and stayed home.'; } p.finance.cash -= cost; for (const f of all) bump(f, rng.int(6, 10)); mood(8); if (a) remember(a, 'groupTrip', 'Went away with you and the whole group.'); return null; }
    if (how === 'noTrip') { for (const f of all) bump(f, -1); return null; }
    if (how === 'celebrate') { const cost = pay(150); if (p.finance.cash >= cost) p.finance.cash -= cost; if (a) bump(a, 10); for (const f of all) bump(f, 2); return null; }
    if (how === 'card') { if (a) bump(a, 2); return null; }
    return null;
  }
  if (what === 'anniv') {
    const n = npcs()[cast.spouse];
    if (!n?.alive) return null;
    if (how === 'gift') { const cost = pay(300); if (p.finance.cash >= cost) { p.finance.cash -= cost; bump(n, 6); return `The present cost ${money(cost)}. ${n.firstName} smiled, at last.`; } bump(n, -2); return 'You could not afford much. The thought counted, a little.'; }
    if (how === 'trip') { const cost = pay(700); if (p.finance.cash >= cost) { p.finance.cash -= cost; bump(n, 9); remember(n, 'makeupTrip', 'Took them away to make up for a forgotten anniversary.'); return `A weekend away, ${money(cost)}. All was forgiven by Saturday night.`; } bump(n, -3); return 'You could not afford the weekend after all, which made it worse.'; }
    if (how === 'sorry') { bump(n, -2); return null; }
    bump(n, -8); trust(n, -4); return null;
  }
  return null;
}
