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

const small = (id, name, young, o) => ({ id, name, young, group: 'companion', lifespan: o.lifespan, stages: [[young, 0], ['adult', 0.12], ['senior', 0.7]],
  housing: o.housing, needs: o.needs, health: o.health ?? ['Teeth', 'Weight'], temperament: dims('curiosity', 'confidence', 'activity', 'sensitivity', ...(o.social ? ['sociability'] : [])),
  training: o.training ?? [], activities: [], coats: o.coats, patterns: o.patterns ?? ['solid', 'patched'], eyes: o.eyes ?? ['dark'], sexes: o.sexes ?? 'both' });
Object.assign(SPECIES, {
  guinea_pig: small('guinea_pig', 'guinea pig', 'pup', { lifespan: [4, 8], social: true, housing: 'A large floor pen, hay, hiding places, and another guinea pig: one alone is lonely.',
    needs: ['Hay, always; fresh vegetables daily', 'Vitamin C in the diet', 'A companion of their own kind', 'Floor time out of the pen'], coats: ['brown', 'white', 'ginger', 'black', 'cream'],
    training: [{ id: 'handling', name: 'Being picked up without panic', learned: 'sits calmly in a lap', difficulty: 2 }] }),
  rat: small('rat', 'rat', 'pup', { lifespan: [2, 3], social: true, housing: 'A tall cage with shelves, time out of it every day, and another rat for company.',
    needs: ['Rat pellets, fresh food and water', 'Another rat for company', 'Daily time out of the cage', 'Things to climb and chew'], coats: ['white', 'grey', 'brown', 'black', 'fawn'],
    training: [{ id: 'name', name: 'Coming to their name', learned: 'comes when called', difficulty: 1 }, { id: 'handling', name: 'Riding on a shoulder', learned: 'rides on a shoulder', difficulty: 2 }] }),
  ferret: small('ferret', 'ferret', 'kit', { lifespan: [5, 9], social: true, housing: 'A large cage for sleeping and hours of supervised freedom in a ferret-proofed room.',
    needs: ['A meat-based diet', 'Hours out of the cage daily', 'Tunnels and things to steal', 'Vaccinations and yearly checks'], coats: ['sable', 'white', 'cream', 'chocolate'], patterns: ['solid', 'blaze'],
    training: [{ id: 'litter', name: 'Using a litter tray', learned: 'uses the litter tray, mostly', difficulty: 2 }, { id: 'name', name: 'Coming to their name', learned: 'comes when called', difficulty: 2 }] }),
  budgie: { id: 'budgie', name: 'budgerigar', young: 'chick', group: 'companion', housing: 'A wide cage, daily flight in a safe room, and company: their own kind or a great deal of yours.',
    lifespan: [5, 12], stages: [['chick', 0], ['adult', 0.1], ['senior', 0.7]], needs: ['Seed, pellets and fresh greens', 'Daily flight out of the cage', 'Company', 'Things to shred'], health: ['Feathers', 'Beak and nails'],
    temperament: dims('sociability', 'curiosity', 'confidence', 'activity', 'sensitivity'), training: [{ id: 'stepup', name: 'Stepping up onto a finger', learned: 'steps up onto a finger', difficulty: 1 }],
    activities: [], coats: ['green', 'blue', 'yellow', 'white'], patterns: ['solid', 'blaze'], eyes: ['dark'], sexes: 'both' },
  fish: { id: 'fish', name: 'fish', young: 'fry', group: 'companion', housing: 'A filtered, heated tank of the right size, cycled before anything lives in it.',
    lifespan: [3, 10], stages: [['young', 0], ['adult', 0.15], ['old', 0.75]], needs: ['A filtered tank of the right size', 'Water tested and changed regularly', 'The right food, and not too much', 'Plants and places to hide'], health: ['Water quality'],
    temperament: dims('activity', 'confidence'), training: [], activities: [], coats: ['golden', 'scarlet', 'blue', 'white', 'black', 'yellow'], patterns: ['solid', 'patched'], eyes: ['dark'], sexes: 'unknown' },
});

