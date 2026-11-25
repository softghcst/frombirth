// Music: genres, the positions in a band, and the record labels' kinds. All
// names of acts and labels are made up; genres are real kinds of music.
// GAMEPLAY CONFIGURATION: popularity and dates are stylized, not chart history.

/**
 * Places in a band, and the skill that plays each (data/skills.js: an instrument, or a talent).
 * skill: a skill id whose level counts most; talent: the talent behind it.
 */
export const POSITIONS = {
  vocals: { name: 'Vocalist', skill: 'singing', talent: 'singing' },
  lead_guitar: { name: 'Lead guitarist', skill: 'guitar', talent: 'music' },
  rhythm_guitar: { name: 'Rhythm guitarist', skill: 'guitar', talent: 'music' },
  bass: { name: 'Bassist', skill: 'bass', talent: 'music' },
  drums: { name: 'Drummer', skill: 'drums', talent: 'music' },
  keys: { name: 'Keyboard player', skill: 'piano', talent: 'music' },
  backing: { name: 'Backing vocalist', skill: 'singing', talent: 'singing' },
  rapper: { name: 'Rapper', skill: 'writing', talent: 'music' },
  producer: { name: 'DJ and producer', skill: 'music_theory', talent: 'music' },
  sax: { name: 'Saxophonist', skill: 'saxophone', talent: 'music' },
  trumpet: { name: 'Trumpeter', skill: 'trumpet', talent: 'music' },
  violin: { name: 'Violinist', skill: 'violin', talent: 'music' },
  cello: { name: 'Cellist', skill: 'cello', talent: 'music' },
};

/**
 * Genres. from: the first year it is played; band: usually a band (else usually solo or a group of singers);
 * lineup: a band's usual positions; style: what makes it good (singing, playing, writing, presence);
 * pull: how many people listen, worldwide (1 is ordinary); strong: countries where it is especially big.
 */
