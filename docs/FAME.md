# Fame, celebrity and entertainment

Fame in Pathways comes from work that exists in the world: a part in a real
production, a record that came out, a tour that played. Nothing is a bare number
the game sets; every gain has a cause, and the archive can show you where it came from.

## Engines

| File | What it owns |
| --- | --- |
| `js/engine/fame.js` | The **fame profile** on every life: recognition by audience (film, TV, theatre, music, digital, public, …) and by country, short-lived *attention* vs lasting *legacy*, favourability, credibility, family recognition. `gain()` and `regard()` are the only ways to change it, and each takes a reason. `hidden.fame` is kept as a derived headline so older systems still work; old saves are migrated honestly. |
| `js/engine/entertainment.js` | The **entertainment world**: studios, networks, theatre companies, community theatres, talent agencies and outlets per country; working actors and directors who persist; productions with casts, schedules, budgets and reception; the casting board, auditions, contracts, time on set, credits, articles, and money held in trust for children. |
| `js/engine/press.js` | Agents, publicists, privacy, public appearances, rumours (true or not, kept separately from how sure the outlet was), corrections, brand deals. |
| `js/engine/awards.js` | Award bodies hold one season a year per place, judging work released that year. A season is decided once and stored. Music awards judge releases. |
| `js/engine/music.js` | Solo acts and bands of persistent people, songwriting from skill, singles/EPs/albums, release reception and charts, rival acts, royalties with a catalogue tail, record deals (lawyer, negotiation, advance, recoupment, albums owed), gigs, tours with dated shows per city, members leaving, hiatus, splits, reunions. |
| `js/engine/sports.js` | Leagues of fictional clubs (football, basketball) whose every match is played each year, with tables, top scorers, players of the year, transfers and caps; individual circuits (tennis, athletics) with draws, finals, rankings and the World Games every four years. The club is the athlete's employer; the career pays the wage, the sport pays nothing. **Sports fame comes only from these results.** |
| `js/engine/modelling.js` | Model agencies, yearly castings (catalogue to magazine covers, runway shows abroad), a portfolio of real bookings. Bookings are the modelling career's work, so they shape its performance and fame and are not paid twice. |
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

## Tests

```
node tests/fame.mjs    # profile, world, the acting vertical slice incl. reload, odds, schedules, awards once, eras, press truth, children, a 25-year career
node tests/fame2.mjs   # sport played match by match with fame only from results, modelling, books, celebrity brands, famous lives, comebacks, the family record
node tests/music.mjs   # bands as people, songs, releases judged once, royalties paid once, deals and advances, tours, charts and music awards, leaving, saves, heirs, eras
```

## Not built yet

- **Historical-era starts**: era gating works (no league before the sport existed, no records before recording, no films before film), but the game cannot start a life in the past, so it is only exercised by tests.
- Sport: no injuries as events, no coaching or management careers built on the sports engine, no women's/men's separate leagues, and only four sports.
- Modelling: no runway walks or shoots as playable scenes; castings are a single decision.
- Books: no literary agents, translations as deals of their own, or screen adaptations of a player's book.
- Celebrity brands use the existing business engine; they have no product launches of their own.
- Music: no music videos, songwriting for other acts, or session work.
