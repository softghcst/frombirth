// The K-pop idol industry, for Pathways. Every agency, label, show, program,
// group and song here is fictional. The structure follows the real industry in
// broad outline (agencies with trainee programs, open and online auditions,
// years of training with no promise of debut, survival programs, weekly music
// shows with their own scoring, exclusive contracts), but no term here is a
// statement of any real company's policy.
// GAMEPLAY CONFIGURATION throughout.

/** When each part of the modern idol industry exists, by game year. */
export const KPOP_ERAS = {
  agencies: 1996,     // the modern trainee-and-debut system
  online: 2005,       // video auditions submitted online
  global: 2010,       // casting tours and auditions open to applicants worldwide
  survival: 2009,     // survival programs on television
  globalGroups: 2020, // groups formed for the world market by joint labels
  fanPlatforms: 2015, // official online fan communities and live streams
  fanCalls: 2020,     // video calls with fans
};

/**
 * Agencies and labels. parent: the corporation a label belongs to (a multi-label group). focus: what its training is
 * strongest at. welfare: how seriously it takes rest and health (0–100). trainee: its trainee agreement; artist: its
 * exclusive artist agreement (years; artistShare: the members' share of what remains after costs are recouped).
 */
export const AGENCIES = [
  { id: 'starlit', name: 'Starlit Group', kind: 'parent', countryId: 'kr', city: 'Seoul', founded: 1996, reputation: 88, training: 85, focus: 'vocal',
    concepts: ['bright', 'elegant', 'youthful'], welfare: 70, rap: false,
    trainee: { review: [1, 3], costs: 'covered', allowance: 0, housing: 'dorm' }, artist: { years: 7, artistShare: 0.35, soloAllowed: true } },
  { id: 'starlit_nova', name: 'NOVA Label', kind: 'label', parent: 'starlit', countryId: 'kr', city: 'Seoul', founded: 2012, reputation: 78, training: 80, focus: 'performance',
    concepts: ['dark', 'powerful', 'futuristic'], welfare: 65, rap: true,
    trainee: { review: [1, 2], costs: 'covered', allowance: 300, housing: 'dorm' }, artist: { years: 7, artistShare: 0.4, soloAllowed: true } },
  { id: 'moonrise', name: 'Moonrise Entertainment', kind: 'parent', countryId: 'kr', city: 'Seoul', founded: 1997, reputation: 85, training: 82, focus: 'dance',
    concepts: ['powerful', 'retro', 'bright'], welfare: 55, rap: true,
    trainee: { review: [1, 2], costs: 'covered', allowance: 0, housing: 'dorm' }, artist: { years: 7, artistShare: 0.3, soloAllowed: false } },
  { id: 'blueprint', name: 'Blueprint Music', kind: 'parent', countryId: 'kr', city: 'Seoul', founded: 2001, reputation: 70, training: 72, focus: 'rap',
    concepts: ['rnb', 'experimental', 'dark'], welfare: 75, rap: true,
    trainee: { review: [1, 3], costs: 'covered', allowance: 200, housing: 'home' }, artist: { years: 5, artistShare: 0.5, soloAllowed: true } },
  { id: 'daybreak', name: 'Daybreak Entertainment', kind: 'parent', countryId: 'kr', city: 'Seoul', founded: 2005, reputation: 62, training: 65, focus: 'balanced',
    concepts: ['youthful', 'bright', 'retro'], welfare: 50, rap: true,
    trainee: { review: [1, 2], costs: 'covered', allowance: 0, housing: 'dorm' }, artist: { years: 7, artistShare: 0.3, soloAllowed: false } },
  { id: 'prism', name: 'Prism Creative', kind: 'parent', countryId: 'kr', city: 'Seoul', founded: 2010, reputation: 55, training: 60, focus: 'songwriting',
    concepts: ['minimalist', 'experimental', 'elegant'], welfare: 80, rap: false,
    trainee: { review: [2, 3], costs: 'covered', allowance: 150, housing: 'home' }, artist: { years: 5, artistShare: 0.5, soloAllowed: true } },
  { id: 'horizon', name: 'Starlit × Horizon Records', kind: 'joint', parent: 'starlit', countryId: 'us', city: 'Los Angeles', founded: 2020, reputation: 80, training: 82, focus: 'global',
    concepts: ['bright', 'elegant', 'powerful'], welfare: 70, rap: true, global: true,
    trainee: { review: [1, 2], costs: 'covered', allowance: 400, housing: 'dorm' }, artist: { years: 5, artistShare: 0.4, soloAllowed: true } },
];
export const AGENCY_BY_ID = Object.fromEntries(AGENCIES.map((a) => [a.id, a]));

