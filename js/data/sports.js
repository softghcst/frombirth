// The sports a character can play. One registry for every sport; the engine
// (engine/sports.js) reads it and never names a sport itself.
//
// GAMEPLAY CONFIGURATION. Founding years and the year a sport could be played
// for money are rounded, documented assumptions for this game, not a history.
// Every league, club, tour and rating in Pathways is invented. The Pathways
// Rating (PR) is the game's own measure and is not any real federation's rating.
//
//   kind      'team' | 'racket' (singles and doubles) | 'golf' | 'race' (timed or measured) | 'judged' | 'combat' | 'fitness'
//   adapter   how a competition is scored: 'goals' | 'points' | 'baseball' | 'cricket' | 'sets' (tennis) | 'rally' (games to a
//             set number of points) | 'strokes' | 'time' | 'judged' | 'bouts'
//   skills    the sport's own skills, [id, name]. A fast runner is not a good tennis player: each is learned separately.
//   attrs     which of the character's general attributes help, and how much (paths into the character; weights add up to 1)
//   positions team sports: [id, name, {skill: weight}] the skills a position leans on
//   founded   the first year it can be played in the game     proFrom  the first year anyone can be paid to play it
//   pro       how a player turns professional: 'draft' | 'signing' (a club signs them) | 'tour' (prize money and rankings) | 'none'
//   draftIn   countries where 'draft' applies; elsewhere the sport uses `proElse` (default 'signing')
//   college   countries where universities run competitive teams with recruiting and scholarships
//   popular   countries where it is a leading sport (more clubs, bigger leagues, better pay)
//   season    team sports: games in a regular season
//   lesson    a year of lessons or club fees, base units      kit  equipment, base units
//   contact   0–3, how often it injures                         minAge  youngest age to begin
//   adaptive  { of, needs } a sport adapted for a disability: `needs` is what a player must have (e.g. 'wheelchair')
//   standing  false where a sport cannot be played from a wheelchair in its usual form
//   events    race sports: [id, name, unit, best, beginner] best is a strong competitive mark, beginner a first attempt
//   womenProFrom  the first year women could be paid to play it, where later than proFrom (null: no women's professional
//             play at all); womenProUntil  the last year of a women's professional league that closed (and none after)
//   mixed     women and men play together at every level (otherwise every org above recreational play has a division)
//   depth     'full' where the engine models it in detail; 'standard' uses the shared adapters only
const S = (id, name, kind, adapter, o) => ({ id, name, kind, adapter, depth: 'standard', minAge: 5, contact: 1, lesson: 400, kit: 150,
  founded: 1800, proFrom: 1900, pro: 'signing', standing: true, popular: [], college: [], ...o });
const k = (...ids) => ids;

