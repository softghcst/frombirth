# K-pop Idol Life

From an audition anywhere in the world to a debut, a group's whole career, and the family record after.
Engine: `js/engine/kpop.js`. Data: `js/data/kpop.js`. Screen: `js/ui/kpop.js` (**My Idol Life**, from the Work tab's
*K-pop Idol* button, or My Fame → Music → *Idol opportunities*). Tests: `node tests/kpop.mjs`.

Everything named in the game is fictional: agencies, labels, shows, programs, groups, songs and fandoms. The structure
follows the real industry in broad outline only (agencies with trainee programs; online and in-person auditions; years
of training with no promise of debut; survival programs; weekly music shows that each score releases their own way;
exclusive contracts). No term in the game is a statement about any real company. References used for the outline:
Korea.net's K-InfoHub on the trainee system, JYP's and HYBE × Geffen's public audition pages, HYBE's business page on its
multi-label structure, Netflix's *Pop Star Academy* coverage, and the Library of Congress K-pop timeline.

## How a career goes

1. **Auditions** (`auditions`, `apply`, `attendCallback`). Each agency puts out its own call every year: online, in person
   or a global casting, with its own ages, line-up (girl, boy or any), places (worldwide or in its own country),
   categories, a few places and what it needs. Stages: application → callback → live assessment → the company's decision
   (rejected, kept on file, or offered a place). Passing is never automatic: in the tests, strong applicants are offered a
   place about two times in three. Three applications a year; one per audition. A file kept "on hold" sometimes leads to
   an offer the next year.
2. **The trainee agreement** (`acceptOffer`). Its own kind of contract: a review after one to three years, training costs
   covered by the company (no debt), an allowance at some agencies, a dorm or home, rules, and leaving by notice with
   nothing charged back. Under-18s need their family's agreement (`askGuardian`). Training abroad comes with a
   sponsored trainee visa, refused with a criminal record. The trainee lives in the agency's city; their legal country of
   residence is unchanged.
3. **Training** (`setFocus`, `trainAction`). A yearly focus (vocals, dance, rap, stage and camera, Korean, media training,
   or a bit of everything) builds the game's own skills: singing and dance talents, the rapping, public speaking and
   Korean skills (Pursuits). Stage presence and camera are trained here. Extra sessions, a word with the coach, time
   with fellow trainees, who are real, persistent people with their own skills and ranks.
4. **Evaluations**. One consolidated report a year: scores, a rank among the agency's trainees, two lines of feedback,
   named evaluators, and an outcome (from *considered for debut* to *at risk*). Two difficult evaluations in a row before
   a review, and the agreement is not renewed; never at random.
5. **Debut projects**. Every few years an agency picks a line-up from its actual trainees (the best voice, the best
   dancer, then readiness). If the player is in it, they choose (`acceptDebut`/`declineDebut`); an unanswered place
   lapses after a year. Plenty of trainees never debut.
6. **Survival programs** (optional; from 2009). Fictional formats (*Project Stardust: Global Debut Academy*, *Rising
   Nine*, *Blueprint: The Final Cut*), each with its rules fixed before the first episode: contestant count, debut
   places, judges' weight against fans'. Five missions (dance, vocal, group, concept, final), the player choosing an
   approach for each; cuts after set missions; the final line-up debuts. Results are stored, never rerolled; the
   eliminated stay in the world.
7. **The group**. Made of the actual chosen trainees, with an exclusive artist agreement for each (the agency's term,
   share and solo rule). Positions, concept, fandom, releases, stages, wins, tours, awards, history.
8. **Debut and comebacks** (`debut`, `comeback`). Releases with songs and line distribution; reception from fans,
   quality and the agency's promotion. Not every release is a hit.
9. **Music shows**. Four fictional weekly shows, each weighing digital sales, album sales, broadcast, social and votes
   differently. A win is earned against the actual competing releases of that week; a first win usually takes years.
10. **Ending fairies**. At each stage a member gets the last close-up, from the camera director's rotation: never
    automatically the center or the main vocalist. When it is the player, they choose a style (cute, confident,
    elegant, funny, natural); the result depends on camera presence, stage, the style's fit with the concept,
    experience and chance. A good one is a fan moment: a little individual recognition, nothing more. All archived.
