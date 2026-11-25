// Real laws, cited by name and year, for the cases lawyers handle (engine/lawCases.js). Each entry is a real statute,
// constitutional provision or court decision, with the year it took effect. What a law says here is a short, plain
// summary, not legal advice; how a case plays out is still the game's simplification. Where a country's law is not
// listed, the game says so instead of borrowing another country's.
//
//   topic: what the law decides in a case: 'search' (evidence from an unlawful search), 'confession', 'hearsay',
//          'leading', 'disclosure', 'counsel', 'burden', 'identification', 'jury', 'custody', 'divorce', 'retaliation',
//          'trademark', 'force', 'removal', 'contingency', 'will', 'prenup', 'support', 'protection', 'adoption', 'guardianship',
//          'campaign' (what a candidate for legal office may do), 'recusal' (when a judge must step aside)
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
  // Campaigns for legal office (engine/lawCampaign.js): what a candidate for a judgeship may and may not do, and when a
  // judge must step aside because of who paid for the campaign.
  L('us_canons30', ['us'], 'campaign', 'ABA Canons of Judicial Ethics (1924), Canon 30', 1924, 'A candidate for judicial office should not make promises of conduct in office that appeal to self-interest or partisan prejudice.', { promises: false }),
  L('us_code7', ['us'], 'campaign', 'ABA Code of Judicial Conduct (1972), Canon 7', 1972, 'A judicial candidate should not make pledges or promises of conduct in office, announce views on disputed legal or political issues, or personally solicit campaign funds; a committee raises them.', { promises: false, solicit: false, announce: false }),
  L('us_rule82', ['us'], 'campaign', 'ABA Model Rule of Professional Conduct 8.2(a)', 1983, 'A lawyer must not make a statement known to be false, or made with reckless disregard for the truth, about the integrity or qualifications of a judge or a candidate for legal office.', { falsehood: false }),
  L('us_white', ['us'], 'campaign', 'Republican Party of Minnesota v. White (2002)', 2002, 'A state may not forbid judicial candidates from announcing their views on disputed legal and political issues.', { announce: true }),
  L('us_code41', ['us'], 'campaign', 'ABA Model Code of Judicial Conduct (2007), Rule 4.1', 2007, 'A judicial candidate must not make pledges, promises or commitments about cases likely to come before the court, personally solicit contributions, or knowingly make false statements.', { promises: false, solicit: false, falsehood: false }),
  L('us_yulee', ['us'], 'campaign', 'Williams-Yulee v. Florida Bar (2015)', 2015, 'A state may forbid judicial candidates from personally asking for campaign money.', { solicit: false }),
  L('us_caperton', ['us'], 'recusal', 'Caperton v. A.T. Massey Coal Co. (2009)', 2009, 'Due process requires a judge to step aside when a party\'s campaign support had a significant and disproportionate influence on the judge\'s election.'),
  // ---------- England and Wales ----------
  L('uk_sang', ['uk'], 'search', 'R v Sang (1979)', 1979, 'A judge has no general discretion to exclude relevant evidence because of how it was obtained (confessions apart).', { excludes: false, until: 1985 }),
  L('uk_pace78', ['uk'], 'search', 'Police and Criminal Evidence Act 1984, section 78', 1986, 'A court may exclude prosecution evidence whose admission would make the proceedings unfair.', { excludes: true }),
  L('uk_judges_rules', ['uk'], 'confession', 'The Judges\' Rules (1912)', 1912, 'Guidance on questioning suspects; a confession had to be voluntary to be admitted.', { excludes: 'coerced', until: 1985 }),
  L('uk_pace76', ['uk'], 'confession', 'Police and Criminal Evidence Act 1984, section 76', 1986, 'A confession obtained by oppression, or in circumstances making it unreliable, must be excluded.', { excludes: true }),
  L('uk_cja_hearsay', ['uk'], 'hearsay', 'Criminal Justice Act 2003, sections 114 to 136', 2005, 'Hearsay is admissible in criminal proceedings only on the grounds the Act allows.'),
  L('uk_cpia', ['uk'], 'disclosure', 'Criminal Procedure and Investigations Act 1996', 1997, 'The prosecution must disclose material that might undermine its case or assist the defense.'),
  // Prenups, support, protection, adoption and guardianship (the Family Law and Divorce Law cases).
  L('us_upaa', ['us'], 'prenup', 'Uniform Premarital Agreement Act (1983)', 1983, 'A premarital agreement is not enforced if it was not signed voluntarily, or was unconscionable and signed without fair disclosure of the other side\'s property.'),
  L('us_fsa88', ['us'], 'support', 'Family Support Act of 1988', 1989, 'States must set child support by guidelines and review orders, so support follows real changes in circumstances.'),
  L('us_vawa', ['us'], 'protection', 'Violence Against Women Act (1994)', 1994, 'A protection order made in one state must be enforced in every other state.'),
  L('uk_radmacher', ['uk'], 'prenup', 'Radmacher v Granatino (2010)', 2010, 'A court should give effect to a nuptial agreement made freely, with a full understanding of what it means, unless holding the couple to it would be unfair.'),
  L('uk_csa91', ['uk'], 'support', 'Child Support Act 1991', 1993, 'Created the Child Support Agency to work out and collect child support.'),
  L('uk_fla96', ['uk'], 'protection', 'Family Law Act 1996, Part IV', 1997, 'A court can make a non-molestation order, and an order about who may live in the family home.'),
  L('uk_aca02', ['uk'], 'adoption', 'Adoption and Children Act 2002', 2005, 'The child\'s welfare, throughout their life, is the court\'s paramount consideration; a parent\'s consent can be dispensed with only if the child\'s welfare requires it.'),
  L('uk_sgo', ['uk'], 'guardianship', 'Children Act 1989, section 14A (special guardianship, added 2002)', 2005, 'A relative can be made a special guardian: day-to-day parental responsibility, without ending the parents\' legal ties.'),
  L('uk_children', ['uk'], 'custody', 'Children Act 1989, section 1', 1991, 'The child\'s welfare is the court\'s paramount consideration.'),
  L('uk_dra1969', ['uk'], 'divorce', 'Divorce Reform Act 1969 (in force 1971)', 1971, 'Divorce for irretrievable breakdown, shown by one of five facts: adultery, behavior or desertion, or two or five years\' separation.', { nofault: 'facts', until: 2021, note: 'Before 1971, divorce in England required proof of a matrimonial offense such as adultery or cruelty.' }),
  L('uk_ddsa', ['uk'], 'divorce', 'Divorce, Dissolution and Separation Act 2020 (in force 2022)', 2022, 'No-fault divorce: a statement that the marriage has broken down irretrievably is enough.', { nofault: true }),
  L('uk_pida', ['uk'], 'retaliation', 'Public Interest Disclosure Act 1998', 1999, 'Protects workers dismissed or harmed for making a protected disclosure (whistleblowing).'),
  L('uk_tma', ['uk'], 'trademark', 'Trade Marks Act 1994, section 10', 1994, 'Using a sign likely to confuse the public with a registered trade mark is infringement.'),
  // ---------- Elsewhere: families ----------
  L('ca_divorce68', ['ca'], 'divorce', 'Divorce Act (1968)', 1968, 'Canada\'s first federal divorce law: adultery, cruelty, or marriage breakdown after three years\' separation.', { nofault: 'facts', until: 1985 }),
  L('ca_divorce85', ['ca'], 'divorce', 'Divorce Act (1985)', 1986, 'Divorce for marriage breakdown: one year\'s separation, adultery or cruelty.', { nofault: 'facts' }),
  L('ca_custody', ['ca'], 'custody', 'Divorce Act (1985), section 16', 1986, 'Custody and parenting are decided on the best interests of the child.'),
  L('au_fla', ['au'], 'divorce', 'Family Law Act 1975 (in force 1976)', 1976, 'No-fault divorce: the marriage has broken down irretrievably, shown by twelve months\' separation.', { nofault: true }),
  L('au_fla_child', ['au'], 'custody', 'Family Law Act 1975', 1976, 'Parenting orders are made on the best interests of the child.'),
  L('de_1977', ['de'], 'divorce', 'First Marriage Law Reform Act (1977)', 1977, 'Divorce on the breakdown of the marriage, replacing divorce for fault.', { nofault: true }),
  L('fr_1975', ['fr'], 'divorce', 'Divorce Reform Law of 11 July 1975', 1976, 'Brought back divorce by mutual consent beside divorce for fault and for breakdown of life together.', { nofault: 'facts' }),
  L('in_hma', ['in'], 'divorce', 'Hindu Marriage Act 1955, section 13', 1955, 'Divorce on grounds such as cruelty, desertion or adultery.', { nofault: false, until: 1975 }),
  L('in_hma13b', ['in'], 'divorce', 'Hindu Marriage Act 1955, section 13B (added 1976)', 1976, 'Divorce by mutual consent, beside the fault grounds.', { nofault: 'facts' }),
  L('jp_civil', ['jp'], 'divorce', 'Civil Code of Japan, divorce by agreement', 1898, 'A couple may divorce by agreement, registered with the municipal office.', { nofault: true }),
  L('au_ea138', ['au'], 'search', 'Evidence Act 1995, section 138', 1995, 'Improperly or illegally obtained evidence is excluded unless the desirability of admitting it outweighs the undesirability of how it was obtained.', { excludes: true }),
  L('in_malkani', ['in'], 'search', 'R.M. Malkani v. State of Maharashtra (1973)', 1973, 'Evidence obtained illegally is still admissible if relevant, though the court may weigh how it was obtained.', { excludes: false }),
  // ---------- Lawyers advertising ----------
  L('us_bates', ['us'], 'advertising', 'Bates v. State Bar of Arizona (1977)', 1977, 'Lawyers may advertise their services; truthful advertising is protected speech.'),
  L('us_rule71', ['us'], 'advertising', 'ABA Model Rule of Professional Conduct 7.1', 1983, 'A lawyer must not make false or misleading communications about their services.'),
  L('uk_advert', ['uk'], 'advertising', 'Law Society rules on solicitors\' publicity (1984)', 1984, 'Solicitors may advertise, provided it is not misleading or inaccurate.'),
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