export const SPORTS_LIST = [
  // ---------- Team sports ----------
  S('soccer', 'Soccer', 'team', 'goals', { womenProFrom: 1989, depth: 'full', founded: 1863, proFrom: 1885, contact: 2, season: 14, lesson: 350, kit: 120,
    skills: [['passing', 'Passing'], ['dribbling', 'Dribbling'], ['shooting', 'Shooting'], ['defending', 'Defending'], ['positioning', 'Positioning'], ['goalkeeping', 'Goalkeeping']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.3, 'stats.intellect': 0.1, 'hidden.discipline': 0.15 },
    positions: [['gk', 'Goalkeeper', { goalkeeping: 0.7, positioning: 0.3 }], ['def', 'Defender', { defending: 0.5, positioning: 0.3, passing: 0.2 }],
      ['mid', 'Midfielder', { passing: 0.4, dribbling: 0.2, positioning: 0.2, defending: 0.2 }], ['fwd', 'Forward', { shooting: 0.5, dribbling: 0.3, positioning: 0.2 }]],
    popular: k('uk', 'es', 'it', 'de', 'fr', 'br', 'ar', 'mx', 'nl', 'pt', 'ng', 'gh', 'tr', 'co', 'uy', 'be', 'hr', 'cl'), college: k('us', 'ca'), teamSize: 11 }),
  S('basketball', 'Basketball', 'team', 'points', { womenProFrom: 1978, founded: 1891, proFrom: 1946, contact: 2, season: 16, pro: 'draft', draftIn: k('us'),
    skills: [['shooting', 'Shooting'], ['handling', 'Ball handling'], ['passing', 'Passing'], ['defense', 'Defense'], ['rebounding', 'Rebounding'], ['awareness', 'Court awareness']],
    attrs: { 'talents.sports': 0.5, 'stats.health': 0.3, 'stats.intellect': 0.1, 'hidden.discipline': 0.1 },
    positions: [['guard', 'Guard', { handling: 0.35, shooting: 0.3, passing: 0.25, awareness: 0.1 }], ['forward', 'Forward', { shooting: 0.35, rebounding: 0.25, defense: 0.25, handling: 0.15 }],
      ['center', 'Center', { rebounding: 0.4, defense: 0.4, shooting: 0.2 }]],
    popular: k('us', 'es', 'lt', 'rs', 'gr', 'ph', 'au', 'cn', 'tr', 'ar'), college: k('us', 'ca'), teamSize: 5 }),
  S('baseball', 'Baseball', 'team', 'baseball', { womenProFrom: 1943, womenProUntil: 1954, founded: 1845, proFrom: 1869, season: 20, pro: 'draft', draftIn: k('us', 'ca', 'jp', 'kr'), lesson: 450, kit: 250,
    skills: [['contact', 'Contact'], ['power', 'Power'], ['discipline', 'Plate discipline'], ['fielding', 'Fielding'], ['throwing', 'Throwing'], ['baserunning', 'Baserunning'],
      ['control', 'Pitching control'], ['stuff', 'Pitch quality'], ['stamina', 'Pitching stamina']],
    attrs: { 'talents.sports': 0.5, 'stats.health': 0.2, 'stats.intellect': 0.15, 'hidden.discipline': 0.15 },
    positions: [['pitcher', 'Pitcher', { control: 0.35, stuff: 0.4, stamina: 0.25 }], ['catcher', 'Catcher', { fielding: 0.4, throwing: 0.3, contact: 0.3 }],
      ['infield', 'Infielder', { fielding: 0.35, throwing: 0.2, contact: 0.3, baserunning: 0.15 }], ['outfield', 'Outfielder', { power: 0.3, contact: 0.3, fielding: 0.2, baserunning: 0.2 }]],
    popular: k('us', 'jp', 'kr', 'do', 'cu', 've', 'mx', 'pr', 'tw'), college: k('us', 'ca'), teamSize: 9 }),
  S('softball', 'Softball', 'team', 'baseball', { womenProFrom: 1997, founded: 1887, proFrom: 1997, season: 18, lesson: 400, kit: 220,
    skills: [['contact', 'Contact'], ['power', 'Power'], ['discipline', 'Plate discipline'], ['fielding', 'Fielding'], ['throwing', 'Throwing'], ['baserunning', 'Baserunning'],
      ['control', 'Pitching control'], ['stuff', 'Pitch quality'], ['stamina', 'Pitching stamina']],
    attrs: { 'talents.sports': 0.5, 'stats.health': 0.2, 'stats.intellect': 0.15, 'hidden.discipline': 0.15 },
    positions: [['pitcher', 'Pitcher', { control: 0.35, stuff: 0.4, stamina: 0.25 }], ['infield', 'Infielder', { fielding: 0.35, throwing: 0.2, contact: 0.3, baserunning: 0.15 }],
      ['outfield', 'Outfielder', { power: 0.3, contact: 0.3, fielding: 0.2, baserunning: 0.2 }]],
    popular: k('us', 'jp', 'au'), college: k('us'), teamSize: 9 }),
  S('american_football', 'American football', 'team', 'points', { womenProFrom: null, founded: 1869, proFrom: 1920, contact: 3, season: 12, pro: 'draft', draftIn: k('us'), minAge: 8, kit: 400,
    skills: [['throwing', 'Throwing'], ['catching', 'Catching'], ['running', 'Ball carrying'], ['blocking', 'Blocking'], ['tackling', 'Tackling'], ['reading', 'Reading the play']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.4, 'stats.intellect': 0.1, 'hidden.discipline': 0.05 },
    positions: [['qb', 'Quarterback', { throwing: 0.6, reading: 0.4 }], ['skill', 'Receiver or running back', { catching: 0.4, running: 0.4, reading: 0.2 }],
      ['line', 'Lineman', { blocking: 0.6, tackling: 0.4 }], ['defense', 'Defender', { tackling: 0.5, reading: 0.3, running: 0.2 }]],
    popular: k('us'), college: k('us'), teamSize: 11 }),
  S('volleyball', 'Volleyball', 'team', 'points', { womenProFrom: 1975, founded: 1895, proFrom: 1975, season: 16,
    skills: [['serving', 'Serving'], ['passing', 'Passing'], ['setting', 'Setting'], ['attacking', 'Attacking'], ['blocking', 'Blocking'], ['digging', 'Digging']],
    attrs: { 'talents.sports': 0.5, 'stats.health': 0.3, 'stats.intellect': 0.1, 'hidden.discipline': 0.1 },
    positions: [['setter', 'Setter', { setting: 0.6, passing: 0.2, serving: 0.2 }], ['outside', 'Outside hitter', { attacking: 0.5, passing: 0.3, serving: 0.2 }],
      ['middle', 'Middle blocker', { blocking: 0.6, attacking: 0.4 }], ['libero', 'Libero', { digging: 0.6, passing: 0.4 }]],
    popular: k('br', 'it', 'pl', 'jp', 'us', 'tr', 'ru', 'cn'), college: k('us', 'ca'), teamSize: 6 }),
  S('ice_hockey', 'Ice hockey', 'team', 'goals', { womenProFrom: 2015, founded: 1875, proFrom: 1910, contact: 3, season: 16, pro: 'draft', draftIn: k('us', 'ca'), kit: 500, lesson: 700,
    skills: [['skating', 'Skating'], ['stickhandling', 'Stickhandling'], ['shooting', 'Shooting'], ['checking', 'Checking'], ['positioning', 'Positioning'], ['goaltending', 'Goaltending']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.35, 'stats.intellect': 0.1, 'hidden.discipline': 0.1 },
    positions: [['goalie', 'Goaltender', { goaltending: 0.7, positioning: 0.3 }], ['defense', 'Defenseman', { checking: 0.4, positioning: 0.3, skating: 0.3 }],
      ['forward', 'Forward', { shooting: 0.35, stickhandling: 0.35, skating: 0.3 }]],
    popular: k('ca', 'us', 'se', 'fi', 'ru', 'cz', 'sk'), college: k('us', 'ca'), teamSize: 6 }),
  S('cricket', 'Cricket', 'team', 'cricket', { womenProFrom: 2016, founded: 1800, proFrom: 1880, season: 10, kit: 250,
    skills: [['batting', 'Batting'], ['bowling', 'Bowling'], ['fielding', 'Fielding'], ['keeping', 'Wicketkeeping'], ['temperament', 'Temperament']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.2, 'stats.intellect': 0.15, 'hidden.discipline': 0.2 },
    positions: [['batter', 'Batter', { batting: 0.6, temperament: 0.3, fielding: 0.1 }], ['bowler', 'Bowler', { bowling: 0.6, fielding: 0.2, temperament: 0.2 }],
      ['allrounder', 'All-rounder', { batting: 0.4, bowling: 0.4, fielding: 0.2 }], ['keeper', 'Wicketkeeper', { keeping: 0.6, batting: 0.4 }]],
    popular: k('in', 'pk', 'au', 'uk', 'nz', 'za', 'bd', 'jm'), teamSize: 11 }),
  S('rugby', 'Rugby', 'team', 'points', { womenProFrom: 2017, founded: 1845, proFrom: 1995, contact: 3, season: 12, minAge: 7,
    skills: [['running', 'Running with the ball'], ['passing', 'Passing'], ['kicking', 'Kicking'], ['tackling', 'Tackling'], ['scrummaging', 'Set piece'], ['awareness', 'Game sense']],
    attrs: { 'talents.sports': 0.4, 'stats.health': 0.45, 'stats.intellect': 0.1, 'hidden.discipline': 0.05 },
    positions: [['forward', 'Forward', { scrummaging: 0.4, tackling: 0.4, running: 0.2 }], ['back', 'Back', { running: 0.35, passing: 0.3, kicking: 0.2, awareness: 0.15 }]],
    popular: k('nz', 'za', 'uk', 'ie', 'fr', 'au', 'ar', 'fj', 'ws'), teamSize: 15 }),

  // ---------- Racket sports (singles and doubles) ----------
  S('tennis', 'Tennis', 'racket', 'sets', { womenProFrom: 1970, depth: 'full', founded: 1874, proFrom: 1926, pro: 'tour', lesson: 900, kit: 200, minAge: 5,
    skills: [['serve', 'Serve'], ['forehand', 'Forehand'], ['backhand', 'Backhand'], ['movement', 'Movement'], ['return', 'Return'], ['volley', 'Volley'], ['tactics', 'Tactical awareness']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.3, 'stats.intellect': 0.1, 'hidden.discipline': 0.15 },
    popular: k('us', 'es', 'fr', 'uk', 'au', 'it', 'de', 'rs', 'ch', 'ar'), college: k('us') }),
  S('pickleball', 'Pickleball', 'racket', 'rally', { womenProFrom: 2015, depth: 'full', founded: 1965, proFrom: 2015, pro: 'tour', lesson: 350, kit: 120, minAge: 7, contact: 0, to: 11,
    skills: [['serve', 'Serve'], ['return', 'Return'], ['third', 'Third-shot drop'], ['drive', 'Drive'], ['dink', 'Dinking'], ['reset', 'Reset'], ['volley', 'Volley and counter'],
      ['movement', 'Court movement'], ['positioning', 'Positioning'], ['communication', 'Doubles communication'], ['tactics', 'Decision-making']],
    attrs: { 'talents.sports': 0.35, 'stats.health': 0.2, 'stats.intellect': 0.2, 'hidden.discipline': 0.25 },
    popular: k('us', 'ca') }),
  S('badminton', 'Badminton', 'racket', 'rally', { womenProFrom: 1988, founded: 1873, proFrom: 1988, pro: 'tour', to: 21, contact: 0, lesson: 350, kit: 80,
    skills: [['serve', 'Serve'], ['clear', 'Clears and drops'], ['smash', 'Smash'], ['net', 'Net play'], ['movement', 'Footwork'], ['tactics', 'Tactics']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.35, 'stats.intellect': 0.1, 'hidden.discipline': 0.1 },
    popular: k('in', 'id', 'my', 'cn', 'dk', 'jp', 'kr', 'th') }),
  S('table_tennis', 'Table tennis', 'racket', 'rally', { womenProFrom: 1990, founded: 1901, proFrom: 1990, pro: 'tour', to: 11, contact: 0, lesson: 250, kit: 60,
    skills: [['serve', 'Serve'], ['spin', 'Spin'], ['forehand', 'Forehand'], ['backhand', 'Backhand'], ['footwork', 'Footwork'], ['tactics', 'Tactics']],
    attrs: { 'talents.sports': 0.4, 'stats.health': 0.15, 'stats.intellect': 0.2, 'hidden.discipline': 0.25 },
    popular: k('cn', 'jp', 'de', 'kr', 'se') }),

  // ---------- Individual sports ----------
  S('golf', 'Golf', 'golf', 'strokes', { womenProFrom: 1950, founded: 1800, proFrom: 1901, pro: 'tour', lesson: 1200, kit: 900, contact: 0, minAge: 7,
    skills: [['driving', 'Driving'], ['irons', 'Iron play'], ['short', 'Short game'], ['putting', 'Putting'], ['course', 'Course management']],
    attrs: { 'talents.sports': 0.35, 'stats.health': 0.1, 'stats.intellect': 0.25, 'hidden.discipline': 0.3 },
    popular: k('us', 'uk', 'ie', 'au', 'za', 'jp', 'kr'), college: k('us') }),
  S('swimming', 'Swimming', 'race', 'time', { womenProFrom: 1990, founded: 1800, proFrom: 1990, pro: 'signing', lesson: 450, kit: 80, minAge: 4, contact: 0,
    skills: [['technique', 'Stroke technique'], ['starts', 'Starts and turns'], ['speed', 'Speed'], ['endurance', 'Endurance'], ['pacing', 'Pacing']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.4, 'hidden.discipline': 0.15 },
    events: [['free100', '100 m freestyle', 's', 48, 95], ['free400', '400 m freestyle', 's', 228, 480], ['fly100', '100 m butterfly', 's', 52, 110]],
    popular: k('us', 'au', 'cn', 'uk', 'hu', 'jp'), college: k('us', 'ca') }),
  S('track', 'Track and field', 'race', 'time', { womenProFrom: 1980, founded: 1800, proFrom: 1980, pro: 'signing', lesson: 300, kit: 150, minAge: 6,
    skills: [['speed', 'Speed'], ['acceleration', 'Acceleration'], ['endurance', 'Endurance'], ['technique', 'Technique'], ['power', 'Power']],
    attrs: { 'talents.sports': 0.5, 'stats.health': 0.4, 'hidden.discipline': 0.1 },
    events: [['m100', '100 m', 's', 10.1, 14.5], ['m400', '400 m', 's', 45.5, 70], ['m1500', '1500 m', 's', 215, 330], ['long', 'Long jump', 'm', 8.0, 3.8]],
    popular: k('jm', 'ke', 'et', 'us', 'uk', 'ng'), college: k('us', 'ca') }),
  S('running', 'Distance running', 'race', 'time', { womenProFrom: 1981, founded: 1800, proFrom: 1981, pro: 'tour', lesson: 100, kit: 120, minAge: 8, contact: 1,
    skills: [['endurance', 'Endurance'], ['pacing', 'Pacing'], ['speed', 'Speed'], ['resilience', 'Resilience']],
    attrs: { 'talents.sports': 0.35, 'stats.health': 0.5, 'hidden.discipline': 0.15 },
    events: [['k10', '10 km', 's', 1650, 3600], ['half', 'Half marathon', 's', 3700, 7800], ['marathon', 'Marathon', 's', 7800, 16500]],
    popular: k('ke', 'et', 'jp', 'us', 'uk') }),
  S('cycling', 'Cycling', 'race', 'time', { womenProFrom: 1984, founded: 1868, proFrom: 1903, pro: 'signing', lesson: 300, kit: 1200, minAge: 8,
    skills: [['endurance', 'Endurance'], ['climbing', 'Climbing'], ['sprinting', 'Sprinting'], ['handling', 'Bike handling'], ['tactics', 'Race tactics']],
    attrs: { 'talents.sports': 0.35, 'stats.health': 0.5, 'hidden.discipline': 0.15 },
    events: [['tt40', '40 km time trial', 's', 2900, 4800]], popular: k('fr', 'it', 'es', 'be', 'nl', 'co', 'dk') }),
  S('gymnastics', 'Gymnastics', 'judged', 'judged', { womenProFrom: 2000, founded: 1811, proFrom: 2000, pro: 'none', lesson: 900, kit: 100, minAge: 4, contact: 2,
    skills: [['strength', 'Strength'], ['flexibility', 'Flexibility'], ['balance', 'Balance'], ['form', 'Form'], ['difficulty', 'Difficulty'], ['nerve', 'Nerve']],
    attrs: { 'talents.sports': 0.35, 'talents.dance': 0.25, 'stats.health': 0.25, 'hidden.discipline': 0.15 },
    popular: k('us', 'cn', 'ru', 'ro', 'jp', 'uk'), college: k('us') }),
  S('figure_skating', 'Figure skating', 'judged', 'judged', { womenProFrom: 1930, founded: 1850, proFrom: 1930, pro: 'none', lesson: 1500, kit: 400, minAge: 4,
    skills: [['skating', 'Skating skills'], ['jumps', 'Jumps'], ['spins', 'Spins'], ['artistry', 'Artistry'], ['nerve', 'Nerve']],
    attrs: { 'talents.sports': 0.35, 'talents.dance': 0.35, 'stats.health': 0.15, 'hidden.discipline': 0.15 },
    popular: k('jp', 'us', 'ca', 'ru', 'kr', 'fr') }),
  S('martial_arts', 'Martial arts', 'combat', 'bouts', { womenProFrom: 1997, founded: 1800, proFrom: 1993, pro: 'signing', lesson: 500, kit: 120, minAge: 5, contact: 2,
    skills: [['striking', 'Striking'], ['grappling', 'Grappling'], ['defense', 'Defense'], ['conditioning', 'Conditioning'], ['composure', 'Composure']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.35, 'hidden.discipline': 0.2 },
    popular: k('jp', 'kr', 'br', 'th', 'us') }),
  S('boxing', 'Boxing', 'combat', 'bouts', { womenProFrom: 1994, founded: 1800, proFrom: 1880, pro: 'signing', lesson: 450, kit: 150, minAge: 8, contact: 3,
    skills: [['jab', 'Jab'], ['power', 'Punching power'], ['defense', 'Defense'], ['footwork', 'Footwork'], ['conditioning', 'Conditioning'], ['chin', 'Taking a punch']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.4, 'hidden.discipline': 0.15 },
    popular: k('us', 'mx', 'uk', 'ph', 'jp', 'pr', 'ru', 'ua', 'cu') }),
  S('wrestling', 'Wrestling', 'combat', 'bouts', { womenProFrom: 1937, founded: 1800, proFrom: 1900, pro: 'none', lesson: 250, kit: 80, minAge: 7, contact: 2,
    skills: [['takedowns', 'Takedowns'], ['control', 'Control'], ['escapes', 'Escapes'], ['conditioning', 'Conditioning'], ['strategy', 'Strategy']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.4, 'hidden.discipline': 0.15 },
    popular: k('us', 'ir', 'ru', 'tr', 'jp', 'ge'), college: k('us') }),
  S('fitness', 'Recreational fitness', 'fitness', 'time', { mixed: true, founded: 1800, proFrom: 9999, pro: 'none', lesson: 300, kit: 100, minAge: 12, contact: 0,
    skills: [['strength', 'Strength'], ['endurance', 'Endurance'], ['mobility', 'Mobility']],
    attrs: { 'stats.health': 0.6, 'talents.sports': 0.2, 'hidden.discipline': 0.2 }, events: [['k5', '5 km fun run', 's', 1080, 2400]] }),

  // ---------- Adaptive sports ----------
  S('wheelchair_basketball', 'Wheelchair basketball', 'team', 'points', { mixed: true, founded: 1946, proFrom: 1980, season: 14, adaptive: { of: 'basketball', needs: 'wheelchair' }, kit: 1500,
    skills: [['shooting', 'Shooting'], ['chair', 'Chair skills'], ['passing', 'Passing'], ['defense', 'Defense'], ['awareness', 'Court awareness']],
    attrs: { 'talents.sports': 0.5, 'stats.health': 0.3, 'stats.intellect': 0.1, 'hidden.discipline': 0.1 },
    positions: [['guard', 'Guard', { chair: 0.35, passing: 0.35, shooting: 0.3 }], ['forward', 'Forward', { shooting: 0.5, defense: 0.3, chair: 0.2 }]], teamSize: 5 }),
  S('wheelchair_tennis', 'Wheelchair tennis', 'racket', 'sets', { founded: 1976, proFrom: 1992, pro: 'tour', adaptive: { of: 'tennis', needs: 'wheelchair' }, kit: 1500, lesson: 900,
    skills: [['serve', 'Serve'], ['forehand', 'Forehand'], ['backhand', 'Backhand'], ['chair', 'Chair movement'], ['return', 'Return'], ['tactics', 'Tactical awareness']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.3, 'stats.intellect': 0.1, 'hidden.discipline': 0.15 } }),
  S('para_athletics', 'Para athletics', 'race', 'time', { founded: 1952, proFrom: 2000, pro: 'signing', adaptive: { of: 'track', needs: 'wheelchair' }, kit: 2500,
    skills: [['speed', 'Speed'], ['endurance', 'Endurance'], ['technique', 'Racing chair technique'], ['power', 'Power']],
    attrs: { 'talents.sports': 0.5, 'stats.health': 0.4, 'hidden.discipline': 0.1 }, events: [['t100', '100 m wheelchair race', 's', 14, 26], ['t1500', '1500 m wheelchair race', 's', 190, 400]] }),
  S('para_swimming', 'Para swimming', 'race', 'time', { founded: 1960, proFrom: 2000, pro: 'signing', adaptive: { of: 'swimming', needs: 'wheelchair' },
    skills: [['technique', 'Stroke technique'], ['starts', 'Starts and turns'], ['speed', 'Speed'], ['endurance', 'Endurance']],
    attrs: { 'talents.sports': 0.45, 'stats.health': 0.4, 'hidden.discipline': 0.15 }, events: [['free100', '100 m freestyle', 's', 58, 120]] }),
];
// Sports that cannot be played from a wheelchair in their usual form.
for (const id of ['soccer', 'basketball', 'baseball', 'softball', 'american_football', 'volleyball', 'ice_hockey', 'cricket', 'rugby', 'tennis', 'pickleball', 'badminton',
  'track', 'running', 'gymnastics', 'figure_skating', 'martial_arts', 'boxing', 'wrestling']) SPORTS_LIST.find((s) => s.id === id).standing = false;

