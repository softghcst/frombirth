// The legal profession as data: how each kind of country trains and admits lawyers, what law school teaches, the
// specialties and the career trees, and the cases lawyers take on. Everything here is simplified game rules, not the
// law anywhere: hypotheticals and "rules" are written for play and are never presented as real statutes or cases.
// The United States is modeled in depth; other countries use the justice system family they already have
// (data/justice.js) with a simplified, clearly labeled profile.

export const SIMULATION_NOTE = 'Real laws are cited by name and year where Pathways lists them. How a case plays out is simplified, and none of it is legal advice.';

// ---------- Jurisdictions ----------

/**
 * How lawyers are trained and admitted, by justice system family (data/justice.js SYSTEMS). `depth: 'full'` is played
 * in detail; `simplified` follows the same steps with general names and says so.
 */
export const LAW_PROFILES = {
  american: {
    depth: 'full', name: 'United States', degree: 'Juris Doctor (J.D.)', degreeYears: 3, afterBachelor: true,
    entrance: { id: 'lsat', name: 'LSAT', required: true }, exam: 'bar exam', fitness: 'character and fitness review',
    admission: 'admission to the state bar', juries: { criminal: true, civil: true, family: false, immigration: false, juvenile: false },
    da: 'elected', ag: { state: 'elected in most states', federal: 'appointed by the President and confirmed by the Senate' },
    judges: 'appointed or elected, depending on the state', titles: { prosecutorChief: 'District Attorney', defenderChief: 'Chief Public Defender' },
  },
  jury: {
    depth: 'simplified', name: 'Common law, with juries', degree: 'law degree', degreeYears: 3, afterBachelor: false,
    entrance: { id: 'admissions_test', name: 'law admissions test', required: false }, exam: 'professional qualifying exam', fitness: 'suitability check',
    admission: 'admission to practice', juries: { criminal: true, civil: false, family: false, immigration: false, juvenile: false },
    da: 'appointed', ag: { state: 'appointed', federal: 'a government minister or law officer' },
    judges: 'appointed', titles: { prosecutorChief: 'Chief Crown or State Prosecutor', defenderChief: 'Head of Public Defense' },
    note: 'In many of these countries law is a first degree, followed by practical training. Pathways plays it as a three-year law program.',
  },
  bench: {
    depth: 'simplified', name: 'Common law, decided by judges', degree: 'law degree', degreeYears: 3, afterBachelor: false,
    entrance: { id: 'admissions_test', name: 'law admissions test', required: false }, exam: 'bar exam', fitness: 'suitability check',
    admission: 'enrollment as an advocate', juries: { criminal: false, civil: false, family: false, immigration: false, juvenile: false },
    da: 'appointed', ag: { state: 'appointed', federal: 'appointed' }, judges: 'appointed',
    titles: { prosecutorChief: 'Director of Public Prosecutions', defenderChief: 'Head of Legal Aid' },
    note: 'Simplified: the real route often runs through an undergraduate law degree and a period of pupillage or articles.',
  },
  mixed: {
    depth: 'simplified', name: 'Civil law, with lay judges', degree: 'law degree', degreeYears: 3, afterBachelor: false,
    entrance: { id: 'none', name: '', required: false }, exam: 'state law examination', fitness: 'suitability check',
    admission: 'admission to practice', juries: { criminal: false, civil: false, family: false, immigration: false, juvenile: false },
    da: 'career appointment', ag: { state: 'appointed', federal: 'appointed' }, judges: 'a career path of its own',
    titles: { prosecutorChief: 'Chief Public Prosecutor', defenderChief: 'Head of Legal Aid' },
    note: 'Simplified: judges and prosecutors are often a separate career entered straight after training.',
  },
  inquisitorial: {
    depth: 'simplified', name: 'Civil law, with investigating magistrates', degree: 'law degree', degreeYears: 3, afterBachelor: false,
    entrance: { id: 'none', name: '', required: false }, exam: 'professional qualifying exam', fitness: 'suitability check',
    admission: 'admission to practice', juries: { criminal: false, civil: false, family: false, immigration: false, juvenile: false },
    da: 'career appointment', ag: { state: 'appointed', federal: 'appointed' }, judges: 'a career path of its own',
    titles: { prosecutorChief: 'Chief Prosecutor', defenderChief: 'Head of Legal Aid' },
    note: 'Simplified: a magistrate leads much of the investigation, and trials are shorter and run by judges.',
  },
};

/**
 * Documented outlines of how lawyers qualify in particular countries, laid over their family's profile. The route is
 * the documented one (degree, entrance test, exam, practical training, who admits); how it plays is still simplified.
 * training: months of supervised practical training after the exam, before admission.
 */
export const COUNTRY_LAW = {
  us: { training: 0 },
  ca: { name: 'Canada', degree: 'Juris Doctor (J.D.)', degreeYears: 3, afterBachelor: true, entrance: { id: 'lsat', name: 'LSAT', required: true },
    exam: 'provincial bar admission exams', training: 10, trainingName: 'articling', admission: 'call to the bar of the province' },
  uk: { name: 'England and Wales', degree: 'law degree (or a degree and a conversion course)', exam: 'Solicitors Qualifying Examination (SQE)', training: 24,
    trainingName: 'qualifying work experience', admission: 'admission as a solicitor', note: 'Barristers qualify differently: the Bar course and a pupillage. Pathways plays the solicitors\' route.' },
  au: { name: 'Australia', degree: 'law degree (LLB or JD)', exam: 'Practical Legal Training assessment', training: 6, trainingName: 'Practical Legal Training', admission: 'admission by the Supreme Court of the state' },
  jp: { name: 'Japan', degree: 'law school degree', degreeYears: 3, afterBachelor: true, exam: 'national bar examination', training: 12, trainingName: 'the Legal Training and Research Institute', admission: 'registration with the bar association' },
  kr: { name: 'South Korea', degree: 'law school degree (J.D.)', degreeYears: 3, afterBachelor: true, entrance: { id: 'leet', name: 'LEET', required: true }, exam: 'bar examination', training: 6, trainingName: 'practical training', admission: 'registration with the Korean Bar Association' },
  de: { name: 'Germany', degree: 'law degree', exam: 'First State Examination', training: 24, trainingName: 'the Referendariat, ending in the Second State Examination', admission: 'admission to the bar (Rechtsanwaltskammer)' },
  fr: { name: 'France', degree: 'master\'s degree in law', exam: 'CRFPA entrance exam to bar school', training: 18, trainingName: 'bar school, ending in the CAPA', admission: 'swearing-in before the Court of Appeal' },
  in: { name: 'India', degree: 'LL.B.', exam: 'All India Bar Examination', training: 0, admission: 'enrollment with a State Bar Council' },
  br: { name: 'Brazil', degree: 'law degree (bacharelado em Direito)', exam: 'OAB bar exam (Exame de Ordem)', training: 0, admission: 'registration with the OAB' },
  ph: { name: 'the Philippines', degree: 'Juris Doctor (J.D.)', degreeYears: 4, afterBachelor: true, exam: 'bar examinations of the Supreme Court', training: 0, admission: 'admission to the bar and signing of the Roll of Attorneys' },
  ng: { name: 'Nigeria', degree: 'LL.B.', exam: 'Nigerian Law School Bar Final examination', training: 12, trainingName: 'the Nigerian Law School', admission: 'call to the bar' },
};

/**
 * Contingency fees (a share of what the client recovers), by country. Never in criminal, family or child matters,
 * anywhere (in the US, ABA Model Rule 1.5(d)). cap: the largest share allowed or usual; byKind for case-specific caps.
 * Countries not listed are treated as not allowing them: Pathways does not model their rules.
 */
export const CONTINGENCY = {
  us: { allowed: true, cap: 0.33, note: 'Usual in civil claims, never in criminal or family matters.' },
  uk: { allowed: true, cap: 0.5, byTemplate: { injury: 0.25, dismissal: 0.35 }, note: 'Damages-based agreements, capped: 25% in personal injury, 35% in employment.' },
  ca: { allowed: true, cap: 0.33, note: 'Allowed in civil claims, regulated by each province.' },
  jp: { allowed: true, cap: 0.3, note: 'Success fees are common.' },
  au: { allowed: false, note: 'A share of the damages is not allowed; a "no win, no fee" uplift is.' },
  fr: { allowed: false, note: 'A pure share of the result (pacte de quota litis) is not allowed.' },
  de: { allowed: false, note: 'Generally not allowed.' },
  in: { allowed: false, note: 'Not allowed by the Bar Council\'s rules.' },
};
export const NO_CONTINGENCY_KINDS = ['criminal', 'family', 'child'];

// ---------- Skills ----------

/** The lawyer's craft, kept apart from fame and from how many cases were won. */
export const LEGAL_SKILLS = [
  { id: 'research', name: 'Legal research' }, { id: 'writing', name: 'Legal writing' },
  { id: 'interpretation', name: 'Reading statutes' }, { id: 'analysis', name: 'Case analysis' },
  { id: 'evidence', name: 'Weighing evidence' }, { id: 'counseling', name: 'Client counseling' },
  { id: 'negotiation', name: 'Negotiation' }, { id: 'oral', name: 'Oral advocacy' },
  { id: 'procedure', name: 'Courtroom procedure' }, { id: 'examination', name: 'Witness examination' },
  { id: 'cross', name: 'Cross-examination' }, { id: 'strategy', name: 'Trial strategy' },
  { id: 'appellate', name: 'Appellate writing' }, { id: 'ethics', name: 'Professional ethics' },
  { id: 'management', name: 'Case management' }, { id: 'leadership', name: 'Leadership' },
  { id: 'drafting', name: 'Contract drafting' }, { id: 'family', name: 'Family procedure' },
  { id: 'immigration', name: 'Immigration procedure' }, { id: 'business', name: 'Business law' },
];
export const SKILL_NAME = Object.fromEntries(LEGAL_SKILLS.map((s) => [s.id, s.name]));

/** What a reputation is made of: several things, not a win count. */
export const REPUTATION = [
  { id: 'integrity', name: 'Integrity' }, { id: 'clients', name: 'Client trust' }, { id: 'advocacy', name: 'Advocacy' },
  { id: 'preparation', name: 'Preparation' }, { id: 'reliability', name: 'Reliability' }, { id: 'recognition', name: 'Recognition' },
];

// ---------- Law school ----------

/** A question with one best answer. `why` is shown after answering. */
const q = (text, options, right, why) => ({ text, options, right, why });

