// The animals a family can keep: what each species is, how individuals of it
// differ, and what can reasonably be asked of them. Individuals are drawn in
// engine/animals.js; nothing here decides one animal's character.
//
// Breed shapes the body, never the temperament: two retrievers can be nothing alike.

/** Coat and eye colours, as drawn in the portraits. */
export const COAT_COLOURS = {
  black: '#2b2724', charcoal: '#4a4744', grey: '#8d8c8a', silver: '#b9b7b2', white: '#f1ede4', cream: '#e9d8b4',
  golden: '#d9a441', fawn: '#c9a26b', red: '#b5562c', ginger: '#d98a3d', chocolate: '#5b3a26', brown: '#7b5637',
  tan: '#b98857', sable: '#8a6a45', blue: '#6f7f8f', green: '#4f9a52', yellow: '#e6c53a', scarlet: '#c8382c',
};
export const EYE_COLOURS = { brown: '#5a3b22', amber: '#b8791f', hazel: '#8a7a3a', green: '#5f8f4e', blue: '#5b8fc0', gold: '#c9a227', dark: '#1e1a17' };

const dims = (...ids) => ids;

/**
 * @typedef {Object} SpeciesDefinition
 * @property {string} id
 * @property {string} name          common name, lower case
 * @property {string} young         what a young one is called
 * @property {'companion'} group
 * @property {string} housing       where one can properly live
 * @property {[number, number]} lifespan  typical range in years; individuals vary around it
 * @property {[string, number][]} stages  [name, share of the individual's own lifespan at which it begins]
 * @property {string[]} needs       what daily care means for this species
 * @property {string[]} health      things a vet watches for; never advice
 * @property {string[]} temperament the dimensions that mean something for this species
 * @property {{id:string, name:string, learned:string, difficulty:1|2|3}[]} training  what can be taught, kindly
 * @property {{id:string, label:string, text:string}[]} activities  time spent together
 * @property {string[]} coats  @property {string[]} patterns  @property {string[]} eyes
 * @property {string} sexes  'both' when it is usually known
 */