const equine = (id, name, young, lifespan, coats) => ({ id, name, young, group: 'equine', lifespan,
  housing: 'A stable or shelter, daily turnout on pasture, and the company of other equines. Never a garden.',
  stages: [[young, 0], [`young ${name}`, 0.04], ['adult', 0.15], ['senior', 0.7]],
  needs: ['Forage through the day, and clean water', 'Daily turnout and movement', 'The company of other equines', 'A farrier every six to eight weeks', 'Teeth, vaccinations and a yearly check'],
  health: ['Feet', 'Teeth', 'Digestion', 'Soundness'], temperament: dims('sociability', 'curiosity', 'confidence', 'activity', 'sensitivity', 'adaptability', 'trainability', 'affection'),
  training: [
    { id: 'halter', name: 'Leading quietly in a halter', learned: 'leads quietly', difficulty: 1 },
    { id: 'feet', name: 'Standing for the farrier', learned: 'stands for the farrier', difficulty: 2 },
    { id: 'groundwork', name: 'Groundwork: yielding, backing, standing', learned: 'works calmly from the ground', difficulty: 2 },
    { id: 'load', name: 'Loading into a trailer', learned: 'loads into a trailer without a fight', difficulty: 3 },
    ...(id === 'donkey' ? [] : [{ id: 'saddle', name: 'Carrying a rider calmly', learned: 'carries a rider calmly at every pace', difficulty: 3 }]),
  ],
  activities: [], coats, patterns: ['solid', 'blaze', 'socks', 'patched'], eyes: ['brown', 'dark'], sexes: 'both' });
Object.assign(SPECIES, {
  horse: equine('horse', 'horse', 'foal', [24, 32], ['brown', 'chocolate', 'black', 'grey', 'red', 'golden', 'white']),
  pony: equine('pony', 'pony', 'foal', [26, 36], ['brown', 'grey', 'black', 'red', 'cream', 'white']),
  donkey: equine('donkey', 'donkey', 'foal', [27, 40], ['grey', 'brown', 'charcoal', 'white']),
});

const farm = (id, name, young, lifespan, coats, needs, housing, extra = {}) => ({ id, name, young, group: 'farm', lifespan, housing,
  stages: [[young, 0], ['adult', 0.12], ['old', 0.75]], needs, health: extra.health ?? ['Feet', 'Parasites'],
  temperament: dims('sociability', 'curiosity', 'confidence', 'activity'), training: extra.training ?? [], activities: [], coats, patterns: extra.patterns ?? ['solid', 'patched'], eyes: ['dark', 'amber'], sexes: 'both' });
Object.assign(SPECIES, {
  chicken: farm('chicken', 'chicken', 'chick', [5, 10], ['red', 'white', 'black', 'golden', 'grey'], ['Layers\' feed, grit and water', 'A fox-proof coop at night', 'Ground to scratch and dust-bathe in', 'A flock: never one alone'], 'A secure coop and a run, with a flock of their own.', { health: ['Mites', 'Feet'] }),
  duck: farm('duck', 'duck', 'duckling', [6, 12], ['white', 'brown', 'black', 'grey'], ['Feed and clean water deep enough to dip the head', 'A fox-proof house at night', 'Somewhere to dabble', 'A flock'], 'A secure house, a run, and water to dabble in.', { health: ['Feet'] }),
  goat: farm('goat', 'goat', 'kid', [11, 16], ['white', 'brown', 'black', 'fawn', 'grey'], ['Hay and browse', 'Fencing that actually holds a goat', 'Shelter from rain', 'Another goat', 'Feet trimmed, and a vet who knows goats'], 'A fenced paddock with shelter and at least one other goat.',
    { training: [{ id: 'halter', name: 'Leading in a halter', learned: 'leads in a halter', difficulty: 2 }, { id: 'feet', name: 'Standing to have feet trimmed', learned: 'stands to have feet trimmed', difficulty: 2 }] }),
  sheep: farm('sheep', 'sheep', 'lamb', [9, 13], ['white', 'cream', 'black', 'brown'], ['Pasture and hay', 'Shearing once a year', 'Feet checked regularly', 'A flock'], 'Pasture, shelter, and a flock.', { patterns: ['solid'] }),
});

