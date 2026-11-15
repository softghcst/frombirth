# Pathways

A text life simulation. One life, one year at a time.

Static site: plain HTML, CSS and ES modules. No build step, no dependencies.

## Play

- **GitHub Pages:** Settings → Pages → deploy from the branch root. All paths are relative.
- **iPad / iPhone:** open the Pages link in Safari → Share → Add to Home Screen. It runs full-screen.
- **Locally:** ES modules need a web server (`python3 -m http.server`), not `file://`.

Lives save automatically to the browser's `localStorage`.

## Layout

```
index.html, manifest.json, sw.js, icons/
css/            base, layout, components, modals
js/main.js      boot and screen routing
js/state.js     live GameState store
js/save.js      save slots and graveyard
js/rng.js       seeded RNG (state is saved with the game)
js/types.js     master schemas (JSDoc)
js/engine/      year processor, event engine, effects, conditions, generation,
                health, education, finance, relationships, death
js/data/        countries, traits, birthConditions, illnesses, events/
js/ui/          shell, avatar, modals, screens/, tabs/
```

## Where to edit content

| To change | Edit |
|---|---|
| School stages, programmes after high school (university, cosmetology, graduate, medical, law), tuition, entry GPAs, housing costs | `js/data/schools.js` |
| University majors, their entry GPAs and audition majors | `js/data/majors.js` |
| Clubs, classes, try-outs, yearly skill gains, the contact a club introduces | `CLUBS` in `js/data/schools.js` |
| High-school crowds | `CLIQUES` in `js/data/schools.js` |
| Kinds of university that make offers (names, cost, aid, what each is known for) | `SCHOOL_TYPES` in `js/data/schools.js` |
| Apprenticeship trades, gap-year options, yearly priorities | `TRADES`, `GAP_YEARS`, `PRIORITIES` in `js/data/schools.js` |
| Part-time jobs and pay | `js/data/partTimeJobs.js` |
| Careers: ladders, pay bands, entry requirements, doors opened by storylines, fame | `js/data/careers.js` |
| Freelance gigs and fame actions | `GIGS`, `FAME_ACTIONS` in `js/data/careers.js` |
| Interview questions and audition pieces | `js/data/interviewQuestions.js` |
| Workplace events | `js/data/events/work.js` |
| Property types, mortgage terms, rent and bills | `js/data/properties.js` |
| Vehicles (bikes and boards for children, motorbikes, cars, boats, aircraft), the age each can be bought at, licences, servicing | `js/data/vehicles.js` |
| Funds, shares and coins (all fictional); bank loans; overdraft and bankruptcy | `js/data/securities.js` |
| Gambling stakes, lottery prizes, the bookmaker's cut | top of `js/engine/gambling.js` |
| Money events (leaks, tenants, breakdowns, tips) | `js/data/events/money.js` |
| Crimes, lawyers, prison gangs, sentence rules | `js/data/crimes.js` |
| Escape puzzle maps (run `node tests/escape-layouts.mjs` after editing) | `js/data/prisonLayouts.js` |
| Treatment costs and success rates, surgeries and surgeons, activity and holiday prices, follower packs, emigration fee | `js/data/activities.js` |
| Trips: getaways, theme parks, cruises, flight classes, and the stories told about them | `js/data/activities.js` (`HOLIDAYS`, `CABINS`, `TRIP_STORIES`) |
| How long people live: the mortality curve, the constitution rolled at birth, and what good habits add | `js/engine/death.js` (`mortalityChance`, `rollLongevity`, `careShift`) |
| Illnesses (what they do each year, who gets them) | `js/data/illnesses.js` |
| Health, online and living-abroad scenes | `js/data/events/leisure.js` |
| Epitaphs (titles, inscriptions, what earns each) and the untaxed estate allowance | `js/data/epitaphs.js` |
| Countries: currency, tax rates, cities, public services | `js/data/countries.js` |
| First names and surnames for each country (people are named from where they live) | `js/data/names.js` |
| Child acting: ages, levels, pay, and the head start it gives an adult actor | `child_actor` in `js/data/careers.js` |
| Prison events | `js/data/events/prison.js` |
| Gift tiers, rings, wedding sizes, fees | top of `js/engine/relationships.js`, `romance.js`, `children.js` |
| Romance and family events | `js/data/events/romance.js`, `family.js` |
| Other people's lives: ambitions, hobbies, school and adult moments, family size limits | `js/data/npcLife.js` |
| Scenes that other people's lives ask you to respond to | `js/data/events/familyLives.js` |
| Friend scenes (new groups, fallings-out, memories) | `js/data/events/friends.js` |
| Early-life scenes (infancy to the teens) | `js/data/events/early.js` |
| Everyday adult and later-life scenes | `js/data/events/everyday.js` |
| Higher-rate income tax and yearly living costs | `js/engine/finance.js` (`incomeTax`, `lifestyleCost`) |
| How performance and promotion work | `js/engine/career.js` (`tickCareer`) |
| One-off events | `js/data/events/*.js` |
| Multi-year storylines: musical theatre, mentors, school paper | `js/data/events/stories/*.js` (each file's header explains its flags and contacts) |

Storyline scenes are ordinary events with a few extra fields: `priority`,
`exclusive`, `queuedOnly`, cast by contact tag (`'tag:director'`), outcome
variants chosen from history with `when([...], outcome)`, memories stored on
people with `mem()`, and follow-up scenes with `queue()`.

## Adding events

Add an object to a file in `js/data/events/` (or a new file registered in
`events/index.js`). See `js/types.js` for the `GameEvent` schema and
`events/helpers.js` for the effect constructors.

After adding or changing a scene, run `node tests/events.mjs`. It checks every
scene for duplicate ids, missing outcomes, unknown effects and conditions, and
names used in the text with nobody cast as them.

## Status

All ten phases are built: core engine, saves, character creation and family,
education with storylines, careers with fame, relationships with independent
family lives, the economy, crime and prison, health and activities, death and
legacy, and a final pass that brought the game to over 200 scenes, rebalanced money
and promotions, and checked the layout at iPad and phone sizes.

The layout has been checked in a desktop browser emulating iPad and phone
screens (portrait and landscape). It has not been run on a physical iPad.
