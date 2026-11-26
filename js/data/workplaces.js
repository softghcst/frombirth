// Kinds of workplace. A scene set at work names the workplaces it can happen in (`workplaces` on the event,
// data/events); the event engine shows it only to someone who works in one of them (engine/conditions.js `workplace`).
// A detective is not poached by a rival firm, and a nurse does not present to "the people at the very top".
//
// Each career belongs to one kind: by its own id where its field is mixed (law holds firms, courts and the police),
// otherwise by its field. A part-time job has a kind of its own.
export const WORKPLACES = {
  office: 'An office: desks, meetings, projects',
  firm: 'A professional firm with clients: law, accounting, consulting, advice',
  court: 'A court or public legal office',
  police: 'A police force or federal agency',
  military: 'The armed forces',
  emergency: 'Emergency services: fire, ambulance, dispatch, lifeguards',
  care: 'A hospital, clinic or care service',
  school: 'A school or university',
  lab: 'A laboratory or research institute',
  shop: 'A shop, restaurant, hotel or salon: customers at a counter',
  site: 'A worksite, farm, depot or route: hands-on work outside an office',
  leisure: 'A gym, pool, camp or park',
  stage: 'A stage, set, studio or arena',
  home: 'Someone else\'s home',
};
const FAMILY = {
  corporate: 'office', tech: 'office', government: 'office', education: 'school', health: 'care', land: 'site', law: 'court',
  science: 'lab', media: 'office', safety: 'emergency', retail: 'shop', hospitality: 'shop', transport: 'site', trades: 'site',
  arts: 'stage', beauty: 'shop', sport: 'leisure', military: 'military', novelty: 'site',
};
const CAREER = {
  // Firms with clients.
  lawyer: 'firm', paralegal: 'firm', defender: 'firm', accountant: 'firm', audit: 'firm', consulting: 'firm', banker: 'firm', fin_advice: 'firm', pi: 'firm',
  // Police and federal agencies; prisons.
  police: 'police', security: 'police', detective: 'police', fbi_agent: 'police', dea_agent: 'police', atf_agent: 'police', usms_deputy: 'police',
  usss_agent: 'police', hsi_agent: 'police', irs_agent: 'police', corrections: 'police', ally_crime_analyst: 'police',
  // Courts and public legal work.
  ally_probation: 'court', ally_court_reporter: 'court', ally_victim_advocate: 'care',
  // Offices in mixed fields.
  ally_compliance: 'office', ally_insurance: 'office', ally_inspector_general: 'office', intelligence: 'office', organizing: 'office', journalist: 'office',
  // Care and public services.
  forensic_psych: 'care', social_work: 'care', funeral: 'shop', postal: 'site', sanitation: 'site',
  // On stage, on camera, in public.
  influencer: 'stage', broadcast: 'stage', author: 'home', photography: 'stage', screenwriting: 'home',
  // Leisure.
  theme_park: 'leisure', waterslide: 'leisure', golf_course: 'leisure', seasonal_santa: 'shop',
};
const PART_TIME = {
  cafe: 'shop', cinema: 'shop', supermarket: 'shop', barista: 'shop', cashier: 'shop', retail_pt: 'shop', babysitter: 'home', ice_cream: 'shop',
  lifeguard_pt: 'emergency', swim_pt: 'leisure', fitness_pt: 'leisure', dance_pt: 'leisure', golf_pt: 'shop', office_pt: 'office', hotel_pt: 'shop',
  tester_pt: 'office', delivery_pt: 'site', tutor_pt: 'school', camp_pt: 'leisure', gym_desk: 'leisure', paper_round: 'site', mystery: 'shop',
  library: 'school', tour_guide: 'school', research_pt: 'lab', lab_pt: 'lab', ra: 'school', cafeteria: 'shop',
};
/** The kind of workplace a career belongs to. */
export const workplaceOfCareer = (career) => (career ? CAREER[career.id] ?? FAMILY[career.family] ?? 'office' : null);
/** The kind of workplace a part-time job is. */
export const workplaceOfPartTime = (jobId) => PART_TIME[jobId] ?? 'shop';

/** Sets of workplaces that scenes use often. */
export const AT = {
  any: Object.keys(WORKPLACES).filter((w) => w !== 'home'),
  desk: ['office', 'firm', 'court', 'lab'], // meetings, deadlines, projects, expense claims
  company: ['office', 'firm', 'shop', 'site'], // a business that can lose money, be bought, pay a bonus
  colleagues: ['office', 'firm', 'court', 'lab', 'school', 'care', 'shop', 'site', 'police', 'emergency', 'leisure'], // a team and a boss
};