// Women's professional years are set on each sport above (womenProFrom, womenProUntil).

// ---------- End-of-season awards ----------
//
// Each league names its awards when the season is over (engine/sportsAwards.js). Kinds:
//   best      the most valuable player of the season              rookie   the best in their first season in the league
//   young     the best aged 21 or under                           stat     the most of one statistic (`stat`, `per` = an average)
//   pos       the best at a position (`pos`)                      bench    the best who came off the bench
//   improved  the biggest step up from last season                comeback the best back from a long injury
//   coach     the coach whose team did most beyond what was expected
//   skill     the best at one side of the game (`by`: fielding or hitting), whatever their numbers
//   posTeam   the best at one side of the game at each position (Gold Glove, Silver Slugger): one honor per place
//   final     the most valuable player of the champions' playoff run
//   `low`     a statistic where less is better (an earned run average)
//   team      a team of the season: the best at each position (an honor shared by several)
// `pos` limits who can win; `stat` names a number the game records for the player's own games (sports.js myGame).
const A = (id, name, kind, o = {}) => ({ id, name, kind, ...o });
const TEAM_DEFAULT = [A('mvp', 'Most Valuable Player', 'best'), A('rookie', 'Rookie of the Year', 'rookie'), A('improved', 'Most Improved Player', 'improved'),
  A('coach', 'Coach of the Year', 'coach'), A('team', 'All-League First Team', 'team')];
