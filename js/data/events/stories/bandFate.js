// When the band is done with you, or done altogether (engine/music.js bandFate): what now. Sent by the music engine
// once, when it happens. Each answer goes back to the engine (effect type 'music', engine/music.js musicChoice).
import { any } from '../helpers.js';

const music = (value) => ({ type: 'music', value });
const scene = (id, text, choices) => ({ id, category: 'career', ageRange: [16, 100], queuedOnly: true, text,
  choices: choices.map(([label, line, value, tone = 'neutral']) => ({ label, outcomes: [any(line, tone, music(value))] })) });

const SOLO = ['Go solo', 'You keep playing, on your own now.', 'solo', 'good'];
const LOOK = ['Find another band', 'You start asking around. Somebody always needs a player.', 'look'];
const STOP = ['Stop making music', 'You put it down. The records are still the records.', 'quit'];

export default [
  scene('music_kicked', '{band} have had a meeting without you. The upshot: they want to carry on with someone else.', [SOLO, LOOK, STOP]),
  scene('music_kicked_drummer', '{band} have had a meeting without you. The upshot: they want a different drummer.', [LOOK, STOP]),
  scene('music_disbanded', 'After {years} years, {band} are calling it a day. Nobody is quite sure whose idea it was.', [SOLO, LOOK, ['Try to keep the band together', 'You call everyone, one by one.', 'reunite'], STOP]),
  scene('music_disbanded_drummer', 'After {years} years, {band} are calling it a day. Nobody is quite sure whose idea it was.', [LOOK, ['Try to keep the band together', 'You call everyone, one by one.', 'reunite'], STOP]),
];
