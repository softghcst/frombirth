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
node tests/succession.mjs      # the rules of royal succession, on hand-built families
node tests/elections.mjs       # votes, seats, run-offs, coalitions, two-candidate races and the count
node tests/admissions.mjs      # university decisions and aid, on hand-built applicants
node tests/schooling.mjs       # marks, and the shape of school in every country
node tests/legislature.mjs     # votes in the legislature: majorities, rebels, deals, vetoes
node tests/animals.mjs         # the family's animals: one record each, owners and carers kept apart, the album, generations
node tests/animal-care.mjs     # shelters, adoption, costs, the vet, insurance, fostering, rehoming, moving abroad, careers
node tests/animal-riding.mjs   # lessons, horses, livery, shows, farm animals, breeding and pedigrees
node tests/animal-life.mjs     # staff, classes, behaviour, landlords, outings, custody, leasing, reptiles, bonds, businesses, story arcs
node tests/sports.mjs          # sports: registry, skills, training limits, clubs, seasons, draws, injuries, recruiting, contracts, money once, generations
node tests/sports-scenarios.mjs # sports: the playable scenarios A to R, the family, and the first vertical slice, each played through
node tests/sports-regressions.mjs # sports: bugs found in review (contracts and jobs, school and university teams, injuries, prison, generations), kept fixed
node tests/turns.mjs           # turn length: years, halves or quarters; the same life comes out the same; scenes for each season
node tests/lawmaking.mjs       # a head of government changing the law of the land through the legislature
node tests/world-scenarios.mjs # the Living World brief's ten end-to-end scenarios, A to J
node tests/systems.mjs         # income-tax schedules and health-care models
node tests/property.mjs        # buying, owning and selling property abroad; tax and inheritance by place
node tests/economy.mjs         # economies that turn, crises that begin and end, news, people who move
node tests/cities.mjs          # cities and regions: prices, pay, regional law, moving within a country
node tests/rules.mjs           # the legal rule engine: layers, overrides, what is allowed, laws that change
node tests/immigration.mjs     # routes into a country, visas that run out, spouses who stay, trips
node tests/citizenship.mjs     # nationality at birth, residency, naturalisation; exchanging money never creates it
node tests/business.mjs        # owning a business: starting, staff, the accounts, the owner paid once, partners, selling, failing, heirs
node tests/worklife.mjs        # every outcome of every working-life scene played through; romance at work, children's leanings, royals at work, two-career households
node tests/careers.mjs         # the occupation catalog, employers and openings, hiring, payroll once a year, side jobs, workplaces, freelancing, the military, retirement, records across generations
node tests/a11y.mjs            # zoom, contrast in both themes, dialog names and focus, landmarks (see docs/ACCESSIBILITY.md)
node tests/money.mjs           # the ledger, banking, goals, budget and lending record: no money made or lost, nothing posted twice
node tests/wealth.mjs          # credit cards, insolvency, insurance, pension plans, family money, trusts, money scenes
node tests/justice.mjs         # crime, courts and prison: incident to release and reload, scenarios A to O, older saves, law reform, family cases, royal immunity, transfers
node tests/world.mjs           # the 102 reference places: codes, kinds, currencies, cities; a life lived in each (--report lists gaps); fails if any reference field disagrees with its source
```

`avatar.mjs` checks the artwork, the manifest, the renderer, inheritance and the loading of old saves.
`events.mjs` checks every scene. `escape-layouts.mjs` proves each prison map can be escaped.

## Money

Every movement of the player's money is written in one double-entry ledger (`js/engine/ledger.js`), in whole
numbers of each currency's smallest unit. **My Money** (tap the amount at the top of the game, or Holdings →
My Money) shows accounts, a budget of what was actually earned and spent, debts and standing with lenders,
savings goals, the household, retirement, the estate and the history. Bank accounts, goals and
budgets are in `js/engine/banking.js`; cards, insurance, pension plans, family money and trusts each have an engine of their own beside it. The banks, insurers and their terms are invented
(`js/data/money.js`).

How it works, what is fiction, and what is not built yet: [docs/FINANCE.md](docs/FINANCE.md).

## Time per turn

Self → **Settings → Time per turn**: a year (the default), six months or three months. The year itself still happens
once, at the turn of the year: pay, tax, school reports, seasons of sport, health and birthdays run exactly as with
one-year turns, so money and records come out the same in every mode (`tests/turns.mjs` plays the same life all three
ways and compares). The turns in between move the calendar on, show the age in months, put a heading for each part of
the year in the life story, and may bring one of about thirty scenes written for that season and that turn length
(`js/data/events/seasons.js`: summer holidays, exam season, the dark of winter, a first scan, a baby's first smile,
preseason training), and perhaps one of the year's ordinary scenes as well: about 1.8 scenes a year with one-year turns,
3.7 with six-month turns and 5.8 with three-month turns. Story beats stay with the turn of the year. Seasons run the
other way round in the southern hemisphere. Those turns draw on luck of their own
(`engine/eventEngine.js` drawBetween), never on the game's dice. A change partway through a year starts from the next.

## Sports and athletics

Pursuits → **My Athletics** is the hub: ten sections (overview, sports, training, teams and clubs, competitions,
rankings, career and offers, health and mind, money and fame, legacy), with profiles for each sport, team, coach,
season, event and family athlete. Family archive → **Athletic legacy** opens the same record from the People tab.

One engine plays every sport; the sports themselves are data. Soccer, tennis and pickleball (with doubles partners)
are modeled in full; the other twenty-odd sports use shared scoring for goals, points, runs, sets, rally games,
strokes, times, judged scores and bouts. Sport skills are separate from the character's talents and grow towards a
fixed ceiling, with diminishing returns per training hour. Coaches, key teammates, doubles partners and agents are
real people. Results come from keyed, seeded luck and are stored once, so a reload never re-rolls them; standings
and champions are counted from completed games only. Clubs, leagues and the Pathways Rating (PR) are invented.

| What | Where |
|---|---|
| The registry: sports, skills, positions, founding years, routes to going pro, injuries, plans | `js/data/sports.js` |
| How a match, race or routine comes out, and the rating | `js/engine/sportsPlay.js` |
| Profiles, eligibility, training, clubs and tryouts, coaches, rosters, leagues and seasons, draws and meets, doubles | `js/engine/sports.js` |
| The year in sport, money, injuries and rehab, recruiting and scholarships, contracts, sponsors, fame, arcs, generations | `js/engine/sportsLife.js` |
| Stories with scenes, A to I: first team, a coach who believes in you, the scholarship, the championship season, the doubles partnership, injury and recovery, the professional dream, the comeback, a new generation | `js/engine/sportsArcs.js`, `js/data/events/sports.js` |
| Sport in the family: parents' and grandparents' past, siblings and children who choose their own sport, parents at games | `js/engine/sportsFamily.js` |
| My Athletics; lines in the life story open the season, event, team or coach they are about | `js/ui/sports.js` |

Not built: there is no wider disability system (adaptive sports key off `flags.wheelchair` or a matching condition),
no historical eras beyond each sport's founding and first-professional year, and the shared adapters do not model
substitutions, set plays or per-event schedules. Relatives' records are light: the level reached, seasons and titles,
not every game.

## The family's animals

People → **Pets & Animals** is the hub: your animals, the local shelter and farm rescue, care and costs, training, the vet,
riding, and the album. People → **Family archive → Our Animal Family** is the generational album and timeline.
Holdings lists the animals of your household and the chronicle of your house.

Every animal has one record, kept for good (`state.animals`). Owner, main caregiver and home are three separate
histories. Moments worth keeping are written once and tied to the line of the life story that tells them. When a
life ends, each animal that depended on the player gets a keeper, and the whole record crosses to the heir.

| What | Where |
|---|---|
| Seventeen species, breeds, temperament, costs, what can be taught, riding disciplines and show levels | `js/data/animals.js` |
| The record: identity, owners, carers, homes, bonds, moments, the hand-over between generations | `js/engine/animals.js` |
| Shelters, adoption checks, yearly costs, the vet, insurance, fostering, rehoming, volunteering, moving abroad | `js/engine/animalCare.js` |
| Riding schools and instructors, lessons, livery yards, buying and riding a horse, shows | `js/engine/equestrian.js` |
| Breeding (vet-checked, unrelated, limited, never for profit), parentage and pedigrees | `js/engine/animalBreeding.js` |
| Classes and trainers, behavior problems, outings, the local pet show, custody after a split, siblings' chores | `js/engine/animalLife.js` |
| Stories that take years: first pet, a nervous rescue settling, training, lifelong bonds, remembrance, the show ring, an older horse | `js/engine/animalArcs.js` |
| Scenes: illness, emergencies, foster reviews, settling in, a child asking for a pet, visiting the family dog | `js/data/events/animals.js` |
| Screens: album, timeline, profiles, chronicle / the hub / portraits / the way back | `js/ui/animals.js`, `js/ui/animalHub.js`, `js/ui/animalPortrait.js`, `js/ui/animalNav.js` |

Rules the tests hold the game to: one shelter animal is the same animal on every visit and after it is adopted; every
charge is in one ledger, once, with its currency; insurance pays its share of a bill once and never routine care; a
show class is ridden once and its result survives a reload; prizes never cover a horse's costs and animals never
make the family money; parentage is never invented and no animal is its own ancestor.

Careers with animals (animal care, dog training, grooming, horses and riding, farming, and veterinary medicine) are in
`js/data/careers.js`; fostering, volunteering and riding well open their doors. The people at shelters, vets, yards and
training clubs become people in the player's life the first time they deal with them, and stay the same people.
Landlords set rules about animals; some species need a license and some are banned. Each person's bond with an animal
has three sides: attachment, trust and comfort. Horses can be leased or sold (never for more than they cost); Pursuits
→ Riding leads to the same screens.

Animal businesses (pet sitting, a grooming salon, kennels, a dog training school, a riding school, a smallholding) are
kinds of business in the shared business system (`js/data/business.js`), started and run from the Work screen like any
other; the Pets & Animals hub links there. Kennels, a riding school and a smallholding need land of one's own, and a
riding school needs a rider who rides at an advanced level.

Not built, because the rest of the game does not have it yet: historical eras (every life starts in the present
day, so there is nothing for era rules to change).

## Avatars

Every portrait in the game is the **CharacterAvatar** system: hand-drawn SVG parts in `assets/avatars/`, stacked
in layers and recoloured with CSS variables. There is no build step: the parts are plain files, and a short
Python script (standard library only) keeps them tidy and lists them for the game.

| What | Where |
|---|---|
| The artwork, one folder per kind of part | `assets/avatars/` — `heads/`, `eyes/`, `eyebrows/`, `noses/`, `lips/`, `hair/`, `clothes/`, `crowns/`, `glasses/`, `jewelry/`, `facial_hair/`, `makeup/`, `aging/`, `emotions/` |
| The list of every part (generated: do not edit) | `js/avatarManifest.js` |
| Cleaning, aligning and listing the artwork | `scripts/build-avatar-manifest.py` |
| Skin, hair, eye, lip and outfit colors | `js/avatarPalettes.js` |
| Notes the filenames cannot carry (hair textures, resting faces, uniforms, royal dress) | `js/avatar/curation.js` |
| The renderer: layers, ages, auto-dress | `js/CharacterAvatar.js` |
| How saved appearances are read, and old saves converted | `js/avatar/catalog.js` |
| How children take after their parents | `js/avatar/inherit.js` |
| The character creator and salon editor | `js/avatar/editor.js` |
| The salon's prices | `js/engine/salon.js` |

**How a portrait is built.** Each layer is an SVG `<use>` of a part file, in this order: back hair, head, make-up
(clipped to the head), age lines, eyes, eyebrows, nose, mouth, facial hair, clothes, necklaces, front hair,
earrings and piercings, glasses, hat or crown, emotions. Hair is drawn twice — the whole style behind the head,
and the part above the jaw again in front — so a fringe falls over the forehead while long hair falls behind the
shoulders. A hat hides hair above the brim (bulky styles, above the ears). Colors are CSS variables on the portrait
(`--skin-color`, `--hair-color`, `--brow-color`, `--eye-color`, `--lip-color`, `--blush-color`, `--outfit-color`)
that reach into the part files.

**Fitting each head.** The script measures every head (top, chin, width above the ears, the ears, neck and
shoulders; stored as `fit` in the manifest), and the renderer moves each layer from the template face onto that
head: features keep their place between forehead and chin, hair and hats follow the top and width of the head,
earrings hang from that head's ears, clothes sit under its chin. Babies, toddlers and children get slightly smaller,
lower-set features. Eyes drawn as an empty outline are given whites by filling the opening.

**Personal proportions.** Each person also has `inherited.tweaks`: eye spacing, eye size, eye height, nose size
and mouth size, each from -2 to 2 steps (`TWEAKS` in `js/avatar/catalog.js`, step sizes in `TWEAK_STEP` in
`js/CharacterAvatar.js`). They are set in the creator, vary a little at random, and children take each from a parent. Cosmetic surgery
(**Self** → **Cosmetic surgery** → *Facial reshaping*) changes them too, and children born afterwards can take after the new face. Anyone's whole look can be edited from **People** → a person →
**Edit stats and talents** → **Edit their look**.

**Ages and dress.** Babies and toddlers have their own heads, baby hair and baby clothes; children have the child
head; from fifty, lines arrive and hair grays unless dyed. Portraits dress for the moment: prison orange in prison,
crown and robes for the royal family (a coronet for the peerage), and uniforms at work — police (tactical gear when
senior), fire service, the armed forces, white coats in medicine, a suit in law and finance. Hats have been withdrawn:
only crowns and tiaras are worn on the head. Hairstyles that hide an eye or much of the face (`HAIR_COVERS_FACE` in
`js/avatar/curation.js`) are never given at random, though they can still be chosen.

**The character creator.** Title screen → **Design a life** → **Design your look**; in a life, **Self** →
**Beauty salon** (styling only); or `avatar-lab.html`. Six tabs (face, eyes, nose and mouth, hair, clothes, extras),
hair filtered by length or by what suits your texture, a preview at other ages, and **Randomize**.

**How appearance is saved**

```js
appearance: {
  v: 3,
  inherited: { head, skin, eyes, eyeColor, brows, nose, lips, hairColor, hairTexture, marks: [], tweaks: {} }, // set once, at birth
  style: { hair, hairDye, glasses, facialHair, makeup, lipColor, jewelry: [], outfit, outfitColor, hat }, // the salon and wardrobe
}
```

A child is built from the parents' `inherited` halves only, so a parent's dye, haircut or clothes never reach a
child. Saves from the two earlier avatar systems are converted on load, deterministically: an old part always
becomes the same new part (relatives who shared a nose still do), colors keep their names, and anything missing is
chosen from the character's id, so nobody's face changes between loads.

**How to add artwork**

1. Drop the new SVGs (or a `.zip` of them, nested zips too) into the repository and run
   `python3 scripts/build-avatar-manifest.py path/to/pack.zip` — or put loose SVGs anywhere under `assets/avatars/`
   and run `python3 scripts/build-avatar-manifest.py`. Files are sorted by their name's prefix (`hair_`, `outfit_`,
   `nose_`, ...), cleaned, fitted onto the shared face and listed in the manifest. Processed files are marked and
   skipped next time, so running it again is safe. `-v` prints how each file was placed.
2. For a new hairstyle, add its texture to `HAIR_TYPE` in `js/avatar/curation.js` (the check below will remind you).
3. Run `node tests/avatar.mjs` and look at the new parts in `avatar-lab.html`, section 3.

Part ids are written into saves: add new ones freely, and avoid renaming a file. A part that goes missing falls back
to a stable replacement instead of breaking.

## The world

Pathways has 103 places to live: the 102 on the reference list (16 in North America, 11 in South America, 28 in Europe,
13 in Africa, 12 under "Middle East", 18 in Asia, 4 in Oceania) and Ghana. Not all are sovereign states, and the game
says so: Puerto Rico and Aruba are territories, Hong Kong is a special administrative region, Taiwan is a self-governing
jurisdiction whose status is disputed. Each has its own currency code, languages, cities, pay and prices, taxes, school
system and form of government. Codes, names, currencies, languages, time zones, capitals, regions and cities are checked
against published sources, and so are the main laws, legal ages, citizenship rules and forms of government (see
`docs/WORLD_DATA.md`).

| What | Where |
|---|---|
| What each place is: codes, kind, parent, capital, languages, time zone, government | `js/data/world.js` |
| The 48 newest places, one row each | `js/data/worldNew.js` |
| Names, currency, taxes, cities; living conditions; political systems | `js/data/countries.js`, `js/data/living.js`, `js/data/politics.js` |
| Profiles, search and comparison (one source for every screen) | `js/engine/world.js` |
| The World Explorer | `js/ui/world.js` |
| What is real, what is game, and what is unverified | [`docs/WORLD_DATA.md`](docs/WORLD_DATA.md) |
| Checking the reference data against ISO, CLDR, IANA and GeoNames; the results | `scripts/verify-world.py`, `js/data/worldVerification.js` (generated) |
| Checking laws, ages, citizenship and government against pinned Wikipedia revisions; the results | `scripts/verify-laws.py`, `js/data/lawVerification.js` (generated) |

**The World Explorer** opens from the title screen (**The world**), from **Design a life** (**Explore the world**) and from
the **Self** tab. Search by country, city, language, currency or code (accents are ignored: "turkiye", "sao paulo"), filter by
region, open a profile, and compare a place with where you live. A profile keeps three things apart: facts about the place,
how the game models living there, and what has happened there in your save.

### Papers: birthplace, citizenship and residence

Three separate records (`js/engine/citizenship.js`, rules in `js/data/citizenship.js`):

- **Citizenship** comes from your parents, and from the place itself where being born there is enough (most of the
  Americas). A child can hold several. Someone born in a territory holds the nationality of the state it belongs to.
- **Residence**: citizens live in their own country, and its territories, as of right. Anyone else is a permanent resident
  from the day they move, with a history of everywhere they have lived.
- **Becoming a citizen**: after the years of residence the place asks for (five by default; three if married to a citizen,
  which shortens the wait and grants nothing by itself), with a fee and a test that is easier if you speak the language.
  Places that allow one nationality only make you give up the others, or take theirs away when you acquire another.
  Only citizens vote.

The **Passport** (Self tab) shows all of it and is where you apply. The rules are gameplay configuration and are unverified;
see [`docs/WORLD_DATA.md`](docs/WORLD_DATA.md).

### Money in more than one currency

`js/engine/currency.js`. Everyday money is always in the currency of the country you live in. Beyond that you can hold
accounts in other currencies (**Holdings** → **Currencies**), change money between them for a 1.5% fee, and see the record of
each exchange with the rate that was used. When you move abroad you choose how much to change and how much to leave behind
in the old currency. Net worth and estates count every currency once. Rates are fictional: each currency wanders a few per
cent a year around a fixed starting rate. Amounts are whole units and every conversion rounds down, so exchanging never
creates money.

### Routes into a country, and visas that run out

`js/engine/immigration.js`, numbers in `js/data/immigration.js`. Moving abroad is a choice between routes, each with its own
conditions, cost, odds and the status it gives:

| Route | For | You arrive as |
|---|---|---|
| As a citizen | citizens, including of a territory's parent state | citizen |
| Free movement | citizens of a country in the same free-movement area | permanent resident |
| To join family | a spouse who is a citizen there, or close family living there | permanent resident |
| Sponsored by an employer | a degree or a trade; comes with the job | work visa, 4 years |
| As a student | a school-leaving qualification and a year's funds | student visa, 4 years, no full-time work |
| As an investor | a large sum | permanent resident |
| Settlement program | points for education, work, age and language | permanent resident |
| Seeking protection | people whose own country is in crisis; no fee | temporary, 3 years |

Routes that are closed are shown with the reason. A temporary status is renewed while its reason holds (a job, a course, a
crisis at home), becomes permanent after five years, and otherwise ends: one year's warning, then the return home. A graduate
gets two years to find a sponsor. Citizenship is for permanent residents.

Family who move with you hold a status of their own: citizens of the place need none, and anyone else is your
**dependant**, for as long as your own permission lasts and permanently once yours is. A child who turns eighteen on a
dependant visa needs a status of their own (a course, a job, or a year to leave), and a dependant whose sponsor leaves must go
too. When you become a citizen your children under eighteen become citizens with you; a husband or wife applies in their own
right. The passport lists your household and how each of them stands.

A husband or wife now decides for themselves whether to come. If they stay, the marriage continues across a border: it wears
with distance, and a strong one often ends with them following.

Flights abroad have a purpose (a holiday, seeing family, or looking with a move in mind, which helps a later application),
give a little practice in a language you have begun, and are listed on the passport. A criminal record can get a visitor
turned back at the border.

All of this is gameplay configuration, the same shape for every country, and describes no real visa.

### One place to ask what the law is

`js/engine/rules.js`, values in `js/data/rules.js`. Every legal question the game asks goes through `rule(id, place)` or
`may(action)`: the ages for voting, driving, drinking, gambling, marrying, leaving school and drawing a pension; whether
alcohol, gambling, divorce and same-sex marriage are legal; how the law treats gay and transgender people; the death penalty;
conscription. An answer is built in layers, the last one winning:

1. the default;
2. the state a territory belongs to (Puerto Rico starts from the United States);
3. the place itself;
4. a region inside it (the table is ready; regions arrive with states and provinces);
5. anything changed during this life, which is kept in the save and never written back to the reference data.

So at nineteen you can go to a bar in the United Kingdom and not in the United States, vote at sixteen in Brazil, and find
that the Philippines has annulment and no divorce. Now and then a country somewhere changes one of its laws; you hear of it
when it is where you live or a country you are a citizen of, and the World Explorer lists the change.

**Changing the law in office.** A head of government can put these laws to the legislature (Work → Bring in a law → The
law of the land): marriage, protection in law, the death penalty, military service, gambling, alcohol, divorce, and the
voting, drinking and pension ages. Parties vote on them by their views on freedoms, order and public provision, so a bill
your own party dislikes brings rebels. The public has a view as well, which starts from the law the country already has. A
bill costs nothing and has no committee stage; it counts as one of the year's two bills; a crown with real power can refuse
it; where one person rules, it is a decree. The world's own reforms in a country your life has a government for now need a
government that wants them.

**Regional law.** Where a country leaves some of these laws to its states, provinces or emirates, the head of a region
can change them, one a year, through the regional assembly. Which ones depends on the country: an American state can set
the death penalty, gambling and the driving, drinking and gambling ages; a Canadian province the same except the death
penalty, which is federal; a German Land only gambling; an Indian state or an emirate can ban alcohol; in Brazil, France,
Italy or Russia none of these are regional (`REGIONAL_POWERS` in `js/data/rules.js`, not yet checked against sources). A law
applies to everyone living in the region (where the game records no states, the area around the city). Between a regional
and a national change to the same law, the more recent one stands.

The values are hand-compiled, one per place, and unverified. They are not legal information.

### Cities and regions that differ

`js/engine/cities.js`, rows in `js/data/cities.js`. A city is no longer only a name. Each has a profile against its country
as a whole: what homes cost to buy and rent, and what work pays. Twelve countries (the United States, the United Kingdom,
Canada, Mexico, Brazil, France, Germany, Japan, India, South Korea, Australia and the United Arab Emirates) have a row for
every city, with the state, province or region it is in. Everywhere else the capital and the first-listed city get a generic
profile and are marked as estimates.

- Property listings, rent and salaries follow the city. A house keeps the value of the city it stands in.
- **Moving** (Pursuits) lets you move to another city without leaving the country: a moving cost, a job that transfers if
  the employer has a place for you, a home that stays where it is, and an entry in the record of where you have lived.
- When you emigrate you choose the city you arrive in.
- A region can have its own law, through the rule engine: the death penalty by American state, the drinking age by Canadian
  province, alcohol by emirate.

Safety, schools and hospitals also vary a little by kind of city: the capital and the largest city have the major hospitals
and slightly better schools, and a little more crime; smaller cities are safer, with fewer specialist hospitals. This is a
rule by kind of city, not data about any named place, and it is modest next to the differences between countries.

The multipliers are rough estimates for play, not statistics.

### A world that moves without you

`js/engine/economy.js`, numbers in `js/data/economy.js`. Each year, in every country:

- **The economy turns** between boom, steady and recession. Where you live this changes how easy it is to be hired, how
  likely you are to be laid off, what house prices do, and where the currency is heading. Now and then a financial crisis
  crosses every border at once.
- **Crises end, and new ones begin.** A war can end in a ceasefire, a collapsed economy can recover, and an unstable country
  can slide into rationing or runaway prices. Everything that read a country's crisis before (the ban on leaving a country at
  war, the protection route, prices, approval of the government) now reads the world as it is in this life.
  Rarely, armed conflict breaks out in a country that is already deeply unstable. It is reported as conflict within that
  country, never as one named country attacking another: the game does not invent wars between real nations.
- **The news** records all of it, with changes of law. **World news** (Self tab) lists what touches you first: where you
  live, where you were born, countries you are a citizen of, and where your family and property are. Only those reach the
  journal.
- **People you know move.** Brothers, sisters, friends and grown children sometimes move abroad, more often from a country
  in trouble; some come home, and some move to be nearer to you. You can fly out to see them, and family abroad opens the
  family route if you want to follow.

All of it is fiction, kept in the save. The reference data is never rewritten, so each new life starts from the same world.

### Property across borders, and tax by place

`js/engine/realEstate.js`, with `quoteForeign`, `payForeign` and `receiveForeign` in `js/engine/currency.js`.

- **Buying abroad** (Holdings → Browse property → In another country): choose a country and a city, and see that year's
  listings in the local currency. A purchase is outright (no lender there will lend to someone who does not live there), with
  5% in fees. It is paid from your account in that currency first, and the rest from everyday money at today's rate, less the
  bank's fee. The exchange is written in the currency record.
- **Owning it**: a property is valued where it stands and brought home at today's rate, so what it is worth to you moves with
  the currency as well as the market. It can be let, and stayed in when you visit. If you move to that country it becomes a
  home in local money, at the same worth.
- **Selling it** pays in the money of the place, into your account in that currency.
- **One housing market per country.** Each country's prices move with its own economy (and now and then slump), so a home in
  Mexico and one in Canada no longer rise and fall together.
- **Loans and rent keep their currency.** A mortgage is held in the currency it was taken out in, and a tenancy is paid in
  the money of the place: moving abroad no longer converts them. Payments, upkeep and local tax on a property abroad come
  from your account in that currency first, then from everyday money at today's rate; rent abroad is paid into that
  account. Net worth, debts and estates count each loan at today's rate.
- **Tax by place**: property tax and tax on rent are charged by the country the property is in. At death, property abroad is
  taxed by the country it stands in and everything else by the country you lived in; the obituary lists each. An inheritance
  from someone who lived abroad is taxed there.

### How tax and health care work, country by country

`js/engine/systems.js`, shapes in `js/data/systems.js`.

**Income tax** is the country's headline rate run through a schedule: an allowance, then bands. There are four shapes: none
(the United Arab Emirates and others that charge nothing), one flat rate (Russia, Ukraine, Hungary and others), rising bands
(the default, and the United States), and steeply rising bands (much of western Europe, Japan, South Korea, Canada,
Australia). The top band is each country's real top rate, from "List of countries by tax rates" (`TAX_TOP`; for the
United States the federal 37%). The low paid keep more than before and high earners less. Holdings shows the rate on what you earn now and on
anything more you earn.

**Health care** has six models:

| Model | Where (examples) | What you pay |
|---|---|---|
| Public | United Kingdom, Canada, Australia, Brazil | almost nothing |
| Compulsory insurance | Germany, France, Japan, South Korea | a yearly contribution if you earn, and a fifth of each bill |
| Private insurance | United States | a fifth with cover, which a full-time job brings or you buy; the whole bill without |
| Through your employer | United Arab Emirates | a tenth with a full-time job; the whole bill without |
| Public clinics, private care | Mexico, India | two fifths |
| Out of pocket | where the game had no public care | the whole bill |

Private cover is bought and canceled at the doctor's, lapses if it cannot be paid for, and does not travel to another country.

These are shapes for play. The thresholds are multiples of a typical wage in the game, not real brackets, and which country
gets which shape or model is unverified.

### Families and couples that cross borders

- One new family in ten has a parent who came from another country: they have that country's name and nationality (and the
  local one too, where both allow it), their own parents still live there, and the child is born with whatever both parents
  and the place give. The country is drawn evenly from the whole world.
- Now and then a child's family emigrates, far more often from a country in crisis. The parents and young brothers and
  sisters come; grandparents and friends stay, and can be visited.
- Some of the people an adult meets grew up abroad. Marrying one opens the family route to their country, shortens the wait
  for its citizenship, and grants nothing by itself.
- Politics goes on in countries you have left and still have ties to, so a country you return to has moved on.
- Portuguese is a language of its own in the game now (Portugal, Brazil, Angola), and someone born where the same language is
  spoken arrives already speaking it.

### The brief's ten scenarios

`node tests/world-scenarios.mjs` plays the Living World brief's scenarios A to J through the engine: born in Orlando; a
Brazilian childhood moved to Portugal; India to Canada as a student; a marriage between Japan and the United Kingdom; a royal
child; a mayor's budget; dollars, pesos and a house in Mexico; three generations across three countries; a recession; and
twenty-five years away. A scenario whose character dies early of something unrelated is played again.

The Living World engine is complete as a first version. `docs/WORLD_DATA.md` lists what is simplified, unverified or not
modeled, which is where further work would go.

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
| School stages, programs after high school (university, cosmetology, graduate, medical, law), tuition, entry GPAs, housing costs | `js/data/schools.js` |
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
| Vehicles (bikes and boards for children, motorbikes, cars, boats, aircraft), the age each can be bought at, licenses, servicing | `js/data/vehicles.js` |
| Funds, shares and coins (all fictional); bank loans; overdraft and bankruptcy | `js/data/securities.js` |
| Gambling stakes, lottery prizes, the bookmaker's cut | top of `js/engine/gambling.js` |
| Money events (leaks, tenants, breakdowns, tips) | `js/data/events/money.js` |
| Crimes and the age each opens at, strangers, ways of killing, lawyers, prison gangs, sentence rules | `js/data/crimes.js` |
| Property tax by country | `PROPERTY_TAX` in `js/data/countries.js` |
| Monarchies: which countries have a crown, the titles used there, allowances, public duties, how rare a royal birth is | `js/data/royalty.js` |
| How each country is governed, what its offices are called, campaign platforms, budgets and moves, what office-holders can do | `js/data/politics.js` |
| Political scenes (class president, polling day, scandals, removal votes, uprisings) | `js/data/events/politics.js` |
| Royal and noble scenes (palace invitation, honors, scandal, protocol) | `js/data/events/royal.js` |
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
| Skills that can be practiced, sessions a year, lesson price | `js/data/skills.js` (rules in `js/engine/skills.js`) |
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
| Multi-year storylines: musical theater, mentors, school paper | `js/data/events/stories/*.js` (each file's header explains its flags and contacts) |

Storyline scenes are ordinary events with a few extra fields: `priority`,
`exclusive`, `queuedOnly`, cast by contact tag (`'tag:director'`), outcome
variants chosen from history with `when([...], outcome)`, memories stored on
people with `mem()`, and follow-up scenes with `queue()`.

## Royalty

Seventeen countries have a reigning royal family in the game: the United
Kingdom, Spain, Sweden, Norway, Denmark, the Netherlands, Belgium, Monaco,
Japan, Thailand, Malaysia, Morocco, Jordan, Saudi Arabia, Kuwait, Qatar and
the United Arab Emirates. Monaco's sovereign is a prince, not a king.
Malaysia has nine royal houses: the one in the game rules a state by
inheritance, and its sultan takes a five-year turn as king every 45 years. Titles follow each country
(Infanta in Spain, Emperor in Japan, Sheikh in the Emirates; dukes, earls and
barons where a nobility survives). Every house and person is invented.

- **Born to it:** rarely by chance, or chosen under "Born into" when designing a
  life in a monarchy. A royal child has a place in the line of succession and
  can inherit the throne. A noble's child inherits the title from their parents.
- **Married into it:** the famous, wealthy and successful are sometimes invited
  to the palace, where an unmarried royal may take an interest. Marrying one
  needs the palace's consent, which depends on your good name, criminal record
  and past marriages. It can be refused, and asked for again the next year.
- **Public image:** a royal's standing with the public, shown on the Self tab.
  Public duties (three a year) raise it; idleness, scandal and convictions sink
  it. If it falls far enough the palace removes the title, and a monarch is
  made to abdicate.
- **Honors:** in the United Kingdom and Spain the crown honors commoners who
  give a great deal or become widely known.

### The royal house and the dynasty journal

Each monarchy has a royal house: a family tree of real people going back
about 150 years, kept in the save (`state.dynasties`). Everyone in it has a
face inherited from their parents through the ordinary avatar genetics, a
birth and death, a marriage, and a story. The player's own parents, siblings,
spouse and children are the same people as in the People tab, linked in.

- **The line of succession is worked out from the tree** under each country's
  law (`law` in `js/data/royalty.js`): eldest child, sons first, or men only
  through fathers. Marrying in gives a title and never a place in the line;
  adopted children follow the law; someone who abdicates stays out.
- **The house lives a year at a time.** Relatives marry, have children, cause
  scandals, give up their place, divorce and die, and the line moves. When the
  monarch dies the first in line takes the throne, whoever that is.
- **The dynasty journal** (Self tab, "The dynasty", or "The royal family and
  its history" for a commoner): every monarch back to the founder, the living
  family, the line of succession with the reason for each place, and the
  house's history. Tap anyone, living or long dead, for their portrait, their
  reign and what of them reaches you, such as "You have her eyes".
- **It carries on.** Continue as a child and the house, its history and your
  former self all remain; the heir takes whatever place is really theirs.

- **Rivalries.** An ambitious relative close to you in the line may come to
  resent you. The story runs over several years (overlooked, finding allies,
  going public) and your choices decide whether it ends in peace, a long
  silence, or a public crisis. Not every life has one.
- **A royal childhood and a royal wedding.** Nannies, etiquette, the first
  public engagement, boarding school, being the spare. Marrying in, you choose
  the scale of the wedding, the cameras and the honeymoon, and the public
  reacts to each.

- **Three reputations.** Public approval, the family's regard and the tone of
  the press are separate and move for different reasons; the Reputation screen
  (Self tab) lists what changed and why. The family notices who does their
  duties, and halves the allowance of someone it has closed ranks against.
- **The press.** Stories are either true or rumor. A rumor can be denied or
  ignored; denying the truth can come back. Stories fade over the years, and
  cost approval while they are loud.
- **Love and children.** Someone born royal can fall for a commoner in secret,
  be found out, and choose between them and the family. Marrying out brings
  the spouse into the family tree (and, where the house's law says so, takes a
  princess out of it). Grown children refuse their training, want another
  life, marry for love, or give up their place.

- **Reigning.** What a monarch can do depends on the kind of monarchy (`type`
  in `js/data/royalty.js`). Where the crown only advises, it can address the
  nation, give honors, open the palace accounts, press the government in
  private, or refuse to sign a law. Where it governs, it can build, dismiss
  officials, favor relatives, silence critics, or hand power to an elected
  parliament for good.
- **A monarchy can fall.** Each country has a level of support for having a
  crown at all. If it stays very low there is a referendum, which a royal
  player can campaign in. If it is lost the monarchy is abolished: titles and
  residences go, the family become private citizens, and the player can stay
  or go into exile. The house and its history remain, and a republic that goes
  badly sometimes asks its royal house back.

- **Residences.** The palaces belong to the country and can never be sold.
  The family's own castle and estates belong to the head of the house, who
  pays for their upkeep and can open them to visitors, restore them or sell
  them. Some houses are land-rich and some are threadbare. Private property
  stays with the family if the monarchy falls.
- **Household staff.** A private secretary, a press secretary and (for the
  head of the family) an estate steward. They are people under People, hired
  from three candidates whose ability shows and whose loyalty does not. A good
  one makes risky acts safer, takes the heat out of stories, or cuts the cost
  of the estates; a disloyal one leaks.
- **Duties of four kinds:** public service, ceremonial, diplomatic and family,
  thirteen in all, each moving a different mix of the reputations.

- **Noble titles.** A title such as "Duke of Ghent" is a record of its own
  (`state.titles`), with a holder and a history. Each country with a nobility
  has a few old families. Someone born noble is heir to a named title, which
  comes to them when its holder dies. A reigning monarch can create one title
  a year, for a relative or for someone in their life, hereditary or for life,
  and can revoke any. Hereditary titles pass to the eldest child, and die out
  when there is none.

The rules are in `js/engine/royalty.js` (the player's side), `js/engine/peerage.js`
(noble titles), `js/engine/household.js`
(residences and staff), `js/engine/reign.js`
(powers, abolition, exile and restoration), `js/engine/court.js`
(rivalries and the wedding), `js/engine/reputation.js` (the three reputations
and the press),
`js/engine/dynasty.js` (the house) and `js/engine/succession.js` (the law);
the screens are in `js/ui/royalty.js` and `js/ui/dynasty.js`.
Scenes can test `monarchy`, `isRoyal`, `isNoble`, `titled`, `reigning`,
`royalBy` and `royal.image`, and use the `image()`, `meetRoyal()` and
`honour()` effects.

## Politics

From 18 you can run for office from the Work tab. The ladder is city
councillor, mayor, a seat in the national legislature, head of a region, and
head of government, each with the title the country uses (Governor and
President in the United States, First Minister and Prime Minister in the
United Kingdom, Chancellor in Germany, Taoiseach in Ireland). Countries
without regions skip that rung.

- **Systems:** presidential, parliamentary, one-party (China, Vietnam, Cuba:
  a committee chooses, not the voters) and none (the Emirates). In Russia,
  Venezuela and Egypt the count leans toward those already in power.
- **Campaigns:** one a year. Pick what you stand for, how much of your own
  money to spend, and two moves. Charm, intellect, fame, a clean record and
  experience all count: student council, the debate team, a law or politics
  degree, helping on a campaign, and above all the rung below.
- **In office:** a salary, a term, and an approval meter. Two actions a year;
  doing nothing costs approval. At the end of a term you stand again or step
  down. Presidents are held to their country's term limit. Low approval brings
  a recall, an impeachment or a vote of no confidence.
- **At the top:** national holidays, a statue of yourself, a pardon for
  yourself, or seizing emergency powers and ruling without elections, which
  can end in an uprising.

### School

School is shaped by the country (`js/data/education.js`): what each stage is
called and when it starts (primary school at 5 and sixth form at 16 in one
place; école primaire at 6 and lycée at 15 in another), how work is marked
(letters, out of 20, out of 10, percentages, 1 to 6, or a grade point
average), and what a school-leaver walks away with. Inside the game there
are always three stages and marks from 0 to 4; the player sees the country's.

- **Schools are places.** A town has named schools of different kinds
  (state, faith, selective, private, boarding, performing arts, sports
  academy, or lessons at home) and they persist in the save: the next child,
  and the next generation, can sit in the same classrooms. The family
  chooses, by what it can afford, what the child is good at, and what it has
  always done; from 11 the child can ask to change, once per stage.
- **Subjects have their own marks** (`js/engine/grades.js`, checked by
  `tests/schooling.mjs`). A year's mark comes from ability, work, interest,
  attendance and teaching together, with work counting for as much as
  ability. Each child has a bent for some subjects; interest grows with
  success, good teachers and clubs. One subject a year can be given extra
  attention, and a tutor works on the weakest.
- **The class stays.** Classmates move up the school together instead of
  being replaced each year, grow closer or do not by how well they suit the
  player, and the closest becomes a best friend. Those the player was close
  to stay friends after school; the rest are remembered and can turn up
  again decades later. Two teachers at each stage are people with a subject
  and a way of teaching.
- **The school book** (Work tab) shows the school, every subject, the class
  and teachers, and every school attended. Rules: `js/engine/schooling.js`.

- **School life** (`js/engine/schoollife.js`, scenes in
  `js/data/events/schoolLife.js`). Classmates have interests and clubs of
  their own, and news of their own each year. The player's friendship group
  is whoever they are actually close to, usually found through a shared club.
  - *Clubs and teams* have a year: a season for the school team (in a sport
    the country plays), a competition for the debaters and the band, a
    production for the drama club. Standing in a club grows with skill and
    time, and can end in being chosen to lead it. The best older players are
    noticed by university coaches.
  - *Productions* begin with an audition against a named classmate, and the
    part goes to whoever suits it. Every part played is kept for good.
  - *Courses* are chosen for the last stage of school: three electives
    beside the core, and up to two subjects at an advanced level.
  - *Scenes* come from what is true of this class: a first day, a birthday
    party, a best friend moving away, friends falling out, a rumor, being
    bullied (with adults who act when told), a teacher who sees something,
    a false accusation, the dance, the final exams, the last day.

### Getting into university

- **A catalog per country** (`js/engine/university.js`, patterns in
  `js/data/universities.js`). Nine invented institutions, named for the
  country's own cities and kept in the save: an old and very selective one,
  two large public universities, a technical institute, two regional
  universities, a small college, a conservatoire that teaches only the arts,
  and an open university that takes anyone. They differ in how hard they
  are to get into, what they cost, where they are, what they are good at,
  and how generous they are. None is real.
- **A round of applications.** From 16, or any time after leaving school:
  choose a subject, add up to five places, write a personal statement, and
  send. Still at school, offers are conditional on final marks and settled
  on results day; with results in hand, answers are final. Waiting lists
  move, one decision a round can be appealed, and one place can be held for
  a year.
- **How it is decided** (`js/engine/admissions.js`, checked by
  `tests/admissions.mjs`). The record, not the mind: marks against what the
  place usually takes, advanced courses in the subject, teachers'
  recommendations, life outside lessons, the statement, and, where it
  applies, what the applicant had to work with, a family history there, or a
  coach's request. Performance courses are decided by audition. The most
  selective turn away good applicants for want of room. Every answer comes
  with its reasons.
- **Help with the cost.** A scholarship for merit, athletics or performance
  (the largest only), plus a grant for need, each as a share of tuition
  waived. What is left is paid by parents, savings or a loan. A merit
  scholarship is lost if marks fall; help for need is not.

### University life

Once enrolled (`js/engine/campus.js`, scenes in `js/data/events/campusLife.js`):

- **The course is credits.** A degree is 120 credits. A light, standard or
  heavy load earns 24, 30 or 40 a year and moves marks up or down, so a
  degree takes five, four or three years. A minor can be taken alongside,
  goes on the degree, and counts where an employer asks for that subject.
  Changing course keeps every credit within a family of subjects and loses
  a year's worth between families. Marks under 1.8 mean academic probation
  before anything worse.
- **People.** One professor knows the player; going to office hours each
  year turns that into a recommendation. A roommate, in halls as well as in
  a flat, is a person with a way of living: they become a close friend, or
  the argument has to be had. Friends made here stay.
- **Organizations.** Up to two of ten: students' union, a subject society,
  sport, drama (cast by audition), the newspaper, debating, a party branch,
  volunteering, music, and fraternities or sororities where those exist.
  Standing grows, and can end in an election.
- **Internships.** After the first year, three postings each summer in the
  fields the subject leads to, one of them the one everybody wants. Getting
  one depends on marks, a professor's backing, leadership and where one is
  studying. A summer that goes well ends with a job held open, and any
  internship is a foot in the door for that career.
- **A year abroad** in one of four countries the university sends students
  to: the language, a friend for life, and a better chance of a visa there.
- **Graduation** records the minor and any organization led, and notes it
  when nobody in the family has done it before.

University and training are in `js/engine/education.js`.

### After the first degree, and later in life

`js/engine/adulted.js`, with the programs as data in `js/data/schools.js`:

- **Professional schools**: medicine, law, business, dentistry, pharmacy,
  veterinary medicine, teacher training and nursing (which needs no degree).
- **Licensing exams.** A professional degree lets you sit the exam; passing
  it lets you practice. Once a year, with a choice of how to prepare.
  Teaching is the exception: schools hire graduates without the
  certificate, and prefer those with it. People who qualified in older
  saves are treated as already licensed.
- **A doctorate**: a topic, a supervisor with a style of their own, a
  stipend, papers published along the way, and a defense. Four to eight
  years; it opens university teaching.
- **Part-time study** keeps the job and takes longer. An employer can be
  asked to pay, once a year, and says yes to people it wants to keep.
- **Ways back in**: an adult school certificate for people who left without
  one, technical college as a paid-for alternative to an apprenticeship,
  and one-year certificates that open some degree-only careers by a
  narrower door.
- **Credits are kept.** Leaving a degree banks what was earned; coming back
  counts it, less a year's worth if the subject is a long way from the old one.

### Education through a whole life

- **Your children's schooling** (`js/engine/kidschool.js`, scenes in
  `js/data/events/parenting.js`). Children go to the same schools and
  universities as everyone else in the world. At each stage you choose
  where they go: the local school, private, boarding, somewhere that fits
  their gifts, or what they want. From the People tab: help with homework
  (patient, strict, or hands-off — strictness helps some children and
  backfires with others), pay for a tutor, turn up to their concert or
  match, change their school, talk about university. Scenes for a bad
  report, a prize, and a grown child going back to study.
- **The family's record** (`js/engine/edlegacy.js`, Work tab → *Family
  schooling*). Each generation's schools, degrees, prizes and the teacher
  who mattered pass to the heir. An heir carries on at the school they
  were at, and arriving at a university a parent attended is noted.
  Family history is noticed in admissions; it guarantees nothing.
- **A royal education** (`js/engine/royaled.js`). At ten: palace tutors,
  the family's boarding school, or a day school. One royal lesson a year
  from the royal card: protocol, the constitution, diplomacy, a language,
  cadet training. At seventeen, the family's expectations — and the choice
  to follow them, serve first, or go your own way. A title earns nothing
  at admissions.
- **Politics.** State schools' teaching follows what national and local
  government spend on them, a little each year. A rival on the ballot may
  be someone from your school year, often from the school council. Politics
  students can intern in a politician's office; one who remembers you well
  may endorse you later, as may a school-council friend.

- **Families shape the choice, not the genes.** Whether a child goes to
  university depends on their marks, and on what the family brings: a
  parent who went, money at home, the school they attended. Grandchildren
  go to school too, so an heir of any generation arrives with a record.

### Schools and degrees in each country's own terms

Schools and universities are named in the country's language
(`js/data/localNames.js`): a *Lycée* in France, a *Gesamtschule* in
Germany, an *Instituto* in Spain and Latin America, numbered schools in
East Asia. All the place words are invented. University results are shown
the way each country writes them (`showDegree` in `js/engine/grades.js`):
honors classes in the UK and much of the Commonwealth, marks out of 20 in
France, 1,0–5,0 in Germany, out of 110 in Italy, out of 10 in Spain and the
Netherlands, A–F in Scandinavia, a GPA in the United States and East Asia.
Underneath, every mark is still on one 0–4 scale.

### What if?

At a turning point (an offer, a proposal, a betrayal, a term ending, a crown)
the scene offers **What if?**: the moment is kept as a second saved life with
the choice still to make, so both roads can be lived. Settings (on the Self
tab) has the same button for decisions made outside scenes. A life can have
four timelines; each gets its own run of luck from the moment it parts. The
title screen tags them and compares them side by side. Which scenes count is
a list in `js/engine/turning.js`; the copying is `forkGame` in `js/save.js`.

### Languages

A language is a skill, and now it matters (`js/engine/languages.js`, with
where each is spoken in `js/data/skills.js`): speaking a country's language
makes a visa likelier and work there easier, not speaking it makes both
harder, and living there teaches it slowly. Languages spoken well count with
employers anywhere, and a head of government who speaks a partner's language
does better on a visit or in talks.

### The political world

Each country has a political life of its own (`state.polities`), which goes on
whether or not the player takes any part.

- **Parties and politicians.** Three to five invented parties, each with
  positions on six issues (`js/data/parties.js`), and politicians who persist:
  they have faces, ages and careers, lead their parties, win and lose, retire
  and die. Nothing here describes a real party.
- **Elections on a calendar.** General elections fall every four to six years
  by country. Voters are five groups with their own priorities and turnout.
  Votes become seats by proportional lists or by districts, depending on the
  country; presidents are elected separately, with a run-off where the country
  holds one. A parliament with no majority produces a coalition or a minority
  government, and coalitions can collapse into an early election.
- **Governments change the law.** Income tax, university funding, health
  funding and housing each move a step at a time, toward what the governing
  parties stand for, within a budget: a government deep in deficit has to
  raise tax or cut something. The changes reach everyone's tax bill, tuition,
  medical costs and rent (`js/engine/policy.js`), and the journal reports them.
- **The player's part.** Join or leave a party from the Politics screen (Work
  tab, "The political world"). A party's backing helps in a campaign; an
  independent has no machine for the bigger races. Offices are contested on
  the calendar, in the year before polling, against a named opponent who
  remembers the result. A head of government can bring in laws, which pass if
  they have the seats.
- **A campaign.** Standing for office is a race in stages (`js/engine/campaign.js`),
  kept in the save so it can be put down and picked up:
  - *The nomination.* A party member seeking anything above the council must
    first beat a named colleague for the party's backing, by winning over the
    members, the leadership, or by outspending them. A loser can stand aside,
    or leave the party and run as an independent.
  - *The pledge.* Each one takes a position on an issue, so it pleases the
    voter groups who want that and puts off those who do not.
  - *The trail.* Four stretches, one thing in each: doors, rallies, courting
    one group of voters, advertising, raising money, a private poll, attack
    adverts, and worse. A published poll follows each, and polls are out by a
    few points, the same way all campaign long.
  - *The debate.* Three questions. A straight answer, a crowd-pleasing promise
    (which comes due in office), an attack, or a dodge.
  - *Polling day.* The result is worked out once and stored; election night
    shows it arriving area by area, after an exit poll that may be wrong.
  A campaign left unfinished when the year ends plays itself out. One-party
  states have no voters to win: the committee decides.
- **Standing again.** At the end of a term the office-holder fights the same
  kind of campaign to keep the job, running on their record.
- **Governing** (`js/engine/government.js`), for a head of government:
  - *The cabinet.* Five departments, each run by a minister who is a
    politician like any other, with a skill of their own. Able ministers lift
    the government and help its bills; an empty post drags it down. Ministers
    are caught in scandals (stand by them or dismiss them), resign on
    principle, or walk out when the leader is weak. Every government in the
    world has a cabinet, not only the player's.
  - *Bills.* A bill goes to committee, where another party may name its
    price, and then to a vote that is counted party by party
    (`js/engine/legislature.js`, checked by `tests/legislature.mjs`). The
    leader can whip, buy votes, appeal to the country, or stake the
    government on it. Where the crown still governs, it may refuse assent.
  - *The budget.* Once a year: tax and every department on one page, one vote
    on the whole. Deficits pile up as debt. A parliamentary leader without a
    majority who loses a budget falls, and must face the voters.
  - *The other side.* A leader without a majority sees the legislature pass
    laws of its own. A president can sign or veto, and a veto can be overridden
    by two thirds.
  Policing joins tax, tuition, health and housing as something governments
  change: it moves the chance that a crime is solved.
- **Leading a party** (`js/engine/leadership.js`). In a parliamentary country
  nobody is elected head of government: they lead the party that can command
  the legislature. A sitting member can challenge their party's leader, and
  the party's members of the legislature vote. A leader whose party governs
  becomes head of government at once; otherwise they take the party into the
  next general election, with a campaign of their own that is worth points to
  the whole party, and a night on which the seats come in. They govern if, and
  only if, their party leads the government; a leader who loses has the party
  to face. Presidential countries keep the race between two candidates.
- **Scandal** (`js/engine/scandal.js`). What an office-holder does in the dark
  (contracts for friends, bought votes, favors for donors) is kept as a
  secret with a weight of evidence that fades over the years. A reporter may
  pick one up: a rumor can be confessed, denied or suppressed; a story can
  be apologized for, pinned on an aide, or sent to an inquiry; and an inquiry
  clears or condemns.
- **The news** (`js/engine/news.js`). Each country has invented newspapers
  that lean one way or the other, a tabloid and a broadcaster. What happens
  in politics is reported in the Politics book's News tab, and the same event
  reads differently in a paper that likes the player and one that does not.
- **The next generation** inherits the country's politics as they were: the
  parent becomes a name in its history.
- **Political families** (`js/engine/kin.js`). A spouse or grown child may go
  into politics, in the family's party or, now and then, the other one. They
  fight their own elections, and the player can campaign beside them, pay
  for the leaflets, or stay out; they get into trouble, and the player
  stands by them or does not. A relative in the legislature can be given a
  ministry, which the family likes and the newspapers notice. What a
  generation did in office becomes the family name: it helps the next one,
  unless it ended in disgrace. An heir who was already in office carries on
  in it.
- **Causes** (`js/engine/activism.js`). Twelve invented campaigns, one for
  each side of each issue. A member collects signatures, marches, organizes
  and, in time, speaks for it. A cause that grows loud enough can force the
  government to change a law. Where protest is not tolerated, marching gets
  people arrested, and governments give way far less.
- **Political staff** is a career of its own, from campaign organizer to
  chief of staff, and counts as experience with voters.
- **Abroad** (`js/engine/diplomacy.js`). Each country deals most with six
  others, and stands somewhere between hostile and close friends with each.
  Governments have good and bad years abroad, sign trade agreements (money
  for the treasury) and defense pacts (an ally in a crisis), and tear them up
  when relations sour. A head of government makes state visits, proposes
  agreements, sends aid and imposes sanctions, with a foreign minister whose
  skill tells; and faces crises, to be settled by talks, sanctions, a show of
  force or giving way.
- **The crown and the government.** Where a monarch reigns without ruling,
  the head of government is received every week: they can ask advice, keep
  to formalities, or leak what was said and lose the palace for good. A
  player who is the monarch is sent the government's real laws to sign, by
  the real head of government, and a refusal that carries the country undoes
  the law. A republican cause and a loyalist one can be joined where there
  is a crown; a republican movement that grows loud enough wins a referendum.
- **Cities and regions** (`js/engine/local.js`). A mayor or the head of a
  region presents a budget of their own each year: local taxes, clinics and
  schools, policing and housing, voted on by a council in which their own
  side holds the largest block. What is decided stays with the place, and
  moves the tax, medical bills, rents and policing of whoever lives there.
- **A citizen's vote.** An adult citizen can say how they will vote (the
  Parties page); the vote is recorded at each general election. Newcomers
  wait five years, and nobody votes where no votes are counted.
- **Loose ends tied.** A party leadership that has just changed hands can be
  contested by a sitting member. Allegations are not always true: a false
  one can still make the papers, and an inquiry clears it. Scandal follows
  a public figure out of office. A relative in the legislature may, rarely,
  come to lead their party and the country.
- **Where there are no elections,** ministers are appointed and rule by
  decree. In a monarchy the monarch remains head of state whatever the voters do.

The rules are in `js/engine/politics.js` (the player's career), `js/engine/polity.js`
(the political world) and `js/engine/elections.js` (the arithmetic, checked by
`tests/elections.mjs`); the screens are in `js/ui/politics.js`, `js/ui/campaign.js` and `js/ui/polity.js`. Scenes can test `inOffice`, `officeTier`, `democracy`,
`partyState` and `politics.approval`, and use the `approval()`, `reelect()`,
`ousted()` and `resignOffice()` effects.

## Work

The Work button on the Work & School tab opens the occupation hub: current jobs (with pay, hours, performance,
satisfaction and stress), the people at work, a job board of real openings at persistent employers, offers and
recruiters, part-time work, a freelance practice, special careers (auditions, portfolios, selection boards), the
military of the country you live in, qualifications, your working history with milestones, retirement, and
businesses of your own (staff, prices, the accounts and their tax, partners, selling, handing on), and a household
plan agreed with a spouse: whose career comes first, and who looks after the children.

There are 193 career tracks and 714 job titles in 19 families. A track is one entry in `js/data/occupations.js`.
How it all fits together (employers, hiring, payroll, the time budget, workplaces, records across generations)
is in [docs/CAREERS.md](docs/CAREERS.md), with an audit of which occupations from the brief live where.

## People you know

Settings (on the title screen and at the bottom of the Self tab) holds a list
of names and genders you add yourself. In each life they can turn up as
friends, classmates, colleagues, dates and strangers, never as born family,
and each at most once at a time. The list is stored in this browser
(`js/people.js`), separately from the saved lives, and travels with them in a
transfer code or cloud saves.

## Moving saves between devices

Saves live in the browser, so each device has its own. Two ways to share them,
both under **Settings**:

- **Transfer saves:** copy a code or save a file on one device, then load it on
  the other. No account needed. Loading can keep what is already there and add
  the new lives, or replace everything.
- **Cloud saves:** sign in with an email and password, and the same lives,
  graves and People you know are kept on every device that signs in. This needs
  a free Supabase project. The steps are in
  [docs/cloud-saves.md](docs/cloud-saves.md), and the two values it gives you go
  in `js/sync/config.js`. Until then the game works exactly as before.

When two copies are combined, the most recently played copy of each life wins,
graves and people are joined, and deletions are carried over. The code is in
`js/sync/`: `bundle.js` packs, combines and unpacks saves; `cloud.js` handles
accounts and syncing; `config.js` holds the project address and public key.

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
avatar system with a live editor, wills with named heirs, skills to practice,
orientation and gender identity, living conditions by country, royalty with a living royal house and a dynasty journal,
politics, a list of people you know who are written into your lives,
moving saves between devices with a transfer code or cloud saves, and a working life with persistent
employers, coworkers, side jobs, freelancing and recruiters.

The layout has been checked in a desktop browser emulating iPad and phone
screens (portrait and landscape). It has not been run on a physical iPad.
