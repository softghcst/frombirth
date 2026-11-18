// Scenes about the family's animals. Most are not drawn by chance: the care
// engine (engine/animalCare.js) puts them in front of the player when the
// state of a real animal calls for one, and each choice is carried out there.
import { st, hid, rel, any, need, addNpc } from './helpers.js';

/** A choice carried out by the care engine: see sceneChoice in engine/animalCare.js. */
const animal = (value) => ({ type: 'animal', value });
/** A choice carried out by engine/animalLife.js. */
const life = (value) => ({ type: 'animalLife', value });
/** A choice in a story that takes years (engine/animalArcs.js). */
const arc = (value) => ({ type: 'animalArc', value });

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
    id: 'walk_neighbor', category: 'animals', ageRange: [16, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: 'The same person is at the park every evening you take {pet} out, with a dog of their own. The dogs have clearly decided the matter between themselves.',
    choices: [
      { label: 'Stop and talk', outcomes: [any('It turns out {walker} lives two streets away. You fall into walking the same way round.', 'good', addNpc('friend', 'walker', { ageOffset: 2 }), st('mood', 4))] },
      { label: 'Nod and keep walking', outcomes: [any('{pet} looks back over a shoulder all the way to the gate.', 'neutral')] },
    ],
  },
  {
    id: 'animal_behavior', category: 'animals', ageRange: [14, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: '{pet} {problem}. It is not spite: something is wrong for {pet}, and it is not going away on its own.',
    choices: [
      { label: 'Book a qualified behaviorist ({$220})', requires: [need('cashBase', '>=', 220)], outcomes: [any('The behaviorist watches for an hour and gives you a plan. Most of it is about you.', 'good', life({ do: 'behavior', how: 'trainer' }))] },
      { label: 'Ask the vet whether something hurts ({$90})', requires: [need('cashBase', '>=', 90)], outcomes: [any('The vet checks {pet} over properly.', 'neutral', life({ do: 'behavior', how: 'vet' }))] },
      { label: 'Change the house: a safe space, a routine, more to do', outcomes: [any('You rearrange a corner, set the days to a pattern, and find {pet} more to do.', 'good', life({ do: 'behavior', how: 'environment' }))] },
      { label: 'Tell {pet} off', outcomes: [any('You lose your temper.', 'bad', life({ do: 'behavior', how: 'scold' }))] },
    ],
  },
  {
    id: 'animal_custody', category: 'animals', ageRange: [18, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet', ex: 'ex' },
    text: 'You and {ex} have split everything else. That leaves {pet}, who loves you both and does not know anything has changed.',
    choices: [
      { label: '{pet} stays with you', outcomes: [any('You say it before {ex} can.', 'neutral', life({ do: 'custody', choice: 'keep' }))] },
      { label: '{pet} stays with you, and sees {ex} every other weekend', outcomes: [any('You suggest it carefully. {ex} says yes before you have finished.', 'good', life({ do: 'custody', choice: 'share' }))] },
      { label: 'Let {pet} go with {ex}', outcomes: [any('You look at {pet}, and then at {ex}, and say it.', 'neutral', life({ do: 'custody', choice: 'give' }))] },
    ],
  },
  {
    id: 'arc_first_pet', category: 'animals', ageRange: [6, 15], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: '{pet} has been part of the house for a year. Somebody has to fill the water bowl every morning, and it has been your mother more often than you.',
    choices: [
      { label: 'Make it your job, every day', outcomes: [any('You set an alarm. {pet} starts waiting for you instead.', 'good', arc({ do: 'first', how: 'chores' }), hid('discipline', 2))] },
      { label: 'Help when you remember', outcomes: [any('You help when you remember, which is some of the time.', 'neutral', arc({ do: 'first', how: 'sometimes' }))] },
    ],
  },
  {
    id: 'arc_rescue_nervous', category: 'animals', ageRange: [12, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: 'A year on, {pet} still flinches at sudden sounds and watches you from doorways. Whatever happened before, it has not quite let go.',
    choices: [
      { label: 'Give {pet} space, and let them come to you', outcomes: [any('You stop reaching out and start sitting still. It takes weeks. Then one evening {pet} is beside you.', 'good', arc({ do: 'settle', how: 'space' }))] },
      { label: 'Keep every day exactly the same', outcomes: [any('Breakfast at seven. Walk at eight. {pet} begins to trust the shape of the day, and then you.', 'good', arc({ do: 'settle', how: 'routine' }))] },
      { label: 'Keep trying to cuddle them', outcomes: [any('{pet} tolerates it, mostly.', 'neutral', arc({ do: 'settle', how: 'fuss' }))] },
    ],
  },
  {
    id: 'arc_retire_horse', category: 'animals', ageRange: [16, 120], queuedOnly: true, cooldown: 0, cast: { pet: 'pet' },
    text: '{pet} took the last fence carefully, as if thinking about it. The vet says there is nothing wrong. Just years.',
    choices: [
      { label: 'Retire {pet} from competing: hacking and grazing from now on', outcomes: [any('You tell the yard. {pet} does not seem to mind at all.', 'good', arc({ do: 'retire', how: 'retire' }))] },
      { label: 'One more season, gently', outcomes: [any('You enter fewer classes and lower fences.', 'neutral', arc({ do: 'retire', how: 'keep' }))] },
    ],
  },
  {
    id: 'arc_remembrance', category: 'animals', ageRange: [6, 120], queuedOnly: true, cooldown: 0, cast: {},
    text: 'It is a year since {pet} died. The house has got used to the quiet, mostly. You have not, entirely.',
    choices: [
      { label: 'Make a small memorial for {pet}', outcomes: [any('You find the right photograph and the right place for it.', 'good', arc({ do: 'remember', how: 'memorial' }))] },
      { label: 'Go through the photographs', outcomes: [any('There are more of them than you thought, and most are blurred, because {pet} never sat still.', 'good', arc({ do: 'remember', how: 'photos' }))] },
      { label: 'Walk the old routes', outcomes: [any('You walk the way the two of you always went.', 'good', arc({ do: 'remember', how: 'walk' }))] },
    ],
  },
  {
    id: 'arc_instructor_suggests', category: 'animals', ageRange: [8, 120], queuedOnly: true, cooldown: 0, cast: { teacher: 'mentor' },
    text: 'After your lesson {teacher} leans on the fence and says you are ready for the show ring. Introductory level, on a school horse, at the show this year.',
    choices: [
      { label: 'Say yes before you can talk yourself out of it', outcomes: [any('{teacher} has the horse braided and gleaming before you arrive.', 'good', arc({ do: 'compete', how: 'yes' }), rel('teacher', 4))] },
      { label: 'Not this year', outcomes: [any('{teacher} shrugs. The offer stands.', 'neutral', arc({ do: 'compete', how: 'no' }))] },
    ],
  },
  {
    id: 'whose_turn', category: 'animals', ageRange: [9, 17], queuedOnly: true, cooldown: 4, cast: { pet: 'pet', sib: 'sibling' },
    text: '{pet} is sitting by the door with the lead in their mouth, and you and {sib} are arguing about whose turn it is.',
    choices: [
      { label: 'Take {pet} yourself', outcomes: [any('You go. The argument can wait.', 'good', life({ do: 'chores', who: 'me' }))] },
      { label: 'Make a rota and stick it on the fridge', outcomes: [any('You draw up a rota with columns and everything.', 'good', life({ do: 'chores', who: 'rota' }))] },
      { label: 'Insist it is {sib}\'s turn', outcomes: [any('You win the argument.', 'neutral', life({ do: 'chores', who: 'sib' }))] },
    ],
  },
];