/** The first year everyone takes, and what each teaches. */
export const CORE_COURSES = [
  { id: 'contracts', name: 'Contracts', skills: { analysis: 3, drafting: 2 }, exam: [
    q('Ana offers to sell her bike to Ben for $200 "if you tell me by Friday." On Thursday Ben says yes. On Saturday Ana sells it to someone else. What is the first question to ask?',
      ['Was there an offer and an acceptance before the offer ended?', 'Did Ana own the bike?', 'Was $200 a fair price?', 'Did Ben have the money in hand?'], 0,
      'A contract starts with an offer and an acceptance made in time. Ben accepted on Thursday, before the offer ran out.'),
    q('A café orders 50 chairs for a fixed price. The maker delivers 40 and stops. The café buys 10 elsewhere for more. What does the café usually claim?',
      ['The extra it cost to buy the missing chairs elsewhere', 'The full price of all 50 chairs', 'Its lost customers for the year', 'Nothing, because 40 arrived'], 0,
      'Damages for breach usually put the other side where it would have been: here, the extra cost of replacing what was not delivered.'),
  ] },
  { id: 'torts', name: 'Torts', skills: { analysis: 3, evidence: 1 }, exam: [
    q('A landlord promised to fix a broken stair rail. Months pass. A tenant falls on the stair and is hurt. Which issue matters most?',
      ['Whether the landlord failed in a duty of care, and that failure caused the fall', 'Whether the tenant paid rent on time', 'Whether the stair was painted', 'Whether the tenant had insurance'], 0,
      'Negligence asks about duty, breach, causation and harm. Knowing about the danger and not fixing it goes to breach.'),
    q('A driver runs a red light and hits a cyclist who was not wearing a helmet. The cyclist\'s head injury is worse because of it. What is the likely effect?',
      ['The driver is still liable, but damages may be reduced for the cyclist\'s own share', 'The driver owes nothing', 'The cyclist must pay the driver', 'Only the city is liable'], 0,
      'Many systems reduce damages for a person\'s own share in the harm, rather than wiping out the claim.'),
  ] },
  { id: 'civpro', name: 'Civil Procedure', skills: { procedure: 3, management: 1 }, exam: [
    q('A company is sued in a state where it has no office, no sales and no staff. What should its lawyer raise first?',
      ['That the court has no jurisdiction over the company', 'That the claim is too small', 'That the judge is new', 'That the company is sorry'], 0,
      'Before the merits, a court must have power over the parties. That challenge usually has to be raised early or it is lost.'),
    q('A defendant misses the deadline to answer a complaint. What is the usual risk?',
      ['A default judgment against them', 'Automatic dismissal of the case', 'A criminal charge', 'Nothing at all'], 0,
      'Missing the deadline to answer can let the other side win by default.'),
  ] },
  { id: 'crimlaw', name: 'Criminal Law', skills: { analysis: 2, evidence: 2 }, exam: [
    q('Dev takes a coat from a restaurant rack, believing it is his own identical coat. Has he committed theft?',
      ['Probably not: theft needs an intent to take what belongs to someone else', 'Yes: he took a coat that was not his', 'Only if the coat was expensive', 'Only if he wore it'], 0,
      'Most crimes need a guilty mind as well as an act. An honest mistake about ownership can mean there was no intent to steal.'),
    q('In a criminal trial, who must prove the case, and how strongly?',
      ['The prosecution, beyond a reasonable doubt', 'The defendant must prove innocence', 'Either side, on balance', 'The judge decides who must prove it'], 0,
      'The prosecution carries the burden, to the high criminal standard.'),
  ] },
  { id: 'conlaw', name: 'Constitutional Law', skills: { interpretation: 3, oral: 1 }, exam: [
    q('A city bans all protest signs in a public park, whatever they say. What is the first question about the rule?',
      ['Whether it restricts speech more than needed for a real government interest', 'Whether the mayor likes protests', 'Whether the signs are well made', 'Whether the park is popular'], 0,
      'Limits on speech in public places are judged by what interest they serve and how tightly they are drawn.'),
  ] },
  { id: 'property', name: 'Property', skills: { interpretation: 2, drafting: 1 }, exam: [
    q('Two siblings inherit a house together. One wants to sell; the other wants to keep living there. What can usually happen?',
      ['A court can order the house divided or sold, sharing the money', 'The older sibling decides', 'Neither can ever sell', 'The government takes it'], 0,
      'Co-owners who cannot agree can usually ask a court to divide or sell the property.'),
  ] },
  { id: 'lrw', name: 'Legal Research and Writing', skills: { research: 4, writing: 4 }, exam: [
    q('You must write a memo on whether a client can break a lease early. Where do you start?',
      ['The lease itself, then the rules and decisions that apply to it', 'A news article about leases', 'What the client hopes the answer is', 'The last memo you wrote'], 0,
      'Start with the governing document, then the law that applies to it.'),
  ] },
];

/** Second- and third-year electives. `leads` is the specialty an elective prepares for. */
export const ELECTIVES = [
  { id: 'evidence', name: 'Evidence', skills: { evidence: 4, procedure: 1 }, leads: ['criminal_defense', 'prosecution', 'civil_litigation'], exam: [
    q('A witness testifies, "My neighbor told me she saw the defendant break the window." The neighbor is not in court. The likely objection?',
      ['Hearsay', 'Leading question', 'Relevance', 'Argumentative'], 0,
      'A statement made outside court, repeated to prove what it says, is hearsay unless an exception applies.') ] },
  { id: 'crimpro', name: 'Criminal Procedure', skills: { procedure: 3, evidence: 1 }, leads: ['criminal_defense', 'public_defense', 'prosecution'], exam: [
    q('Police search a car without a warrant or consent and find stolen goods. What does the defense lawyer consider?',
      ['A motion to suppress the evidence as unlawfully obtained', 'Asking the police to apologize', 'Pleading guilty right away', 'Nothing can be done'], 0,
      'Evidence found in an unlawful search may be excluded, depending on the rules that apply.') ] },
  { id: 'family_law', name: 'Family Law', skills: { family: 4, negotiation: 1 }, leads: ['family'], exam: [
    q('In deciding custody, what does a family court usually put first?',
      ['The best interests of the child', 'Which parent earns more', 'Which parent filed first', 'Which parent has the better lawyer'], 0,
      'Custody is decided on the child\'s interests, not wealth or tactics.') ] },
  { id: 'immigration_law', name: 'Immigration Law', skills: { immigration: 4, research: 1 }, leads: ['immigration'], exam: [
    q('An application is denied for a missing document the applicant actually has. The best first step?',
      ['Check whether the decision can be reopened or appealed in time, with the document', 'File the same form again without it', 'Ignore the decision', 'Leave the country at once'], 0,
      'Deadlines and the right route back (reopening, appeal or a new filing) matter most.') ] },
  { id: 'trial_ad', name: 'Trial Advocacy', skills: { oral: 3, examination: 2, cross: 2 }, leads: ['criminal_defense', 'prosecution', 'civil_litigation', 'public_defense'], exam: [
    q('On cross-examination, which kind of question is usually safest?',
      ['A short, leading question you already know the answer to', 'An open "why" question', 'A long question with three parts', 'A question about something you never checked'], 0,
      'Cross-examination works best with short, leading questions grounded in the record.') ] },
  { id: 'corporate_law', name: 'Corporations', skills: { business: 4, drafting: 2 }, leads: ['corporate'], exam: [
    q('A buyer is about to acquire a company. What is due diligence for?',
      ['Finding the risks and debts the buyer would be taking on', 'Making the deal close faster', 'Choosing the office furniture', 'Setting the CEO\'s salary'], 0,
      'Due diligence is the buyer checking what it is really buying.') ] },
  { id: 'tax', name: 'Taxation', skills: { interpretation: 3, business: 1 }, leads: ['tax'], exam: [
    q('A client\'s tax bill turns on whether a payment was a gift or wages. What decides it?',
      ['The facts of why and how it was paid, measured against the rules', 'What the client calls it', 'Whichever is cheaper', 'The amount alone'], 0,
      'The label does not decide it; the substance does.') ] },
  { id: 'employment', name: 'Employment Law', skills: { negotiation: 2, interpretation: 2 }, leads: ['employment'], exam: [
    q('A worker is dismissed a week after reporting a safety problem. What does a lawyer look into first?',
      ['Whether the dismissal was retaliation for the report', 'Whether the worker liked the job', 'The company\'s logo', 'Whether the worker was late once'], 0,
      'Timing close to a protected report is a reason to look for retaliation.') ] },
  { id: 'child_welfare', name: 'Child Welfare', skills: { family: 3, counseling: 2 }, leads: ['child_welfare'], exam: [
    q('What is the difference between a child\'s attorney and a guardian ad litem, in many systems?',
      ['The attorney argues for what the child wants; the guardian ad litem argues for the child\'s best interests', 'There is no difference', 'The guardian ad litem is always a judge', 'The attorney represents the parents'], 0,
      'One represents the child\'s wishes, the other advises on best interests. They are different jobs.') ] },
  { id: 'juvenile', name: 'Juvenile Justice', skills: { counseling: 2, procedure: 2 }, leads: ['juvenile_defense'], exam: [
    q('A fourteen-year-old is accused of shoplifting. Where is the case usually heard?',
      ['A juvenile or youth court, with a focus on rehabilitation', 'An adult jury trial', 'An immigration court', 'No court at all'], 0,
      'Young people are usually dealt with in youth courts, with different aims and procedures.') ] },
  { id: 'appellate', name: 'Appellate Advocacy', skills: { appellate: 4, oral: 1 }, leads: ['appellate'], exam: [
    q('What does an appeal court usually look at?',
      ['Whether the trial court made a legal error, on the record of the trial', 'A whole new trial with new witnesses', 'Which lawyer was more likeable', 'Only the sentence length'], 0,
      'Appeals review errors in the record; they do not rehear the case from scratch.') ] },
  { id: 'estates', name: 'Wills and Estates', skills: { drafting: 3, counseling: 1 }, leads: ['estate'], exam: [
    q('A will leaves "my house to my children." One child died before the parent. What does the lawyer check first?',
      ['What the will and the rules say about a gift to someone who died first', 'Which child visited most', 'The house\'s color', 'Nothing; the house goes to the state'], 0,
      'A gift to someone who has died can lapse, pass to their own children, or be shared out, depending on the will and the rules.') ] },
  { id: 'ip', name: 'Intellectual Property', skills: { interpretation: 2, business: 2 }, leads: ['ip'], exam: [
    q('A company uses a name for its shoes almost identical to a rival\'s well-known brand. The likely claim?',
      ['Trademark infringement, if customers are likely to be confused', 'Copyright in the word', 'Patent infringement', 'None'], 0,
      'Trademarks protect against names and marks likely to confuse customers.') ] },
  { id: 'admin', name: 'Administrative Law', skills: { interpretation: 2, procedure: 2 }, leads: ['government', 'environmental'], exam: [
    q('An agency refuses a permit without giving any reason. What can be challenged?',
      ['That the decision did not follow fair procedure or explain itself', 'That the official was rude', 'Nothing: agencies cannot be challenged', 'The color of the form'], 0,
      'Agencies must usually follow fair procedures and give reasons that can be reviewed.') ] },
];
export const COURSE_BY_ID = Object.fromEntries([...CORE_COURSES, ...ELECTIVES].map((c) => [c.id, c]));