export const SEASON_AWARDS = {
  soccer: [A('mvp', 'Player of the Season', 'best'), A('young', 'Young Player of the Season', 'young'), A('boot', 'Golden Boot', 'stat', { stat: 'goals', pos: ['fwd', 'mid', 'def'] }),
    A('glove', 'Golden Glove', 'stat', { stat: 'clean', pos: ['gk'] }), A('coach', 'Manager of the Season', 'coach'), A('team', 'Team of the Season', 'team')],
  basketball: [A('mvp', 'Most Valuable Player', 'best'), A('rookie', 'Rookie of the Year', 'rookie'), A('dpoy', 'Defensive Player of the Year', 'stat', { stat: 'rebounds' }),
    A('sixth', 'Sixth Man of the Year', 'bench'), A('improved', 'Most Improved Player', 'improved'), A('scoring', 'Scoring Title', 'stat', { stat: 'points', per: true }),
    A('coach', 'Coach of the Year', 'coach'), A('final', 'Finals MVP', 'final'), A('team', 'All-League First Team', 'team')],
  wheelchair_basketball: [A('mvp', 'Most Valuable Player', 'best'), A('rookie', 'Rookie of the Year', 'rookie'), A('scoring', 'Scoring Title', 'stat', { stat: 'points', per: true }),
    A('team', 'All-League First Team', 'team')],
  american_football: [A('mvp', 'Most Valuable Player', 'best'), A('opoy', 'Offensive Player of the Year', 'pos', { pos: ['qb', 'skill'] }),
    A('dpoy', 'Defensive Player of the Year', 'pos', { pos: ['defense', 'line'] }), A('rookie', 'Rookie of the Year', 'rookie'), A('comeback', 'Comeback Player of the Year', 'comeback'),
    A('coach', 'Coach of the Year', 'coach'), A('final', 'Championship Game MVP', 'final'), A('team', 'All-League Team', 'team')],
  baseball: [A('mvp', 'Most Valuable Player', 'best', { pos: ['catcher', 'infield', 'outfield'] }), A('pitcher', 'Pitcher of the Year', 'pos', { pos: ['pitcher'] }),
    A('reliever', 'Reliever of the Year', 'bench', { pos: ['pitcher'] }), A('rookie', 'Rookie of the Year', 'rookie'),
    A('hitter', 'Hitter of the Year', 'skill', { by: 'hitting', pos: ['catcher', 'infield', 'outfield'] }),
    A('batting', 'Batting Title', 'stat', { stat: 'hits', per: true, pos: ['catcher', 'infield', 'outfield'] }),
    A('homers', 'Home Run Leader', 'stat', { stat: 'homeRuns', pos: ['catcher', 'infield', 'outfield'] }), A('rbi', 'RBI Leader', 'stat', { stat: 'rbi', pos: ['catcher', 'infield', 'outfield'] }),
    A('strikeouts', 'Strikeout Leader', 'stat', { stat: 'strikeouts', pos: ['pitcher'] }), A('era', 'ERA Title', 'stat', { stat: 'era', low: true, pos: ['pitcher'] }),
    A('glove', 'Gold Glove', 'posTeam', { by: 'fielding' }), A('platinum', 'Platinum Glove', 'skill', { by: 'fielding' }),
    A('slugger', 'Silver Slugger', 'posTeam', { by: 'hitting', pos: ['catcher', 'infield', 'outfield'] }),
    A('comeback', 'Comeback Player of the Year', 'comeback'), A('coach', 'Manager of the Year', 'coach'),
    A('final', 'Championship Series MVP', 'final'), A('team', 'All-League Team', 'team')],
  softball: [A('mvp', 'Most Valuable Player', 'best', { pos: ['infield', 'outfield'] }), A('pitcher', 'Pitcher of the Year', 'pos', { pos: ['pitcher'] }),
    A('rookie', 'Rookie of the Year', 'rookie'), A('batting', 'Batting Title', 'stat', { stat: 'hits', per: true, pos: ['infield', 'outfield'] }),
    A('homers', 'Home Run Leader', 'stat', { stat: 'homeRuns', pos: ['infield', 'outfield'] }), A('strikeouts', 'Strikeout Leader', 'stat', { stat: 'strikeouts', pos: ['pitcher'] }),
    A('glove', 'Gold Glove', 'posTeam', { by: 'fielding' }), A('slugger', 'Silver Slugger', 'posTeam', { by: 'hitting', pos: ['infield', 'outfield'] }),
    A('final', 'Championship Series MVP', 'final'), A('team', 'All-League Team', 'team')],
  ice_hockey: [A('mvp', 'Most Valuable Player', 'best'), A('rookie', 'Rookie of the Year', 'rookie'), A('goalie', 'Best Goaltender', 'pos', { pos: ['goalie'] }),
    A('defense', 'Best Defenseman', 'pos', { pos: ['defense'] }), A('scoring', 'Scoring Title', 'stat', { stat: 'points', pos: ['forward', 'defense'] }),
    A('coach', 'Coach of the Year', 'coach'), A('final', 'Playoff MVP', 'final'), A('team', 'All-League First Team', 'team')],
  volleyball: [A('mvp', 'Most Valuable Player', 'best'), A('attacker', 'Best Attacker', 'stat', { stat: 'kills', pos: ['outside', 'middle'] }),
    A('libero', 'Best Libero', 'stat', { stat: 'digs', pos: ['libero'] }), A('setter', 'Best Setter', 'pos', { pos: ['setter'] }), A('rookie', 'Rookie of the Year', 'rookie'),
    A('team', 'All-League Team', 'team')],
  cricket: [A('mvp', 'Player of the Season', 'best'), A('runs', 'Leading Run-Scorer', 'stat', { stat: 'runs', pos: ['batter', 'allrounder', 'keeper'] }),
    A('wickets', 'Leading Wicket-Taker', 'stat', { stat: 'wickets', pos: ['bowler', 'allrounder'] }), A('young', 'Young Cricketer of the Year', 'young'),
    A('team', 'Team of the Season', 'team')],
  rugby: [A('mvp', 'Player of the Season', 'best'), A('tries', 'Top Try Scorer', 'stat', { stat: 'tries' }), A('young', 'Young Player of the Season', 'young'),
    A('coach', 'Coach of the Season', 'coach'), A('team', 'Team of the Season', 'team')],
};
/** A team of the season is a side: how many at each position, as the sport lines up. */
/** Which skills make a fielder and a hitter, for the awards that judge one side of the game. */
export const AWARD_SKILLS = { fielding: { fielding: 0.7, throwing: 0.3 }, hitting: { contact: 0.4, power: 0.4, discipline: 0.2 } };
export const AWARD_LINEUPS = {
  soccer: { gk: 1, def: 4, mid: 4, fwd: 2 }, basketball: { guard: 2, forward: 2, center: 1 }, wheelchair_basketball: { guard: 2, forward: 3 },
  baseball: { pitcher: 1, catcher: 1, infield: 4, outfield: 3 }, softball: { pitcher: 1, infield: 5, outfield: 3 },
  american_football: { qb: 1, skill: 4, line: 5, defense: 11 }, ice_hockey: { goalie: 1, defense: 2, forward: 3 },
  volleyball: { setter: 1, outside: 2, middle: 2, libero: 1 }, cricket: { batter: 5, bowler: 4, allrounder: 1, keeper: 1 }, rugby: { forward: 8, back: 7 },
};
/** University leagues name two of them differently. */
export const COLLEGE_NAMES = { mvp: 'Player of the Year', rookie: 'Freshman of the Year', young: 'Freshman of the Year', coach: 'Coach of the Year' };
/** Individual sports: a year's honors on the tour or in national competition. */
export const YEAR_AWARDS = [A('poy', 'Player of the Year', 'best'), A('newcomer', 'Newcomer of the Year', 'rookie'), A('comeback', 'Comeback Player of the Year', 'comeback')];
/** Awards a league gives: its own list, or the usual one. */
export const awardsFor = (sport) => SEASON_AWARDS[sport.id] ?? TEAM_DEFAULT;