/**
 * What keeping one costs and asks of a household. Money is in base units a year.
 *   load   how much of a household's capacity to care it takes up
 *   cost   food, bedding, supplies and the ordinary things, a year
 *   space  the least room it can properly live in: 'small' (a shelf or a corner) | 'room' | 'yard' | 'land'
 *   exam   a routine visit to the vet         insure  a year's insurance premium, where insurance is sold
 *   fee    what a rescue asks                 banned  countries where keeping one is against the law
 *   names  what people call them
 */
const KEEPING = {
  dog: { load: 1, cost: 900, space: 'room', exam: 90, insure: 320, fee: 150, names: ['Biscuit', 'Juno', 'Pepper', 'Moose', 'Olive', 'Daisy', 'Rufus', 'Maple', 'Scout', 'Bramble', 'Otis', 'Poppy'] },
  cat: { load: 0.7, cost: 600, space: 'room', exam: 80, insure: 220, fee: 100, names: ['Miso', 'Pickle', 'Shadow', 'Clementine', 'Figaro', 'Mog', 'Juniper', 'Sprat', 'Tansy', 'Bartleby'] },
  rabbit: { load: 0.5, cost: 420, space: 'room', exam: 70, insure: 140, fee: 50, names: ['Clover', 'Thistle', 'Button', 'Bracken', 'Parsley', 'Hazel'] },
  parrot: { load: 0.9, cost: 700, space: 'room', exam: 110, insure: 0, fee: 250, names: ['Captain', 'Mango', 'Echo', 'Admiral', 'Kiwi'] },
  hamster: { load: 0.25, cost: 150, space: 'small', exam: 45, insure: 0, fee: 15, names: ['Nugget', 'Peanut', 'Gizmo', 'Truffle', 'Crumb'] },
  guinea_pig: { load: 0.3, cost: 300, space: 'small', exam: 55, insure: 0, fee: 25, names: ['Pumpkin', 'Fudge', 'Wheek', 'Toffee', 'Nutmeg'] },
  rat: { load: 0.25, cost: 200, space: 'small', exam: 50, insure: 0, fee: 15, names: ['Remy', 'Pip', 'Sesame', 'Domino', 'Fig'] },
  ferret: { load: 0.6, cost: 450, space: 'room', exam: 85, insure: 0, fee: 80, banned: ['nz', 'pr'], names: ['Bandit', 'Noodle', 'Weasel', 'Tumble'] },
  budgie: { load: 0.3, cost: 180, space: 'small', exam: 60, insure: 0, fee: 20, names: ['Pippin', 'Sky', 'Chirp', 'Lemon', 'Bluebell'] },
  fish: { load: 0.15, cost: 120, space: 'small', exam: 0, insure: 0, fee: 5, names: ['Bubbles', 'Finn', 'Comet', 'Marble', 'Ripple'] },
  horse: { load: 2, cost: 2600, space: 'land', exam: 220, insure: 900, fee: 900, names: ['Juniper', 'Atlas', 'Willow', 'Storm', 'Clementine', 'Sorrel', 'Kestrel', 'Bramble', 'Fable', 'Tempo'] },
  pony: { load: 1.6, cost: 1800, space: 'land', exam: 200, insure: 600, fee: 600, names: ['Pebble', 'Tinker', 'Hobnob', 'Bracken', 'Merrylegs', 'Conker'] },
  donkey: { load: 1.5, cost: 1300, space: 'land', exam: 180, insure: 0, fee: 300, names: ['Dusty', 'Clementine', 'Barnaby', 'Thistle'] },
  chicken: { load: 0.2, cost: 110, space: 'yard', exam: 40, insure: 0, fee: 10, names: ['Henrietta', 'Dot', 'Pepper', 'Marigold', 'Queenie', 'Speckle'] },
  duck: { load: 0.25, cost: 130, space: 'yard', exam: 40, insure: 0, fee: 10, names: ['Puddle', 'Waddle', 'Jemima', 'Drake'] },
  goat: { load: 0.8, cost: 500, space: 'land', exam: 90, insure: 0, fee: 80, names: ['Nettle', 'Billy', 'Clover', 'Gruff', 'Mabel'] },
  sheep: { load: 0.7, cost: 380, space: 'land', exam: 80, insure: 0, fee: 60, names: ['Bo', 'Woolly', 'Bramble', 'Dolly', 'Tup'] },
};
for (const [id, k] of Object.entries(KEEPING)) Object.assign(SPECIES[id], { banned: [], ...k });
/** Rooms, smallest first: what a home offers, and what an animal needs at the least. */
export const SPACES = ['small', 'room', 'yard', 'land'];
/** How an owner can choose to look after an animal day to day. `k` multiplies the yearly cost. */
export const ROUTINES = {
  standard: { name: 'Standard care', blurb: 'Fed, clean, exercised and seen to.', k: 1 },
  enriched: { name: 'Extra enrichment', blurb: 'Better food, more toys, more to do. Good for body and mood.', k: 1.35 },
  senior: { name: 'Senior care', blurb: 'Softer beds, gentler exercise, food for an older body.', k: 1.25 },
};
/** What a vet's surgery offers, with prices in base units before the surgery's own level. */
export const VET_SERVICES = [
  { id: 'wellness', name: 'Yearly check-up', blurb: 'A nose-to-tail look, a weigh-in, and a chance to catch things early.', k: 1 },
  { id: 'vaccination', name: 'Vaccinations', blurb: 'The first course, or this year\'s boosters.', k: 0.7, only: ['dog', 'cat', 'rabbit', 'ferret', 'horse', 'pony', 'donkey'] },
  { id: 'dental', name: 'Dental check and clean', blurb: 'Teeth looked at properly, and cleaned if they need it.', k: 2.4, only: ['dog', 'cat', 'rabbit', 'ferret', 'guinea_pig', 'horse', 'pony', 'donkey'] },
  { id: 'senior', name: 'Senior health screen', blurb: 'Bloods and a longer look, for an animal in later life.', k: 2, senior: true },
];
/** Insurance, where it is sold: what it pays back on illness and injury, never on routine care. */
export const INSURANCE = { deductible: 250, rate: 0.8, yearCap: 6000 };

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
Object.assign(BREEDS, {
  horse: [
    { id: 'crossbred', name: 'Crossbred horse', mix: true, size: 'large', ears: 'up', length: 'short', weight: 20 },
    { id: 'thoroughbred', name: 'Thoroughbred', size: 'large', ears: 'up', length: 'short', coats: ['brown', 'chocolate', 'red', 'grey'], weight: 8 },
    { id: 'quarter', name: 'Quarter Horse', size: 'large', ears: 'up', length: 'short', coats: ['red', 'brown', 'golden'], weight: 8 },
    { id: 'arabian', name: 'Arabian', size: 'medium', ears: 'up', length: 'short', coats: ['grey', 'red', 'brown'], weight: 5 },
    { id: 'warmblood', name: 'Warmblood', size: 'large', ears: 'up', length: 'short', coats: ['brown', 'chocolate', 'black', 'grey'], weight: 6 },
    { id: 'cob', name: 'Cob', size: 'large', ears: 'up', length: 'medium', coats: ['black', 'brown', 'white'], patterns: ['patched', 'socks', 'blaze'], weight: 6 },
  ],
  pony: [
    { id: 'crossbred', name: 'Crossbred pony', mix: true, size: 'small', ears: 'up', length: 'medium', weight: 20 },
    { id: 'welsh', name: 'Welsh Pony', size: 'small', ears: 'up', length: 'medium', coats: ['grey', 'brown', 'red'], weight: 8 },
    { id: 'shetland', name: 'Shetland Pony', size: 'small', ears: 'up', length: 'long', coats: ['black', 'brown', 'cream'], weight: 6 },
    { id: 'connemara', name: 'Connemara', size: 'medium', ears: 'up', length: 'medium', coats: ['grey', 'cream', 'brown'], weight: 5 },
  ],
});
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
  fostered: { label: 'Fostered', glyph: '🧡' },
  placed: { label: 'Found a permanent home', glyph: '🏡' },
  companions: { label: 'Animal friendship', glyph: '🐾' },
  lesson: { label: 'Riding milestone', glyph: '🏇' },
  competition: { label: 'Competition', glyph: '🏆' },
  born: { label: 'Born', glyph: '🌱' },
  emergency: { label: 'Emergency', glyph: '🚑' },
  died: { label: 'Passed away', glyph: '🕯️' },
  memorial: { label: 'Memorial', glyph: '🌿' },
};

