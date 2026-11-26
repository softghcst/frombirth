// Contraception: the canonical registry of methods, the eligibility rules applied to them, where and when each exists,
// and who may provide it. Pathways is a game: nothing here is medical advice, and the screens never tell a player how
// to use, start or stop a real method. Read docs/CONTRACEPTION.md before changing anything.
//
// EFFECTIVENESS. Every figure below is the PERCENT OF PEOPLE WHO BECOME PREGNANT IN THE FIRST YEAR of use, as published
// in the CDC's "Contraception" effectiveness chart and the US Selected Practice Recommendations (both based on Trussell
// et al., Contraceptive Technology). `typical` is typical use (as people actually use a method, missed doses and all);
// `perfect` is correct and consistent use. These are annual population figures. They are NOT applied as a chance per
// Age Up: engine/health/contraception.js turns them into a relative risk against using no method (85% a year), applied
// to the game's own exposure model (engine/children.js surpriseChance, engine/bonds.js maybeConceive) month by month.
//
// VERIFICATION. On 2026-11-26 the figures were checked against the live CDC, NHS and FDA pages (`verified: true`
// below, with what each page confirmed). Sources not read that day stay `verified: false`. Device durations change
// (approvals are extended); they live in `durations`, versioned by year and country, and the UI shows only what this
// file says.
//
// ELIGIBILITY. `mec` follows the shape of the US Medical Eligibility Criteria (US MEC 2024): 1 no restriction, 2
// advantages generally outweigh risks, 3 risks usually outweigh advantages (needs a clinician's careful judgment), 4 an
// unacceptable risk. The game uses only conditions it actually models (engine/health/record.js) and a few facts
// collected at a consultation; it never invents a diagnosis to rule a method out. A category is a starting point for
// a clinician's conversation, never a universal ban.

export const SOURCES = {
  cdc_about: { url: 'https://www.cdc.gov/contraception/about/', name: 'CDC: Contraception', applies: 'United States', checked: '2026-11-26', verified: true,
    confirmed: 'Typical-use failure for every method here (LNG IUD 0.1–0.4%, cervical cap 22%, fertility awareness 2–23%); implant over 3 years; LNG IUD 3 to 8 years by device; copper IUD 10 years; vasectomy about 12 weeks to a zero count' },
  cdc_mec: { url: 'https://www.cdc.gov/contraception/hcp/usmec/', name: 'CDC: US Medical Eligibility Criteria for Contraceptive Use (2024)', applies: 'United States', checked: '2026-11-26', verified: false },
  cdc_spr: { url: 'https://www.cdc.gov/contraception/hcp/usspr/', name: 'CDC: US Selected Practice Recommendations for Contraceptive Use (2024)', applies: 'United States', checked: '2026-11-26', verified: true,
    confirmed: 'Injection every 13 weeks, up to 2 weeks late without backup; emergency pills within 5 days (levonorgestrel less effective at 4–5 days, ulipristal more effective then); copper IUD within 5 days; backup 2 days for norethindrone pills, 7 for drospirenone; semen test 8–16 weeks after vasectomy, 80% clear by 12 weeks' },
  acog: { url: 'https://www.acog.org/womens-health/faqs/birth-control', name: 'ACOG: Birth control FAQs', applies: 'United States', checked: '2026-11-26', verified: false },
  nhs: { url: 'https://www.nhs.uk/contraception/', name: 'NHS: Contraception guide', applies: 'United Kingdom', checked: '2026-11-26', verified: true,
    confirmed: 'Implant 5 years; IUS 3 to 8 years by type; copper IUD 5 or 10 years by type; injection 8 to 13 weeks; emergency pill within 3 or 5 days by type, free from NHS pharmacies; internal condoms 79% typical, 95% perfect; diaphragm or cap 92–96% with correct use; fertility awareness 76% typical; free and confidential, including under 16' },
  fda: { url: 'https://www.fda.gov/consumers/womens-health-topics/birth-control', name: 'FDA: Birth control', applies: 'United States', checked: '2026-11-26', verified: true,
    confirmed: 'Copper IUD up to 10 years; hormonal IUD 8 years or more, by type' },
  owh: { url: 'https://womenshealth.gov/a-z-topics/birth-control-methods', name: 'US Office on Women\'s Health: Birth control methods', applies: 'United States', checked: '2026-11-26', verified: false },
};