/** The international games for individual sports, every four years, from the first modern games. */
export const WORLD_GAMES = { name: 'World Games', founded: 1896, every: 4 };
export const isGamesYear = (y) => y >= WORLD_GAMES.founded && y % WORLD_GAMES.every === 0;
/** What a finish at the games is worth: a medal for the first three, whichever way the event is decided. */
export const MEDAL_FOR = { Champion: 'gold', Final: 'silver', '2nd': 'silver', Semifinal: 'bronze', '3rd': 'bronze' };

export const SPORTS = Object.fromEntries(SPORTS_LIST.map((s) => [s.id, s]));
export const sportOf = (id) => SPORTS[id] ?? null;

/** Training plans: how the year's practice is spent. `hours` a week; `fatigue` added per hour; `focus` which kind of skill grows faster. */
export const PLANS = {
  balanced: { name: 'Balanced training', blurb: 'A bit of everything.', focus: null, k: 1 },
  technical: { name: 'Technical development', blurb: 'Skills and technique, rep after rep.', focus: 'technical', k: 1.05 },
  conditioning: { name: 'Conditioning', blurb: 'Fitness, strength and speed.', focus: 'physical', k: 0.95, health: 2 },
  tactical: { name: 'Tactical development', blurb: 'Reading the game, decisions, positioning.', focus: 'mental', k: 1 },
  competition: { name: 'Competition preparation', blurb: 'Sharpening up for the events that matter.', focus: null, k: 0.9, form: 6 },
  recovery: { name: 'Recovery', blurb: 'Lighter work, rest, and rebuilding.', focus: null, k: 0.4, recovery: true },
};
/** How much time goes into it, hours a week. */
export const LOADS = [
  { hours: 2, name: 'Now and then', blurb: 'A couple of hours a week.' },
  { hours: 5, name: 'Regularly', blurb: 'A few sessions a week.' },
  { hours: 10, name: 'Seriously', blurb: 'Most days.' },
  { hours: 18, name: 'Like a professional', blurb: 'Twice a day. Only sustainable with rest built in.' },
];
/** Which skills count as which kind, for the training focus. Anything not listed is technical. */
export const SKILL_KIND = {
  physical: ['movement', 'speed', 'endurance', 'stamina', 'power', 'acceleration', 'strength', 'conditioning', 'skating', 'chair', 'running', 'flexibility', 'resilience', 'climbing', 'sprinting', 'mobility'],
  mental: ['tactics', 'positioning', 'awareness', 'reading', 'discipline', 'course', 'pacing', 'temperament', 'composure', 'strategy', 'communication', 'nerve'],
};