// ---------- Riding ----------

/** What a rider is made of. Each is 0–100 and grows with lessons and hours in the saddle. */
export const RIDER_SKILLS = {
  balance: 'Balance', seat: 'Seat', reins: 'Rein contact', handling: 'Handling on the ground', groundwork: 'Groundwork', confidence: 'Confidence', knowledge: 'Horse knowledge',
};
export const RIDER_LEVELS = [[0, 'Beginner'], [25, 'Novice'], [45, 'Intermediate'], [65, 'Advanced'], [85, 'Expert']];
/**
 * Ways of riding. `needs` says which of a rider's skills each one leans on (the weights add up to 1);
 * `horse` says what it asks of the horse's temperament; `hard` marks those an old horse should be spared.
 */
export const DISCIPLINES = {
  hacking: { name: 'Hacking out', blurb: 'Riding out across country for the pleasure of it.', needs: { confidence: 0.4, balance: 0.3, handling: 0.3 }, horse: 'confidence', show: false },
  dressage: { name: 'Dressage', blurb: 'Precision and harmony, on the flat.', needs: { seat: 0.4, reins: 0.4, balance: 0.2 }, horse: 'trainability', show: true },
  jumping: { name: 'Show jumping', blurb: 'A course of fences, against the clock.', needs: { balance: 0.4, confidence: 0.35, seat: 0.25 }, horse: 'confidence', hard: true, show: true },
  eventing: { name: 'Eventing', blurb: 'Dressage, cross-country and show jumping, on one horse.', needs: { balance: 0.3, confidence: 0.3, seat: 0.2, reins: 0.2 }, horse: 'adaptability', hard: true, show: true },
  western: { name: 'Western riding', blurb: 'A loose rein, a deep seat, and a horse that thinks for itself.', needs: { seat: 0.35, reins: 0.25, handling: 0.4 }, horse: 'trainability', show: true },
  endurance: { name: 'Endurance', blurb: 'Long distances, at the horse\'s pace, with a vet check at every stage.', needs: { knowledge: 0.4, balance: 0.3, handling: 0.3 }, horse: 'activity', hard: true, show: true },
};
/** Levels a show class is run at: what a rider must have before entering, the entry fee and the top prize, in base units. */
export const SHOW_LEVELS = {
  intro: { name: 'Introductory', needs: 25, fee: 40, prize: 0, field: [18, 42] },
  novice: { name: 'Novice', needs: 45, fee: 70, prize: 60, field: [35, 62] },
  open: { name: 'Open', needs: 65, fee: 120, prize: 220, field: [55, 86] },
};
/** A year of weekly lessons at a riding school, and a year of livery for one horse, in base units. */
export const LESSON_COST = 1500;
export const LIVERY_COST = 5200;
