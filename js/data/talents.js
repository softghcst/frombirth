// Inborn talents: what someone has a gift for before any practice. Each is 0–100, passed down from both parents.
// IDs are saved in characters: never rename or remove one, only add.
//   hidden: kept out of the Talents list (mischief shows in what someone does, not on a chart).
//   leadsTo: the work a gift gives a head start in (engine/aptitudes.js), shown when choosing one.
//   added:  came later than the first six (persuasion and modeling later still: LATER_TALENTS); older saves are given one when they load (save.js).
export const TALENTS = [
  { id: 'music', name: 'Music', leadsTo: 'Bands, records, orchestras and producing.' },
  { id: 'sports', name: 'Sports', leadsTo: 'Pro sport and coaching, and a head start in the police, the fire service and the military.' },
  { id: 'acting', name: 'Acting', leadsTo: "Stage and screen, and presence for K-pop and modeling. A head start wherever you have to win a room: the courtroom, the news on air, a doctor's bedside." },
  { id: 'singing', name: 'Singing', leadsTo: 'Records and K-pop, and a voice that carries on air. Musical theater wants singing, dance and acting together.' },
  { id: 'dance', name: 'Dance', leadsTo: 'Dance, K-pop and modeling, and a head start in fitness. Musical theater wants singing, dance and acting together.' },
  { id: 'art', name: 'Art', leadsTo: 'Design, animation and photography, and a steady hand for surgery and dentistry.', added: true },
  { id: 'writing', name: 'Writing', leadsTo: "Books and journalism, and a head start in law, policy and a detective's reports.", added: true },
  { id: 'tech', name: 'Technology', leadsTo: 'Software, engineering and games, and digital evidence in an investigation.', added: true },
  { id: 'science', name: 'Math and Science', leadsTo: 'Medicine, nursing, pharmacy, vets, the lab and engineering, and the reasoning behind forensics.', added: true },
  { id: 'persuasion', name: 'Persuasion', leadsTo: 'Debate club, student council and campaigns, and a head start in law, politics, sales and the news on air.', added: true },
  { id: 'modeling', name: 'Modeling', leadsTo: 'The runway, castings and campaigns: posing, finding the light, and how clothes hang on you.', added: true },
  { id: 'crime', name: 'Mischief', leadsTo: 'Trouble. And, oddly, an eye for it: a head start as a detective.', hidden: true },
];
export const TALENT_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t]));
/** The talents added after the first six. */
export const ADDED_TALENTS = TALENTS.filter((t) => t.added).map((t) => t.id);
/** Added after those four: rolled last, on dice of their own, so older lives' rolls are unchanged (genetics.js, talentGrowth.js). */
export const LATER_TALENTS = ['persuasion', 'modeling'];
/** How a talent is named in a sentence ("a gift for technology"). */
export const talentWord = (id) => (TALENT_BY_ID[id]?.name ?? id).toLowerCase();
