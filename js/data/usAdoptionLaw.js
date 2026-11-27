// United States adoption law, state by state: who can see an adult adoptee's original birth certificate (OBC), from when,
// and from when a same-sex couple could adopt a child together. Keyed by the state's id in js/data/cities.js (its name in
// lower case with underscores). Used by engine/origins.js. The OBC is issued by the state the adoptee was BORN in, so
// records follow the birth state; adoption eligibility follows the state the adoptive family lives in.
//
// SOURCES AND HOW SURE: written from public summaries of state law (the Adoptee Rights Law Center's state pages and
// maps, the American Adoption Congress's state list, Child Welfare Information Gateway's 2019 survey, and news coverage
// of each reform), checked against web search summaries in November 2026. The trackers themselves could not be opened
// from where this was written, and the sources disagree on several states. Rows marked `disputed` are ones where a
// source lists the state differently; the conservative reading is used. Check a state's current statute before
// relying on any row outside the game.
//
//   obc:      [[fromYear, kind, minAge?], ...] in order. kind:
//               'open'         the adult adoptee may request the OBC directly
//               'conditional'  open with a compromise: a birth parent may redact their name or veto, or access depends on
//                              the year of birth or adoption
//               'restricted'   sealed: a court order, an intermediary, or consent through a registry
//             Before the first step: 'restricted' after `sealed`, 'open' before it.
//   sealed:   the year the state's records are treated as sealed (most states sealed them between the 1930s and the
//             1950s; 1945 is used where no better year is given). null: never sealed.
//   sameSex:  the first year a same-sex couple could adopt together there: a court ruling or statute allowing joint or
//             second-parent adoption, or else the year same-sex couples could marry there. Everywhere from 2016, when the
//             last state ban (Mississippi) was struck down. Examples: Vermont and Massachusetts 1993 (court rulings),
//             New York 1995 (Matter of Jacob), D.C. 1995, New Jersey 1997, California 2003 (Sharon S.); Florida
//             banned adoption by gay people until 2010.

const L = (obc, sameSex, extra = {}) => ({ obc, sameSex, sealed: 1945, ...extra });