/** Things to do in law school beyond the classes. Once each per year unless `per` says otherwise. */
export const SCHOOL_ACTS = [
  { id: 'study', name: 'Study for exams', gains: { research: 1, analysis: 1 } },
  { id: 'group', name: 'Join a study group', gains: { analysis: 1, counseling: 1 }, friend: true },
  { id: 'office_hours', name: 'Go to office hours', gains: { writing: 1 }, mentor: true },
  { id: 'moot', name: 'Enter moot court', from: 1, gains: { appellate: 3, oral: 2, research: 1 } },
  { id: 'mock', name: 'Enter mock trial', from: 1, gains: { oral: 2, examination: 2, cross: 1, procedure: 1 } },
  { id: 'clinic', name: 'Join a legal clinic', from: 1, gains: { counseling: 3, procedure: 1, ethics: 1 } },
];

/** Summer and term-time placements. Each has a supervisor who stays in the player's life. */
export const INTERNSHIPS = [
  { id: 'judicial', name: 'Judicial internship', who: 'Judge', gains: { writing: 2, research: 2 }, leads: 'judiciary' },
  { id: 'firm', name: 'Law firm summer associate', who: 'Supervising partner', gains: { drafting: 2, business: 1, research: 1 }, leads: 'lawyer', pay: 2400 },
  { id: 'prosecutor', name: 'Prosecutor\'s office internship', who: 'Senior prosecutor', gains: { evidence: 2, procedure: 1 }, leads: 'prosecutor' },
  { id: 'defender', name: 'Public defender\'s office internship', who: 'Supervising defender', gains: { counseling: 2, procedure: 1 }, leads: 'defender' },
  { id: 'legal_aid', name: 'Legal aid placement', who: 'Legal aid director', gains: { counseling: 2, family: 1 }, leads: 'lawyer' },
  { id: 'agency', name: 'Government agency placement', who: 'Agency counsel', gains: { interpretation: 2, research: 1 }, leads: 'gov_counsel' },
];
export const INTERNSHIP_BY_ID = Object.fromEntries(INTERNSHIPS.map((x) => [x.id, x]));

// ---------- The bar ----------

/** The bar exam's questions, drawn from first-year and core subjects. */
export const BAR_SUBJECTS = ['contracts', 'torts', 'civpro', 'crimlaw', 'conlaw', 'property', 'evidence', 'crimpro'];
/** The share of points a pass needs. Fictional. */
export const BAR_PASS = 0.62;

// ---------- Specialties and careers ----------

/**
 * Practice areas. `cases` lists the case templates a specialty takes on; `playable` is true only for specialties with
 * cases that run to an end in the game. Others are kept honest: they exist, and say they are not yet playable.
 * `tracks` is where the specialty is practiced: a firm (lawyer), the prosecutor's office, the public defender's office,
 * a government legal office, or a practice of one's own.
 */
export const SPECIALTIES = [
  { id: 'criminal_defense', name: 'Criminal Defense', tracks: ['lawyer', 'own'], cases: ['burglary_hale', 'burglary', 'theft', 'assault', 'homicide'], playable: true, skills: ['evidence', 'cross', 'counseling'], fees: ['flat', 'hourly'] },
  { id: 'public_defense', name: 'Public Defense', tracks: ['defender'], cases: ['burglary', 'theft', 'assault', 'homicide'], playable: true, skills: ['evidence', 'cross', 'counseling'], fees: ['salary'] },
  { id: 'prosecution', name: 'Criminal Prosecution', tracks: ['prosecutor'], cases: ['burglary', 'theft', 'assault', 'homicide'], playable: true, skills: ['evidence', 'examination', 'ethics'], fees: ['salary'] },
  { id: 'family', name: 'Family & Divorce Law', tracks: ['lawyer', 'own'], cases: ['divorce', 'custody'], playable: true, skills: ['family', 'negotiation', 'counseling'], fees: ['hourly', 'flat'] },
  { id: 'child_welfare', name: 'Child Welfare Law', tracks: ['lawyer', 'gov_counsel', 'own'], cases: ['dependency'], playable: true, skills: ['family', 'counseling'], fees: ['salary', 'flat'] },
  { id: 'juvenile_defense', name: 'Juvenile Defense', tracks: ['defender', 'lawyer'], cases: ['juvenile'], playable: true, skills: ['counseling', 'procedure'], fees: ['salary', 'flat'] },
  { id: 'immigration', name: 'Immigration Law', tracks: ['lawyer', 'own'], cases: ['family_petition', 'removal'], playable: true, skills: ['immigration', 'research'], fees: ['flat', 'hourly'] },
  { id: 'civil_litigation', name: 'Civil Litigation', tracks: ['lawyer', 'own'], cases: ['contract_dispute', 'injury'], playable: true, skills: ['research', 'negotiation', 'oral'], fees: ['hourly', 'contingency'] },
  { id: 'personal_injury', name: 'Personal Injury', tracks: ['lawyer', 'own'], cases: ['injury'], playable: true, skills: ['negotiation', 'evidence'], fees: ['contingency'] },
  { id: 'corporate', name: 'Corporate Law', tracks: ['lawyer', 'own'], cases: ['acquisition', 'supply_deal'], playable: true, skills: ['drafting', 'business', 'negotiation'], fees: ['hourly'] },
  { id: 'employment', name: 'Employment Law', tracks: ['lawyer', 'own'], cases: ['dismissal'], playable: true, skills: ['negotiation', 'interpretation'], fees: ['hourly', 'contingency'] },
  { id: 'estate', name: 'Estate Planning & Probate', tracks: ['lawyer', 'own'], cases: ['will', 'probate'], playable: true, skills: ['drafting', 'counseling'], fees: ['flat', 'hourly'] },
  { id: 'appellate', name: 'Appellate Practice', tracks: ['lawyer', 'defender', 'prosecutor', 'gov_counsel', 'own'], cases: ['appeal_brief'], playable: true, skills: ['appellate', 'oral'], fees: ['hourly', 'salary'] },
  { id: 'civil_rights', name: 'Civil Rights', tracks: ['lawyer', 'own'], cases: ['police_conduct'], playable: true, skills: ['interpretation', 'oral'], fees: ['contingency', 'hourly'] },
  { id: 'real_estate', name: 'Real Estate Law', tracks: ['lawyer', 'own'], cases: ['closing_defect', 'boundary'], playable: true, skills: ['drafting'], fees: ['flat'] },
  { id: 'ip', name: 'Intellectual Property', tracks: ['lawyer', 'own'], cases: ['trademark', 'license_deal'], playable: true, skills: ['interpretation', 'business'], fees: ['hourly'] },
  { id: 'tax', name: 'Tax Law', tracks: ['lawyer', 'gov_counsel', 'own'], cases: ['tax_appeal', 'restructure'], playable: true, skills: ['interpretation', 'business'], fees: ['hourly'] },
  { id: 'environmental', name: 'Environmental Law', tracks: ['lawyer', 'gov_counsel', 'own'], cases: ['permit_case'], playable: true, skills: ['interpretation'], fees: ['hourly', 'salary'] },
  { id: 'government', name: 'Government & Administrative Law', tracks: ['gov_counsel'], cases: ['agency_review'], playable: true, skills: ['interpretation', 'procedure'], fees: ['salary'] },
  { id: 'legal_aid', name: 'Public Interest / Legal Aid', tracks: ['lawyer'], cases: ['divorce', 'family_petition', 'dismissal'], playable: true, skills: ['counseling', 'negotiation'], fees: ['salary'] },
];
export const SPECIALTY_BY_ID = Object.fromEntries(SPECIALTIES.map((s) => [s.id, s]));

/**
 * The legal career trees, keyed by career id (data/careers.js, data/occupations.js). Each has its own titles; reaching
 * some levels takes more than years and reviews: `gate` names what else it takes (engine/lawPractice.js).
 * `cases`: the hardest complexity a lawyer at that level is given as lead counsel.
 */
export const TRACKS = {
  lawyer: { name: 'Law firm', gates: { 2: 'partnership', 3: 'managing' }, cases: [2, 3, 4, 5], minDone: [0, 6, 20, 40] },
  prosecutor: { name: 'Prosecutor\'s office', gates: { 3: 'da' }, cases: [2, 3, 4, 5], minDone: [0, 8, 25, 40] },
  defender: { name: 'Public defender\'s office', gates: { 2: 'chief_defender' }, cases: [2, 3, 5], minDone: [0, 10, 40] },
  gov_counsel: { name: 'Government legal office', gates: { 3: 'general_counsel' }, cases: [2, 3, 4, 4], minDone: [0, 5, 15, 30] },
  judiciary: { name: 'The bench', gates: { 1: 'elevation', 2: 'elevation' }, cases: [0, 0, 0], minDone: [0, 0, 0] },
  attorney_general: { name: 'The Attorney General\'s office', gates: { 1: 'ag' }, cases: [0, 0], minDone: [0, 0] },
  us_attorney: { name: 'United States Attorney\'s office', gates: { 1: 'us_attorney' }, cases: [5, 5], minDone: [0, 0] },
  solicitor_general: { name: 'Office of the Solicitor General', gates: { 1: 'solicitor_general' }, cases: [0, 0], minDone: [0, 0] },
};
export const LEGAL_CAREERS = Object.keys(TRACKS);

// ---------- Cases ----------

/**
 * Case templates. kind decides the adapter (engine/lawCases.js): criminal cases run through the Justice Engine's own
 * case; family, child, immigration, civil and transactions run here. `stages` are [stage, months]; a case moves on as
 * game months pass. `forum`: where it is heard ('none' for a transaction). `jury` only where the profile allows one.
 *
 * evidence: [id, kind, label, favors ('client'|'other'), weight 1-5, reliability 0-100, admissibility ('ok' |
 *            'challengeable', with the basis that can exclude it)]
 * witnesses: [id, role, side, credibility 0-100, weakness (the line of cross that the file supports)]
 */
