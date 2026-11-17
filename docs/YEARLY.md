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
| Repeated choices (practising, posting) | Had to be clicked every year | Can be set once as a plan: hobby focus, posting routine |
| Saving money | Not modelled beyond cash | A savings goal: set aside each year, small interest, in net worth and the estate |
| Pets | Bought, aged, no routine care | A care routine for each animal, paid every year; there is no "no care" option |
| Celebrations and traditions | Not modelled | Celebrations once per occasion per year; traditions that come round by themselves and pass to heirs |
| Prison | Each activity clicked once a year | A priority for the years inside (education, work, rehabilitation, family contact, personal development), chosen once and lived every year |
| Yearly summary | Journal only | The yearly life update, including convictions, prison, moves, new citizenship and a crisis starting or ending |

## Status

**Complete**
- One authoritative yearly clock, with registered steps and once-per-year markers.
- Health on the yearly model (the internal weekly simulation stays, so medicines
  still take weeks to act and therapy still builds session by session).
- Long-running plans: hobby focus, posting routine, savings goal, pet care,
  family traditions, a prison priority; celebrations as once-a-year actions.
- The yearly life update, the "Your life this year" card (Pursuits tab).
- Tests: `tests/yearly.mjs` (one year per Age Up, steps run once, limits,
  plans, the summary, the full-year scenario, three generations) and
  `tests/yearly-ui.mjs` (phone and desktop widths in a real browser).

**Partly complete**
- *Sports*: there is no sports-career engine. A sport can be the hobby focus
  (practice through the year); school sports clubs exist already. No teams,
  seasons, matches or rankings.
- *Multigenerational test*: covers three generations in the present day. It
  cannot start in 1900 (see below).

**Not in this repository** (so not simplified, and not invented here)
- Historical eras and an era registry; the health catalog carries years, but
  every life still starts in the present.
- Business and entrepreneurship.
- Digital Life as a separate system (`js/data/digital.js`, `js/engine/digital/`,
  `tests/digital-ui.mjs` do not exist); social media is the small system in
  `engine/social.js`, now with a posting routine.
- Equestrian life; fame as its own system beyond careers with fame actions.