/** The yearly pregnancy rate with no method at all, the reference every relative risk is taken against. */
export const NO_METHOD_ANNUAL = 0.85;

/**
 * Who a method is used by: 'uterus' (the person who could become pregnant), 'penis' (the partner who could cause a
 * pregnancy), or 'either' (a shared approach such as fertility awareness, recorded by the person whose cycle it uses).
 */
const B = (o) => ({ hormonal: false, hormone: null, sti: false, procedure: null, supply: null, onsetWeeks: 0, returnMonths: 0, permanent: false,
  barrier: false, combinable: [], body: 'uterus', minAge: 12, sideEffects: [], bleeding: {}, ...o });

/**
 * The methods. Costs are game tuning in the game's base money (scaled to each country's prices and paid through the
 * existing cover model), not real prices. `access`: where it is obtained ('clinic' needs a clinician; 'pharmacy' a
 * pharmacist; 'otc' off the shelf; 'procedure' a qualified clinician and an appointment). Country and era overrides
 * are in COUNTRY_RULES. `procedure`: the service a clinician must be qualified for (PROVIDER_SCOPE).
 */
export const METHODS = [
  B({ id: 'implant', name: 'Arm implant', category: 'larc', hormonal: true, hormone: 'progestin', mechanism: 'A small rod under the skin of the upper arm releases a progestin that mainly stops ovulation.',
    typical: 0.1, perfect: 0.1, access: 'procedure', procedure: 'implant', remove: 'implant', from: 1990, sources: ['cdc_about', 'cdc_spr', 'nhs'],
    durations: [{ from: 1990, years: 5, note: 'the earlier multi-rod implant' }, { from: 1999, years: 3, note: 'the single-rod implant' }, { from: 2006, years: 3, countries: ['us'] }, { from: 2026, years: 5, countries: ['uk'], note: 'NHS guidance as checked 2026-11-26 (first year of the change not known: not invented)' }],
    maintenance: 'Nothing day to day. Removed or replaced by a trained clinician when due or whenever you want.', onsetWeeks: 1,
    cost: { device: 850, placement: 250, removal: 220 }, sideEffects: ['irregular_bleeding', 'spotting', 'headache', 'mood', 'acne', 'arm_site'], bleeding: { pattern: 'unpredictable', amenorrhea: 0.22, irregular: 0.45 } }),
  B({ id: 'iud_lng52', name: 'Hormonal IUD (larger)', family: 'iud_hormonal', category: 'larc', hormonal: true, hormone: 'progestin', mechanism: 'A small device in the uterus releases a progestin locally; it thickens cervical mucus and thins the lining.',
    typical: 0.1, perfect: 0.1, access: 'procedure', procedure: 'iud', remove: 'iud', from: 1990, sources: ['cdc_about', 'cdc_spr', 'acog', 'fda'],
    durations: [{ from: 1990, years: 5 }, { from: 2022, years: 8, countries: ['us'] }, { from: 2024, years: 8, countries: ['uk'] }],
    maintenance: 'Nothing day to day. Checked if anything feels wrong; removed or replaced by a trained clinician.', onsetWeeks: 1,
    cost: { device: 900, placement: 260, removal: 200 }, sideEffects: ['spotting', 'irregular_bleeding', 'cramping_early', 'headache', 'acne'], bleeding: { pattern: 'lighter', amenorrhea: 0.2, irregular: 0.3 } }),
  B({ id: 'iud_lng19', name: 'Hormonal IUD (mid-size)', family: 'iud_hormonal', category: 'larc', hormonal: true, hormone: 'progestin', mechanism: 'A smaller hormonal IUD with a lower progestin dose.',
    typical: 0.2, perfect: 0.2, access: 'procedure', procedure: 'iud', remove: 'iud', from: 2016, sources: ['cdc_spr', 'acog'],
    durations: [{ from: 2016, years: 5 }], maintenance: 'Nothing day to day.', onsetWeeks: 1,
    cost: { device: 900, placement: 260, removal: 200 }, sideEffects: ['spotting', 'irregular_bleeding', 'cramping_early', 'headache'], bleeding: { pattern: 'lighter', amenorrhea: 0.12, irregular: 0.35 } }),
  B({ id: 'iud_lng13', name: 'Hormonal IUD (smallest)', family: 'iud_hormonal', category: 'larc', hormonal: true, hormone: 'progestin', mechanism: 'The smallest hormonal IUD, with the lowest dose.',
    typical: 0.4, perfect: 0.3, access: 'procedure', procedure: 'iud', remove: 'iud', from: 2013, sources: ['cdc_spr', 'acog'],
    durations: [{ from: 2013, years: 3 }], maintenance: 'Nothing day to day.', onsetWeeks: 1,
    cost: { device: 850, placement: 260, removal: 200 }, sideEffects: ['spotting', 'irregular_bleeding', 'cramping_early'], bleeding: { pattern: 'lighter', amenorrhea: 0.06, irregular: 0.4 } }),
  B({ id: 'iud_copper', name: 'Copper IUD', family: 'iud_copper', category: 'larc', mechanism: 'A small copper device in the uterus. No hormones: copper is toxic to sperm.',
    typical: 0.8, perfect: 0.6, access: 'procedure', procedure: 'iud', remove: 'iud', from: 1974, sources: ['cdc_about', 'cdc_spr', 'nhs'],
    durations: [{ from: 1974, years: 4, note: 'early copper devices' }, { from: 1988, years: 10 }], maintenance: 'Nothing day to day. Works from the day it is placed.', onsetWeeks: 0,
    emergency: { windowHours: 120, residual: 0.01 },
    cost: { device: 700, placement: 260, removal: 200 }, sideEffects: ['heavier_bleeding', 'cramping', 'spotting'], bleeding: { pattern: 'heavier', amenorrhea: 0, irregular: 0.15, heavier: 0.5 } }),
  B({ id: 'coc', name: 'Combined pill', category: 'pill', hormonal: true, hormone: 'estrogen+progestin', mechanism: 'A daily pill with an estrogen and a progestin that stops ovulation.',
    typical: 7, perfect: 0.3, access: 'clinic', from: 1960, sources: ['cdc_about', 'cdc_spr', 'nhs'], supply: { months: 1, rxMonths: 12, base: 25 }, adherence: 'daily', missWindowHours: 24,
    formulations: [{ id: 'cyclic', name: 'Monthly pack with a break', from: 1960 }, { id: 'extended', name: 'Extended or continuous use', from: 2003, note: 'fewer or no scheduled bleeds' }],
    maintenance: 'One pill a day, handled in the background by your routine. Refills are automatic while a prescription lasts.', onsetWeeks: 1,
    cost: { visit: 120 }, sideEffects: ['nausea', 'breast_tenderness', 'spotting', 'headache', 'mood'], bleeding: { pattern: 'regular_lighter', amenorrhea: 0.02, irregular: 0.1, lighter: 0.6 } }),
  B({ id: 'pop_norethindrone', name: 'Progestin-only pill (3-hour window)', family: 'pop', category: 'pill', hormonal: true, hormone: 'progestin', mechanism: 'A daily progestin-only pill, mainly by thickening cervical mucus; it has to be taken within the same three hours each day.',
    typical: 7, perfect: 0.3, access: 'clinic', from: 1973, sources: ['cdc_spr', 'nhs'], supply: { months: 1, rxMonths: 12, base: 25 }, adherence: 'daily', missWindowHours: 3,
    maintenance: 'One pill at the same time every day, handled in the background.', onsetWeeks: 0.3,
    cost: { visit: 120 }, sideEffects: ['irregular_bleeding', 'spotting', 'headache', 'breast_tenderness'], bleeding: { pattern: 'unpredictable', amenorrhea: 0.1, irregular: 0.4 } }),
  B({ id: 'pop_desogestrel', name: 'Progestin-only pill (12-hour window)', family: 'pop', category: 'pill', hormonal: true, hormone: 'progestin', mechanism: 'A daily progestin-only pill that also stops ovulation, with a 12-hour window.',
    typical: 7, perfect: 0.3, access: 'clinic', from: 2002, notIn: ['us'], sources: ['nhs'], supply: { months: 1, rxMonths: 12, base: 25 }, adherence: 'daily', missWindowHours: 12,
    maintenance: 'One pill a day, handled in the background.', onsetWeeks: 0.3,
    cost: { visit: 120 }, sideEffects: ['irregular_bleeding', 'spotting', 'acne', 'mood'], bleeding: { pattern: 'unpredictable', amenorrhea: 0.2, irregular: 0.4 } }),
  B({ id: 'pop_drospirenone', name: 'Progestin-only pill (24-hour window)', family: 'pop', category: 'pill', hormonal: true, hormone: 'progestin', mechanism: 'A newer progestin-only pill taken in a 24/4 pattern, with a 24-hour window.',
    typical: 7, perfect: 0.3, access: 'clinic', from: 2019, sources: ['cdc_spr'], supply: { months: 1, rxMonths: 12, base: 40 }, adherence: 'daily', missWindowHours: 24,
    maintenance: 'One pill a day, handled in the background.', onsetWeeks: 1,
    cost: { visit: 120 }, sideEffects: ['irregular_bleeding', 'spotting'], bleeding: { pattern: 'unpredictable', amenorrhea: 0.1, irregular: 0.4 } }),
  B({ id: 'patch', name: 'Contraceptive patch', category: 'patch', hormonal: true, hormone: 'estrogen+progestin', mechanism: 'A skin patch releasing an estrogen and a progestin; one patch a week for three weeks, then a patch-free week.',
    typical: 7, perfect: 0.3, access: 'clinic', from: 2002, sources: ['cdc_about', 'cdc_spr', 'nhs'], supply: { months: 1, rxMonths: 12, base: 50 }, adherence: 'weekly',
    maintenance: 'A new patch each week for three weeks, then a week off. Kept up in the background.', onsetWeeks: 1,
    cost: { visit: 120 }, sideEffects: ['skin_irritation', 'breast_tenderness', 'nausea', 'spotting', 'headache'], bleeding: { pattern: 'regular_lighter', amenorrhea: 0.02, irregular: 0.12, lighter: 0.5 } }),
  B({ id: 'ring_monthly', name: 'Vaginal ring (monthly)', family: 'ring', category: 'ring', hormonal: true, hormone: 'estrogen+progestin', mechanism: 'A soft ring releasing an estrogen and a progestin; three weeks in, one week out, a new ring each month.',
    typical: 7, perfect: 0.3, access: 'clinic', from: 2001, sources: ['cdc_about', 'cdc_spr', 'nhs'], supply: { months: 1, rxMonths: 12, base: 60 }, adherence: 'monthly',
    maintenance: 'A new ring each month, on the product\'s own schedule. Kept up in the background.', onsetWeeks: 1,
    cost: { visit: 120 }, sideEffects: ['discharge', 'headache', 'nausea', 'spotting'], bleeding: { pattern: 'regular_lighter', amenorrhea: 0.02, irregular: 0.1, lighter: 0.5 } }),
  B({ id: 'ring_annual', name: 'Vaginal ring (one-year)', family: 'ring', category: 'ring', hormonal: true, hormone: 'estrogen+progestin', mechanism: 'A reusable ring that lasts thirteen cycles: three weeks in, one week out, the same ring kept between cycles.',
    typical: 7, perfect: 0.3, access: 'clinic', from: 2018, onlyIn: ['us'], sources: ['cdc_spr'], supply: { months: 12, rxMonths: 12, base: 1600 }, adherence: 'monthly',
    maintenance: 'One ring for a year, on its own schedule.', onsetWeeks: 1,
    cost: { visit: 120 }, sideEffects: ['discharge', 'headache', 'nausea', 'spotting'], bleeding: { pattern: 'regular_lighter', amenorrhea: 0.02, irregular: 0.1, lighter: 0.4 } }),
  B({ id: 'injection', name: 'Contraceptive injection', category: 'injection', hormonal: true, hormone: 'progestin', mechanism: 'A progestin injection that stops ovulation, repeated about every three months.',
    typical: 4, perfect: 0.2, access: 'clinic', from: 1974, sources: ['cdc_about', 'cdc_spr', 'nhs'], every: { months: 3, graceWeeks: 2 }, adherence: 'quarterly', returnMonths: 10,
    maintenance: 'An injection about every three months. Renewal visits are booked for you while you keep this method.', onsetWeeks: 1,
    cost: { visit: 90, dose: 60 }, sideEffects: ['irregular_bleeding', 'weight_change', 'headache', 'mood'], bleeding: { pattern: 'often_none', amenorrhea: 0.5, irregular: 0.35 } }),
  B({ id: 'condom_external', name: 'External condom', category: 'barrier', barrier: true, sti: true, body: 'either', mechanism: 'A barrier worn on the penis (a couple\'s choice, whichever partner keeps them). Also lowers the risk of many sexually transmitted infections.',
    typical: 13, perfect: 2, access: 'otc', from: 1860, minAge: 12, sources: ['cdc_about', 'nhs'], supply: { months: 1, base: 10, otc: true }, adherence: 'each_time',
    maintenance: 'Used every time. Kept stocked in the background.', combinable: ['*'], cost: {}, sideEffects: ['latex_irritation'] }),
  B({ id: 'condom_internal', name: 'Internal condom', category: 'barrier', barrier: true, sti: true, body: 'uterus', mechanism: 'A soft pouch worn inside the vagina. Also lowers the risk of many sexually transmitted infections.',
    typical: 21, perfect: 5, access: 'otc', from: 1993, minAge: 12, sources: ['cdc_about', 'nhs'], supply: { months: 1, base: 30, otc: true }, adherence: 'each_time',
    maintenance: 'Used every time. Not used together with an external condom.', combinable: ['*'], cost: {}, sideEffects: ['irritation'] }),
  B({ id: 'diaphragm', name: 'Diaphragm', category: 'barrier', barrier: true, mechanism: 'A reusable cup placed over the cervix before sex, used with spermicide.',
    typical: 17, perfect: 16, access: 'clinic', from: 1882, sources: ['cdc_about', 'nhs'], supply: { months: 24, rxMonths: 24, base: 100 }, adherence: 'each_time',
    maintenance: 'Used each time, with spermicide. Replaced every couple of years.', combinable: ['*'], cost: { visit: 120 }, sideEffects: ['irritation', 'uti'] }),
  B({ id: 'cervical_cap', name: 'Cervical cap', category: 'barrier', barrier: true, mechanism: 'A small reusable cap over the cervix, used with spermicide. Less effective after a vaginal birth.',
    typical: 22, perfect: 14, parousTypical: 29, access: 'clinic', from: 1900, sources: ['cdc_about'], supply: { months: 12, rxMonths: 12, base: 90 }, adherence: 'each_time',
    maintenance: 'Used each time, with spermicide.', combinable: ['*'], cost: { visit: 120 }, sideEffects: ['irritation'] }),
  B({ id: 'spermicide', name: 'Spermicide', category: 'barrier', barrier: true, mechanism: 'A gel, foam or film placed before sex. On its own, one of the less effective methods.',
    typical: 21, perfect: 16, access: 'otc', from: 1885, sources: ['cdc_about'], supply: { months: 1, base: 12, otc: true }, adherence: 'each_time',
    maintenance: 'Used each time.', combinable: ['*'], cost: {}, sideEffects: ['irritation'] }),
  B({ id: 'fam', name: 'Fertility awareness', category: 'awareness', body: 'uterus', mechanism: 'Tracking signs of the menstrual cycle to avoid sex, or use a barrier, on likely fertile days.',
    typical: 15, typicalRange: [2, 23], perfect: 2, access: 'clinic', optionalTeaching: true, from: 1930, sources: ['cdc_about', 'nhs'], adherence: 'daily_tracking', approximate: true,
    maintenance: 'Daily tracking. Works best with regular cycles, training and a partner who shares it. An app\'s prediction is a guess, not knowledge of ovulation.',
    combinable: ['condom_external', 'condom_internal', 'diaphragm', 'cervical_cap', 'spermicide'], cost: { visit: 0, course: 60 }, sideEffects: [] }),
  B({ id: 'tubal', name: 'Tubal sterilization', category: 'permanent', permanent: true, procedure: 'tubal', access: 'procedure', mechanism: 'An operation that blocks or removes the fallopian tubes. Meant to be permanent.',
    typical: 0.5, perfect: 0.5, from: 1930, minAge: 21, sources: ['cdc_about', 'acog', 'nhs'], onsetWeeks: 0, consentWaitWeeks: 4,
    maintenance: 'Nothing more to do. It is meant to be permanent: reversal is a major operation that often does not work.', cost: { procedure: 3500, visit: 150 }, sideEffects: ['recovery'] }),
  B({ id: 'vasectomy', name: 'Vasectomy', category: 'permanent', permanent: true, procedure: 'vasectomy', access: 'procedure', body: 'penis', mechanism: 'A short procedure that blocks the tubes carrying sperm. Meant to be permanent.',
    typical: 0.15, perfect: 0.1, from: 1925, minAge: 21, sources: ['cdc_about', 'nhs'], onsetWeeks: 12, needsConfirmation: 'semen_test', consentWaitWeeks: 2,
    maintenance: 'Another method is needed until a semen test about three months later confirms it has worked.', cost: { procedure: 900, visit: 120, test: 100 }, sideEffects: ['recovery'] }),
];
export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m]));