export const SPECIES = {
  dog: {
    id: 'dog', name: 'dog', young: 'puppy', group: 'companion',
    housing: 'A home with room to move, daily walks, and people about.',
    lifespan: [10, 16], stages: [['puppy', 0], ['young dog', 0.08], ['adult', 0.2], ['senior', 0.68]],
    needs: ['Two meals a day and fresh water', 'Walks and play every day', 'Company: dogs do badly left alone for long', 'Grooming to suit the coat', 'A yearly check with the vet'],
    health: ['Teeth', 'Joints in later years', 'Weight'],
    temperament: dims('sociability', 'curiosity', 'confidence', 'activity', 'playfulness', 'sensitivity', 'adaptability', 'trainability', 'affection'),
    training: [
      { id: 'name', name: 'Answering to their name', learned: 'answers to their name', difficulty: 1 },
      { id: 'sit', name: 'Sit', learned: 'sits when asked', difficulty: 1 },
      { id: 'come', name: 'Coming when called', learned: 'comes when called', difficulty: 2 },
      { id: 'stay', name: 'Stay', learned: 'stays until released', difficulty: 2 },
      { id: 'leash', name: 'Walking on a loose lead', learned: 'walks on a loose lead', difficulty: 3 },
      { id: 'settle', name: 'Settling on a mat', learned: 'settles on their mat', difficulty: 3 },
    ],
    activities: [{ id: 'walk', label: 'Go for a long walk', text: 'You took {name} the long way round. {They} read every lamp post on the route.' }],
    coats: ['black', 'chocolate', 'golden', 'cream', 'white', 'fawn', 'red', 'grey', 'tan', 'sable'],
    patterns: ['solid', 'patched', 'saddle', 'socks', 'blaze'], eyes: ['brown', 'amber', 'hazel', 'blue'], sexes: 'both',
  },
  cat: {
    id: 'cat', name: 'cat', young: 'kitten', group: 'companion',
    housing: 'A home with high places, hiding places and a clean litter tray.',
    lifespan: [12, 20], stages: [['kitten', 0], ['young cat', 0.06], ['adult', 0.15], ['senior', 0.65]],
    needs: ['Small meals and fresh water', 'A clean litter tray', 'Places to climb, scratch and hide', 'Play that lets them hunt something', 'A yearly check with the vet'],
    health: ['Teeth', 'Kidneys in later years', 'Weight'],
    temperament: dims('sociability', 'curiosity', 'confidence', 'activity', 'playfulness', 'sensitivity', 'adaptability', 'independence', 'affection'),
    training: [
      { id: 'name', name: 'Answering to their name', learned: 'comes to their name, when it suits', difficulty: 1 },
      { id: 'carrier', name: 'Going into the carrier calmly', learned: 'walks into the carrier without a fight', difficulty: 2 },
      { id: 'handling', name: 'Being handled for brushing and claws', learned: 'puts up with brushing and claw trims', difficulty: 2 },
      { id: 'target', name: 'Touching a target for a treat', learned: 'touches a target on cue', difficulty: 3 },
    ],
    activities: [{ id: 'hunt', label: 'Play with the feather wand', text: 'You ran the feather wand until {name} lay flat and furious and happy.' }],
    coats: ['black', 'grey', 'white', 'ginger', 'cream', 'brown', 'silver', 'charcoal'],
    patterns: ['solid', 'tabby', 'bicolour', 'tortoiseshell', 'calico', 'pointed'], eyes: ['green', 'gold', 'amber', 'blue', 'hazel'], sexes: 'both',
  },
  rabbit: {
    id: 'rabbit', name: 'rabbit', young: 'kit', group: 'companion',
    housing: 'A large pen or a rabbit-proofed room. A hutch alone is not enough.',
    lifespan: [7, 12], stages: [['kit', 0], ['young rabbit', 0.06], ['adult', 0.15], ['senior', 0.65]],
    needs: ['Hay, always; greens daily', 'Room to run every day', 'Things to chew and dig', 'Another rabbit for company, where possible', 'A yearly check with the vet'],
    health: ['Teeth', 'Digestion', 'Nails'],
    temperament: dims('sociability', 'curiosity', 'confidence', 'activity', 'sensitivity', 'adaptability', 'affection'),
    training: [
      { id: 'litter', name: 'Using a litter tray', learned: 'uses the litter tray', difficulty: 1 },
      { id: 'come', name: 'Coming for their name', learned: 'comes hopping when called', difficulty: 2 },
      { id: 'handling', name: 'Being picked up without panic', learned: 'stays calm when picked up', difficulty: 3 },
    ],
    activities: [{ id: 'floor', label: 'Sit on the floor with them', text: 'You sat on the floor until {name} decided you were furniture, and then something better.' }],
    coats: ['white', 'grey', 'brown', 'black', 'fawn', 'cream'], patterns: ['solid', 'patched', 'blaze'], eyes: ['brown', 'dark', 'blue'], sexes: 'both',
  },
  parrot: {
    id: 'parrot', name: 'parrot', young: 'chick', group: 'companion',
    housing: 'A large cage, hours out of it every day, and a household that can live with noise.',
    lifespan: [30, 60], stages: [['chick', 0], ['young bird', 0.03], ['adult', 0.1], ['senior', 0.75]],
    needs: ['Fresh food and water daily', 'Hours out of the cage every day', 'Things to shred and solve', 'A great deal of company', 'A vet who knows birds'],
    health: ['Feathers', 'Beak and nails', 'Weight'],
    temperament: dims('sociability', 'curiosity', 'confidence', 'activity', 'playfulness', 'sensitivity', 'trainability', 'affection'),
    training: [
      { id: 'stepup', name: 'Stepping up onto a hand', learned: 'steps up onto a hand', difficulty: 1 },
      { id: 'target', name: 'Touching a target', learned: 'touches a target on cue', difficulty: 2 },
      { id: 'cage', name: 'Going back into the cage when asked', learned: 'goes back into the cage when asked', difficulty: 3 },
    ],
    activities: [{ id: 'forage', label: 'Set up a foraging puzzle', text: 'You hid {name}\'s favourite things in a box of paper. It was destroyed with great care.' }],
    coats: ['green', 'grey', 'blue', 'scarlet', 'yellow', 'white'], patterns: ['solid', 'blaze'], eyes: ['dark', 'gold'], sexes: 'unknown',
  },
  hamster: {
    id: 'hamster', name: 'hamster', young: 'pup', group: 'companion',
    housing: 'A large enclosure with deep bedding to burrow in and a proper wheel. Awake at night.',
    lifespan: [2, 4], stages: [['pup', 0], ['adult', 0.12], ['senior', 0.7]],
    needs: ['Seed mix, fresh greens and water', 'Deep bedding to burrow in', 'A wheel of the right size', 'To be left to sleep by day'],
    health: ['Teeth', 'Weight'],
    temperament: dims('curiosity', 'confidence', 'activity', 'sensitivity'),
    training: [{ id: 'handling', name: 'Taking food from a hand, then sitting in one', learned: 'climbs into an open hand', difficulty: 2 }],
    activities: [{ id: 'maze', label: 'Build a cardboard maze', text: 'You built {name} a cardboard maze. It was solved, then eaten.' }],
    coats: ['golden', 'cream', 'grey', 'white', 'brown'], patterns: ['solid', 'patched'], eyes: ['dark'], sexes: 'both',
  },
};

