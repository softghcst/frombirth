// Scenes about the family's animals. Most are not drawn by chance: the care
// engine (engine/animalCare.js) puts them in front of the player when the
// state of a real animal calls for one, and each choice is carried out there.
import { st, hid, rel, any, need, addNpc } from './helpers.js';

/** A choice carried out by the care engine: see sceneChoice in engine/animalCare.js. */
const animal = (value) => ({ type: 'animal', value });

export default [
  {
    id: 'animal_unwell', category: 'animals', ageRange: [8, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: '{pet} is not right. Off the food, quiet, and not where they usually are when you come in.',
    choices: [
      { label: 'Take {pet} to the vet', outcomes: [any('You sit in the waiting room with {pet} pressed against you.', 'neutral', animal({ do: 'treat', kind: 'treatment', costBase: 420, chance: 0.88 }))] },
      { label: 'Keep {pet} warm and quiet, and watch', outcomes: [any('You make up a bed by the radiator and check on {pet} every hour.', 'neutral', animal({ do: 'wait', kind: 'treatment', chance: 0.5 }))] },
    ],
  },
  {
    id: 'animal_emergency', category: 'animals', ageRange: [8, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: 'Something is badly wrong with {pet}. It has happened fast, and it is not the kind of thing that waits until morning.',
    choices: [
      { label: 'Go straight to the emergency vet', outcomes: [any('You carry {pet} to the car and drive faster than you should.', 'neutral', animal({ do: 'treat', kind: 'emergency', costBase: 1800, chance: 0.8 }))] },
      { label: 'Ring for advice, and watch closely', outcomes: [any('The voice on the phone tells you what to look for. You sit up with {pet} all night.', 'neutral', animal({ do: 'wait', kind: 'emergency', chance: 0.35 }))] },
    ],
  },
  {
    id: 'foster_review', category: 'animals', ageRange: [18, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: 'The rescue rings about {pet}. A year has gone by. They ask how things are, and what you would like to happen next.',
    choices: [
      { label: 'Ask to adopt {pet} yourself', outcomes: [any('You say it before you have quite decided to.', 'neutral', animal({ do: 'foster', what: 'adopt' }))] },
      { label: 'Keep fostering for another year', outcomes: [any('You tell them {pet} is no trouble.', 'neutral', animal({ do: 'foster', what: 'keep' }))] },
      { label: 'Say {pet} is ready for a permanent home', outcomes: [any('You tell them everything a new family ought to know.', 'neutral', animal({ do: 'foster', what: 'return' }))] },
    ],
  },
  {
    id: 'want_a_pet', category: 'childhood', ageRange: [6, 14], cooldown: 4, cast: { parent: 'parent' },
    requires: [need('roles', 'lacks', 'pet'), need('flags.livesWithParents', '==', true)],
    text: 'Everyone at school seems to have an animal at home. You have been thinking about how to raise it with {parent}.',
    choices: [
      { label: 'Ask properly, and promise to help look after it', outcomes: [any('{parent} listens to the whole speech.', 'neutral', animal({ do: 'familyAdopt' }), rel('parent', 2))] },
      { label: 'Leave it for now', outcomes: [any('You decide this is not the week.', 'neutral')] },
    ],
  },
  {
    id: 'new_home_nerves', category: 'animals', ageRange: [16, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: '{pet} is finding the new house hard. Hiding when the door goes, awake at night, startled by things you no longer notice.',
    choices: [
      { label: 'A quiet room, a routine, and time', outcomes: [any('You stop expecting anything of {pet}, and keep every day the same. Slowly, {pet} starts coming to find you.', 'good', animal({ do: 'settle', help: 'time' }))] },
      { label: 'Book a session with a trainer ({$180})', requires: [need('cashBase', '>=', 180)], outcomes: [any('The trainer watches for an hour and changes three small things about your house. They work.', 'good', animal({ do: 'settle', help: 'trainer', costBase: 180 }))] },
      { label: 'Ask the vet to rule out anything physical ({$90})', requires: [need('cashBase', '>=', 90)], outcomes: [any('Nothing is wrong with {pet} that patience will not mend. It helps to know.', 'good', animal({ do: 'settle', help: 'vet', costBase: 90 }))] },
    ],
  },
  {
    id: 'older_animal', category: 'animals', ageRange: [18, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: '{pet} took the stairs one at a time this morning, and stopped halfway for a think.',
    choices: [
      { label: 'Change how you look after {pet}: softer bed, gentler days', outcomes: [any('You move the bed downstairs and shorten the days. {pet} approves of all of it.', 'good', animal({ do: 'routine', routine: 'senior' }))] },
      { label: 'Carry on as you are', outcomes: [any('{pet} gets to the top in the end, and looks pleased about it.', 'neutral')] },
    ],
  },
  {
    id: 'home_for_holidays', category: 'animals', ageRange: [18, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: 'You are back at the family home for a few days. {pet} hears your voice in the hall before anyone has said you are here.',
    choices: [
      { label: 'Get down on the floor', outcomes: [any('It takes {pet} about four seconds to forgive you for ever leaving.', 'good', animal({ do: 'visit' }), st('mood', 6))] },
      { label: 'Say hello and go and unpack', outcomes: [any('{pet} follows you up the stairs anyway, and watches you unpack.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'take_them_with_you', category: 'animals', ageRange: [16, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: 'You have moved out, and {pet} has not. The house you left is the only one {pet} has known; you are the one {pet} waits by the door for.',
    choices: [
      { label: 'Ask the family whether {pet} could come and live with you', outcomes: [any('You raise it carefully, over dinner.', 'neutral', animal({ do: 'askToTake' }))] },
      { label: 'Leave {pet} where their life is, and visit often', outcomes: [any('You decide it is not about what you want.', 'good', hid('karma', 2), animal({ do: 'visit' }))] },
    ],
  },
  {
    id: 'walk_neighbour', category: 'animals', ageRange: [16, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: 'The same person is at the park every evening you take {pet} out, with a dog of their own. The dogs have clearly decided the matter between themselves.',
    choices: [
      { label: 'Stop and talk', outcomes: [any('It turns out {walker} lives two streets away. You fall into walking the same way round.', 'good', addNpc('friend', 'walker', { ageOffset: 2 }), st('mood', 4))] },
      { label: 'Nod and keep walking', outcomes: [any('{pet} looks back over a shoulder all the way to the gate.', 'neutral')] },
    ],
  },
];
