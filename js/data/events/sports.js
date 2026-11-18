// Sports stories with scenes (engine/sportsArcs.js). None of these is drawn by chance: each is put in front of the
// player when the athletic record shows its story has begun, and names the real coach, team, final or offer.
// Every choice is carried out by sportArcChoice in engine/sportsArcs.js.
import { st, hid, any } from './helpers.js';

const arc = (value) => ({ type: 'sportArc', value });
const scene = (id, ageRange, cast, text, choices) => ({ id, category: 'sport', ageRange, queuedOnly: true, cooldown: 0, cast, text, choices });

export default [
  // A — First team
  scene('sport_arc_first_team', [5, 16], {}, 'The list goes up on the clubhouse door after training. Your name is on it: you are in the {team} squad. {Coach} catches your eye and nods.', [
    { label: 'Ask {coach} what to work on next', outcomes: [any('{Coach} gives you three things. You write them on the back of your hand.', 'good', arc({ arc: 'A', how: 'work' }))] },
    { label: 'Run home and tell everyone', outcomes: [any('You tell everyone. Twice.', 'good', arc({ arc: 'A', how: 'family' }), st('mood', 6))] },
    { label: 'Just enjoy it', outcomes: [any('You play the next game grinning the whole way through.', 'good', arc({ arc: 'A', how: 'fun' }))] },
  ]),
  scene('sport_arc_first_team_missed', [5, 16], {}, 'The list goes up on the clubhouse door. Your name is not on it. {team} took other players this year.', [
    { label: 'Ask {coach} what you need to work on', outcomes: [any('{Coach} is kind about it, and specific. You have a list now, and a year.', 'neutral', arc({ arc: 'A', how: 'ask' }))] },
    { label: 'Keep playing {sport} for fun', outcomes: [any('You go back to playing with your friends. It is still the best part of the week.', 'neutral', arc({ arc: 'A', how: 'fun' }))] },
  ]),
  // B — A coach who believes in you
  scene('sport_arc_believer', [8, 30], {}, 'After training, {coach} asks you to stay behind. "I have watched you work for two years. You are the first in and the last out. I would like to help you with more than {sport}, if you want that."', [
    { label: 'Say yes', outcomes: [any('From then on {coach} is the person you call, about {sport} and about everything else.', 'good', arc({ arc: 'B', how: 'yes' }), hid('discipline', 3))] },
    { label: 'Thank them, and keep it to {sport}', outcomes: [any('{Coach} understands. The extra work goes on, and so does the respect.', 'neutral', arc({ arc: 'B', how: 'polite' }))] },
  ]),
  // C — The big scholarship
  scene('sport_arc_scholarship', [15, 19], {}, 'The letter from {uni} is real: {share} of tuition, if you play {sport} for them, and only for as long as you do. It would change what the next four years cost your family.', [
    { label: 'Sit down with your family and work it through', outcomes: [any('You lay it all out on the kitchen table: the money, the hours, what happens if you get hurt.', 'good', arc({ arc: 'C', how: 'family' }))] },
    { label: 'Make sure your grades can carry you either way', outcomes: [any('You decide the grades come first. If {sport} ends, the degree should not.', 'good', arc({ arc: 'C', how: 'grades' }))] },
    { label: 'Train for it like it is everything', outcomes: [any('You train like the offer depends on it, because it does.', 'neutral', arc({ arc: 'C', how: 'sport' }))] },
  ]),
  // D — The championship season
  scene('sport_arc_final_won', [6, 60], {}, 'Final whistle in the {league} final: {team} {score} against {opponent}. Champions. Somebody is crying, and it might be you.', [
    { label: 'Lift the trophy with the team', outcomes: [any('You hold it up together, and the picture ends up on every wall.', 'good', arc({ arc: 'D', how: 'team' }), st('mood', 8))] },
    { label: 'Find {coach} first', outcomes: [any('{Coach} does not say anything. The handshake turns into a hug.', 'good', arc({ arc: 'D', how: 'coach' }), st('mood', 6))] },
  ]),
  scene('sport_arc_final_lost', [6, 60], {}, 'The {league} final: {team} lost {score} to {opponent}. {close}The other team is celebrating on your side of the ground.', [
    { label: 'Go round the dressing room, one by one', outcomes: [any('You talk to every one of them. Next year starts tonight.', 'neutral', arc({ arc: 'D', how: 'console' }))] },
    { label: 'Watch the replay until you understand it', outcomes: [any('You watch it three times. You see where it went, and it hurts, and it helps.', 'neutral', arc({ arc: 'D', how: 'study' }))] },
  ]),
  // E — The doubles partnership
  scene('sport_arc_doubles', [8, 90], {}, '{events} events together now{titles_line}. {partner} says, half joking, that the two of you play like one person on a good day and like strangers on a bad one.', [
    { label: 'Commit to another year together', outcomes: [any('You shake on it. {partner} says it is the most formal thing you have ever done.', 'good', arc({ arc: 'E', how: 'commit' }))] },
    { label: 'Work on calling the ball', outcomes: [any('You drill the calls until they are automatic: mine, yours, switch.', 'good', arc({ arc: 'E', how: 'talk' }))] },
    { label: 'Go separate ways', outcomes: [any('You both know it is time. It is friendlier than you feared.', 'neutral', arc({ arc: 'E', how: 'split' }))] },
  ]),
  // F — Injury and recovery
  scene('sport_arc_injury', [6, 70], {}, 'The scan confirms it: {injury}. {Coach} says the next few months are about patience, and that the players who come back best are the ones who do not rush.', [
    { label: 'Do the rehab properly, every day', outcomes: [any('Physiotherapy, the boring exercises, the slow progress. You do all of it.', 'good', arc({ arc: 'F', how: 'patient' }))] },
    { label: 'Get back as fast as you can', outcomes: [any('You push the timeline. It might work.', 'neutral', arc({ arc: 'F', how: 'rush' }))] },
    { label: 'Rest, and study the game while you heal', outcomes: [any('You cannot play, so you watch. You see things from the side you never saw on the field.', 'good', arc({ arc: 'F', how: 'study' }))] },
  ]),
  // G — The professional dream
  scene('sport_arc_pro_dream', [16, 40], {}, 'It is real: {club}. Playing {sport} for a living, the thing you used to pretend about in the backyard.', [
    { label: 'Ask {coach} what they think', outcomes: [any('{Coach} asks you what you want. Then tells you what they see. Both help.', 'good', arc({ arc: 'G', how: 'coach' }))] },
    { label: 'Call home first', outcomes: [any('There is a silence on the line, and then a lot of noise.', 'good', arc({ arc: 'G', how: 'home' }))] },
    { label: 'Sit with it for a night', outcomes: [any('You do not decide anything. You just let yourself have it, for one night.', 'good', arc({ arc: 'G', how: 'dream' }))] },
  ]),
  // H — The comeback
  scene('sport_arc_comeback', [20, 90], {}, 'Your first full season of {sport} after {years} years away. Your body remembers more than you expected, and less than you hoped.', [
    { label: 'Play for the love of it', outcomes: [any('You stop comparing yourself to who you were. It is the most fun you have had in years.', 'good', arc({ arc: 'H', how: 'enjoy' }))] },
    { label: 'Get fit enough to prove something', outcomes: [any('You start running again in the mornings. Some old fire comes back.', 'neutral', arc({ arc: 'H', how: 'prove' }))] },
  ]),
  // I — A new generation
  scene('sport_arc_new_generation', [18, 110], {}, '{child} has taken up {sport}. Nobody suggested it: they saw it, wanted it, and asked.', [
    { label: 'Pay for lessons, and drive them to every game', outcomes: [any('You become one of the parents on the sideline with a flask and a folding chair.', 'good', arc({ arc: 'I', how: 'support' }))] },
    { label: 'Encourage them, and let them lead', outcomes: [any('You ask questions and let {child} decide how serious it gets.', 'good', arc({ arc: 'I', how: 'lead' }))] },
    { label: 'Point them towards {mine} instead', outcomes: [any('{child} listens politely.', 'bad', arc({ arc: 'I', how: 'steer' }))] },
  ]),
];
