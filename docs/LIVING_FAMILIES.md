# Living families

Blended families, moving out, foster and kinship care, weddings with real guests, and the gaps in teenage life. Built on
what the game already had (the neighborhood's households, romance, moments, schooling, the yearly steps); nothing here
is a second family graph, household engine or clock.

## Where it lives

| What | Where |
|---|---|
| How two people are related (biological, legal, step, half, adoptive); who lives in the family home | `js/engine/kinship.js` |
| Parents who separate, the care arrangement, a parent's new partner, step- and half-siblings, the player's step-children | `js/engine/blended.js` |
| Moving out and back: leases, deposits, roommates | `js/engine/independence.js` |
| Foster care, kinship care, guardianship, adoption from care | `js/engine/fostering.js`, `js/ui/fostering.js` |
| Wedding guests and who came | `js/engine/weddingGuests.js` |
| House rules (curfew) | `js/engine/houseRules.js` |
| Family court (custody cases) and child support after a separation | `js/engine/familyCourt.js` |
| People from the past, back because of real shared history | `js/engine/callbacks.js`, `js/data/events/callbacks.js` |
| Dice of their own for the new systems | `js/engine/keyedDice.js` |
| Scenes | `js/data/events/blended.js`, `independence.js`, `fostering.js` |
| Age of majority by country | `js/data/rules.js` (`majorityAge`), `js/data/history.js` |

## Records

- `player.family`: the parents a life was born to and its legal parents, separations, and the care arrangement (where
  the child mainly lives, how often they see the other parent, its history). Filled in for old saves from what they
  already say; nothing is invented (`migrateFamilyLife`, run on every load, idempotent).
- People keep one id. A step-parent is role `stepparent` (`flags.partnerOf`, `married`, `liveIn`, `former`); a
  step-sibling `stepsibling` (`parentIds` = their own parent); a half-sibling is a `sibling` with `flags.half` = the
  shared parent's id; the player's spouse's children are `stepchild`; a child in care `fosterchild` (or keeps their
  role in kinship care); a ward `ward`; a child in care's parents `fosterfamily`.
- A parent who moves out lives in a real household on the neighborhood map (`houseApart`).
- `player.leases`, `player.fostering`, `player.houseRules`; wedding guests on the spouse (`flags.wedding.guestList`).
- Separations, remarriages, births, first homes, placements, reunifications, guardianships, adoptions and weddings are
  canonical events (`chronicle.recordEvent`, keyed so they are never written twice).

## Time

Everything routine runs in the yearly steps (`blended`, `fostering`, `independence`), which run once a world year
whatever the turn length. Rent stays in `finance.js`, once a year. Deposits are ledger charges with a key, paid once and
refunded once. `tests/family-time-steps.mjs` plays ten years of a separating family and of a foster carer who rents, in
3-, 6- and 12-month turns, and they come out the same.

The new systems roll keyed dice (`keyedDice.js`) and make new people on dice of their own, so a life where none of this
happens plays exactly as it did before.

## Simplified, and labeled so

- The care arrangement after a separation is a model of where a child mainly lives and how often they see the other
  parent, not a court process. It is never decided by money. It is labeled simplified outside the United States.
- Foster care: approval is a year of training, a background check and a home study; any criminal record declines (a
  simplification); licensed foster care begins in 1950. Reviews are yearly; reunification follows the family's progress;
  only a court ends parents' rights; adoption from care needs that, and an older child can say no.
- Age of majority is one age per country (19 South Korea, 21 Singapore, 20 Japan before 2022, otherwise 18).

## Built since the first version

- Parents who cannot agree go to family court: a case in the justice record (`J().family`) with a real judge,
  mediation or a judge's decision a year on, the child heard from ten (strongly from twelve), decided on continuity,
  bonds and distance, never money. Child support: 15% of the absent parent's income, yearly, until 18, none with
  shared care, reversed if the child moves.
- Moving back home needs room (`SLEEPS` by home type).
- Continuing as an heir keeps the blended family: half- and step-siblings told apart, close step-relatives as
  step-grandparents and step-aunts or uncles, people raised in care in touch; active placements end on the record.
- Callbacks: a former foster child's wedding, an old roommate's job lead, a lapsed school friend, a former step-parent at
  a milestone birthday, a step-sibling's wedding. Only with the history behind them, once per person, keyed dice.

## Not built yet

- Starting a new life already in foster care or raised by a grandparent by choice (it happens today only when no parent
  can care for the child, `engine/guardianship.js`).
- Appeals of a custody decision; a lawyer player taking on the family's own case.
- Friend groups as their own records for teenagers (cliques and adult circles exist); a teen job interview.
