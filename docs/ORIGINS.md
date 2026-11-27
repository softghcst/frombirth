# Adoption, Birth Families & Identity

`js/engine/origins.js` · `js/data/origins.js` · `js/data/events/stories/origins.js` · `js/ui/origins.js` · tests: `tests/origins.mjs`, `tests/origins-ui.mjs`

## One character, two family networks

- The player keeps one id. The **adoptive family** is the household (`player.npcIds`, roles `parent` / `sibling`,
  flags `adoptiveParent`, `adoptiveSibling`). The **birth family** is the family generated for the birth: the same
  people, never regenerated, with `flags.birthKin` (`mother`, `father`, `sibling`, `half`, `grandparent`) and
  `flags.birthOf` (the player's id), role `relative`.
- `state.origins.records[id]` is the adoption record: kind (`birth`, `childhood`, `kinship`, `by-player`), legal type
  (`adoption`, `guardianship`, `kinship-care`), birth / adoptive / legal parent ids, reason, placement and
  finalization years, jurisdiction, contact arrangement, birth name and legal name.
- Birth relatives outside the player's life are aged and lived by `tickOrigins()` (partners, new children, moves,
  going abroad, deaths, the end of a sentence that was part of the history from the start). Once in the player's life
  they age with everyone else in `relationships.js`.
- Heredity follows biology only: adoptive parents, guardians and the relatives who raise a child are excluded
  (`health/heredity.js isBiological`). Inheritance follows legal parentage: a birth parent's estate does not pass by
  blood; a guardian's goes to their own children.

## Knowing

`state.origins.self` holds what the character knows (`people[id]`: exists → first → named → located → contact → met;
`facts[key]`), their curiosity, and their actions this year. My Origins shows only that. Parents tell the child at an age
set by how the family talks about it (early, gradual, limited, late); what parents share depends on the arrangement
(open: names; mediated: first names; closed: background only) and on the child's age.

## Search and contact

Records (by jurisdiction and the year asked), the agency, a mutual-consent registry, an intermediary, public records
(only for someone already named; never an address), and DNA (matches only with relatives who tested, with stated
certainty). Contact needs consent: the relative's answer comes from their own openness and circumstances — welcome,
letters first, time, declined, no contact, or a dispute. Refusals and no-contact requests are kept; the player can
set breaks and no-contact boundaries too. Results are queued and told at the turn of the year, **one revelation a
year**, so 3-, 6- and 12-month turns give the same story.

## Same-sex adoptive couples

About one adoptive couple in twenty is two women or two men, where and when the law allowed joint adoption
(`SAME_SEX_ADOPTION_FROM` in `js/data/origins.js`: US 2016 nationally, earlier in some states; England and Wales from the
end of 2005; and so on). Elsewhere, not before same-sex marriage was legal there. Applies to adoption at birth, in
childhood, and an aunt's or uncle's partner in kinship care.

## Law and history

United States: legal adoption from 1851; original-birth-certificate access by period (sealed in most states from the
1940s; open in a growing minority from the 2000s); registries from 1975; DNA matching from 2008. England and Wales:
adoption from 1927; adult adoptees' access from the Children Act 1975; Contact Register from 1991. Elsewhere: adoption
from 1950, records restricted — a conservative default until researched. Before adoption law, "adopted" becomes
kinship care.

## Not built (v1)

- International adoption (birth country, immigration and citizenship history, and language are not modeled; the
  option is not offered rather than offered wrongly).
- Foster care as a system: a foster stay before adoption is recorded as history only.
- Per-state US law by name: there are no US states in the game, so each adopted life gets a fixed, unnamed state
  "profile" (`accessSeed`). It decides whether that state's original birth records are open, open with conditions,
  or sealed (by the year asked, as states changed their laws), and before 2016 whether a same-sex couple could adopt there.
- A birth parent's sentence is a fact of the history, not a case in the Justice system (no facility, no visits).
