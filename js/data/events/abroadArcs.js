// Scenes sent by the arcs engine (engine/abroadArcs.js): a job abroad, a marriage
// across a border, going home, retiring elsewhere. Each begins from the real
// state of the life, names real people and places, and each choice goes back
// to the engine, which makes an application or a plan, never a promise.
import { any, need } from './helpers.js';

const arc = (value) => ({ type: 'global', value });
const scene = (id, ageRange, text, choices) => ({ id, category: 'life abroad', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, value, requires]) => ({ label, ...(requires ? { requires } : {}), outcomes: [any(line, 'neutral', arc(value))] })) });
const together = [need('single', '==', false)];

export default [
  scene('abroad_offer', [24, 58], 'An email you nearly deleted: a company in {place} wants someone who does exactly what you do, as {job}. They will sponsor the visa. They would like an answer.', [
    ['Apply for the visa', 'You write back: yes.', 'offer:apply'],
    ['Go out and meet them first', 'You ask whether they would see you in person.', 'offer:visit'],
    ['Talk it over at home', 'You wait until dinner to bring it up.', 'offer:talk', together],
    ['Turn it down', 'You write back, politely.', 'offer:no'],
  ]),
  scene('abroad_distance', [18, 100], '{who} calls from {country} again, late, the way they always do now. The time difference has made you both good at short conversations, and tired of them.', [
    ['Ask {who} to come and live with you', 'You ask, and mean it.', 'distance:ask'],
    ['Say you will come to {country}', 'You say it before you have thought it through, and find you mean it.', 'distance:join'],
    ['Plan a visit', 'You get out the calendar.', 'distance:visit'],
    ['Let it be for now', 'You talk about other things.', 'distance:wait'],
  ]),
  scene('abroad_homeward', [35, 100], '{who} is {age} now. You have lived away from {home} for {years} years, and every call home is a little shorter of breath on the other end.', [
    ['Go home', 'You start looking at flights one way.', 'homeward:go'],
    ['Go and see them first', 'You look at flights both ways.', 'homeward:visit'],
    ['Stay where your life is', 'You stay, and call more often.', 'homeward:stay'],
  ]),
  scene('abroad_firstTrip', [12, 17], 'Your parents have been whispering about money, and then about maps. This summer, they say, the family goes abroad: a fortnight {trip}. It would be your first time out of the country.', [
    ['Count down the days', 'You start a list of everything you want to see.', 'firstTrip:go'],
    ['Ask if you can see family there', 'You ask whether there will be time for family.', 'firstTrip:kin'],
    ['Say you would rather stay at home', 'You shrug, and say it is not really your thing.', 'firstTrip:stay'],
  ]),
  scene('abroad_exchange', [18, 30], 'The international office has pinned up its list of exchange places for next spring. One of them is a semester in {place}, and your tutor has written your name next to it in pencil.', [
    ['Apply for it', 'You fill in the form before you can talk yourself out of it.', 'exchange:apply'],
    ['Let it go', 'You decide this is not the year.', 'exchange:no'],
  ]),
  scene('abroad_cultures', [20, 100], '{who} answered you in the local language again tonight, and asked what a word in {lang} meant. It is the language {parent} grew up with, and it is slipping out of the house.', [
    ['Speak {lang} at home', 'You decide to keep it in the house.', 'cultures:home'],
    ['Send {who} to weekend {lang} school', 'You look up the Saturday classes.', 'cultures:school'],
    ['Let the local language take over', 'You decide not to fight it.', 'cultures:local'],
  ]),
  scene('abroad_venture', [25, 100], 'Customers keep asking whether {business} will ever open in {country}. {who}', [
    ['Open a branch there', 'You ask the accountant what it would take.', 'venture:go'],
    ['Not yet', 'You keep the business where it is.', 'venture:no'],
  ]),
  scene('abroad_retire', [60, 100], 'Retirement has made the days long and the winters longer. {why}', [
    ['Apply to live there', 'You find out what it would take.', 'retire:apply'],
    ['Spend a month there first', 'You decide to try it before you decide.', 'retire:visit'],
    ['Stay put', 'You put the idea away.', 'retire:stay'],
  ]),
];