11. **Fandom and public life**. Size, core, engagement, regions, a name (chosen if the agency lets the members
    choose); the player's own following. Interviews, variety, radio, fan meetings, fansigns, fan calls (from 2020),
    livestreams (from 2015): media training matters, and the leader is a natural spokesperson but not the only one.
12. **Welfare and hiatus**. Agencies differ in how hard they push (`welfare`). Asking for rest is never held against
    anyone; a hiatus (rest, health, personal) keeps the member in the group, with the reason given only broadly. Korean
    men serve in the military in their late twenties: a two-year hiatus, not an ending.
13. **Money**. Each year a group's revenue is settled against its costs; costs not yet recouped carry over; the
    members' share is split between them. The player's share and any trainee allowance are payroll lines, paid once.
14. **Solo work, renewal, disbandment, reunion**. Solo releases if the contract allows and there is demand: the member
    stays in the group. At the end of the contract, each member decides; the group goes on with whoever stays, or
    disbands, and is kept whole on the record. Years later, a reunion with whoever is willing.
15. **Generations**. The industry carries into the heir's life; the ancestor stays in the line-ups, credits and
    archives; the family record lists their groups.

## Positions

`assignPositions` gives each member **one primary position and at most one secondary**, never contradictory
(`validLabels`): one rank per specialty (no Main + Lead Vocalist), Visual and Center not together, two labels at most.
The **maknae** is derived from birth dates (the youngest current member; ties broken consistently) and counts toward
the limit; it is worked out again when the line-up changes. The **leader** is chosen on media training, the members'
trust and reliability, not age, and counts toward the limit; some groups have none. Main vocalists, dancers and rappers
need the skill; two mains are allowed when the line-up really has two. **All-Rounder** needs strong vocals *and* dance
*and* rap or stage presence. Some groups have no official positions at all. Skills are never changed to fit a title,
and every change of positions is kept in the group's position history.

## Eras

The modern idol system from 1996; online auditions from 2005; global casting from 2010; survival programs from 2009;
global groups from joint labels from 2020; fan platforms from 2015; fan calls from 2020. Agencies open in their own
founding years.

## And the rest of an idol life

- **Subunits** (`formSubunit`): two or three members, two years after debut, if the agency agrees; a group of its own
  with its own release and contracts, while everyone stays in the main group. Subunits wind down after a while.
- **Japanese releases** (`japaneseRelease`): for groups with fans in Japan; physical singles sell well there; Japanese
  lessons help; the Japanese fanbase grows.
- **Acting and hosting** (`actingOffer`, `hostShow`): dramas cast popular idols without an audition: the offer arrives as
  an ordinary acting contract in My Fame (`castDirect` in the entertainment engine). A year as a music show's MC needs
  media training, builds it, and is paid once.
- **Lightstick, fan club, merchandise** (`designLightstick`, `launchFanclub`): a lightstick designed once (with the
  members, if the agency asks them); an official fan club renewed each year by the devoted core; merchandise each year
  goes into the group's accounts before the members' share.
- **Dating** (`datingRule`, `answerRumor`): each agency's contract says nothing, discourages public relationships, or asks
  for none in the first three years. Rumors come up, sometimes true, sometimes not (kept apart); a false one can be
  denied, a true one confirmed or left unanswered, never lied about. Fans react; the company may grumble; nothing is
  ended over a relationship.
- **Health records**: a hard year at a demanding agency can bring exhaustion or a dance injury (health conditions of
  their own, never from the yearly roll). A health break records the conditions it is for, treats them, and clears them
  on return; the public hears only "health reasons".
- **Moving to Korea** (`relocate`): an adult trainee or idol can move properly, through the emigration system, onto a
  four-year work visa sponsored by the agency.
- **The story** (`arcs`): the first audition, trainee life, evaluations, the survival academy, debut, the first stage,
  the ending fairy, the first win, pressure, hiatus, solo debut, renewal, reunion: each read from what actually happened,
  not begun, under way or lived.