export const US_STATE_LAW = {
  alabama: L([[2000, 'open', 19]], 2015, { note: 'Unrestricted from age 19 since 2000.' }),
  alaska: L([], 2014, { sealed: null, note: 'Never sealed original birth certificates to adult adoptees.' }),
  arizona: L([], 2014, { disputed: true, note: 'Treated as sealed (court order or confidential intermediary); one source lists it as unrestricted.' }),
  arkansas: L([[2018, 'conditional']], 2015, { note: 'Open since 2018, with birth parents able to ask for redaction.' }),
  california: L([], 2003, { note: 'Sealed: a court order is needed.' }),
  colorado: L([[2000, 'conditional'], [2014, 'open']], 2007, { note: 'Open to most adult adoptees since 2014; before then it depended on the year of adoption.' }),
  connecticut: L([[2015, 'conditional'], [2021, 'open']], 2000, { note: 'Open for adoptions after 1983 from 2015, and for everyone from 2021.' }),
  delaware: L([[1998, 'conditional']], 2013, { note: 'Open since 1998, unless a birth parent has filed to have their name withheld.' }),
  district_of_columbia: L([], 1995, { note: 'Sealed: a court order is needed.' }),
  florida: L([], 2015, { note: 'Sealed: a court order is needed.' }),
  georgia: L([[2025, 'open']], 2015, { note: 'Unrestricted since July 2025 (Andee\'s Law).' }),
  hawaii: L([[2016, 'open']], 2013, { note: 'Unrestricted since 2016.' }),
  idaho: L([], 2014, { note: 'Sealed: a court order is needed for older adoptions; the 2022 changes are not modeled.' }),
  illinois: L([[2011, 'conditional']], 1995, { note: 'Open since 2011, unless a birth parent filed a denial of release.' }),
  indiana: L([[2018, 'conditional']], 2014, { note: 'Open since 2018, with birth parents able to ask for redaction.' }),
  iowa: L([], 2009, { disputed: true, note: 'Treated as sealed; a redaction-based process is reported, but its year was not confirmed.' }),
  kansas: L([], 2014, { sealed: null, note: 'Never sealed original birth certificates to adult adoptees.' }),
  kentucky: L([], 2015, { note: 'Sealed: available only with consent through the state, or a court order.' }),
  louisiana: L([[2022, 'open', 24]], 2015, { note: 'Unrestricted from age 24 since 2022.' }),
  maine: L([[2016, 'open']], 2007, { note: 'Unrestricted since 2016, with a contact preference form attached if a birth parent filed one.' }),
  maryland: L([[1999, 'conditional']], 2013, { note: 'Open since 1999 for most adoptions, unless a birth parent filed a disclosure veto.' }),
  massachusetts: L([[2008, 'conditional'], [2022, 'open']], 1993, { note: 'Open for some years of birth from 2008, and for everyone from November 2022.' }),
  michigan: L([[1980, 'conditional']], 2015, { note: 'Depends on the year of adoption and on birth parents\' consent statements.' }),
  minnesota: L([[1977, 'conditional'], [2024, 'open']], 2013, { note: 'Open on birth-parent consent from 1977; unrestricted since July 2024.' }),
  mississippi: L([], 2016, { note: 'Sealed: a court order is needed.' }),
  missouri: L([[2018, 'conditional']], 2015, { note: 'Open since 2018, with birth parents able to ask for redaction.' }),
  montana: L([[2013, 'conditional']], 2014, { note: 'Depends on the year of adoption since 2013.' }),
  nebraska: L([[1988, 'conditional']], 2015, { note: 'Open with conditions, through birth parents\' consent or non-consent forms.' }),
  nevada: L([], 2014, { note: 'Sealed: a court order is needed.' }),
  new_hampshire: L([[2005, 'open']], 2010, { note: 'Unrestricted since 2005.' }),
  new_jersey: L([[2017, 'conditional']], 1997, { note: 'Open since 2017, unless a birth parent asked for redaction before then.' }),
  new_mexico: L([], 2013, { note: 'Sealed: a court order or consent is needed.' }),
  new_york: L([[2020, 'open']], 1995, { note: 'Unrestricted since January 2020.' }),
  north_carolina: L([], 2014, { note: 'Sealed: a court order is needed.' }),
  north_dakota: L([], 2015, { note: 'Sealed: through an intermediary or with consent.' }),
  ohio: L([[1996, 'conditional']], 2015, { note: 'Depends on the year of adoption; the oldest adoptions were opened in 2015.' }),
  oklahoma: L([], 2014, { note: 'Sealed: through a registry with consent, or a court order.' }),
  oregon: L([[2000, 'open']], 2014, { note: 'Unrestricted since 2000 (a ballot measure passed in 1998).' }),
  pennsylvania: L([[2017, 'conditional']], 2002, { note: 'Open since November 2017, with birth parents able to ask for redaction.' }),
  rhode_island: L([[2012, 'open', 25], [2022, 'open', 18]], 2013, { note: 'Unrestricted from age 25 since 2012; the age was later lowered to 18 (the year of that change is not confirmed).' }),
  south_carolina: L([], 2014, { note: 'Sealed: a court order is needed.' }),
  south_dakota: L([], 2015, { disputed: true, note: 'Treated as sealed; one source lists it as unrestricted.' }),
  tennessee: L([[1996, 'conditional']], 2015, { note: 'Open since 1996, with a contact veto birth parents can file.' }),
  texas: L([[2025, 'conditional']], 2015, { disputed: true, note: 'A court order was needed; a 2025 law lets adult adoptees ask for it, with details still unsettled.' }),
  utah: L([], 2014, { disputed: true, note: 'Treated as sealed; one source lists it as unrestricted.' }),
  vermont: L([[1986, 'conditional']], 1993, { disputed: true, note: 'Open for most adoptions since 1986, with a birth-parent veto; one source lists it as unrestricted.' }),
  virginia: L([[2026, 'open']], 2014, { note: 'Unrestricted since July 2026; before that a court order was needed.' }),
  washington: L([[2014, 'conditional']], 2012, { note: 'Open since 2014; birth parents of older adoptions could file to have their name withheld.' }),
  west_virginia: L([], 2014, { note: 'Sealed: a court order or registry consent is needed.' }),
  wisconsin: L([], 2014, { note: 'Sealed: through the state\'s search program or a court order.' }),
  wyoming: L([], 2014, { note: 'Sealed: a court order or a confidential intermediary is needed.' }),
};

/** What a state's law says about the original birth certificate for a request made in `year`: { kind, minAge, since }. */
export function stateObc(stateId, year) {
  const law = US_STATE_LAW[stateId];
  if (!law) return null;
  let now = law.sealed == null || year < law.sealed ? { kind: 'open', minAge: 18, since: null } : { kind: 'restricted', minAge: 18, since: law.sealed };
  for (const [from, kind, minAge = 18] of law.obc) if (year >= from) now = { kind, minAge, since: from };
  return now;
}

/** Whether a same-sex couple could adopt together in this state in `year`. */
export const stateSameSex = (stateId, year) => year >= 2016 || (US_STATE_LAW[stateId] ? year >= US_STATE_LAW[stateId].sameSex : false);
