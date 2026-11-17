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
| `js/ui/fame.js` | **My Fame**: Overview, Opportunities, Music, Current work, Representation, Public image, Awards, Connections, Archive. Records link to each other (credit → production → castmate; award → season → nominees; record → act → everyone who was in it), with Back. |

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
node tests/music.mjs   # bands as people, songs, releases judged once, royalties paid once, deals and advances, tours, charts and music awards, leaving, saves, heirs, eras
```

## Not built yet

Honest list of parts of the fame brief that are not implemented:

- **Modelling** (agencies, castings, campaigns, portfolio).
- **Sports fame**: there is no sports simulation to draw results from, and fame from sport must come from real results, so it is left out rather than faked.
- **Writers and creatives** publishing books or scripts as a fame route (writing exists as a career, not as published works with reception).
- **Celebrity-owned businesses** linked to the business engine (a brand, a label of your own).
- **Fame decay arcs and comebacks** beyond the attention/legacy decay already in the profile; no scripted comeback storylines.
- **Autonomous celebrity NPC lives** beyond working actors and rival acts (no NPC scandals, marriages or retirements in the press).
- **Family entertainment legacy view** (a dynasty page); the archive and award records do survive generations.
- **Historical-era starts**: era gating works, but the game has no way to start a life in the past, so it is only exercised by tests.
- Music: no music videos, streaming-era specifics, publishing/songwriter credits for other acts, or session work; tours abroad depend on fans already there.