/** The legacy, unspecified "birth control" of lives saved before this registry: assumed effective like a pill. */
export const UNSPECIFIED = { id: 'unspecified', name: 'Birth control (not specified)', typical: 7, perfect: 0.3, hormonal: null, category: 'legacy', legacy: true };

/** Emergency contraception: offered only after a real exposure event, within its window. `residual`: share of the
 * expected pregnancies still happening (game approximation of published ranges; ulipristal is the more effective pill). */
export const EMERGENCY = [
  { id: 'ec_lng', name: 'Levonorgestrel emergency pill', windowHours: 72, from: 1999, access: 'pharmacy', residual: 0.4, base: 45, sources: ['cdc_spr', 'nhs'],
    note: 'Works best the sooner it is taken; it prevents or delays ovulation and does not end an established pregnancy. (Licensed for 3 days; CDC: up to 5, less effective after day 4.)' },
  { id: 'ec_upa', name: 'Ulipristal emergency pill', windowHours: 120, from: 2009, access: 'clinic', residual: 0.3, base: 60, sources: ['cdc_spr', 'nhs'],
    note: 'Effective for up to five days. Delays ovulation; it does not end an established pregnancy.' },
  { id: 'ec_cu_iud', name: 'Copper IUD as emergency contraception', windowHours: 120, from: 1976, access: 'procedure', residual: 0.01, methodId: 'iud_copper', sources: ['cdc_spr', 'nhs'],
    note: 'The most effective emergency option, placed by a trained clinician within five days; it can then stay as ongoing contraception.' },
];
export const EC_BY_ID = Object.fromEntries(EMERGENCY.map((e) => [e.id, e]));

