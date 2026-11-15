// Face shapes. Each is one closed path on the shared template (see
// ../template.js): the skull top sits at y=17 and the eyes at y=47, so
// swapping a face never moves the features.
// `jaw` is the y of the chin; beards and the neck shadow use it.
// IDs are saved in characters: never rename or remove one, only add.
export const FACES = [
  { id: 'oval', name: 'Oval', jaw: 79,
    d: 'M50 17C65 17 73.5 29 73.5 46C73.5 62 64 79 50 79C36 79 26.5 62 26.5 46C26.5 29 35 17 50 17Z' },
  { id: 'round', name: 'Round', jaw: 77.5,
    d: 'M50 17.5C67 17.5 76 30 76 47C76 65 65 77.5 50 77.5C35 77.5 24 65 24 47C24 30 33 17.5 50 17.5Z' },
  { id: 'square', name: 'Square', jaw: 78,
    d: 'M50 17C66 17 74.5 28 74.5 44L74 61C73.5 71 65 77 56 78L44 78C35 77 26.5 71 26 61L25.5 44C25.5 28 34 17 50 17Z' },
  { id: 'heart', name: 'Heart', jaw: 80.5,
    d: 'M50 17C68 17 76.5 28 76.5 42C76.5 55 67 67 57 76.5Q50 82.5 43 76.5C33 67 23.5 55 23.5 42C23.5 28 32 17 50 17Z' },
  { id: 'long', name: 'Long', jaw: 82,
    d: 'M50 16C64 16 72 28 72 45C72 63 64 82 50 82C36 82 28 63 28 45C28 28 36 16 50 16Z' },
  { id: 'diamond', name: 'Diamond', jaw: 80,
    d: 'M50 17C62 17 70 26 72 38Q76 46 73 54C70 66 60 76 54 79Q50 81.5 46 79C40 76 30 66 27 54Q24 46 28 38C30 26 38 17 50 17Z' },
];