/** Training focuses a trainee can choose for the year, and what each builds. */
export const FOCUSES = {
  balanced: { name: 'A bit of everything', builds: { vocal: 3, dance: 3, rap: 1, stage: 2, korean: 2, media: 1 } },
  vocal: { name: 'Vocals', builds: { vocal: 7, stage: 1 } },
  dance: { name: 'Dance', builds: { dance: 7, stage: 1 } },
  rap: { name: 'Rap', builds: { rap: 7, stage: 1 } },
  stage: { name: 'Stage and camera', builds: { stage: 5, camera: 4 } },
  korean: { name: 'Korean', builds: { korean: 8 } },
  media: { name: 'Media training', builds: { media: 6, camera: 2 } },
};

/** Original concepts a group can take on. */
export const CONCEPTS = {
  bright: 'Bright and energetic', elegant: 'Elegant pop', dark: 'Dark and dramatic', retro: 'Retro', futuristic: 'Futuristic',
  powerful: 'Powerful performance', rnb: 'R&B', experimental: 'Experimental pop', youthful: 'Youthful', minimalist: 'Minimalist',
};

/** Official positions. rank: the specialty's rank (only one per specialty per member). */
export const POSITIONS = {
  main_vocal: { name: 'Main Vocalist', specialty: 'vocal', rank: 'main' },
  lead_vocal: { name: 'Lead Vocalist', specialty: 'vocal', rank: 'lead' },
  sub_vocal: { name: 'Sub-Vocalist', specialty: 'vocal', rank: 'sub' },
  main_dancer: { name: 'Main Dancer', specialty: 'dance', rank: 'main' },
  lead_dancer: { name: 'Lead Dancer', specialty: 'dance', rank: 'lead' },
  main_rapper: { name: 'Main Rapper', specialty: 'rap', rank: 'main' },
  lead_rapper: { name: 'Lead Rapper', specialty: 'rap', rank: 'lead' },
  sub_rapper: { name: 'Sub-Rapper', specialty: 'rap', rank: 'sub' },
  leader: { name: 'Leader', specialty: 'role' },
  visual: { name: 'Visual', specialty: 'image' },
  center: { name: 'Center', specialty: 'stage' },
  all_rounder: { name: 'All-Rounder', specialty: 'versatile' },
  maknae: { name: 'Maknae', specialty: 'age', derived: true },
};
/** Most labels any member displays: one primary, one secondary. */
export const MAX_POSITIONS = 2;

/** Weekly music shows (fictional), each weighing a release's performance its own way. */
export const MUSIC_SHOWS = [
  { id: 'spotlight', name: 'Weekly Spotlight', from: 1998, weights: { digital: 0.4, physical: 0.15, broadcast: 0.3, social: 0, vote: 0.15 } },
  { id: 'starchart', name: 'Star Chart Live', from: 2004, weights: { digital: 0.55, physical: 0.15, broadcast: 0.1, social: 0.1, vote: 0.1 } },
  { id: 'pulse', name: 'Pulse Countdown', from: 2012, weights: { digital: 0.3, physical: 0.15, broadcast: 0.1, social: 0.15, vote: 0.3 } },
  { id: 'encore', name: 'Encore Stage', from: 2009, weights: { digital: 0.25, physical: 0.4, broadcast: 0.15, social: 0.1, vote: 0.1 } },
];
/** Weeks of promotion a comeback gets on the shows. */
export const PROMO_WEEKS = 3;