/**
 * Side effects a method MAY bring. `p` is a game-tuning chance per person (decided once from the person and the
 * method, never redrawn on reload); most people get none or one. `fades`: usually settles in the first months.
 * Only effects listed for a method in the sources are used; nothing here causes infertility, a chronic illness, or
 * fixed weight gain.
 */
export const SIDE_EFFECTS = {
  irregular_bleeding: { label: 'Irregular bleeding', p: 0.35, fades: false, bleeding: true },
  spotting: { label: 'Spotting between periods', p: 0.3, fades: true, bleeding: true },
  heavier_bleeding: { label: 'Heavier periods', p: 0.35, fades: true, bleeding: true },
  cramping: { label: 'More cramping with periods', p: 0.3, fades: true },
  cramping_early: { label: 'Cramping in the first weeks', p: 0.3, fades: true },
  headache: { label: 'Headaches', p: 0.12, fades: true },
  mood: { label: 'Mood changes', p: 0.08, fades: false },
  acne: { label: 'Skin changes (acne)', p: 0.1, fades: false },
  nausea: { label: 'Nausea', p: 0.12, fades: true },
  breast_tenderness: { label: 'Breast tenderness', p: 0.15, fades: true },
  weight_change: { label: 'Some weight change (varies; not everyone)', p: 0.2, fades: false },
  skin_irritation: { label: 'Skin irritation where the patch sits', p: 0.15, fades: false },
  discharge: { label: 'More vaginal discharge', p: 0.12, fades: false },
  arm_site: { label: 'Soreness or bruising at the arm site', p: 0.15, fades: true },
  latex_irritation: { label: 'Irritation (latex-free condoms exist)', p: 0.04, fades: false },
  irritation: { label: 'Irritation', p: 0.06, fades: false },
  uti: { label: 'A urinary infection', p: 0.05, fades: true },
  recovery: { label: 'A few days of soreness after the procedure', p: 0.6, fades: true },
};

