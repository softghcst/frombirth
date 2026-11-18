# The yearly model

Pathways moves one year per Age Up ("Live another year"). Players make
decisions; the year is lived; they see what changed. This page records how
the game follows that model, what was changed to make it consistent, and what
does not exist yet.

## How a year works

1. **Actions happen now.** Anything the player chooses resolves in the current
   year: a job application, a date, an assessment with a doctor, a talk with a
   prescriber, a birthday party. Some start something long-running (therapy, a
   medicine, a degree, a savings goal) that is lived through the year rather than
   finished on the spot.
2. **Age Up lives the year.** `advanceYear` in `js/engine/yearProcessor.js` is
   the one clock. In order: the year's plans (`engine/plans.js`), the weeks of
   health care left in the year (`engine/health`), then every registered yearly
   step in `YEARLY`, then death, then the year's scenes.
3. **Everything runs once.** Each step in `YEARLY` is marked with the world year
   it last ran (`state.yearMarks`), and `runYearSteps` skips a step already run
   for that year. Plans carry their own marker (`plans.lastYear`); health bills
   carry a reference each and are never charged twice.
4. **The player sees the year.** After the year's scenes, a yearly life update
   (`engine/yearSummary.js`) shows what changed, worked out from a snapshot taken
   when the year began: big moments first, then family, work, money, health and
   the plans that carried on. Routine things are left to their own screens. A
   quiet year says so. It can be switched off in Settings.

## Audit: what the code already did, and what changed

| Area | Before | Now |
| --- | --- | --- |
| Age Up | One function calling about forty yearly steps in a fixed order | The same steps, in the same order, registered in `YEARLY` with once-per-year markers |
| Everyday actions (work harder, study, spend time, dates, gym, practice, posting) | Already once a year, or a yearly allowance | Unchanged; covered by tests |
| Health care (built in this branch) | A weekly care calendar the player moved through with "Let the weeks pass" | Assessments, prescriber talks, second opinions and side-effect reports resolve when chosen; therapy, medicines, checks and follow-ups are lived at Age Up; decisions come back to the player after the year; no week counts on screen |
| Repeated choices (practicing, posting) | Had to be clicked every year | A hobby focus is set once (`engine/plans.js`); posting is Digital Life's creator routine (`engine/digital/creator.js`, `setRoutine`) |
| Saving money | Cash only | A standing yearly deposit into one of the player's bank accounts (`engine/banking.js`), through the ledger like any deposit |
| Pets | Bought, aged, no routine care | The animal-care routine (`engine/animalCare.js`, `setRoutine`/`tickCare`), lived every year |
| Celebrations and traditions | Not modeled | Living Moments (`engine/moments.js`): each occasion once a year; traditions that come round by themselves and pass to heirs |
| Prison | Each activity clicked once a year | The prison routine (`engine/prison.js`, `setRoutine`), chosen once and lived every year |
| Yearly summary | Journal only | The yearly life update, including convictions, prison, moves, new citizenship and a crisis starting or ending |

When the work in other branches was merged (eras with Digital Life and travel,
fame, sports, Living Moments), the simpler versions this branch had written of
the same things were removed so that each exists once: the posting plan, the
savings pot, pet care, the prison priority, and celebrations and traditions.

## Status

**Complete**
- One authoritative yearly clock, with registered steps and once-per-year markers,
  including the merged systems: eras (`tickEra`), Digital Life (`tickDigital`),
  travel and global life (`tickGlobalLife`), sports (`tickSports`), animals,
  Living Moments (`finishYear`/`startYear`) and the ledger's books.
- Health on the yearly model (the internal weekly simulation stays, so medicines
  still take weeks to act and therapy still builds session by session), and
  following the eras: nothing is offered before it existed.
- Long-running plans: hobby focus and a standing bank deposit here; posting,
  pet care, prison and traditions in their own systems, as above.
- The yearly life update and the "Your life this year" card (Pursuits tab).
- Tests: `tests/yearly.mjs` (one year per Age Up, steps run once, limits,
  plans, the summary, the full-year scenario, three generations),
  `tests/yearly-ui.mjs` (phone and desktop widths in a real browser) and
  `tests/generations-1900.mjs` (one family from 1900 to the present through every
  era: no gaps, steps once a year, nothing before its time, saves load).

**Known overlaps and gaps**
- *Sport is one system now*: the professional leagues and circuits that came with
  fame were folded into the athletics engine (`engine/sports.js`,
  `engine/sportsLife.js`), with its World Games, caps, women's leagues and the
  route in from the jobs board; old saves are converted when loaded.
- *Fame and social media*: fame's own social hooks (fame from a viral post,
  bought followers) were dropped in favor of Digital Life; fame from online
  posting comes only from what Digital Life reports.
- *Older treatments*: the health catalog holds today's medicines and therapies,
  so lives before the 1980s are offered little (see docs/HEALTH.md).