const G = (id, name, from, band, lineup, style, pull, strong = []) => ({ id, name, from, band, lineup, style, pull, strong });
const ROCK = ['vocals', 'lead_guitar', 'rhythm_guitar', 'bass', 'drums'];
const PUNK = ['vocals', 'lead_guitar', 'bass', 'drums'];
export const GENRES = [
  G('pop', 'Pop', 1955, false, ['vocals', 'backing', 'backing', 'producer'], { singing: 0.45, presence: 0.35, writing: 0.2 }, 1.5),
  G('rock', 'Rock', 1955, true, ROCK, { playing: 0.4, singing: 0.3, writing: 0.3 }, 1.2, ['us', 'uk']),
  G('punk', 'Punk', 1975, true, PUNK, { presence: 0.4, playing: 0.3, writing: 0.3 }, 0.6, ['uk', 'us']),
  G('pop_punk', 'Pop punk', 1994, true, PUNK, { singing: 0.35, playing: 0.35, writing: 0.3 }, 0.7, ['us']),
  G('hardcore', 'Hardcore', 1980, true, PUNK, { presence: 0.5, playing: 0.5 }, 0.35, ['us']),
  G('metal', 'Heavy metal', 1970, true, ROCK, { playing: 0.6, singing: 0.2, presence: 0.2 }, 0.7, ['de', 'se', 'fi', 'no', 'us', 'uk']),
  G('death_metal', 'Death metal', 1985, true, ROCK, { playing: 0.75, presence: 0.25 }, 0.3, ['se', 'fi', 'us']),
  G('grunge', 'Grunge', 1988, true, PUNK, { playing: 0.35, singing: 0.3, writing: 0.35 }, 0.6, ['us']),
  G('alternative', 'Alternative rock', 1985, true, ROCK, { playing: 0.35, singing: 0.3, writing: 0.35 }, 0.9),
  G('indie', 'Indie', 1985, true, ['vocals', 'lead_guitar', 'bass', 'drums', 'keys'], { writing: 0.45, playing: 0.3, singing: 0.25 }, 0.8, ['uk']),
  G('emo', 'Emo', 1995, true, PUNK, { singing: 0.4, writing: 0.4, playing: 0.2 }, 0.45, ['us']),
  G('shoegaze', 'Shoegaze', 1988, true, ['vocals', 'lead_guitar', 'rhythm_guitar', 'bass', 'drums'], { playing: 0.6, writing: 0.4 }, 0.25, ['uk']),
  G('ska', 'Ska', 1960, true, ['vocals', 'lead_guitar', 'bass', 'drums', 'sax', 'trumpet'], { playing: 0.5, presence: 0.5 }, 0.35, ['jm', 'uk']),
  G('blues', 'Blues', 1912, true, ['vocals', 'lead_guitar', 'bass', 'drums', 'keys'], { playing: 0.5, singing: 0.5 }, 0.4, ['us']),
  G('jazz', 'Jazz', 1917, true, ['sax', 'trumpet', 'keys', 'bass', 'drums'], { playing: 0.8, writing: 0.2 }, 0.45, ['us', 'fr']),
  G('soul', 'Soul', 1958, false, ['vocals', 'backing', 'keys', 'bass', 'drums', 'sax'], { singing: 0.6, presence: 0.2, playing: 0.2 }, 0.6, ['us']),
  G('funk', 'Funk', 1965, true, ['vocals', 'rhythm_guitar', 'bass', 'drums', 'keys', 'sax'], { playing: 0.6, presence: 0.4 }, 0.45, ['us', 'br']),
  G('disco', 'Disco', 1974, false, ['vocals', 'backing', 'bass', 'drums', 'keys'], { singing: 0.4, presence: 0.4, playing: 0.2 }, 0.6),
  G('rnb', 'R&B', 1945, false, ['vocals', 'backing', 'producer'], { singing: 0.6, presence: 0.25, writing: 0.15 }, 1.1, ['us', 'uk', 'ng']),
  G('hip_hop', 'Hip-hop', 1979, false, ['rapper', 'rapper', 'producer'], { writing: 0.5, presence: 0.35, playing: 0.15 }, 1.4, ['us', 'fr', 'uk', 'de']),
  G('trap', 'Trap', 2005, false, ['rapper', 'producer'], { presence: 0.45, writing: 0.35, playing: 0.2 }, 1.1, ['us']),
  G('drill', 'Drill', 2012, false, ['rapper', 'rapper', 'producer'], { writing: 0.5, presence: 0.5 }, 0.5, ['uk', 'us']),
  G('grime', 'Grime', 2002, false, ['rapper', 'producer'], { writing: 0.55, presence: 0.45 }, 0.4, ['uk']),
  G('electronic', 'Electronic', 1977, false, ['producer', 'vocals'], { playing: 0.7, writing: 0.3 }, 0.9, ['de', 'nl', 'uk']),
  G('house', 'House', 1985, false, ['producer', 'vocals'], { playing: 0.7, presence: 0.3 }, 0.7, ['uk', 'nl', 'za']),
  G('techno', 'Techno', 1988, false, ['producer'], { playing: 0.85, presence: 0.15 }, 0.45, ['de']),
  G('synth_pop', 'Synth-pop', 1979, true, ['vocals', 'keys', 'keys', 'producer'], { singing: 0.4, playing: 0.35, writing: 0.25 }, 0.55, ['uk', 'de']),
  G('lofi', 'Lo-fi', 2015, false, ['producer'], { playing: 0.6, writing: 0.4 }, 0.35, ['jp']),
  G('country', 'Country', 1925, true, ['vocals', 'lead_guitar', 'bass', 'drums', 'violin'], { singing: 0.45, writing: 0.4, playing: 0.15 }, 0.9, ['us', 'ca', 'au']),
  G('folk', 'Folk', 1920, true, ['vocals', 'lead_guitar', 'violin', 'cello'], { writing: 0.5, singing: 0.35, playing: 0.15 }, 0.45, ['ie', 'uk', 'us']),
  G('reggae', 'Reggae', 1968, true, ['vocals', 'rhythm_guitar', 'bass', 'drums', 'keys'], { playing: 0.4, singing: 0.35, writing: 0.25 }, 0.6, ['jm']),
  G('latin_pop', 'Latin pop', 1980, false, ['vocals', 'backing', 'producer'], { singing: 0.5, presence: 0.35, writing: 0.15 }, 1.1, ['mx', 'es', 'co', 'ar', 'br', 'us']),
  G('reggaeton', 'Reggaeton', 2000, false, ['vocals', 'rapper', 'producer'], { presence: 0.5, singing: 0.25, writing: 0.25 }, 1.1, ['pr', 'mx', 'co', 'es']),
  G('afrobeats', 'Afrobeats', 2005, false, ['vocals', 'producer', 'drums'], { singing: 0.4, presence: 0.4, playing: 0.2 }, 0.9, ['ng', 'gh', 'uk']),
  G('kpop', 'K-pop', 1996, false, ['vocals', 'vocals', 'vocals', 'rapper'], { singing: 0.35, presence: 0.45, playing: 0.2 }, 1.0, ['kr', 'jp']),
  G('jpop', 'J-pop', 1990, false, ['vocals', 'backing', 'producer'], { singing: 0.5, presence: 0.4, writing: 0.1 }, 0.6, ['jp']),
  G('gospel', 'Gospel', 1930, false, ['vocals', 'backing', 'backing', 'keys'], { singing: 0.75, presence: 0.25 }, 0.4, ['us', 'ng']),
  G('classical', 'Classical crossover', 1950, false, ['vocals', 'violin', 'cello', 'keys'], { playing: 0.6, singing: 0.4 }, 0.35, ['at', 'de', 'it', 'uk']),
  G('singer_songwriter', 'Singer-songwriter', 1960, false, ['vocals'], { writing: 0.55, singing: 0.45 }, 0.8),
];
export const GENRE_BY_ID = Object.fromEntries(GENRES.map((g) => [g.id, g]));
/** Older saves wrote a genre as a word; this finds the genre it means. */
export const genreOf = (g) => GENRE_BY_ID[g] ?? GENRES.find((x) => x.name.toLowerCase() === String(g ?? '').toLowerCase())
  ?? { 'r&b': GENRE_BY_ID.rnb, 'hip-hop': GENRE_BY_ID.hip_hop, 'classical crossover': GENRE_BY_ID.classical }[String(g ?? '').toLowerCase()] ?? GENRE_BY_ID.pop;