/**
 * Who may provide what. A profession's scope is the baseline; `trained` services need a clinician who is trained for
 * them (decided once per clinician, never on reload). Not every doctor places IUDs, and not only doctors do.
 */
export const PROVIDER_SCOPE = {
  obgyn: { counsel: true, prescribe: true, iud: 'always', implant: 'always', tubal: 'always', injection: true },
  gp: { counsel: true, prescribe: true, iud: 'trained', implant: 'trained', vasectomy: 'trained', injection: true },
  nurse_practitioner: { counsel: true, prescribe: true, iud: 'trained', implant: 'trained', injection: true },
  physician_assistant: { counsel: true, prescribe: true, iud: 'trained', implant: 'trained', injection: true },
  midwife: { counsel: true, prescribe: true, iud: 'trained', implant: 'trained', injection: true },
  sexual_health_nurse: { counsel: true, prescribe: true, iud: 'trained', implant: 'trained', injection: true },
  nurse: { counsel: true, injection: true },
  urologist: { counsel: true, vasectomy: 'always' },
  doctor: { counsel: true, prescribe: true },
};
/** How often a clinician whose scope says 'trained' is trained for that service (game tuning). */
export const TRAINED_SHARE = { iud: 0.55, implant: 0.6, vasectomy: 0.25 };