/** Survival programs (fictional): who runs them and how they choose. */
export const SURVIVAL_FORMATS = [
  { id: 'stardust', name: 'Project Stardust: Global Debut Academy', agency: 'horizon', from: 2021, location: 'us', contestants: 20, slots: 6, voting: 'mixed', judgeWeight: 0.6, global: true },
  { id: 'rising', name: 'Rising Nine', agency: 'moonrise', from: 2009, location: 'kr', contestants: 18, slots: 7, voting: 'fan', judgeWeight: 0.3 },
  { id: 'blueprint_live', name: 'Blueprint: The Final Cut', agency: 'blueprint', from: 2015, location: 'kr', contestants: 16, slots: 5, voting: 'judge', judgeWeight: 0.85 },
];
/** The missions of a season, in order; after the marked ones, the lowest-ranked go home. */
export const MISSIONS = [
  { id: 'dance', name: 'Dance performance', uses: { dance: 0.6, stage: 0.4 }, cutTo: null },
  { id: 'vocal', name: 'Vocal performance', uses: { vocal: 0.7, stage: 0.3 }, cutTo: 0.6 },
  { id: 'group', name: 'Group performance', uses: { dance: 0.3, vocal: 0.3, stage: 0.2, team: 0.2 }, cutTo: null },
  { id: 'concept', name: 'Concept challenge', uses: { stage: 0.4, camera: 0.3, dance: 0.15, vocal: 0.15 }, cutTo: 0.45 },
  { id: 'final', name: 'Final evaluation', uses: { vocal: 0.3, dance: 0.3, stage: 0.25, camera: 0.15 }, cutTo: 'final' },
];
/** How a contestant can approach a mission. */
export const APPROACHES = {
  steady: { name: 'Play it safe', bonus: 0, spread: 4, team: 0 },
  ambitious: { name: 'Go for something difficult', bonus: 4, spread: 14, team: 0 },
  team: { name: 'Lift your team', bonus: 1, spread: 6, team: 6 },
};

/** Ending-fairy styles for the last close-up of a stage. fits: concepts it suits. */
export const FAIRY_STYLES = {
  cute: { name: 'Cute and playful', fits: ['bright', 'youthful', 'retro'] },
  confident: { name: 'Confident and charismatic', fits: ['powerful', 'dark', 'futuristic'] },
  elegant: { name: 'Elegant and mysterious', fits: ['elegant', 'dark', 'minimalist', 'rnb'] },
  funny: { name: 'Funny and memorable', fits: ['bright', 'youthful', 'experimental'] },
  natural: { name: 'Natural and relaxed', fits: ['minimalist', 'rnb', 'elegant', 'bright'] },
};

/** Release kinds and what they hold. */
export const RELEASE_KINDS = {
  digital_single: { name: 'Digital single', songs: 1, cost: 60000 },
  single_album: { name: 'Single album', songs: 2, cost: 120000 },
  mini: { name: 'Mini album', songs: 5, cost: 250000 },
  full: { name: 'Full album', songs: 10, cost: 450000 },
};

/** Fictional award ceremonies at the end of the year. */
export const KPOP_AWARDS = { id: 'golden_wave', name: 'Golden Wave Music Awards', from: 2000, categories: ['rookie', 'performance', 'song', 'grand'] };

/** Words for group, song and fandom names. */
export const GROUP_WORDS = ['LUMEN', 'NOVA', 'ORBIT', 'VELA', 'AURA', 'ECLIPSE', 'HALO', 'SOLARA', 'PRISM', 'ZENITH', 'KAIRO', 'ODYSSEY', 'IRIS', 'TEMPO', 'ASTRA', 'VERVE', 'NOIR', 'BLOOM'];
export const SONG_WORDS = { a: ['Midnight', 'Electric', 'Paper', 'Golden', 'Silver', 'Starlight', 'Velvet', 'Neon', 'Crystal', 'Summer', 'Wild', 'Echo'], b: ['Heart', 'Signal', 'Runway', 'Dream', 'Rush', 'Bloom', 'Wave', 'Code', 'Fever', 'Mirror', 'Sky', 'Pulse'] };
export const FANDOM_WORDS = ['Lumi', 'Orbiters', 'Halos', 'Blooms', 'Wavers', 'Stars', 'Sparks', 'Petals', 'Comets', 'Echoes'];