export const genresIn = (year) => GENRES.filter((g) => year >= g.from);

/** Kinds of record label: majors sign everything; independents keep to a sound. */
export const LABEL_KINDS = {
  major: { name: 'A major label', royalty: [0.14, 0.2], advance: 1.4, albums: [3, 4], reach: 2.2 },
  indie: { name: 'An independent label', royalty: [0.18, 0.26], advance: 0.6, albums: [1, 2], reach: 1.3 },
};
/** Families of genre an independent label might keep to. */
export const LABEL_SOUNDS = [
  ['rock', 'alternative', 'grunge', 'blues'], ['punk', 'pop_punk', 'hardcore', 'emo'], ['metal', 'death_metal', 'hardcore'], ['indie', 'alternative', 'shoegaze', 'grunge'],
  ['hip_hop', 'trap', 'drill', 'grime'], ['electronic', 'house', 'techno', 'synth_pop', 'lofi'], ['soul', 'rnb', 'funk', 'gospel', 'disco'],
  ['country', 'folk', 'singer_songwriter', 'blues'], ['jazz', 'blues', 'classical'], ['latin_pop', 'reggaeton'], ['reggae', 'ska', 'afrobeats'], ['kpop', 'jpop', 'pop'],
];
export const LABEL_SOUND_WORDS = { rock: 'Amplifier', punk: 'Riot', metal: 'Iron', indie: 'Paper', hip_hop: 'Block', electronic: 'Pulse', soul: 'Velvet', country: 'Dust', jazz: 'Midnight', latin_pop: 'Sol', reggae: 'Palm', kpop: 'Starling' };
/** How many openings, auditions and demos a year. */
export const BAND_SEARCH = { openings: 8, auditions: 3, demos: 2 };

/**
 * The styles within each genre, chosen for each record: they shade how a record lands (a style that is in fashion
 * helps a little), never the act's genre itself, which a career keeps.
 */