/** Levels of organized sport, lowest first. */
export const LEVELS = ['recreational', 'club', 'school', 'academy', 'college', 'pro'];
export const LEVEL_NAMES = { recreational: 'Recreational', club: 'Club', school: 'School', academy: 'Academy', college: 'University', pro: 'Professional' };

/**
 * Sports injuries. They go into the health record (data/illnesses.js has a matching entry for each), and heal
 * on a rehabilitation plan, not by chance. `seasons` is how much of a year (or years) is missed.
 */
export const INJURIES = {
  strain: { name: 'a muscle strain', severity: 12, seasons: 0.2, skillLoss: 0 },
  sprain: { name: 'a sprained ankle', severity: 15, seasons: 0.3, skillLoss: 0 },
  overuse: { name: 'an overuse injury', severity: 20, seasons: 0.4, skillLoss: 1 },
  fracture: { name: 'a fracture', severity: 35, seasons: 0.6, skillLoss: 2 },
  concussion: { name: 'a concussion', severity: 40, seasons: 0.5, skillLoss: 1, contactOnly: true },
  ligament: { name: 'a torn knee ligament', severity: 60, seasons: 1.2, skillLoss: 5 },
  // A pitcher's elbow: the ulnar collateral ligament, rebuilt by Tommy John surgery; a year or more away.
  ucl: { name: 'a torn elbow ligament', severity: 55, seasons: 1.3, skillLoss: 2, pitcher: true },
};
/** How an injury is treated. Costs are base units. */
export const REHAB = {
  rest: { name: 'Rest and let it heal', cost: 0, speed: 0.8, setback: 0.12 },
  physio: { name: 'See a physiotherapist and follow the plan', cost: 900, speed: 1.15, setback: 0.04 },
  rush: { name: 'Push through and play on', cost: 0, speed: 1.3, setback: 0.4 },
};

/** Sponsors are invented. */
export const SPONSORS = ['Northline Athletic', 'Kestrel Sportswear', 'Brightwater Drinks', 'Summit Timepieces', 'Vela Motors', 'Harbor Bank', 'Ember Nutrition', 'Lark Optics'];
/** Invented words for team and club names; {C} is the city. */
export const TEAM_WORDS = ['Rovers', 'United', 'Athletic', 'City', 'Wanderers', 'Comets', 'Falcons', 'Harriers', 'Lions', 'Royals', 'Pioneers', 'Rangers', 'Storm', 'Thunder', 'Mariners', 'Wolves'];
/**
 * How many teams a league has. Most leagues in the game have 8 (a conference, a regional league, a country's top
 * flight); the big professional leagues of the countries with a draft have their real number of clubs, so the draft has
 * real rounds and picks. Women's leagues there are smaller, as they are.
 */
export const LEAGUE_TEAMS = { baseball: 30, basketball: 30, american_football: 32, ice_hockey: 32 };
export const WOMEN_LEAGUE_TEAMS = { basketball: 12, ice_hockey: 8, softball: 8 };
/**
 * Countries whose players go into another country's draft: Puerto Rico's baseball players have been in the big
 * leagues' draft since 1990, like any player in the United States.
 */
export const DRAFT_VIA = { baseball: { pr: 'us' } };
/** The country whose league drafts players from `countryId` in this sport, or null. */
export const draftCountry = (sport, countryId) => ((sport.draftIn ?? []).includes(countryId) ? countryId : DRAFT_VIA[sport.id]?.[countryId] ?? null);
/** Japan's professional league has 12 clubs, Korea's 10. */
export const COUNTRY_LEAGUE_TEAMS = { jp: { baseball: 12 }, kr: { baseball: 10 } };
export function leagueSize(sport, level, countryId, div = null) {
  if (level !== 'pro' || !(sport.draftIn ?? []).includes(countryId)) return 8;
  if (COUNTRY_LEAGUE_TEAMS[countryId]) return (div === 'women' ? null : COUNTRY_LEAGUE_TEAMS[countryId][sport.id]) ?? 8;
  return (div === 'women' ? WOMEN_LEAGUE_TEAMS[sport.id] : LEAGUE_TEAMS[sport.id]) ?? 8;
}

