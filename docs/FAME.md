# Fame, celebrity and entertainment

Fame in Pathways comes from work that exists in the world: a part in a real
production, a record that came out, a tour that played. Nothing is a bare number
the game sets; every gain has a cause, and the archive can show you where it came from.

## Engines

| File | What it owns |
| --- | --- |
| `js/engine/fame.js` | The **fame profile** on every life: recognition by audience (film, TV, theater, music, digital, public, …) and by country, short-lived *attention* vs lasting *legacy*, favourability, credibility, family recognition. `gain()` and `regard()` are the only ways to change it, and each takes a reason. `hidden.fame` is kept as a derived headline so older systems still work; old saves are migrated honestly. |
| `js/engine/entertainment.js` | The **entertainment world**: studios, networks, theater companies, community theaters, talent agencies and outlets per country; working actors and directors who persist; productions with casts, schedules, budgets and reception; the casting board, auditions, contracts, time on set, credits, articles, and money held in trust for children. |
| `js/engine/press.js` | Agents, publicists, privacy, public appearances, rumours (true or not, kept separately from how sure the outlet was), corrections, brand deals. |
| `js/engine/awards.js` | Award bodies hold one season a year per place, judging work released that year. A season is decided once and stored. Music awards judge releases. |
| `js/engine/music.js` | Solo acts and bands of persistent people, songwriting from skill, singles/EPs/albums, release reception and charts, rival acts, royalties with a catalog tail, record deals (lawyer, negotiation, advance, recoupment, albums owed), gigs, tours with dated shows per city, members leaving, hiatus, splits, reunions. |
| `js/engine/sports.js` | Leagues of fictional clubs (football, basketball) whose every match is played each year, with tables, top scorers, players of the year, transfers and caps; individual circuits (tennis, athletics) with draws, finals, rankings and the World Games every four years. The club is the athlete's employer; the career pays the wage, the sport pays nothing. **Sports fame comes only from these results.** |
| `js/engine/modelling.js` | Model agencies, yearly castings (catalog to magazine covers, runway shows abroad), a portfolio of real bookings. Bookings are the modelling career's work, so they shape its performance and fame and are not paid twice. |
| `js/engine/publishing.js` | Manuscripts written over seasons of work, publishers who judge the book and the name on it, self-publishing, release, reviews once, bestseller lists, advances earned back, royalties with a tail, the Lantern Prize. A published author is paid by their books instead of a salary. Memoirs sell on fame. |
| `js/engine/celebs.js` | Famous NPCs' own lives (marriages recorded on both sides, separations, children, scandals reported apart from whether they were true, retirements, returns, deaths) and the player's arc: rising, peak, fading, faded, comeback, with comeback offers (reality show, tribute, memoir, band reunion). |
| Celebrity brands | `fashion_label`, `beauty_brand`, `record_label`, `production_co` in the business engine: they need a known name to start and sell on the owner's fame and goodwill (`starPull`). |
| `js/ui/fame.js` | **My Fame**: Overview (with your arc, comeback offers and celebrity news), Opportunities, Music, Sport, Modelling, Writing, Current work, Representation, Public image, Awards, Connections, Archive, Family (every generation's credits, records, books, sport and awards, linked). Records link to each other (credit → production → castmate; award → season → nominees; record → act → everyone who was in it), with Back. |

Data lives in `js/data/fame.js` (audiences, eras, kinds of production, tiers, roles,
award bodies, venues, release types, deal terms). Everything named there is fictional.

## Rules the engines keep

- **Paid once.** Contracts, brand deals, royalties, advances and tours each have a payroll line with its own source key; `runPayroll` marks them paid, and a second call in the same year pays nothing. An act's money is split between its members.
- **Decided once.** A production's reception, a release's reviews and chart place, and an award season are settled once and stored.
- **No invented credits.** Credits, nominations and discographies are read from productions, releases and seasons, never written as free text.
- **Time is real.** Productions and tours take weeks; a stage run, a TV series and a tour clash with each other; everything appears in the weekly load.
- **Eras.** `MEDIA_ERAS` gates what exists in a year: no film before 1910, no TV before 1950, no recorded music before 1900, no awards before their founding year.
- **Children.** Under-18s need a guardian's agreement; a share of their pay is held in trust and released at 18. A famous parent gives family recognition, not credits, skill or an audience.
- **Generations.** When a life continues as a child, the world carries over: the parent's productions, awards and bands are remembered as the parent's (an NPC id), and the heir starts with none of their own.

## Balance

`node scripts/balance/fame.mjs [seed] [lives] [years]` plays whole public careers in each field at three levels of
talent, with a keen player who practises every year, and reports peak fame, lasting fame, what they earned against
the country's average wage, how many became nationally and internationally known, and the save size. After the
balance pass (seed 7, six lives each, 20 years), roughly:

| Field | Peak fame | Earned (× average wage) | Notes |
| --- | --- | --- | --- |
| Acting | 65–70 | 3.5–4.5 | the quickest road to international fame, for someone who auditions constantly |
| Music | 30–47 | up to ~1 | touring is where the money is; most acts stay national at best |
| Sport | 25–42 | 1–20 | stars are paid like stars; fame follows results |
| Modeling | 22–32 | 1–2 | a steady living, rarely a household name |
| Books | ~45 | ~1–1.4 | bestselling authors; wealth is rare |

Practice matters more than starting talent: after twenty keen years most players are near the top of their craft.
The pass also fixed sales and shows abroad being counted in the other country's currency (`wageIn` in util.js).

## Tests

```
node tests/fame.mjs    # profile, world, the acting vertical slice incl. reload, odds, schedules, awards once, eras, press truth, children, a 25-year career
node tests/fame2.mjs   # sport played match by match with fame only from results, modelling, books, celebrity brands, famous lives, comebacks, the family record
node tests/music.mjs   # bands as people, songs, releases judged once, royalties paid once, deals and advances, tours, charts and music awards, leaving, saves, heirs, eras
```

## Lives in the past

The new-life screen offers a birth year back to 1920 (`js/data/eras.js`). What had not been invented does
not exist: careers (`CAREER_ERAS`: no software before 1955, no influencers before 2006), freelance services
(`SERVICE_ERAS`), kinds of business (`BUSINESS_ERAS`), social media (`SOCIAL_FROM`), dating apps (personal
ads before 2009), and every medium, sport and award by its founding year (`MEDIA_ERAS`, `SPORTS`, award
bodies). Women's professional leagues begin in their own years. Countries, laws and prices are today's,
and money is shown at today's values throughout: a constant-price world, chosen over inflating every stored
salary and price.

## Bands, genres and labels

`js/data/music.js` and `js/engine/music.js`.

- **Genres**: 39 of them, from blues and jazz to punk, metal, emo, grime, drill, K-pop and afrobeats, each from the year
  it began. Each has a usual line-up, wants something different (singing, playing, writing, presence: `genreFit`),
  is more or less popular worldwide and bigger in its heartlands, and goes in and out of fashion year by year (`heat`).
- **Positions**: vocalist, lead and rhythm guitar, bass, drums, keys, backing vocals, rapper, DJ and producer, sax,
  trumpet, violin, cello. How well the player plays one comes from the instrument they practice and their talent
  (`positionSkill`). Musicians in the world play one or two positions and love a few genres.
- **Bands looking for members**: each year there are notices from new bands and established ones (with their fans
  and their label) wanting a specific position. Three auditions a year; get in and you are in the band, in that
  position, alongside real people. Your own band can advertise for any position and choose from those who answer.
- **Labels**: two majors that sign anything, and independents that keep to a sound, chosen by what sells in that
  country (punk and metal labels in the UK, Latin labels in Mexico). Each has its own terms and a roster you can look
  through. Send demos (two a year); a label that is not into your sound will tell you.

## Agents

`js/engine/agents.js`. Every agent (talent agents at agencies, literary agents) is a person with their own
terms: a cut between 5% and 20% (leading agencies usually charge more, not always), their pull with the people
who hire (clout: it changes audition odds, offers, which publishers read a book and the advance), and a list of
clients who are real people in the world (actors with their credits, authors with their books; the biggest
names are with the leading agencies). Looking for an agent shows one at a time; you can sign, say no, or look
again, but only twice a year for each kind. Signing a new agent replaces the old one; work already signed keeps
the terms it was signed on (each contract and book records its agent's cut).

## Also in the engines

- **Sport**: football, basketball, rugby and cricket leagues (men's and women's, from their own founding years);
  tennis, athletics, golf and swimming circuits; boxing with fights, a ranking and a world title (nobody is number
  one without the belt). Injuries by age, fitness and contact cost games and leave marks on the record. A coach
  (career `coaching`) takes charge of a club, is judged on its real position, and is let go after two seasons at
  the bottom.
- **Modelling**: each casting has a brief; how the model plays it (poised, energetic, warm, strange) changes the
  odds (`castingOdds`).
- **Books**: literary agents (15%, better reads and advances), translation deals, film options, and films made of
  the book (a real production with a cast to audition for), which send readers back to it.
- **Celebrity brands**: one product launch a year; hit, steady or flop, from the product and the owner's name.
- **Music**: music videos (from 1981), songs written for other acts with a writer's share, session work.

## Not built yet

- Prices and wages do not change with the era (see above); historical events (wars, depressions) are not modelled
  beyond the economy engine's own cycles; countries and borders are today's.
- Sport: no transfers between countries, no Olympic-style team events, no management of a squad.
- Session work and songwriting do not make credits on other acts' albums beyond the single written.