/** Animals recorded before this catalogue knew their species. */
export const UNKNOWN_SPECIES = {
  id: 'other', name: 'animal', young: 'young one', group: 'companion', housing: 'Somewhere suited to what they are.',
  lifespan: [5, 15], stages: [['young', 0], ['adult', 0.15], ['senior', 0.7]], needs: ['Food, water, shelter and care suited to what they are'],
  health: [], temperament: dims('curiosity', 'confidence', 'activity'), training: [], activities: [],
  coats: ['brown', 'grey', 'white'], patterns: ['solid'], eyes: ['dark'], sexes: 'unknown',
};
export const speciesOf = (id) => SPECIES[id] ?? { ...UNKNOWN_SPECIES, name: id || 'animal' };

/**
 * Breeds and types. `mix` marks an animal of no particular breed. Body only:
 * size, ears, coat length, and the coats and patterns usually seen.
 * @type {Object<string, {id:string, name:string, mix?:boolean, size:'small'|'medium'|'large', ears:'up'|'drop'|'half'|'tuft',
 *        length:'short'|'medium'|'long', coats?:string[], patterns?:string[], eyes?:string[], weight:number}[]>}
 */
export const BREEDS = {
  dog: [
    { id: 'mixed', name: 'Mixed breed', mix: true, size: 'medium', ears: 'half', length: 'short', weight: 30 },
    { id: 'labrador', name: 'Labrador Retriever', size: 'large', ears: 'drop', length: 'short', coats: ['black', 'chocolate', 'cream'], patterns: ['solid'], eyes: ['brown', 'hazel'], weight: 9 },
    { id: 'golden', name: 'Golden Retriever', size: 'large', ears: 'drop', length: 'long', coats: ['golden', 'cream'], patterns: ['solid'], eyes: ['brown'], weight: 7 },
    { id: 'shepherd', name: 'German Shepherd', size: 'large', ears: 'up', length: 'medium', coats: ['tan', 'sable', 'black'], patterns: ['saddle', 'solid'], eyes: ['brown'], weight: 6 },
    { id: 'beagle', name: 'Beagle', size: 'medium', ears: 'drop', length: 'short', coats: ['tan', 'brown'], patterns: ['saddle', 'patched'], eyes: ['brown', 'hazel'], weight: 5 },
    { id: 'poodle', name: 'Poodle', size: 'medium', ears: 'drop', length: 'long', coats: ['white', 'black', 'cream', 'grey', 'chocolate'], patterns: ['solid'], eyes: ['brown'], weight: 5 },
    { id: 'collie', name: 'Border Collie', size: 'medium', ears: 'half', length: 'medium', coats: ['black', 'red', 'grey'], patterns: ['blaze', 'socks', 'patched'], eyes: ['brown', 'blue'], weight: 5 },
    { id: 'dachshund', name: 'Dachshund', size: 'small', ears: 'drop', length: 'short', coats: ['red', 'chocolate', 'black'], patterns: ['solid', 'socks'], eyes: ['brown'], weight: 4 },
    { id: 'chihuahua', name: 'Chihuahua', size: 'small', ears: 'up', length: 'short', coats: ['fawn', 'cream', 'black', 'chocolate'], patterns: ['solid', 'patched'], eyes: ['brown'], weight: 4 },
    { id: 'husky', name: 'Siberian Husky', size: 'large', ears: 'up', length: 'medium', coats: ['grey', 'black', 'red'], patterns: ['blaze', 'socks'], eyes: ['blue', 'brown'], weight: 4 },
    { id: 'corgi', name: 'Corgi', size: 'small', ears: 'up', length: 'medium', coats: ['red', 'fawn', 'sable'], patterns: ['blaze', 'socks'], eyes: ['brown'], weight: 4 },
  ],
  cat: [
    { id: 'dsh', name: 'Domestic Shorthair', mix: true, size: 'medium', ears: 'up', length: 'short', weight: 40 },
    { id: 'dlh', name: 'Domestic Longhair', mix: true, size: 'medium', ears: 'tuft', length: 'long', weight: 12 },
    { id: 'siamese', name: 'Siamese', size: 'medium', ears: 'up', length: 'short', coats: ['cream', 'white'], patterns: ['pointed'], eyes: ['blue'], weight: 4 },
    { id: 'mainecoon', name: 'Maine Coon', size: 'large', ears: 'tuft', length: 'long', coats: ['brown', 'grey', 'ginger', 'black'], patterns: ['tabby', 'bicolour'], eyes: ['green', 'gold'], weight: 4 },
    { id: 'persian', name: 'Persian', size: 'medium', ears: 'up', length: 'long', coats: ['white', 'cream', 'grey', 'ginger'], patterns: ['solid', 'bicolour'], eyes: ['amber', 'blue'], weight: 3 },
    { id: 'ragdoll', name: 'Ragdoll', size: 'large', ears: 'up', length: 'long', coats: ['cream', 'white'], patterns: ['pointed', 'bicolour'], eyes: ['blue'], weight: 3 },
    { id: 'bengal', name: 'Bengal', size: 'medium', ears: 'up', length: 'short', coats: ['brown', 'ginger', 'silver'], patterns: ['tabby'], eyes: ['green', 'gold'], weight: 3 },
    { id: 'british', name: 'British Shorthair', size: 'medium', ears: 'up', length: 'short', coats: ['grey', 'cream', 'black'], patterns: ['solid'], eyes: ['amber', 'gold'], weight: 3 },
  ],
  rabbit: [
    { id: 'upright', name: 'Upright-eared rabbit', mix: true, size: 'small', ears: 'up', length: 'short', weight: 6 },
    { id: 'lop', name: 'Lop-eared rabbit', mix: true, size: 'small', ears: 'drop', length: 'short', weight: 4 },
  ],
};
export const breedOf = (speciesId, breedId) => (BREEDS[speciesId] ?? []).find((b) => b.id === breedId) ?? null;