// ---------- The drafts (where proPath is 'draft') ----------
//
// Each league's own draft, as the real ones are run (the numbers are the real ones as of the mid-2020s):
//   rounds    how many rounds              lottery   the worst `teams` draw for the first `picks` picks
//   rule      who is eligible (engine/draft.js eligible)
//   declare   underclassmen must declare (and lose their college eligibility); `test` they may test the waters and withdraw
//   combine   a combine before the draft, where stock rises and falls
//   deal      'bonus' a signing bonus by the pick's slot · 'scale' a rookie wage scale · 'entry' an entry-level contract
//   minors    the levels below the top league, lowest first (engine/draft.js minorsYear)
export const DRAFTS = {
  baseball: { rounds: 20, lottery: { teams: 18, picks: 6 }, rule: 'baseball', declare: false, combine: true, deal: 'bonus', years: 6,
    minors: ['Rookie ball', 'Single-A', 'High-A', 'Double-A', 'Triple-A'] },
  american_football: { rounds: 7, lottery: null, rule: 'football', declare: true, combine: true, deal: 'scale', years: 4, minors: ['Practice squad'] },
  basketball: { rounds: 2, lottery: { teams: 14, picks: 4 }, rule: 'basketball', declare: true, test: true, combine: true, deal: 'scale', years: 4, minors: ['G League'] },
  ice_hockey: { rounds: 7, lottery: { teams: 16, picks: 2 }, rule: 'hockey', declare: false, combine: true, deal: 'entry', years: 3, minors: ['AHL'], rights: 4 },
};
/**
 * Japan's and Korea's drafts. Japan (NPB, 12 clubs, each October): high school and university players must first file a
 * declaration that they want to turn professional; high school graduates in the industrial (company) leagues are
 * eligible three years on, university graduates two. In the first round every club names a player at once, and where
 * several name the same one, lots are drawn. A drafted player who will not sign goes to university or a company team.
 * Contracts run a year at a time, the club holding the player until free agency (nine seasons to go abroad); before
 * that, the club may post him to the big leagues (engine/asiaBaseball.js). Korea (KBO, 10 clubs, 11 rounds each
 * September): high school and university seniors; posting after seven seasons, and military service before 28.
 */
export const COUNTRY_DRAFTS = {
  jp: { baseball: { name: 'NPB', rounds: 7, lottery: null, bids: true, rule: 'npb', declare: true, combine: false, deal: 'npb', years: 1, minors: ['Farm team'], posting: 3, freeAgency: 9 } },
  kr: { baseball: { name: 'KBO', rounds: 11, lottery: null, rule: 'kbo', declare: false, combine: false, deal: 'kbo', years: 1, minors: ['Futures League'], posting: 7, freeAgency: 9 } },
};
/** The women's leagues' drafts: basketball takes players at 22 or once college is done; hockey after college. */
/** What the big leagues of the draft countries pay, against an ordinary professional league (their real averages run to millions). */
export const BIG_LEAGUE_PAY = { basketball: 6, baseball: 9, american_football: 2.5, ice_hockey: 2.5 };
/** Japan's and Korea's professional baseball pay well, if far less than the big leagues. */
export const COUNTRY_LEAGUE_PAY = { jp: { baseball: 1.8 }, kr: { baseball: 1.3 } };
export const WOMEN_DRAFTS = {
  basketball: { rounds: 3, lottery: { teams: 4, picks: 4 }, rule: 'women', declare: true, combine: false, deal: 'scale', years: 3, minors: [] },
  ice_hockey: { rounds: 7, lottery: null, rule: 'women', declare: true, combine: false, deal: 'entry', years: 2, minors: [] },
};

// ---------- International amateur signings (baseball) ----------
//
// Players from outside the draft countries are not drafted: big league clubs sign them as international amateurs. The
// signing period opens on January 15, and a player may sign once they are 16. Each club has a bonus pool for the year
// (about $5–7.6 million in the mid-2020s). Most of these players come up through a trainer (in the Dominican Republic a
// "buscón") who takes them in at 12 to 14, trains them, often houses and feeds them, shows them to the clubs' scouts, and
// takes a share of the bonus (usually 20–35%). Clubs and players agree handshake deals years early, against the rules and
// binding no one: some fall through. A signed player goes to the club's academy in the Dominican Republic and the
// Dominican Summer League (Venezuela's own summer league closed in 2015), then to the United States and the minors.
// Cuban players must first leave Cuba and settle in a third country; those 23 or over with five seasons in Cuba's top
// league are signed outside the bonus pools, as professionals.
export const INTL_SIGNING = {
  sports: ['baseball'],
  countries: ['do', 've', 'cu', 'mx', 'pa', 'co', 'ni', 'cr', 'aw', 'bs', 'gt', 'sv', 'br', 'au', 'nz', 'za', 'nl', 'it', 'de', 'uk', 'cn', 'ph', 'tw'],
  trainers: ['do', 've', 'pa', 'co', 'ni', 'cu', 'mx', 'cr', 'aw', 'bs'], // where trainers run programs for boys of 12 to 14
  from: 1977, // the year big league clubs began running academies in the Dominican Republic (the Toronto club's first)
  poolsFrom: 2012, // international bonus pools
  pool: [5100000, 7600000],
  cut: [0.2, 0.35],
  ladder: ['Dominican Summer League', 'Rookie ball', 'Single-A', 'High-A', 'Double-A', 'Triple-A'],
};