/**
 * Countries and eras, simplified. Defaults apply everywhere; overrides are documented milestones only, never invented
 * dates. `from` moves a method's first year in that country; `access` changes how it is obtained; `minors`: how a
 * young person's confidential access works in this simplified profile ('confidential', 'varies' or 'guardian').
 */
export const COUNTRY_RULES = {
  default: { minors: 'varies', ecLng: 'clinic', ecUpa: 'clinic' },
  us: { minors: 'varies', ecLng: 'otc', ecLngFrom: 2013, ecUpa: 'clinic', noCostSharingFrom: 2012, pills: { pop_norethindrone: { otcFrom: 2024 } },
    from: { implant: 1990, iud_lng52: 2000, coc: 1960, injection: 1992, ec_lng: 1999, ec_upa: 2010, condom_internal: 1993 } },
  uk: { minors: 'confidential', minorsFrom: 1985, ecLng: 'pharmacy', ecLngFrom: 2001, ecUpa: 'pharmacy', ecUpaFrom: 2015, freeContraceptionFrom: 1974,
    from: { coc: 1961, implant: 1993, iud_lng52: 1995, ec_lng: 2000, ec_upa: 2009, condom_internal: 1992 } },
  jp: { minors: 'guardian', from: { coc: 1999, iud_lng52: 2007, implant: 9999, injection: 9999, patch: 9999, ring_monthly: 9999, ec_lng: 2011, ec_upa: 9999 } },
  ie: { minors: 'varies', from: { coc: 1979, condom_external: 1979, diaphragm: 1979, injection: 1979, iud_copper: 1979, spermicide: 1979 } },
  fr: { minors: 'confidential', minorsFrom: 1974, from: { coc: 1967 } },
  de: { minors: 'varies', from: { coc: 1961 } },
  ca: { minors: 'confidential', from: { coc: 1960 } },
  au: { minors: 'confidential', from: { coc: 1961 } },
};

/** Life stages for reproductive care (approximate; menopause timing varies widely between people). */
export const LIFE_STAGE = { menopauseMedian: 51, spread: 4, perimenopauseYears: 4, contraceptionUntil: 55 };
