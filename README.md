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
node tests/schooling.mjs       # marks, and the shape of school in every country
node tests/legislature.mjs     # votes in the legislature: majorities, rebels, deals, vetoes
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
| Monarchies: which countries have a crown, the titles used there, allowances, public duties, how rare a royal birth is | `js/data/royalty.js` |
| How each country is governed, what its offices are called, campaign platforms, budgets and moves, what office-holders can do | `js/data/politics.js` |
| Political scenes (class president, polling day, scandals, removal votes, uprisings) | `js/data/events/politics.js` |
| Royal and noble scenes (palace invitation, honours, scandal, protocol) | `js/data/events/royal.js` |
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
- **Honours:** in the United Kingdom and Spain the crown honours commoners who
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
- **The press.** Stories are either true or rumour. A rumour can be denied or
  ignored; denying the truth can come back. Stories fade over the years, and
  cost approval while they are loud.
- **Love and children.** Someone born royal can fall for a commoner in secret,
  be found out, and choose between them and the family. Marrying out brings
  the spouse into the family tree (and, where the house's law says so, takes a
  princess out of it). Grown children refuse their training, want another
  life, marry for love, or give up their place.

- **Reigning.** What a monarch can do depends on the kind of monarchy (`type`
  in `js/data/royalty.js`). Where the crown only advises, it can address the
  nation, give honours, open the palace accounts, press the government in
  private, or refuse to sign a law. Where it governs, it can build, dismiss
  officials, favour relatives, silence critics, or hand power to an elected
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
  Venezuela and Egypt the count leans towards those already in power.
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

University and training are in `js/engine/education.js`.

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
  funding and housing each move a step at a time, towards what the governing
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
  (contracts for friends, bought votes, favours for donors) is kept as a
  secret with a weight of evidence that fades over the years. A reporter may
  pick one up: a rumour can be confessed, denied or suppressed; a story can
  be apologised for, pinned on an aide, or sent to an inquiry; and an inquiry
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
  each side of each issue. A member collects signatures, marches, organises
  and, in time, speaks for it. A cause that grows loud enough can force the
  government to change a law. Where protest is not tolerated, marching gets
  people arrested, and governments give way far less.
- **Political staff** is a career of its own, from campaign organiser to
  chief of staff, and counts as experience with voters.
- **Abroad** (`js/engine/diplomacy.js`). Each country deals most with six
  others, and stands somewhere between hostile and close friends with each.
  Governments have good and bad years abroad, sign trade agreements (money
  for the treasury) and defence pacts (an ally in a crisis), and tear them up
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
avatar system with a live editor, wills with named heirs, skills to practise,
orientation and gender identity, living conditions by country, royalty with a living royal house and a dynasty journal,
politics, a list of people you know who are written into your lives, and
moving saves between devices with a transfer code or cloud saves.

The layout has been checked in a desktop browser emulating iPad and phone
screens (portrait and landscape). It has not been run on a physical iPad.
