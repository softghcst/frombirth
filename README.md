# Pathways

A text life simulation. One life, one year at a time.

Static site: plain HTML, CSS and ES modules. No build step, no dependencies.

## Play

- **GitHub Pages:** Settings → Pages → deploy from the branch root. All paths are relative.
- **iPad / iPhone:** open the Pages link in Safari → Share → Add to Home Screen. It runs full-screen.
- **Locally:** ES modules need a web server, not `file://`. From the repository folder:

  ```bash
  python3 -m http.server 8000
  ```

  Then open `http://localhost:8000/` for the game, or `http://localhost:8000/avatar-lab.html` for the avatar lab.

Lives save automatically to the browser's `localStorage`.

## Checks

There is nothing to install: the checks run on Node alone.

```bash
node tests/avatar.mjs
```

```bash
node tests/events.mjs
```

```bash
node tests/escape-layouts.mjs
```

`avatar.mjs` checks the parts catalogue, the renderer, inheritance and the loading of old saves.
`events.mjs` checks every scene. `escape-layouts.mjs` proves each prison map can be escaped.

## Avatars

Every portrait in the game is drawn by one renderer from layered, recolourable SVG parts.

| What | Where |
|---|---|
| Artwork, one file per feature | `js/avatar/parts/`: `face.js`, `eyes.js`, `brows.js`, `nose.js`, `lips.js`, `skin.js`, `hair.js`, `extras.js` (marks, glasses, facial hair, make-up) |
| The catalogue, and how saved appearances are read | `js/avatar/catalog.js` |
| The portrait renderer and the shared face template | `js/avatar/render.js` |
| How children take after their parents | `js/avatar/inherit.js` |
| The live editor | `js/avatar/editor.js` |
| The salon's prices and rules | `js/engine/salon.js` |
| The look of the portraits (proportions, outlines, cheeks, the baby) | constants at the top of `js/avatar/render.js` |

**Where to open the live appearance editor**

- In the game: title screen → **Design a life** → **Design your look**.
- In a life: **Self** tab → **Beauty salon** (hair, dye, glasses, facial hair, make-up; from age 3).
- On its own: `avatar-lab.html`, section 1.

**How to see a family resemblance example**

Open `avatar-lab.html`, section 2. It shows two parents with different features (one with dyed hair) and their
children, with a column saying which parent each feature came from. The buttons make a new family, add a child,
restyle the parents (the children must not change) and save and reload (they must come back identical).
In the game, design a look and start the life: your parents are built to resemble you, and the People tab shows them.

**How appearance is saved**

Each character carries its own `appearance`, written by the normal save system:

```js
appearance: {
  v: 2,
  inherited: { face, skin, eyeShape, eyeColor, brows, nose, lips, hairColor, hairTexture, marks: [] }, // set once, at birth
  style: { hair, hairDye, glasses, facialHair, makeup, lipColor },                                    // changed at the salon
}
```

A child is built from the parents' `inherited` halves only and then keeps their own copy, so a parent's dye or
haircut never reaches a child, and restyling a parent later changes nobody else. Saves from before this system
(four numbers) are converted on load; anything missing is chosen from the character's id, so the same person
always gets the same face.

**How to add a new avatar part**

1. Open the file for the feature in `js/avatar/parts/` and add an entry with a new `id` and a `name`.
   Each file's header explains the coordinates: everything is drawn on one 100 by 100 template with the eyes
   at (38,47) and (62,47), so a new part lines up with the rest.
2. Add the new id to the `SHIPPED` list for that feature in `tests/avatar.mjs`.
3. Run `node tests/avatar.mjs`, then look at it in `avatar-lab.html`, section 3 (every part, with its id).

Ids are written into saves. Add new ones freely, and never rename or remove one: the check fails if a shipped
id disappears. If one ever does go missing, characters using it fall back to a stable replacement instead of breaking.

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
js/avatar/      portrait parts, catalogue, renderer, inheritance, live editor
js/ui/          shell, modals, screens/, tabs/
avatar-lab.html a workbench for avatar artwork
tests/          checks that run on Node alone
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
| Crimes and the age each opens at, strangers, ways of killing, lawyers, prison gangs, sentence rules | `js/data/crimes.js` |
| Property tax by country | `PROPERTY_TAX` in `js/data/countries.js` |
| Moving abroad: who comes, how likely relatives are to say yes, shipping costs, the passport | `js/engine/emigration.js` |
| Escape puzzle maps (run `node tests/escape-layouts.mjs` after editing) | `js/data/prisonLayouts.js` |
| Treatment costs and success rates, surgeries and surgeons, activity and holiday prices, follower packs, emigration fee | `js/data/activities.js` |
| Trips: getaways, theme parks, cruises, flight classes, and the stories told about them | `js/data/activities.js` (`HOLIDAYS`, `CABINS`, `TRIP_STORIES`) |
| How long people live: the mortality curve, the constitution rolled at birth, and what good habits add | `js/engine/death.js` (`mortalityChance`, `rollLongevity`, `careShift`) |
| Illnesses (what they do each year, who gets them) | `js/data/illnesses.js` |
| Health, online and living-abroad scenes | `js/data/events/leisure.js` |
| Epitaphs (titles, inscriptions, what earns each) and the untaxed estate allowance | `js/data/epitaphs.js` |
| Age down: how many years can be taken back | `UNDO_YEARS` in `js/save.js` |
| Which stats and talents can be edited on other people | `EDITABLE_METERS`, `EDITABLE_TALENTS` in `js/engine/relationships.js` |
| Wills: who inherits, who gets which property or vehicle, what happens at death | `js/engine/death.js` |
| Skills that can be practised, sessions a year, lesson price | `js/data/skills.js` (rules in `js/engine/skills.js`) |
| Orientation, gender, transition steps and costs, how family respond | `js/engine/identity.js` |
| Scenes about identity | `js/data/events/identity.js` |
| Countries: currency, tax rates, cities, public services | `js/data/countries.js` |
| What each country is like to live in: pay, prices, safety, health care, power and water, stability, hazards, laws, crises | `js/data/living.js` (simplified, mid-2020s; edit a row and the game follows) |
| What living somewhere does each year, how wealth softens it, and what the law allows | `js/engine/living.js` |
| Scenes that depend on the country | `js/data/events/country.js` |
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
and promotions, and checked the layout at iPad and phone sizes. Since then: a modular
avatar system with a live editor, wills with named heirs, skills to practise, and
orientation and gender identity.

The layout has been checked in a desktop browser emulating iPad and phone
screens (portrait and landscape). It has not been run on a physical iPad.
