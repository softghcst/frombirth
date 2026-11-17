# Historical Eras — repository audit

What assumed the present day before Historical Eras, and where each system is
taught about the past. Written before the work began (Phase 1) and kept as the
map of where eras touch the game.

| System | Where | Behaviour before eras | Integration point | Risk | Tests before |
|---|---|---|---|---|---|
| World clock | `state.year`, `engine/yearProcessor.js` (`advanceYear`) | One year a tick; a life starts in the present unless `createLife({ year })` | `tickEra()` in the year processor; the era is always read from `state.year` | Low | `world-scenarios`, `digital` |
| Technology | `data/digital.js`, `engine/digital/tech.js` | Already era-aware: adoption by year and country infrastructure | Reused as is; eras never copy its data | — | `digital`, `digital-ui` |
| Scenes | `engine/eventEngine.js` (`timely`) | Modern-technology scenes already wait for the technology | Era scenes are queued by `engine/history.js`; nothing else changes | Low | `events` |
| Careers | `data/careers.js`, `engine/career.js` (`unmet`, `careerOptions`), `engine/npcLives.js` (`careersFor`), `data/traits.js` (`OCCUPATIONS` for parents) | Every career open in every year; parents can be software engineers in 1850 | `careerOpen()` from the era engine, called by `unmet`, by NPCs' job choice and by parents' occupations | Medium: hiring is central | `world-scenarios` (hiring) |
| Majors | `data/majors.js`; used in `ui/tabs/work.js`, `engine/education.js`, `engine/npcLives.js` | Computer science available in 1880 | `majorOpen()` filter at each list | Low | `admissions` |
| Money | `util.js` (`localMoney`, `localWage`, `localCost` use `country.currency.scale`), `engine/emigration.js` (`convertMoney`), `engine/currency.js` (`BY_CODE`) | Mid-2020s wages and prices; today's currencies (euros in 1900) | Each country's `currency` is set for the year (historical currency and a price level built into its `scale`); the year's change is applied to everyone's money once, with `convertMoney` — the same mechanism as emigrating | High: touches every amount | `property`, `systems`, `economy` |
| Laws | `engine/rules.js` (`source`, layers default → parent → place → region → enacted), `data/rules.js` | Today's law in every year | A historical layer in `source()`: dated values in `data/history.js`, applied only before the date a law changed. Changes made during the life (enacted) still win | Medium | `rules`, `lawmaking` |
| Schooling | `rules.schoolLeavingAge`, `engine/education.js`, `engine/npcLives.js` (`choosePath`) | Modern schooling and university rates | School-leaving age through the law layer; the chance of university for NPCs and the player's admission odds scaled by the era's university access | Medium | `schooling`, `admissions` |
| Health | `engine/death.js` (`mortalityChance`), `engine/medical.js` (`seeDoctor`, treatments), `engine/children.js` (`birth`) | Modern medicine and lifespan | Era health profile: a shift in old-age mortality, extra adult and childhood risk, treatment availability and effectiveness, childbirth risk | High: deaths are permanent | `world-scenarios` |
| Economy and news | `engine/economy.js` (`post`, phases), `engine/news.js` | Fictional crises only | Era events (`data/history.js`) post news, set economic phases, call people up, and queue a few scenes | Medium | `economy` |
| Conscription | `rules.conscription` | Today's rule | The law layer, with wartime windows by country | Low | `rules` |
| Saves | `save.js` (`migrate`) | No era data | `state.era` is created once; lives saved before eras keep their money as it was (see below) | Medium | `avatar` (old saves), `digital` |
| Heirs | `engine/legacy.js` (`continueAs`) | Carries the year on | `state.era` is carried with the year; money is already in the year's terms | Low | `digital` (legacy) |
| Character creator | `ui/screens/creator.js` | Year of birth field, no explanation | Era name and a short description beside the field | Low | `digital-ui` |
| Family Archive / Digital History | `ui/digital.js` | Technology only | The eras each ancestor lived through; the era of the current year | Low | `digital-ui` |

## Lives saved before eras

A life saved before this feature, already in the past, kept modern prices. To avoid
rewriting a fortune, such a save keeps modern money for the rest of that life
(`state.era.money = 'modern'`); everything else (careers, laws, schooling, health,
events) follows the era from the next year on. New lives use era money from birth.
Lives in the present are unaffected: from 2025 on, every era rule is today's rule.

## Accuracy

Dated facts (the start of a war, the year women could vote or same-sex couples marry
in a country, the euro's conversion rates) carry a short source note in
`data/history.js`. Price levels, wage levels and mortality are **gameplay estimates**
built from a handful of anchors, and are marked as such. Where a country's
history is not recorded, the shared era default applies and is marked as a default,
never presented as that country's own law.
