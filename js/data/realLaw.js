// Real laws, cited by name and year, for the cases lawyers handle (engine/lawCases.js). Each entry is a real statute,
// constitutional provision or court decision, with the year it took effect. What a law says here is a short, plain
// summary, not legal advice; how a case plays out is still the game's simplification. Where a country's law is not
// listed, the game says so instead of borrowing another country's.
//
//   topic: what the law decides in a case: 'search' (evidence from an unlawful search), 'confession', 'hearsay',
//          'leading', 'disclosure', 'counsel', 'burden', 'identification', 'jury', 'custody', 'divorce', 'retaliation',
//          'trademark', 'force', 'removal', 'contingency', 'will'
//   from:  the year it took effect;  until: the year it stopped applying, if it did
//   excludes: for 'search' and 'confession', whether the rule lets a court leave the evidence out
const L = (id, countryIds, topic, name, from, summary, o = {}) => ({ id, countryIds, topic, name, from, summary, ...o });

export const REAL_LAWS = [
  // ---------- United States ----------
  L('us_fourth', ['us'], 'search', 'Fourth Amendment to the U.S. Constitution', 1791, 'Protects against unreasonable searches and seizures.', { excludes: false, note: 'Until Mapp v. Ohio (1961), evidence from an unlawful search could still be used in a state court.' }),
  L('us_mapp', ['us'], 'search', 'Mapp v. Ohio (1961)', 1961, 'Evidence from an unlawful search cannot be used in a state criminal trial: the exclusionary rule.', { excludes: true }),
  L('us_brown_ms', ['us'], 'confession', 'Brown v. Mississippi (1936)', 1936, 'A confession obtained by force or coercion cannot be used.', { excludes: 'coerced' }),
  L('us_miranda', ['us'], 'confession', 'Miranda v. Arizona (1966)', 1966, 'Statements from custodial questioning are excluded unless the suspect was warned of the right to silence and to a lawyer.', { excludes: true }),
  L('us_edwards', ['us'], 'confession', 'Edwards v. Arizona (1981)', 1981, 'Once a suspect asks for a lawyer, police questioning must stop until a lawyer is present.', { excludes: true }),
  L('us_fre_hearsay', ['us'], 'hearsay', 'Federal Rules of Evidence, Rule 802', 1975, 'Hearsay is not admissible unless a rule or exception allows it.'),
  L('us_fre_leading', ['us'], 'leading', 'Federal Rules of Evidence, Rule 611(c)', 1975, 'Leading questions should not be used on direct examination, with exceptions.'),
  L('us_brady', ['us'], 'disclosure', 'Brady v. Maryland (1963)', 1963, 'The prosecution must disclose evidence favorable to the defense that is material to guilt or punishment.'),
  L('us_gideon', ['us'], 'counsel', 'Gideon v. Wainwright (1963)', 1963, 'A person charged with a felony in a state court who cannot afford a lawyer must be given one.'),
  L('us_winship', ['us'], 'burden', 'In re Winship (1970)', 1970, 'Due process requires proof beyond a reasonable doubt of every element of a crime.'),
  L('us_biggers', ['us'], 'identification', 'Neil v. Biggers (1972)', 1972, 'An identification is judged on the witness\'s opportunity to view, attention, accuracy, certainty and the time elapsed.'),
  L('us_strauder', ['us'], 'jury', 'Strauder v. West Virginia (1880)', 1880, 'A law excluding Black citizens from juries violates the Equal Protection Clause.'),
  L('us_batson', ['us'], 'jury', 'Batson v. Kentucky (1986)', 1986, 'A prosecutor may not strike jurors because of their race.'),
  L('us_umda', ['us'], 'custody', 'Uniform Marriage and Divorce Act, section 402 (1970)', 1970, 'Custody is decided by the best interests of the child, weighing listed factors.'),
  L('us_ca_nofault', ['us'], 'divorce', 'California Family Law Act (1969, in force 1970)', 1970, 'The first no-fault divorce law: a marriage may end for irreconcilable differences, without proving fault.', { nofault: true, note: 'Before no-fault laws, a divorce needed proof of a fault ground such as adultery, cruelty or desertion. States adopted no-fault at different times; New York was last, in 2010.' }),
  L('us_title7', ['us'], 'retaliation', 'Civil Rights Act of 1964, Title VII, section 704(a)', 1965, 'An employer may not retaliate against an employee for opposing discrimination or taking part in a complaint.'),
  L('us_lanham', ['us'], 'trademark', 'Lanham Act (1946), 15 U.S.C. section 1114', 1947, 'Using a mark likely to cause confusion with a registered trademark is infringement.'),
  L('us_1983', ['us'], 'force', '42 U.S.C. section 1983 (Civil Rights Act of 1871)', 1871, 'A person may sue a state or local official who violates their constitutional rights.'),
  L('us_graham', ['us'], 'force', 'Graham v. Connor (1989)', 1989, 'Force in an arrest is judged by whether it was objectively reasonable in the circumstances.'),
  L('us_ina', ['us'], 'removal', 'Immigration and Nationality Act, section 240A(b)', 1997, 'Cancellation of removal for some long-term residents: ten years\' presence, good moral character, and exceptional hardship to a citizen or resident spouse, parent or child.'),
  L('us_aba15d', ['us'], 'contingency', 'ABA Model Rule of Professional Conduct 1.5(d)', 1983, 'A lawyer may not charge a contingent fee in a domestic relations matter or for defending a criminal case.'),
  // ---------- England and Wales ----------
  L('uk_sang', ['uk'], 'search', 'R v Sang (1979)', 1979, 'A judge has no general discretion to exclude relevant evidence because of how it was obtained (confessions apart).', { excludes: false, until: 1985 }),
  L('uk_pace78', ['uk'], 'search', 'Police and Criminal Evidence Act 1984, section 78', 1986, 'A court may exclude prosecution evidence whose admission would make the proceedings unfair.', { excludes: true }),
  L('uk_judges_rules', ['uk'], 'confession', 'The Judges\' Rules (1912)', 1912, 'Guidance on questioning suspects; a confession had to be voluntary to be admitted.', { excludes: 'coerced', until: 1985 }),
  L('uk_pace76', ['uk'], 'confession', 'Police and Criminal Evidence Act 1984, section 76', 1986, 'A confession obtained by oppression, or in circumstances making it unreliable, must be excluded.', { excludes: true }),
  L('uk_cja_hearsay', ['uk'], 'hearsay', 'Criminal Justice Act 2003, sections 114 to 136', 2005, 'Hearsay is admissible in criminal proceedings only on the grounds the Act allows.'),
  L('uk_cpia', ['uk'], 'disclosure', 'Criminal Procedure and Investigations Act 1996', 1997, 'The prosecution must disclose material that might undermine its case or assist the defense.'),
  L('uk_children', ['uk'], 'custody', 'Children Act 1989, section 1', 1991, 'The child\'s welfare is the court\'s paramount consideration.'),
  L('uk_dra1969', ['uk'], 'divorce', 'Divorce Reform Act 1969 (in force 1971)', 1971, 'Divorce for irretrievable breakdown, shown by one of five facts: adultery, behavior or desertion, or two or five years\' separation.', { nofault: 'facts', until: 2021, note: 'Before 1971, divorce in England required proof of a matrimonial offense such as adultery or cruelty.' }),
  L('uk_ddsa', ['uk'], 'divorce', 'Divorce, Dissolution and Separation Act 2020 (in force 2022)', 2022, 'No-fault divorce: a statement that the marriage has broken down irretrievably is enough.', { nofault: true }),
  L('uk_pida', ['uk'], 'retaliation', 'Public Interest Disclosure Act 1998', 1999, 'Protects workers dismissed or harmed for making a protected disclosure (whistleblowing).'),
  L('uk_tma', ['uk'], 'trademark', 'Trade Marks Act 1994, section 10', 1994, 'Using a sign likely to confuse the public with a registered trade mark is infringement.'),
  // ---------- Elsewhere ----------
  L('ca_charter8', ['ca'], 'search', 'Canadian Charter of Rights and Freedoms, sections 8 and 24(2)', 1982, 'Protects against unreasonable search; evidence is excluded if admitting it would bring justice into disrepute.', { excludes: true }),
  L('ca_charter10', ['ca'], 'confession', 'Canadian Charter of Rights and Freedoms, section 10(b)', 1982, 'Everyone arrested has the right to retain and instruct counsel without delay, and to be told of it.', { excludes: true }),
  L('in_evidence25', ['in'], 'confession', 'Indian Evidence Act 1872, section 25', 1872, 'A confession made to a police officer cannot be proved against the accused.', { excludes: true }),
  L('jp_const38', ['jp'], 'confession', 'Constitution of Japan, Article 38', 1947, 'A confession made under compulsion, torture or threat, or after prolonged detention, is not admitted.', { excludes: true }),
  L('de_stpo136a', ['de'], 'confession', 'Code of Criminal Procedure (StPO), section 136a', 1950, 'Statements obtained by prohibited methods (force, deception, threats) may not be used.', { excludes: true }),
  L('echr6', ['uk', 'fr', 'de', 'it', 'es', 'nl', 'be', 'at', 'se', 'no', 'dk', 'fi', 'ie', 'pt', 'gr', 'pl', 'cz', 'ch', 'tr'], 'counsel', 'European Convention on Human Rights, Article 6', 1953, 'The right to a fair trial, including to legal assistance and to examine witnesses.'),
];

/** Court names that changed with the law. */
export const COURT_HISTORY = {
  uk: { trial: [[1972, 'Crown Court'], [0, 'Assizes (or Quarter Sessions)']], family: [[2014, 'Family Court'], [1971, 'Family Division of the High Court'], [0, 'Probate, Divorce and Admiralty Division']] },
  us: { immigration: [[1983, 'Immigration Court'], [0, 'Immigration hearing before a special inquiry officer']] },
};
