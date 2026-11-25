// Journalism: the newsrooms, beats, stories and questions of the journalism career (engine/journalism.js).
// All outlets are invented; none is, or is based on, a real organization. The standards the game asks of a
// reporter (verify before publishing, attribute claims, ask for comment, correct mistakes, protect a confidential
// source) follow the common codes of practice (the SPJ Code of Ethics and similar newsroom standards): they are
// how a newsroom here behaves, not a statement of any country's law.

/** Kinds of newsroom, and the year each can exist from (fame.js MEDIA_ERAS for radio and television). */
export const OUTLET_KINDS = {
  local: { name: 'Local newspaper', medium: 'print', from: 1700, reach: 1, pay: 0.9, standards: [0.45, 0.8], words: ['Gazette', 'Courier', 'Herald', 'Chronicle', 'Post', 'Record', 'Ledger', 'Bulletin'] },
  regional: { name: 'Regional daily', medium: 'print', from: 1800, reach: 3, pay: 1.05, standards: [0.55, 0.85], words: ['Times', 'Journal', 'Daily News', 'Observer', 'Tribune', 'Evening Star'] },
  radio: { name: 'Radio newsroom', medium: 'radio', from: 1922, reach: 3, pay: 1, standards: [0.5, 0.85], words: ['Radio', 'Radio News', 'Public Radio', 'FM News'] },
  tv: { name: 'Television news station', medium: 'television', from: 1950, reach: 6, pay: 1.25, standards: [0.5, 0.85], words: ['News Channel', 'Television News', 'TV', 'Evening News'] },
  digital: { name: 'Digital newsroom', medium: 'online', from: 2005, reach: 4, pay: 0.95, standards: [0.4, 0.85], words: ['Dispatch', 'Report', 'Signal', 'Daily', 'Brief'] },
  investigative: { name: 'Investigative nonprofit', medium: 'online', from: 2008, reach: 2, pay: 0.9, standards: [0.75, 0.95], words: ['Reporting Project', 'Accountability Desk', 'Investigations Unit'] },
};

/** The beats, and the kind of story each brings: the same reporting workflow, with its own sources and records. */
export const BEATS = {
  local: { name: 'Local and community', blurb: 'Openings, meetings, schools, the neighborhood: the stories people live next to.' },
  court: { name: 'Crime and courts', blurb: 'Cases in open court, from the public record. Never the police file.' },
  sports: { name: 'Sports', blurb: 'Results that were really played, and the people who played them.' },
  entertainment: { name: 'Music and entertainment', blurb: 'Records that came out, and the artists who made them.' },
  politics: { name: 'Politics', blurb: 'Elections, governments and what was really said and decided.' },
  investigative: { name: 'Investigations', blurb: 'Long stories that may, or may not, stand up. From senior reporter.', minLevel: 2 },
};

/** Local stories: an organizer (a real person) and what is said about the event. */
export const LOCAL_EVENTS = [
  { kind: 'opening', title: 'A new {what} opens on {street}', what: ['bakery', 'bookshop', 'clinic', 'hardware store', 'cafe', 'repair shop'], organizer: 'owner' },
  { kind: 'meeting', title: 'Residents meet over plans for {what}', what: ['a new housing block', 'a bus route change', 'the old mill site', 'a park redesign'], organizer: 'resident who called the meeting' },
  { kind: 'fair', title: 'The {what} raises money for the school', what: ['spring fair', 'book sale', 'fun run', 'concert night'], organizer: 'parent who ran it' },
  { kind: 'program', title: 'A {what} starts at the community center', what: ['free tutoring program', 'lunch club for older neighbors', 'repair cafe', 'youth football league'], organizer: 'volunteer coordinator' },
];

/** Investigative tips: an allegation that may, or may not, be true. Most do not stand up as first told. */
export const TIPS = [
  { kind: 'overtime', title: 'Workers say {org} does not pay overtime', claim: '{org} does not pay staff for overtime they work', record: 'The labor inspectorate\'s public findings', inside: 'a former employee' },
  { kind: 'safety', title: 'Questions over safety at {org}', claim: '{org} ignored safety inspections it failed', record: 'The public register of inspections', inside: 'a worker on the floor' },
  { kind: 'contract', title: 'How {org} won a public contract', claim: '{org} won a public contract without the required bids', record: 'The published tender record', inside: 'someone in the procurement office' },
  { kind: 'charity', title: 'Where the {org} appeal money went', claim: 'Money raised by the {org} appeal was not spent on the appeal', record: 'The charity regulator\'s filed accounts', inside: 'a volunteer' },
];

/** Interview questions, and what each draws out of a source who agrees to talk. */
export const QUESTIONS = {
  saw: { label: 'What did you personally see or hear?', draws: 'facts' },
  when: { label: 'When did this happen, exactly?', draws: 'facts' },
  evidence: { label: 'What evidence is there? Is there a record we could look at?', draws: 'documents' },
  who: { label: 'Who else could confirm this?', draws: 'sources' },
  view: { label: 'What do you make of it?', draws: 'opinion' },
  clarify: { label: 'Is there anything you would like to clarify or take back?', draws: 'clarify' },
};

/** What a source agrees the reporter may do with what they say. */
export const ATTRIBUTION = {
  record: { name: 'On the record', sub: 'Named, and quoted.' },
  background: { name: 'On background', sub: 'Used, described ("a person close to the club"), not named.' },
  confidential: { name: 'Confidential source', sub: 'Never named, to anyone outside the newsroom. What they say must still be checked.' },
  off: { name: 'Off the record', sub: 'Not to be published at all. It can point you somewhere, nothing more.' },
};

/** What a reporter's notebook says of a claim, from the evidence actually gathered. Never the truth itself. */
export const STATUS = {
  verified: { name: 'Verified', tone: 'good', sub: 'A public record confirms it.' },
  supported: { name: 'Supported', tone: 'good', sub: 'Two independent sources agree, and none disagrees.' },
  single: { name: 'One source', tone: '', sub: 'Only one person says so. Not yet a fact.' },
  disputed: { name: 'Disputed', tone: 'bad', sub: 'Sources disagree.' },
  false: { name: 'Contradicted', tone: 'bad', sub: 'A public record says otherwise.' },
  open: { name: 'Not checked', tone: '', sub: 'Nobody has spoken to it yet.' },
};

/** Actions a reporter has in a year, whatever the turn length: work is done in the year, not per tap. */
export const ACTIONS_A_YEAR = 30;
/** Journalism awards (the game's own, not any real prize). */
export const AWARDS = [
  { id: 'young', name: 'Young Reporter of the Year', blurb: 'For a reporter under thirty whose work held up.' },
  { id: 'local', name: 'Local Reporting Prize', blurb: 'For local reporting that was accurate and mattered to the community.' },
  { id: 'investigation', name: 'Investigative Reporting Prize', blurb: 'For an investigation that stood up.' },
];