- **Fan products** (`launchProduct`, `whyNotProduct`): a photobook (from 1998), a concert film once there has been a
  tour (2000), season's greetings (2008), a café collaboration (2012), a pop-up store in a city the player chooses among
  the places with the most fans (2016), and a character line the members design themselves (2018, once; it keeps
  selling every year after). Each needs enough fans and is made at most once a year; sales come from the devoted core
  and the wider fandom and go into the group's accounts before the members' share. **Photocards** come with every
  album: each year the most wanted cards follow each member's own following (`myCard`).
- **Variety and hosting, a career of its own** (`varietyOffers`, `takeVariety`, `leaveVariety`): producers call a
  debuted idol (or a former one, or anyone with a standing in variety) with offers on fictional shows: talk, game,
  radio, fixed-cast variety, travel, cooking and web formats, each from its own year. Roles: a guest spot (one
  episode), panelist, regular cast member, radio DJ, and main host (which needs a real standing in variety). At most two
  shows at once. Each year on air has ratings; good years build media skill, the player's following and their standing;
  weak ones can end in cancellation or a new line-up without them. A year-end *Broadcast Entertainment Awards* (rookie,
  excellence, top excellence, grand prize). Fees are paid once a year, in the player's money; the shows go on after the
  group ends. Separate from a year as a music show's MC (`hostShow`).
- **The family route** (`legacyRoutes`, `legacyAudition`): a child or grandchild of an idol or trainee (a parent or
  grandparent in this life's family) can be seen privately by that relative's agency, from twelve to twenty-three:
  no open call, straight to the callback and live assessment, with a small edge. The decision is the same as anyone's
  (in the tests, some are turned away), it counts as one of the year's three applications, and ordinary auditions stay
  open. Taking the place makes the player a little better known from the start, and costs a little standing: some say
  it was handed to them.

- **Photocards** (`cardValues`, `cardRanking`, `cardBoost`, `setCardPolicy`): every album holds one random member's
  card (from 1999). Each year every member's card has a going price among fans, from their own following, an ending
  fairy or a solo release that year, a hiatus, and the size of the fandom; former members' cards trade lower, and a
  disbanded group's hold up. Demand bunches on the favorites: in a group of about 180,000 fans an ordinary card runs
  from about £3 to £20 in Britain (a rare one of the favorite well over £100); a group of millions, up to £35 and £280. Trading pays the idols nothing. It matters through albums (more members, more copies
  bought to find the one you want: up to a fifth more physical sales) and through a price everyone can see: the player
  feels it when theirs is the dearest, and when it is the cheapest two years running. The player can ask the company
  for more rare cards (pre-order, lucky draw, fansign): about a tenth more sales, and fans grumble (engagement falls
  each year); or for fewer. The company decides.
- **Collecting, for any character** (`becomeFan`, `buyAlbums`, `tradeFor`, `buyCard`, `sellCard`): from age eight, from
  Pursuits → K-pop fandom or My Idol Life → Photocards. Follow a group with a favorite member; buy albums (thirty a
  year) for the random card inside, now and then a rare one; trade spares with fellow fans (eight trades a year); buy
  or sell single cards at about the going price (selling nets a little under it, thirty sales a year); complete a set
  (every member's card from one album). Money moves both ways and is booked under
  leisure; spending a large part of what one has in a year shows. The cards keep their albums in the world for as
  long as they are collected; old cards are worth a little more. A character who later debuts finds their own cards on
  the same market.

- **Fellow fans** (`tradersOf`, `planTrade`, `tradeFor`): six fans of each group the player follows, made the first
  time they are needed. Each is a person with a favorite member and a collection that grows every year as they buy
  albums too. A trade is with one of them: someone who has the card to spare (never their favorite's last copy) and
  takes the player's spares they want most, their favorite's first. The screen says who, and for what, before the
  trade. About one fan in seven is dishonest and may keep the cards sent: after that their name is known and nobody
  trades with them again. Three good trades with the same fan make a friend, who gives a slightly better deal.
- **Co-stars** (`castShow`, `castYear`): a regular seat on a variety show comes with three to five castmates
  (comedians, hosts and actors, and now and then an idol from another group), people the player knows from then on.
  Chemistry with each moves year by year with the player's ease on camera and with chance, and lifts or drags their
  year on the show; castmates leave and new ones arrive. Great chemistry can win **Best Couple** at the year-end
  awards, together.

## Not built

- Fans do not trade among themselves, only with the player; co-stars do not have shows of their own.