/** What the two ends of each temperament dimension look like in an animal. */
export const TEMPERAMENT = {
  sociability: { name: 'With people', high: 'greets everyone', low: 'wary of strangers' },
  curiosity: { name: 'Curiosity', high: 'into everything', low: 'likes what is familiar' },
  confidence: { name: 'Confidence', high: 'bold', low: 'easily startled' },
  activity: { name: 'Energy', high: 'tireless', low: 'happiest lying down' },
  playfulness: { name: 'Play', high: 'always ready to play', low: 'plays on their own terms' },
  sensitivity: { name: 'Sensitivity', high: 'feels every change in the house', low: 'unbothered by noise and fuss' },
  adaptability: { name: 'Change', high: 'takes change in their stride', low: 'needs routine' },
  trainability: { name: 'Learning', high: 'quick to learn', low: 'learns in their own time' },
  independence: { name: 'Independence', high: 'keeps their own counsel', low: 'follows you from room to room' },
  affection: { name: 'Affection', high: 'wants to be close', low: 'shows affection sparingly' },
};

/** The kinds of moment that are kept in the family's record. */
export const EVENT_TYPES = {
  met: { label: 'Part of the family', glyph: '🏠' },
  adopted: { label: 'Adopted', glyph: '🏡' },
  joined: { label: 'Joined the family', glyph: '🏡' },
  trained: { label: 'Training milestone', glyph: '🎓' },
  achievement: { label: 'Achievement', glyph: '🏅' },
  moved: { label: 'Family relocation', glyph: '🧳' },
  stayed: { label: 'Stayed in the family home', glyph: '🚪' },
  recovery: { label: 'Veterinary recovery', glyph: '🩺' },
  care: { label: 'Care passed on', glyph: '🤝' },
  rehomed: { label: 'Rehomed', glyph: '🤝' },
  died: { label: 'Passed away', glyph: '🕯️' },
  memorial: { label: 'Memorial', glyph: '🌿' },
};