// ---------- Baseball, in detail (engine/baseball.js, engine/baseballContracts.js) ----------
//
// A season in the game is a sample of a real one: the player's numbers are scaled to the length of the real season at
// their level, so a career adds up to the totals baseball counts (3,000 hits, 500 home runs, 300 wins).
export const BASEBALL = {
  games: { MLB: 162, NPB: 143, KBO: 144, 'Triple-A': 150, 'Double-A': 138, 'High-A': 132, 'Single-A': 132, 'Rookie ball': 60, 'Dominican Summer League': 60,
    'Farm team': 110, 'Futures League': 100, 'Independent League': 100, college: 56, school: 28, other: 30 },
  top: { us: 'MLB', ca: 'MLB', jp: 'NPB', kr: 'KBO' },
  // The rounds of the postseason, as each league names them. The big leagues take twelve clubs: four rest through the
  // wild card round (engine/sports.js playoffs).
  rounds: { MLB: { 'Wild Card': 'Wild Card Series', Quarterfinal: 'Division Series', Semifinal: 'League Championship Series', Final: 'World Series' },
    NPB: { Quarterfinal: 'Climax Series, first stage', Semifinal: 'Climax Series, final stage', Final: 'Japan Series' },
    KBO: { Quarterfinal: 'Semi-playoff', Semifinal: 'Playoff', Final: 'Korean Series' } },
  milestones: { H: [1000, 2000, 3000], HR: [100, 200, 300, 400, 500, 600, 700], W: [100, 200, 300], SV: [100, 300, 500], K: [1000, 2000, 3000] },
  names: { H: 'hits', HR: 'home runs', W: 'wins', SV: 'saves', K: 'strikeouts' },
  // The World Baseball Classic: 2006, 2009, 2013, 2017, 2023, 2026; assumed every four years after that.
  classic: [2006, 2009, 2013, 2017, 2023, 2026],
  classicStrong: ['jp', 'us', 'do', 've', 'pr', 'kr', 'cu', 'mx', 'nl'],
  winter: { do: 'Dominican Winter League', ve: 'Venezuelan Winter League', pr: 'Puerto Rican Winter League', mx: 'Mexican Pacific League', pa: 'Panamanian Winter League', co: 'Colombian Winter League', ni: 'Nicaraguan Winter League' },
  qualifyingOffer: 21000000, // one year, at the average of the 125 best salaries (about $21 million in the mid-2020s)
  minimum: 760000,
  optionYears: 3, // seasons in which a club may send a player on its 40-man roster down to the minors
  rule5: { young: 5, older: 4 }, // seasons before an unprotected minor leaguer can be taken: five if signed at 18 or under, else four
  hall: { wait: 5, ballots: 10, elect: 75, stay: 5, seasons: 10 }, // Hall of Fame: five years retired, ten years on the ballot, 75% to get in, 5% to stay on
  derbyPrize: 1000000,
};

// ---------- College sport (the United States and Canada) ----------
//
// Divisions, as the real ones work: Division I and II give athletic scholarships (II mostly partial ones), Division
// III gives none (aid comes from need and merit), the Ivy-style old universities play Division I but give no athletic
// scholarships either, NAIA colleges give partial ones, and junior colleges (two-year community colleges) give full or
// partial ones and send players on to four-year programs or straight to the draft.
// minGpa: the high school GPA a recruit needs to be eligible as a freshman (core courses; D1 2.3, D2 2.2).
export const DIVISIONS = {
  D1: { name: 'Division I', aid: 'full', minGpa: 2.3, rank: 1 },
  IVY: { name: 'Division I (Ivy)', aid: 'none', minGpa: 2.3, rank: 2 },
  D2: { name: 'Division II', aid: 'partial', minGpa: 2.2, rank: 3 },
  NAIA: { name: 'NAIA', aid: 'partial', minGpa: 2.0, rank: 4 },
  JUCO: { name: 'Junior college', aid: 'full', minGpa: 0, rank: 5 },
  D3: { name: 'Division III', aid: 'none', minGpa: 0, rank: 6 },
};
/**
 * Headcount sports give whole scholarships; the rest (equivalency sports) share a few out among the roster, so most
 * players get part of one (baseball: 11.7 shared by a roster of more than thirty).
 */
export const HEADCOUNT = ['basketball', 'american_football', 'volleyball'];
/** Recruiting stars, from a prospect's grade (see engine/recruiting.js). */
export const STARS = [[80, 5], [71, 4], [62, 3], [53, 2]];

/** Team nicknames, by the kind of names each sport's clubs tend to have (made up; any can be renamed in Settings). */
export const MASCOTS = {
  soccer: ['United', 'City', 'Athletic', 'Rovers', 'Wanderers', 'Albion', 'Town', 'Rangers', 'Harriers', 'Villa', 'Argyle', 'Dynamo', 'Sporting', 'Olympic', 'Victoria', 'Corinthians'],
  basketball: ['Comets', 'Thunder', 'Falcons', 'Storm', 'Blaze', 'Hawks', 'Knights', 'Vipers', 'Rockets', 'Pumas', 'Titans', 'Kings', 'Flyers', 'Jaguars', 'Cyclones', 'Spartans'],
  baseball: ['Bears', 'Owls', 'Mariners', 'Pioneers', 'Stallions', 'Foxes', 'Sentinels', 'Barons', 'Grizzlies', 'Hornets', 'Mustangs', 'Express', 'Miners', 'Sox', 'Captains', 'Skyhawks'],
  american_football: ['Wolves', 'Lions', 'Chargers', 'Stampede', 'Ironmen', 'Buffalo', 'Raiders', 'Wildcats', 'Generals', 'Thunderbirds', 'Bulldogs', 'Outlaws', 'Coyotes', 'Rams', 'Admirals', 'Patriots'],
  ice_hockey: ['Blades', 'Glaciers', 'Icemen', 'Lynx', 'Huskies', 'Avalanche', 'Bandits', 'Wolverines', 'Polar Bears', 'Frost', 'Ravens', 'Stars', 'Fury', 'Moose', 'Phantoms', 'Generals'],
  rugby: ['Warriors', 'Saracens', 'Harlequins', 'Bulls', 'Highlanders', 'Chiefs', 'Rebels', 'Tigers', 'Sharks', 'Dragons', 'Crusaders', 'Stormers', 'Cheetahs', 'Brumbies', 'Ospreys', 'Scarlets'],
  cricket: ['Strikers', 'Sixers', 'Scorchers', 'Heat', 'Renegades', 'Hurricanes', 'Royals', 'Super Kings', 'Gladiators', 'Zalmi', 'Capitals', 'Tridents', 'Spirit', 'Invincibles', 'Phoenix', 'Fire'],
  volleyball: ['Spikers', 'Waves', 'Sunrays', 'Breakers', 'Aces', 'Rallies', 'Herons', 'Gulls', 'Volts', 'Flames', 'Comets', 'Tides', 'Eagles', 'Panthers', 'Sparks', 'Jets'],
};
export const mascotsFor = (sport) => MASCOTS[sport?.id] ?? MASCOTS[sport?.adapter === 'baseball' ? 'baseball' : 'basketball'];
/** Jersey colors: a club's home and away shirts are two of these. */
export const JERSEY_COLORS = [['Red', '#c8102e'], ['Crimson', '#8a1538'], ['Orange', '#f47a20'], ['Gold', '#f2b51c'], ['Yellow', '#ffd400'], ['Green', '#00843d'],
  ['Forest', '#1f4d2b'], ['Teal', '#00787a'], ['Sky blue', '#6cace4'], ['Royal blue', '#1d4f91'], ['Navy', '#0b1f41'], ['Purple', '#5b2c83'], ['Maroon', '#6a1f2b'],
  ['Black', '#141414'], ['White', '#f6f6f2'], ['Silver', '#a7a9ac'], ['Brown', '#5c3a21'], ['Pink', '#e8749a']];
export const CLUB_WORDS = ['Riverside', 'Northgate', 'Elm Park', 'Westfield', 'Harbor', 'Oakmont', 'Southbank', 'Hillcrest', 'Meadowbrook', 'Kingsway', 'Ashford', 'Lakeside'];