export const SUBGENRES = {
  pop: ['Bubblegum', 'Dance-pop', 'Electropop', 'Power ballad', 'Teen pop', 'Psychedelic pop', 'Sing-along'],
  rock: ['Classic rock', 'Hard rock', 'Southern rock', 'Rock and roll', 'Arena rock', 'Garage rock'],
  punk: ['Street punk', 'Art punk', 'Folk punk', 'Dance-punk'], pop_punk: ['Skate punk', 'Easycore', 'Pop punk anthem'],
  hardcore: ['Melodic hardcore', 'Beatdown', 'Post-hardcore'], metal: ['Thrash', 'Power metal', 'Doom', 'Alternative metal'],
  death_metal: ['Melodic death metal', 'Technical death metal', 'Brutal death metal'], grunge: ['Post-grunge', 'Sludge', 'Seattle sound'],
  alternative: ['Alternative metal', 'New wave', 'Britpop', 'College rock'], indie: ['Indie folk', 'Indie pop', 'Dream pop', 'Bedroom pop'],
  emo: ['Midwest emo', 'Emo pop', 'Screamo', 'Emo rap'], shoegaze: ['Dream pop', 'Blackgaze', 'Nu-gaze'], ska: ['Two-tone', 'Ska punk', 'Rocksteady'],
  blues: ['Delta blues', 'Chicago blues', 'Hill country blues', 'Contemporary blues'], jazz: ['Smooth jazz', 'Bebop', 'Fusion', 'Swing', 'Ragtime'],
  soul: ['Motown', 'Northern soul', 'Neo-soul', 'Southern soul'], funk: ['P-funk', 'Boogie', 'Groove', 'Funk rock'], disco: ['Nu-disco', 'Italo disco', 'Euro disco'],
  rnb: ['Contemporary R&B', 'New jack swing', 'Quiet storm', 'Doo-wop', 'Alternative R&B'],
  hip_hop: ['Old-school', 'Conscious rap', 'Gangsta rap', 'West Coast', 'Dirty South', 'Boom bap', 'Alternative rap'],
  trap: ['Mumble rap', 'Melodic trap', 'Rage', 'Crunk'], drill: ['UK drill', 'Brooklyn drill', 'Chicago drill'], grime: ['Road rap', 'Instrumental grime', 'Grime anthem'],
  electronic: ['Electro', 'Drum and bass', 'Dubstep', 'Ambient'], house: ['Deep house', 'Tech house', 'Progressive house'], techno: ['Detroit techno', 'Minimal', 'Industrial techno'],
  synth_pop: ['Synthwave', 'Electroclash', 'New romantic'], lofi: ['Lo-fi hip-hop', 'Chillhop', 'Bedroom lo-fi'],
  country: ['Bluegrass', 'Honky-tonk', 'Outlaw country', 'Country rock', 'Urban cowboy', 'Rockabilly'],
  folk: ['Indie folk', 'Neofolk', 'Progressive folk', 'Folk punk', 'Traditional'], reggae: ['Roots reggae', 'Dancehall', 'Dub', 'Reggae fusion', 'Lovers rock'],
  latin_pop: ['Latin ballad', 'Tropical pop', 'Bachata pop', 'Salsa pop'], reggaeton: ['Dembow', 'Perreo', 'Latin trap', 'Romantic reggaeton'],
  afrobeats: ['Afro-pop', 'Amapiano', 'Afro-fusion', 'Highlife'], kpop: ['Ballad', 'Bubblegum', 'Girl crush', 'Hip-hop idol', 'Retro'],
  jpop: ['City pop', 'Anime song', 'Kawaii metal', 'Kayōkyoku'], gospel: ['Hymn', 'Praise', 'Contemporary worship', 'Spiritual', 'Gospel choir'],
  classical: ['Popera', 'Neoclassical', 'Film score', 'Cinematic'], singer_songwriter: ['Acoustic', 'Confessional', 'Folk-pop', 'Piano ballad'],
};
export const subgenresOf = (genreId) => SUBGENRES[genreId] ?? ['Mainstream', 'Experimental', 'Acoustic'];