const E = (id, kind, label, favors, weight, reliability, admissibility = 'ok', basis = null) => ({ id, kind, label, favors, weight, reliability, admissibility, basis });
const W = (id, role, side, credibility, weakness = null) => ({ id, role, side, credibility, weakness });

export const CASE_TEMPLATES = {
  // The demonstration trial: a defense brief with an identification, a camera, a timeline and a disputed item.
  burglary_hale: {
    kind: 'criminal', offense: 'burglary', level: 2, title: 'The State v. {client}', fixedClient: { firstName: 'Morgan', lastName: 'Hale', age: 27 },
    summary: 'The prosecution says {client} broke into a hardware store after closing and took power tools. {client} says they were walking home from a late shift.',
    stages: [['intake', 0], ['discovery', 2], ['pretrial', 2], ['trial', 3], ['verdict', 0]], forum: 'trial', jury: true,
    evidence: [
      E('ident', 'witness_statement', 'A neighbor picked {client} out of a photo lineup', 'other', 4, 45, 'challengeable', 'suggestive_lineup'),
      E('camera', 'recording', 'A security camera recording from across the street', 'other', 3, 70),
      E('timeline', 'timecard', '{client}\'s timecard shows them clocking out 20 minutes before the break-in, 3 miles away', 'client', 3, 85),
      E('drill', 'physical', 'A drill found in {client}\'s car, said to be from the store', 'other', 3, 55, 'challengeable', 'unlawful_search'),
    ],
    witnesses: [W('neighbor', 'Eyewitness', 'other', 55, 'lighting'), W('officer', 'Arresting officer', 'other', 70, 'warrant'), W('manager', 'Shift manager', 'client', 75)],
    research: q('The drill was found when police searched {client}\'s car after a traffic stop, without a warrant or consent. What is the issue?',
      ['Whether the search was lawful, so the drill can be used at trial', 'Whether the drill was expensive', 'Whether the store had insurance', 'Whether {client} owns a car'], 0,
      'Evidence from a search without a warrant, consent or another lawful basis can be challenged before trial.'),
    motion: { name: 'Motion to suppress the drill', target: 'drill', options: [
      ['Argue the warrantless search had no lawful basis', 'strong'], ['Ask the court to exclude it because it hurts the defense', 'improper'],
      ['Concede the drill and focus on the identification', 'concede'], ['Ask for more time to investigate', 'delay']] },
    opening: [['Hold the prosecution to its burden: the evidence must leave no reasonable doubt', 'burden'], ['Walk the jury through the timecard: {client} was three miles away', 'theory'],
      ['Promise the jury they will see who really did it', 'overpromise'], ['Keep it short and leave the evidence to speak', 'brief']],
    cross: { witness: 'neighbor', text: 'The neighbor says they saw {client} by the store\'s side door at 11 at night.', options: [
      ['Ask how far away they were, and where the nearest working streetlight was', 'lighting'], ['Ask how long they watched the person', 'duration'],
      ['Ask why they dislike people from {client}\'s neighborhood', 'improper'], ['Ask them to repeat their story', 'repeat']] },
    objection: { by: 'prosecution', text: 'The prosecutor asks the officer: "And the store owner told you the drill was definitely theirs, didn\'t they?"',
      valid: 'hearsay', options: [['Object: hearsay', 'hearsay'], ['Object: leading', 'leading'], ['Object: relevance', 'relevance'], ['Let it go', 'none']] },
    closing: [['Go through each piece of evidence, and the doubt in each', 'evidence'], ['Appeal to the jury\'s sympathy for {client}', 'sympathy'], ['Attack the prosecutor personally', 'improper'], ['Return to the timecard and the burden of proof', 'burden']],
  },
  burglary: {
    kind: 'criminal', offense: 'burglary', level: 2, title: 'The State v. {client}',
    summary: '{client} is accused of breaking into a home and taking jewelry. A partial fingerprint and a pawn receipt are the main evidence.',
    stages: [['intake', 0], ['discovery', 2], ['pretrial', 2], ['trial', 3], ['verdict', 0]], forum: 'trial', jury: true,
    evidence: [E('print', 'forensic', 'A partial fingerprint on the window frame', 'other', 3, 60, 'challengeable', 'chain_of_custody'),
      E('receipt', 'document', 'A pawn shop receipt in {client}\'s name, two days later', 'other', 4, 80), E('alibi', 'witness_statement', 'A friend says {client} was with them that evening', 'client', 2, 50)],
    witnesses: [W('tech', 'Fingerprint examiner', 'other', 70, 'partial'), W('friend', 'Alibi witness', 'client', 50)],
    research: q('The fingerprint was stored in an unsealed bag for a week. What matters?', ['The chain of custody: can they show it was not mixed up or tampered with?', 'Who paid for the bag', 'Whether the window was clean', 'The weather that week'], 0, 'Physical evidence needs a record showing it stayed the same from collection to court.'),
    motion: { name: 'Motion to exclude the fingerprint', target: 'print', options: [['Challenge the broken chain of custody', 'strong'], ['Say fingerprints are never reliable', 'weak'], ['Concede it', 'concede'], ['Ask for a delay', 'delay']] },
    opening: [['The burden is on the prosecution', 'burden'], ['A partial print and a receipt are not proof of a break-in', 'theory'], ['Promise a surprise witness', 'overpromise'], ['Keep it brief', 'brief']],
    cross: { witness: 'tech', text: 'The examiner says the print matches {client}.', options: [['Ask how many points matched on a partial print', 'partial'], ['Ask about their training', 'repeat'], ['Ask about their divorce', 'improper'], ['Ask them to explain fingerprints', 'repeat']] },
    objection: { by: 'prosecution', text: 'The prosecutor asks the examiner: "So you would agree the defendant is obviously a thief?"', valid: 'speculation',
      options: [['Object: speculation, beyond the witness\'s expertise', 'speculation'], ['Object: hearsay', 'hearsay'], ['Object: leading', 'leading'], ['Let it go', 'none']] },
    closing: [['Go through the doubt in each piece', 'evidence'], ['Ask for sympathy', 'sympathy'], ['Attack the police', 'improper'], ['The burden has not been met', 'burden']],
  },
  theft: {
    kind: 'criminal', offense: 'theft', level: 1, title: 'The State v. {client}',
    summary: '{client} is accused of leaving a shop without paying for a jacket. They say they forgot it was over their arm.',
    stages: [['intake', 0], ['pretrial', 1], ['hearing', 2], ['verdict', 0]], forum: 'trial', jury: false,
    evidence: [E('cctv', 'recording', 'Store camera footage of {client} leaving', 'other', 3, 80), E('receipt', 'document', 'A receipt for other items paid for minutes earlier', 'client', 2, 90)],
    witnesses: [W('guard', 'Store guard', 'other', 65, 'distraction')],
    research: q('Theft needs an intent to take what is not yours. What helps show there was none?', ['That {client} paid for everything else and did not hide the jacket', 'That the jacket was cheap', 'That the store is big', 'That {client} is young'], 0, 'Conduct around the act can show whether there was an intent to steal.'),
    motion: { name: 'Motion to dismiss for lack of evidence of intent', target: null, options: [['Argue there is no evidence of intent', 'strong'], ['Argue the store is to blame', 'weak'], ['Concede', 'concede'], ['Delay', 'delay']] },
    opening: [['The burden is on the prosecution', 'burden'], ['An honest mistake is not theft', 'theory'], ['Promise the store will apologize', 'overpromise'], ['Brief', 'brief']],
    cross: { witness: 'guard', text: 'The guard says {client} walked out quickly.', options: [['Ask whether {client} tried to hide the jacket', 'distraction'], ['Ask how long the guard has worked there', 'repeat'], ['Ask about the guard\'s pay', 'improper'], ['Ask them to repeat it', 'repeat']] },
    objection: { by: 'prosecution', text: 'The prosecutor asks the guard: "People like that always steal, don\'t they?"', valid: 'relevance', options: [['Object: relevance and prejudice', 'relevance'], ['Object: hearsay', 'hearsay'], ['Object: leading', 'leading'], ['Let it go', 'none']] },
    closing: [['The receipt and the open jacket show no intent', 'evidence'], ['Ask for sympathy', 'sympathy'], ['Blame the guard', 'improper'], ['Not proven', 'burden']],
  },
  assault: {
    kind: 'criminal', offense: 'assault', level: 3, title: 'The State v. {client}',
    summary: '{client} is accused of injuring a man in a bar fight. {client} says the other man attacked first.',
    stages: [['intake', 0], ['discovery', 2], ['pretrial', 3], ['trial', 3], ['verdict', 0]], forum: 'trial', jury: true,
    evidence: [E('medical', 'medical_record', 'The other man\'s hospital record', 'other', 3, 90), E('video', 'recording', 'A phone video that starts halfway through', 'client', 3, 60), E('bartender', 'witness_statement', 'The bartender says the other man swung first', 'client', 3, 70)],
    witnesses: [W('victim', 'Complainant', 'other', 55, 'drunk'), W('bartender', 'Bartender', 'client', 70)],
    research: q('{client} says it was self-defense. What must usually be shown?', ['A reasonable belief of being attacked, and force in proportion to it', 'That {client} was angry', 'That the other man was rich', 'That nobody was hurt'], 0, 'Self-defense usually needs a reasonable belief of threat and proportionate force.'),
    motion: { name: 'Motion to admit the phone video in full', target: null, options: [['Argue the video is authentic and relevant', 'strong'], ['Argue it proves everything', 'weak'], ['Leave it out', 'concede'], ['Delay', 'delay']] },
    opening: [['The burden is on the prosecution', 'burden'], ['{client} defended themselves', 'theory'], ['Promise the video shows it all', 'overpromise'], ['Brief', 'brief']],
    cross: { witness: 'victim', text: 'The complainant says {client} attacked without warning.', options: [['Ask how much they had to drink that night', 'drunk'], ['Ask about their injuries again', 'repeat'], ['Ask about their past girlfriends', 'improper'], ['Ask them to repeat it', 'repeat']] },
    objection: { by: 'prosecution', text: 'The prosecutor leads its own witness: "You were terrified, weren\'t you?"', valid: 'leading', options: [['Object: leading', 'leading'], ['Object: hearsay', 'hearsay'], ['Object: relevance', 'relevance'], ['Let it go', 'none']] },
    closing: [['The bartender and the video show who started it', 'evidence'], ['Sympathy', 'sympathy'], ['Attack the complainant', 'improper'], ['Self-defense was not disproved', 'burden']],
  },
  homicide: {
    kind: 'criminal', offense: 'homicide', level: 5, title: 'The State v. {client}',
    summary: '{client} is charged with the death of a business partner. The case rests on a motive, a phone location record and a disputed confession.',
    stages: [['intake', 0], ['discovery', 4], ['pretrial', 4], ['trial', 4], ['verdict', 0]], forum: 'trial', jury: true,
    evidence: [E('motive', 'financial_record', 'Records of a bitter dispute over money', 'other', 2, 85), E('location', 'phone_record', 'Phone records place {client} near the scene', 'other', 4, 75),
      E('confession', 'statement', 'A statement to police after six hours without a lawyer', 'other', 5, 40, 'challengeable', 'coerced'), E('expert', 'expert_opinion', 'A defense expert says the time of death is uncertain', 'client', 3, 70)],
    witnesses: [W('detective', 'Lead detective', 'other', 70, 'interrogation'), W('analyst', 'Phone records analyst', 'other', 70, 'tower_range'), W('pathologist', 'Defense pathologist', 'client', 75)],
    research: q('{client} asked for a lawyer twice during a six-hour interview. Police kept questioning. What is the issue?', ['Whether the statement was obtained lawfully and voluntarily', 'Whether the room was comfortable', 'Whether {client} was tired of talking', 'Whether the detective is experienced'], 0, 'Statements taken after a request for a lawyer, or under pressure, can be excluded.'),
    motion: { name: 'Motion to suppress the statement', target: 'confession', options: [['Argue the statement was taken after a request for counsel', 'strong'], ['Argue every confession is unreliable', 'weak'], ['Concede it', 'concede'], ['Delay', 'delay']] },
    opening: [['The burden is on the prosecution, and it is heavy', 'burden'], ['The time of death and the phone record do not fit', 'theory'], ['Promise to name the real killer', 'overpromise'], ['Brief', 'brief']],
    cross: { witness: 'analyst', text: 'The analyst says the phone was near the scene.', options: [['Ask how wide an area one phone tower covers', 'tower_range'], ['Ask about their qualifications again', 'repeat'], ['Ask about their politics', 'improper'], ['Ask them to repeat it', 'repeat']] },
    objection: { by: 'prosecution', text: 'The prosecutor asks the detective: "The victim\'s sister told you the defendant had threatened him, correct?"', valid: 'hearsay', options: [['Object: hearsay', 'hearsay'], ['Object: leading', 'leading'], ['Object: speculation', 'speculation'], ['Let it go', 'none']] },
    closing: [['Each piece, and the doubt in each', 'evidence'], ['Sympathy', 'sympathy'], ['Accuse the police of a plot', 'improper'], ['Reasonable doubt remains', 'burden']],
  },
  divorce: {
    kind: 'family', level: 2, title: 'In re the Marriage of {client} and {other}', jury: false, forum: 'family',
    summary: '{client} and {other} are divorcing after {years} years. They share a home and savings; they disagree on how to divide them.',
    stages: [['intake', 0], ['filing', 1], ['disclosure', 3], ['negotiation', 2], ['hearing', 2], ['judgment', 0]],
    evidence: [E('home', 'property_record', 'The family home, in both names', 'client', 3, 95), E('accounts', 'financial_record', 'Bank and pension statements from both sides', 'client', 3, 90), E('hidden', 'financial_record', 'A savings account {other} did not list', 'client', 3, 70)],
    witnesses: [W('accountant', 'Forensic accountant', 'client', 75)],
    research: q('{other} did not list a savings account in their financial disclosure. What follows?', ['Full disclosure is required; the court can take the hidden money into account', 'Nothing: it is theirs', '{client} loses the house', 'The divorce is canceled'], 0, 'Both sides must disclose finances fully. Hiding assets usually counts against the one who hid them.'),
    motion: { name: 'Petition for dissolution, with a request for full disclosure', target: 'hidden', options: [['Ask the court to order full disclosure of all accounts', 'strong'], ['Ask for everything, for {client}', 'weak'], ['Leave the accounts alone', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  custody: {
    kind: 'family', level: 3, title: 'In re the Custody of {child}', jury: false, forum: 'family',
    summary: '{client} and {other} cannot agree where {child}, aged {childAge}, should live. Both are fit parents with different schedules.',
    stages: [['intake', 0], ['filing', 1], ['evaluation', 3], ['negotiation', 2], ['hearing', 2], ['judgment', 0]],
    evidence: [E('school', 'school_record', '{child}\'s school record and attendance', 'client', 3, 90), E('schedule', 'document', 'Both parents\' work schedules', 'other', 2, 85), E('evaluator', 'expert_opinion', 'A custody evaluator\'s report', 'client', 4, 80)],
    witnesses: [W('evaluator', 'Custody evaluator', 'client', 80)],
    research: q('What standard decides where {child} lives?', ['The child\'s best interests', 'Which parent earns more', 'Which parent filed first', 'Which parent is liked by the judge'], 0, 'Custody turns on the child\'s best interests: stability, care, the child\'s needs and, at some ages, wishes.'),
    motion: { name: 'Proposed parenting plan', target: null, options: [['A plan built around {child}\'s school and routines', 'strong'], ['A plan giving {client} everything', 'weak'], ['Accept {other}\'s plan', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  dependency: {
    kind: 'child', level: 3, title: 'In re {child}, a minor', jury: false, forum: 'juvenile', role: 'childAttorney',
    summary: 'Child services asked the court to review {child}\'s care after repeated missed school and an unsafe home. You represent {child}, aged {childAge}.',
    stages: [['intake', 0], ['review', 2], ['services', 3], ['hearing', 2], ['judgment', 0]],
    evidence: [E('report', 'agency_report', 'The caseworker\'s report on the home', 'other', 3, 75), E('school', 'school_record', 'School attendance and a teacher\'s note', 'other', 2, 85), E('wishes', 'interview', '{child}\'s own wishes, in their words', 'client', 3, 90)],
    witnesses: [W('caseworker', 'Caseworker', 'other', 70)],
    research: q('As {child}\'s attorney, what is your role?', ['To present what {child} wants, while giving honest advice', 'To decide what is best and argue it whatever {child} says', 'To represent the parents', 'To prosecute the parents'], 0, 'A child\'s attorney represents the child\'s expressed wishes. A guardian ad litem, where there is one, advises on best interests.'),
    motion: { name: 'Request for services', target: null, options: [['Ask for family services so {child} can stay safely at home, as {child} wishes', 'strong'], ['Ask for whatever the agency wants', 'weak'], ['Say nothing', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  juvenile: {
    kind: 'child', level: 2, title: 'In re {child}, a juvenile', jury: false, forum: 'juvenile', role: 'juvenileDefense',
    summary: '{child}, aged {childAge}, is accused of damaging a school bus shelter with friends. It is a first offense.',
    stages: [['intake', 0], ['review', 1], ['hearing', 2], ['judgment', 0]],
    evidence: [E('photo', 'photograph', 'A photo of three teenagers near the shelter', 'other', 2, 60), E('record', 'school_record', '{child}\'s clean record and good grades', 'client', 2, 90)],
    witnesses: [W('officer', 'School resource officer', 'other', 65)],
    research: q('What does a youth court usually aim for with a first offense?', ['Accountability and rehabilitation, often through diversion', 'The harshest sentence', 'An adult trial', 'Nothing at all'], 0, 'Youth courts weigh rehabilitation, and first offenses are often diverted.'),
    motion: { name: 'Request for diversion', target: null, options: [['Ask for diversion: repair the damage and a community program', 'strong'], ['Ask for dismissal because {child} is young', 'weak'], ['Accept a formal finding', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  family_petition: {
    kind: 'immigration', level: 2, title: 'Petition for {client}\'s {relation}', jury: false, forum: 'agency',
    summary: '{client} wants to bring their {relation} to live with them. The petition needs proof of the relationship and that {client} can support them.',
    stages: [['intake', 0], ['filing', 2], ['review', 3], ['interview', 2], ['decision', 0]],
    evidence: [E('birth', 'document', 'Birth and marriage certificates', 'client', 4, 90), E('income', 'financial_record', '{client}\'s income records', 'client', 3, 85), E('gap', 'document', 'A missing translation of one certificate', 'other', 2, 90)],
    witnesses: [],
    research: q('The agency sends a request for evidence about one untranslated certificate. The best response?', ['A certified translation, sent before the deadline', 'A letter saying it is obvious', 'Nothing until the interview', 'A new petition from scratch'], 0, 'Answering a request for evidence fully and on time usually decides these cases.'),
    motion: { name: 'Petition and supporting evidence', target: 'gap', options: [['File with certified translations and full income records', 'strong'], ['File now and fix it later', 'weak'], ['Leave the certificate out', 'concede'], ['Delay', 'delay']] },
    agency: true,
  },
  removal: {
    kind: 'immigration', level: 3, title: 'In the Matter of {client}, Removal Proceedings', jury: false, forum: 'immigration',
    summary: '{client} has lived here for {years} years and faces removal after their visa lapsed. They may qualify for relief through family ties and a long, clean record.',
    stages: [['intake', 0], ['filing', 2], ['hearing', 4], ['decision', 0]],
    evidence: [E('residence', 'document', 'Leases and pay slips covering {years} years', 'client', 4, 85), E('family', 'document', 'Records of a citizen child and spouse', 'client', 4, 90), E('lapse', 'document', 'The visa that lapsed', 'other', 3, 95)],
    witnesses: [W('spouse', 'Spouse', 'client', 70)],
    research: q('Immigration court is not a criminal court. What does the judge decide?', ['Whether {client} can be removed, and whether any relief applies', 'Whether {client} is guilty of a crime', 'How long {client} goes to prison', 'Whether a jury should hear it'], 0, 'Removal proceedings are civil, before an immigration judge, with no jury.'),
    motion: { name: 'Application for relief from removal', target: null, options: [['Apply for relief, supported by the family and residence records', 'strong'], ['Argue the law is unfair', 'weak'], ['Ask for voluntary departure', 'concede'], ['Delay', 'delay']] },
    agency: true,
  },
  contract_dispute: {
    kind: 'civil', level: 1, title: '{client} v. {otherOrg}', jury: true, forum: 'trial',
    summary: '{client} built shelving for {otherOrg}, which has not paid the final invoice, saying the work was late.',
    stages: [['intake', 0], ['demand', 1], ['pleadings', 2], ['discovery', 2], ['negotiation', 2], ['trial', 3], ['judgment', 0]],
    evidence: [E('contract', 'contract', 'The signed contract, with no date for completion', 'client', 4, 95), E('emails', 'message', 'Emails approving the finished work', 'client', 3, 85), E('delay', 'document', 'A delivery note three weeks after the estimate', 'other', 2, 80)],
    witnesses: [W('manager', 'Their manager', 'other', 60, 'approved')],
    research: q('The contract has no completion date. What usually applies?', ['A reasonable time, judged on the circumstances', 'The work had to be done the next day', 'No time limit at all, ever', 'Whatever the buyer says later'], 0, 'Where a contract says nothing, courts often read in a reasonable time.'),
    motion: { name: 'Complaint for the unpaid invoice', target: null, options: [['Claim the invoice, relying on the contract and the approval emails', 'strong'], ['Claim triple the invoice', 'weak'], ['Drop the claim', 'concede'], ['Delay', 'delay']] },
    cross: { witness: 'manager', text: 'Their manager says the work was unacceptable.', options: [['Show them their own email approving it', 'approved'], ['Ask about their qualifications', 'repeat'], ['Ask about their car', 'improper'], ['Ask them to repeat it', 'repeat']] },
    settle: true,
  },
  injury: {
    kind: 'civil', level: 2, title: '{client} v. {otherOrg}', jury: true, forum: 'trial',
    summary: '{client} slipped on a wet floor in a supermarket run by {otherOrg} and broke a wrist. There was no warning sign.',
    stages: [['intake', 0], ['demand', 1], ['pleadings', 2], ['discovery', 3], ['negotiation', 2], ['trial', 3], ['judgment', 0]],
    evidence: [E('medical', 'medical_record', 'Hospital records of the broken wrist', 'client', 4, 95), E('log', 'business_record', 'The store\'s cleaning log, with a gap of two hours', 'client', 3, 80), E('shoes', 'photograph', 'A photo of {client}\'s worn shoes', 'other', 1, 70)],
    witnesses: [W('clerk', 'Store clerk', 'other', 60, 'log_gap')],
    research: q('What must {client} usually show?', ['The store knew or should have known of the spill and did not deal with it', 'That {client} was hurt, nothing more', 'That the store is large', 'That the floor was tiled'], 0, 'Premises claims turn on whether the owner knew or should have known of the danger.'),
    motion: { name: 'Complaint for negligence', target: null, options: [['Claim damages based on the cleaning log gap', 'strong'], ['Claim a vast sum', 'weak'], ['Drop it', 'concede'], ['Delay', 'delay']] },
    cross: { witness: 'clerk', text: 'The clerk says the floor was checked often.', options: [['Show the two-hour gap in the log', 'log_gap'], ['Ask about the weather', 'repeat'], ['Ask about the clerk\'s pay', 'improper'], ['Ask them to repeat it', 'repeat']] },
    settle: true,
  },
  // The family's claim after a fatal collision (engine/investigations/local.js): offered only from a real investigation.
  collision_claim: {
    kind: 'civil', level: 3, title: '{client} v. {other}', jury: true, forum: 'trial', otherTitle: 'Driver',
    summary: '{client}\'s sibling was struck and killed by a car driven by {other}. The family claims for the loss.',
    stages: [['intake', 0], ['demand', 1], ['pleadings', 2], ['discovery', 3], ['negotiation', 2], ['trial', 3], ['judgment', 0]],
    evidence: [E('death', 'medical_record', 'The hospital record of the injuries and the death', 'client', 3, 95), E('recon', 'document', 'The police collision reconstruction', 'client', 4, 85), E('light', 'photograph', 'A photograph of the broken street light at the crossing', 'other', 2, 80)],
    witnesses: [W('driver', 'The driver', 'other', 55, 'speed')],
    research: q('What must the family usually show?', ['That the driver did not take the care a reasonable driver would, and that this caused the death', 'That a death happened, nothing more', 'That the driver was convicted of a crime', 'That the driver is insured'], 0, 'A civil claim turns on negligence and causation, proved on the balance of probabilities, not on a criminal conviction.'),
    motion: { name: 'Complaint for wrongful death', target: null, options: [['Claim damages on the reconstruction and the record', 'strong'], ['Claim a vast sum to punish the driver', 'weak'], ['Drop it', 'concede'], ['Delay', 'delay']] },
    cross: { witness: 'driver', text: 'The driver says they were driving with care.', options: [['Ask about the speed the reconstruction found', 'speed'], ['Ask about the weather', 'repeat'], ['Ask about their family', 'improper'], ['Ask them to repeat it', 'repeat']] },
    settle: true,
  },
  dismissal: {
    kind: 'civil', level: 2, title: '{client} v. {otherOrg}', jury: false, forum: 'tribunal',
    summary: '{client} was dismissed from {otherOrg} a week after reporting a safety problem.',
    stages: [['intake', 0], ['filing', 1], ['disclosure', 2], ['negotiation', 2], ['hearing', 2], ['judgment', 0]],
    evidence: [E('report', 'message', '{client}\'s written safety report', 'client', 4, 90), E('timing', 'document', 'The dismissal letter, seven days later', 'client', 3, 95), E('reviews', 'document', 'Two earlier warnings about lateness', 'other', 2, 80)],
    witnesses: [W('hr', 'HR manager', 'other', 60, 'timing')],
    research: q('What makes this a likely retaliation claim?', ['A protected report followed closely by dismissal', 'That {client} disliked the job', 'That the company is large', 'That {client} was ever late'], 0, 'Close timing after a protected report is strong evidence of retaliation.'),
    motion: { name: 'Claim of retaliatory dismissal', target: null, options: [['Claim, relying on the report and its timing', 'strong'], ['Claim the company is evil', 'weak'], ['Drop it', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  will: {
    kind: 'transaction', level: 1, title: 'The will of {client}', jury: false, forum: 'none',
    summary: '{client} wants a will that provides for their family, and a guardian for any young children.',
    stages: [['intake', 0], ['drafting', 1], ['signing', 1], ['done', 0]],
    evidence: [E('assets', 'financial_record', 'A list of {client}\'s assets', 'client', 3, 90), E('family', 'document', 'Who is in {client}\'s family', 'client', 3, 95)],
    witnesses: [],
    research: q('What makes a will valid in most places?', ['Signed by the person, with the required witnesses, while of sound mind', 'Written in pen', 'Read aloud to the family', 'Kept in a bank'], 0, 'Formalities usually include a signature and witnesses, and the capacity to make it.'),
    motion: { name: 'Draft will', target: null, options: [['A clear will with a guardian named and a residuary clause', 'strong'], ['A one-line will', 'weak'], ['Leave it to the default rules', 'concede'], ['Delay', 'delay']] },
    transaction: true,
  },
  probate: {
    kind: 'transaction', level: 2, title: 'The estate of {deceased}', jury: false, forum: 'probate',
    summary: '{client} is executor of {deceased}\'s estate. Two relatives disagree over a painting.',
    stages: [['intake', 0], ['filing', 2], ['inventory', 3], ['negotiation', 2], ['distribution', 0]],
    evidence: [E('will', 'document', 'The will, leaving "my art" to one niece', 'client', 4, 95), E('note', 'document', 'A handwritten note promising the painting to a nephew', 'other', 2, 50)],
    witnesses: [],
    research: q('A handwritten note conflicts with the signed will. Which usually governs?', ['The properly signed and witnessed will', 'The more recent piece of paper, whatever its form', 'Whoever asks first', 'The court flips a coin'], 0, 'An informal note usually cannot override a valid will, unless it meets the rules itself.'),
    motion: { name: 'Petition for probate', target: null, options: [['Probate the will as written and inventory the estate', 'strong'], ['Give the painting to whoever is louder', 'weak'], ['Split everything evenly regardless', 'concede'], ['Delay', 'delay']] },
    settle: true, transaction: true,
  },
  acquisition: {
    kind: 'transaction', level: 4, title: '{clientOrg}\'s acquisition of {otherOrg}', jury: false, forum: 'none',
    summary: '{clientOrg} wants to buy {otherOrg}. You lead the legal work: diligence, the agreement and closing.',
    stages: [['intake', 0], ['diligence', 3], ['negotiation', 3], ['signing', 1], ['closing', 0]],
    evidence: [E('books', 'financial_record', '{otherOrg}\'s accounts', 'client', 3, 80), E('lawsuit', 'document', 'A pending lawsuit {otherOrg} had not mentioned', 'other', 3, 85), E('ip', 'document', 'Patents and trademarks', 'client', 3, 90)],
    witnesses: [],
    research: q('Diligence turns up a pending lawsuit against {otherOrg}. What protects {clientOrg}?', ['An indemnity or price adjustment for that liability in the agreement', 'Ignoring it', 'Telling the press', 'Closing faster'], 0, 'Risks found in diligence are priced in or covered by an indemnity.'),
    motion: { name: 'The purchase agreement', target: 'lawsuit', options: [['Add an indemnity for the lawsuit and a lower price', 'strong'], ['Demand they drop the lawsuit, which they cannot do', 'weak'], ['Accept the risk as is', 'concede'], ['Delay', 'delay']] },
    transaction: true, settle: true,
  },
  supply_deal: {
    kind: 'transaction', level: 2, title: 'Supply agreement: {clientOrg} and {otherOrg}', jury: false, forum: 'none',
    summary: '{clientOrg} wants a five-year supply contract with {otherOrg}. The draft has a one-sided cancellation clause.',
    stages: [['intake', 0], ['review', 1], ['negotiation', 2], ['signing', 0]],
    evidence: [E('draft', 'contract', 'Their draft, letting them cancel at any time', 'other', 3, 95), E('volumes', 'business_record', '{clientOrg}\'s order volumes', 'client', 2, 90)],
    witnesses: [],
    research: q('The draft lets the supplier cancel at any time without notice. What is the risk?', ['{clientOrg} could be left without supply overnight', 'None', 'That prices fall', 'That the logo changes'], 0, 'One-sided termination leaves the buyer exposed.'),
    motion: { name: 'Markup of the agreement', target: 'draft', options: [['Ask for mutual notice of six months before canceling', 'strong'], ['Strike the clause and demand a penalty', 'weak'], ['Accept the draft', 'concede'], ['Delay', 'delay']] },
    transaction: true, settle: true,
  },
  agency_review: {
    kind: 'civil', level: 2, title: '{otherOrg} permit appeal', jury: false, forum: 'agency', gov: true,
    summary: '{otherOrg} appeals the refusal of a building permit. You represent the government agency that refused it.',
    stages: [['intake', 0], ['filing', 2], ['hearing', 2], ['decision', 0]],
    evidence: [E('reasons', 'document', 'The written reasons for the refusal', 'client', 4, 90), E('plans', 'document', 'The plans, which exceed the height limit', 'client', 3, 90)],
    witnesses: [W('planner', 'Planning officer', 'client', 75)],
    research: q('What will the review body ask about the agency\'s decision?', ['Whether it followed the rules and gave reasons', 'Whether the officer was polite', 'Whether the building is pretty', 'Whether the agency has a big budget'], 0, 'Administrative review asks whether the decision was lawful, fair and reasoned.'),
    motion: { name: 'Response to the appeal', target: null, options: [['Defend the decision on the height rule and the written reasons', 'strong'], ['Say the agency is always right', 'weak'], ['Withdraw the refusal', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
};

// ---------- Cases for the remaining specialties ----------
Object.assign(CASE_TEMPLATES, {
  police_conduct: {
    kind: 'civil', level: 3, title: '{client} v. City of {city}', jury: true, forum: 'trial',
    summary: '{client} was injured during an arrest for a charge later dropped. They say the force used was far beyond what the situation called for.',
    stages: [['intake', 0], ['pleadings', 2], ['discovery', 4], ['negotiation', 2], ['trial', 3], ['judgment', 0]],
    evidence: [E('bodycam', 'recording', 'Body camera footage, with two minutes missing', 'client', 4, 75), E('medical', 'medical_record', 'Hospital records of a broken arm', 'client', 4, 95), E('report', 'document', 'The officer\'s report of resistance', 'other', 3, 55)],
    witnesses: [W('officer', 'Arresting officer', 'other', 55, 'gap'), W('bystander', 'Bystander', 'client', 70)],
    research: q('What must {client} usually show in a claim about force used in an arrest?', ['That the force was unreasonable in the circumstances', 'That the charge was later dropped, nothing more', 'That the officer was rude', 'That the city has a large budget'], 0, 'Claims about force turn on whether it was reasonable given what the officer faced.'),
    motion: { name: 'Motion to compel the full body camera footage', target: null, options: [['Ask the court to order the missing two minutes produced', 'strong'], ['Ask for sanctions against the whole police force', 'weak'], ['Proceed without it', 'concede'], ['Delay', 'delay']] },
    cross: { witness: 'officer', text: 'The officer says {client} resisted throughout.', options: [['Ask why two minutes of the footage are missing', 'gap'], ['Ask about their training again', 'repeat'], ['Ask about their divorce', 'improper'], ['Ask them to repeat it', 'repeat']] },
    settle: true,
  },
  closing_defect: {
    kind: 'transaction', level: 2, title: 'Purchase of {address}', jury: false, forum: 'none',
    summary: '{client} is buying a house. The title search shows a neighbor\'s old right of way across the garden.',
    stages: [['intake', 0], ['review', 1], ['negotiation', 1], ['closing', 0]],
    evidence: [E('title', 'document', 'The title report, showing a recorded right of way', 'other', 3, 95), E('survey', 'document', 'A survey of the boundary', 'client', 3, 90)],
    witnesses: [],
    research: q('A recorded right of way crosses the garden. What does it usually mean for the buyer?', ['It binds the new owner unless it is released or ended', 'It disappears when the house is sold', 'It only matters if the neighbor is friendly', 'Nothing'], 0, 'Recorded rights over land usually pass with it to the next owner.'),
    motion: { name: 'Purchase agreement terms', target: 'title', options: [['Make closing depend on a signed release of the right of way', 'strong'], ['Demand the seller move the neighbor\'s path', 'weak'], ['Close as is', 'concede'], ['Delay', 'delay']] },
    transaction: true, settle: true,
  },
  boundary: {
    kind: 'civil', level: 1, title: '{client} v. {other}', jury: false, forum: 'trial',
    summary: '{client} and their neighbor {other} disagree about where the fence should be. A new survey puts it a meter onto {client}\'s land.',
    stages: [['intake', 0], ['demand', 1], ['negotiation', 2], ['hearing', 2], ['judgment', 0]],
    evidence: [E('survey', 'document', 'A licensed survey of the boundary', 'client', 4, 90), E('old_fence', 'photograph', 'Photos of the fence where it stood for twenty years', 'other', 2, 80)],
    witnesses: [],
    research: q('The fence stood in the wrong place for twenty years. What might the neighbor argue?', ['That long, open use of the land changed who owns it, under the rules where it applies', 'That fences never matter', 'That surveys are always wrong', 'Nothing'], 0, 'Long, open use of land can sometimes change ownership. Whether it does depends on the rules and the facts.'),
    motion: { name: 'Demand letter, with the survey', target: null, options: [['Send the survey and propose moving the fence', 'strong'], ['Threaten to sue for everything', 'weak'], ['Let it go', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  trademark: {
    kind: 'civil', level: 3, title: '{clientOrg} v. {otherOrg}', jury: true, forum: 'trial',
    summary: '{otherOrg} has started selling shoes under a name almost identical to {clientOrg}\'s best-known brand.',
    stages: [['intake', 0], ['demand', 1], ['pleadings', 2], ['discovery', 3], ['negotiation', 2], ['trial', 3], ['judgment', 0]],
    evidence: [E('registration', 'document', '{clientOrg}\'s trademark registration', 'client', 4, 95), E('confusion', 'document', 'Emails from customers who bought the wrong shoes', 'client', 3, 75), E('different', 'photograph', 'Photos showing different logos and colors', 'other', 2, 80)],
    witnesses: [W('marketing', 'Their head of marketing', 'other', 60, 'emails')],
    research: q('What usually decides a trademark claim like this?', ['Whether customers are likely to be confused about who makes the product', 'Whether the names are spelled the same', 'Which company is older', 'Which company sells more'], 0, 'Trademark disputes turn on the likelihood of confusion.'),
    motion: { name: 'Request for a preliminary injunction', target: null, options: [['Ask the court to stop sales while the case goes on, citing the confused customers', 'strong'], ['Ask for the other company to be shut down', 'weak'], ['Wait for trial', 'concede'], ['Delay', 'delay']] },
    cross: { witness: 'marketing', text: 'Their head of marketing says nobody could confuse the two.', options: [['Show them the customers\' emails', 'emails'], ['Ask about their salary', 'improper'], ['Ask them to repeat it', 'repeat'], ['Ask about the logo again', 'repeat']] },
    settle: true,
  },
  license_deal: {
    kind: 'transaction', level: 2, title: 'License: {clientOrg} and {otherOrg}', jury: false, forum: 'none',
    summary: '{otherOrg} wants to license {clientOrg}\'s software for five years. Their draft would let them sublicense it to anyone.',
    stages: [['intake', 0], ['review', 1], ['negotiation', 2], ['signing', 0]],
    evidence: [E('draft', 'contract', 'Their draft, with unlimited sublicensing', 'other', 3, 95), E('pricing', 'business_record', '{clientOrg}\'s pricing for comparable licenses', 'client', 2, 90)],
    witnesses: [],
    research: q('Their draft allows unlimited sublicensing. What is the risk?', ['{clientOrg} could lose control of who uses its software, and lose sales', 'None', 'The price would go up', 'The software would stop working'], 0, 'Who may use licensed software, and on what terms, is the heart of a license.'),
    motion: { name: 'Markup of the license', target: 'draft', options: [['Limit sublicensing to their own subsidiaries, with approval', 'strong'], ['Forbid all use outside one office', 'weak'], ['Accept the draft', 'concede'], ['Delay', 'delay']] },
    transaction: true, settle: true,
  },
  tax_appeal: {
    kind: 'civil', level: 2, title: '{client} v. the Tax Authority', jury: false, forum: 'tax',
    summary: 'The tax authority says {client} owes tax on money their parents gave them. {client} says it was a gift, not income.',
    stages: [['intake', 0], ['filing', 2], ['review', 3], ['hearing', 2], ['decision', 0]],
    evidence: [E('letter', 'document', 'A letter from the parents describing the gift', 'client', 3, 80), E('transfers', 'financial_record', 'Bank transfers, made monthly', 'other', 3, 90), E('no_work', 'document', 'Proof {client} did no work for their parents', 'client', 3, 85)],
    witnesses: [W('parent', 'Parent', 'client', 70)],
    research: q('What decides whether the payments were a gift or income?', ['Why and how they were paid, measured against the rules: not what anyone calls them', 'What {client} calls them', 'How large they were', 'Whether they were paid monthly'], 0, 'The substance decides, not the label.'),
    motion: { name: 'Notice of appeal against the assessment', target: null, options: [['Appeal, showing no work was done in return', 'strong'], ['Argue taxes are unfair', 'weak'], ['Pay and move on', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  restructure: {
    kind: 'transaction', level: 3, title: 'Restructuring {clientOrg}', jury: false, forum: 'none',
    summary: '{clientOrg} wants to split into two companies. Done carelessly, the split would trigger a large tax bill.',
    stages: [['intake', 0], ['diligence', 2], ['negotiation', 2], ['signing', 1], ['closing', 0]],
    evidence: [E('books', 'financial_record', '{clientOrg}\'s accounts', 'client', 3, 85), E('ruling', 'document', 'The rules on tax-free reorganizations', 'client', 3, 90), E('timing', 'document', 'A sale planned for next month', 'other', 3, 85)],
    witnesses: [],
    research: q('A sale planned right after the split could cost the tax treatment. Why?', ['Many rules ask that a reorganization have a real business purpose, not be a step toward a quick sale', 'Sales are always taxed twice', 'Splits are always taxed', 'It would not matter'], 0, 'Tax relief for reorganizations usually depends on their purpose and what follows them.'),
    motion: { name: 'The restructuring plan', target: 'timing', options: [['Delay the sale and document the business reasons', 'strong'], ['Hide the planned sale', 'improper'], ['Go ahead as planned', 'concede'], ['Delay everything', 'delay']] },
    transaction: true, settle: true,
  },
  permit_case: {
    kind: 'civil', level: 3, title: 'In re {otherOrg} discharge permit', jury: false, forum: 'agency',
    summary: '{otherOrg} wants a permit to discharge treated water into a river. {client}\'s community group says the limits are too loose.',
    stages: [['intake', 0], ['filing', 2], ['review', 3], ['hearing', 2], ['decision', 0]],
    evidence: [E('study', 'expert_opinion', 'A study of the river\'s fish population', 'client', 4, 80), E('limits', 'document', 'The draft permit limits', 'other', 3, 90), E('monitoring', 'document', 'Missing monitoring requirements', 'client', 3, 85)],
    witnesses: [W('scientist', 'River scientist', 'client', 75)],
    research: q('What can the community group challenge?', ['Whether the agency followed its own rules and considered the evidence before setting the limits', 'Whether the company is popular', 'Whether the river is pretty', 'Nothing: permits cannot be challenged'], 0, 'Permits can be challenged on the process and the evidence the agency had to weigh.'),
    motion: { name: 'Comments and petition on the permit', target: null, options: [['Ask for stricter limits and monitoring, citing the study', 'strong'], ['Ask for the company to be closed', 'weak'], ['Accept the permit', 'concede'], ['Delay', 'delay']] },
    settle: true,
  },
  appeal_brief: {
    kind: 'civil', level: 3, title: 'Appeal: {client} v. {otherOrg}', jury: false, forum: 'appeal', appeal: true,
    summary: '{client} lost a contract case at trial after the judge refused to let the jury see the key email. You take the appeal.',
    stages: [['intake', 0], ['record', 2], ['briefing', 3], ['argument', 2], ['decision', 0]],
    evidence: [E('record', 'document', 'The trial record, with the ruling that kept the email out', 'client', 4, 95), E('email', 'message', 'The email itself', 'client', 3, 85), E('harmless', 'document', 'Other evidence the jury did hear', 'other', 3, 80)],
    witnesses: [],
    research: q('What will the appeal court ask about the ruling that kept the email out?', ['Whether it was an error, and whether the error affected the result', 'Whether the jury liked {client}', 'What new witnesses would say', 'Whether the trial judge was experienced'], 0, 'An appeal reviews errors on the record and asks whether they mattered. It does not hear new witnesses.'),
    motion: { name: 'Appellate brief', target: 'harmless', options: [['Argue the ruling was wrong and changed the outcome, citing the record', 'strong'], ['Argue the jury got the facts wrong', 'weak'], ['Ask for a new trial with new witnesses', 'improper'], ['Delay', 'delay']] },
  },
});

// ---------- Procedural filings ----------

/**
 * The filings a kind of case has besides its main motion, each due by the end of its stage. Each option is
 * [text, kind]: 'strong' is the sound choice, 'weak' costs something, 'concede' gives the point up, 'improper' breaks a
 * duty. Left undone, a routine version goes in at the deadline, unless the lawyer is swamped and misses it.
 */
const F = (id, name, stage, options, o = {}) => ({ id, name, stage, options, ...o });
export const PROCEDURE = {
  defense: [
    F('bail', 'Motion for pretrial release', 'intake', [['Ask for release with conditions, citing work and family ties', 'strong'], ['Ask for release with no conditions at all', 'weak'], ['Do not ask', 'concede']]),
    F('discovery', 'Discovery request', ['discovery', 'pretrial'], [['Ask for the specific records that matter: the full footage, the lineup notes', 'strong'], ['Ask for everything the state has ever had', 'weak'], ['Rely on what was handed over', 'concede']]),
  ],
  prosecution: [
    F('disclosure', 'Disclosure to the defense', ['discovery', 'pretrial', 'hearing'], [['Disclose everything, including what helps the defense, on time', 'strong'], ['Disclose late, the week before trial', 'weak'], ['Leave out what hurts your case', 'improper']], { duty: true }),
  ],
  civil: [
    F('discovery', 'Discovery requests', 'discovery', [['Targeted requests for the documents that matter', 'strong'], ['Ask for every document they have', 'weak'], ['Skip discovery', 'concede']]),
    F('deposition', 'Deposition of the key witness', 'discovery', [['Depose them on the weak point in their account', 'strong'], ['Depose them on everything, for two days', 'weak'], ['Skip it', 'concede']]),
  ],
  family: [
    F('fin_disclosure', 'Financial disclosure', 'disclosure', [['Full and honest disclosure of your client\'s finances', 'strong'], ['Disclose the main accounts only', 'weak'], ['Leave out your client\'s second account', 'improper']], { duty: true }),
  ],
  immigration: [
    F('evidence_packet', 'Supporting evidence', 'review', [['Every document, translated and indexed', 'strong'], ['What the client brought in', 'weak'], ['Nothing more', 'concede']]),
  ],
  transaction: [
    F('term_sheet', 'Term sheet', 'review', [['Set out the key terms and the risks found so far', 'strong'], ['A one-page wish list', 'weak'], ['Skip it and go straight to drafting', 'concede']]),
    F('term_sheet', 'Term sheet', 'diligence', [['Set out the key terms and the risks found so far', 'strong'], ['A one-page wish list', 'weak'], ['Skip it and go straight to drafting', 'concede']]),
  ],
  appeal: [
    F('notice', 'Notice of appeal', 'intake', [['File the notice now', 'strong'], ['Wait to see the full record first', 'weak']], { hard: true }),
    F('reply', 'Reply brief', 'briefing', [['Answer their best argument, point by point', 'strong'], ['Repeat the opening brief', 'weak'], ['No reply', 'concede']]),
  ],
};

/**
 * The roles in a child welfare case are different jobs. An attorney for the child argues for what the child wants; a
 * guardian ad litem (not always a lawyer) advises on the child's best interests; a parent's attorney works for the
 * parent; government counsel acts for the child protection agency.
 */
export const CHILD_ROLES = {
  childAttorney: { name: 'Attorney for the child', side: 'client' },
  gal: { name: 'Guardian ad litem', side: 'client', research: q('As guardian ad litem for {child}, what do you put to the court?', ['Your own assessment of {child}\'s best interests, with their wishes reported too', 'Only what {child} says they want', 'What the parents want', 'What the agency wants'], 0, 'A guardian ad litem advises on best interests. The child\'s wishes are reported, but the guardian\'s view is their own.') },
  parentAttorney: { name: 'Attorney for the parent', side: 'client', research: q('You represent {other}, the parent. What does the court usually look for before a child goes home?', ['Whether the safety concerns have been addressed, often through a service plan', 'Whether the parent is wealthy', 'Whether the child likes the parent best', 'Nothing: children always go home'], 0, 'Reunification usually turns on whether the reasons for the case have been dealt with, through services.') },
  childProtection: { name: 'Counsel for the child protection agency', side: 'other', research: q('For the agency, what must you show the court?', ['That there is a real safety concern, and that the plan proposed answers it', 'That the parents are unpleasant', 'That the child should never go home', 'Nothing: the agency is always right'], 0, 'The agency must show the concern and a proportionate plan. Its counsel has duties to the court as well as to the agency.') },
};

/** Which templates suit a level of experience: complexity 1-5. */
export const COMPLEXITY = ['', 'Introductory', 'Developing', 'Experienced', 'Senior', 'High stakes'];

/** Ethics scenes that can arise in a case, with the choice that keeps a lawyer in good standing. */
export const ETHICS = [
  { id: 'conceal', text: '{client} asks you to "lose" a document that hurts their case.', options: [['Explain you cannot hide evidence, and keep it', 'proper'], ['Quietly leave it out of what you hand over', 'improper'], ['Ask your supervisor what to do', 'guidance']] },
  { id: 'privileged', text: 'Opposing counsel emails you their client\'s private notes by mistake.', options: [['Tell them, and do not read on', 'proper'], ['Read it all and use it', 'improper'], ['Ask your supervisor', 'guidance']] },
  { id: 'exculpatory', text: 'You find a statement that helps the defense, in a case you are prosecuting.', options: [['Disclose it to the defense', 'proper'], ['Keep it to yourself', 'improper'], ['Ask your supervisor', 'guidance']], prosecutor: true },
  { id: 'perjury', text: '{client} tells you they plan to lie on the stand.', options: [['Advise them against it and refuse to present false testimony', 'proper'], ['Let them', 'improper'], ['Ask your supervisor', 'guidance']] },
];

// More dilemmas: a lawyer's duties to the court, the client and the truth.
ETHICS.push(
  { id: 'gift', text: '{client} offers you a very expensive watch, "for everything you are doing." The case is still open.', options: [['Decline politely, and note it', 'proper'], ['Accept it', 'improper'], ['Ask your supervisor', 'guidance']] },
  { id: 'press', text: 'A reporter asks what {client} told you in private. They promise not to name you.', options: [['Say nothing: it is confidential', 'proper'], ['Tell them, off the record', 'improper'], ['Ask your supervisor how to handle the press', 'guidance']] },
  { id: 'coaching', text: 'Your witness is nervous. A colleague suggests telling them exactly what to say, "to keep them consistent."', options: [['Prepare them to tell the truth clearly, in their own words', 'proper'], ['Give them a script', 'improper'], ['Ask your supervisor', 'guidance']] },
  { id: 'billing', text: 'It was a slow month. Your timesheet is short of the firm\'s target.', options: [['Bill the hours you actually worked', 'proper'], ['Round up generously', 'improper'], ['Talk to your supervisor about the target', 'guidance']] },
);

/** Moments in a trial when the other side asks a question. `valid` is the right objection, or 'none' where the question is proper. */
export const OBJECTIONS = [
  { text: 'Opposing counsel asks your client: "Where were you at eleven that night?"', valid: 'none' },
  { text: 'Opposing counsel asks a witness: "Isn\'t it true the defendant is the kind of person who would do this?"', valid: 'relevance' },
  { text: 'Opposing counsel asks their own witness: "You saw the defendant clearly, didn\'t you?"', valid: 'leading' },
  { text: 'Opposing counsel asks a witness: "What do you think the defendant was planning?"', valid: 'speculation' },
  { text: 'Opposing counsel asks an expert to describe their qualifications.', valid: 'none' },
  { text: 'Opposing counsel shows a witness a document nobody has identified: "This proves it, doesn\'t it?"', valid: 'foundation' },
];
export const OBJECTION_GROUNDS = [['Object: hearsay', 'hearsay'], ['Object: leading', 'leading'], ['Object: relevance', 'relevance'], ['Object: speculation', 'speculation'], ['Object: lack of foundation', 'foundation'], ['Let it go', 'none']];

/** Story titles shown with each moment of a legal life (Story Director scenes, data/events/stories/law.js). */
export const LAW_STORIES = {
  firstExam: 'Your First Law School Exam', professor: 'A Professor Notices Your Work', moot: 'The Moot Court Competition', internship: 'A Summer Internship',
  clinic: 'A Difficult Legal Clinic Case', graduation: 'Your Graduation', barResults: 'The Bar Exam Results', firstClient: 'Your First Client',
  deadline: 'The Filing Deadline', verdict: 'The Verdict', plea: 'The Plea Offer', partnership: 'The Partnership Vote', vacancy: 'The Judicial Vacancy',
  ag: 'The Attorney General Opportunity', da: 'Should You Run for District Attorney?', government: 'An Offer from Government', majorClient: 'A Major Client Calls',
};
