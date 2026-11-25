# Investigations — police, detectives, federal agents, private investigators

The engine is `js/engine/investigations/` with its data in `js/data/investigations.js`, its scenes in
`js/data/events/stories/investigations.js` and its screen in `js/ui/investigations.js` (Work → My Investigations).

## Audit (what existed, and what this builds on)

| System | Where | What it gave | How it is used |
|---|---|---|---|
| Criminal case records | `engine/cases.js` (`state.justice`) | Incidents with a hidden truth, investigations, evidence with reliability and lawfulness, charges, bail, pleas, trials, sentences, appeals, fresh evidence, a payments ledger | The one case identity. A case file is a field on the same investigation (`inv.file`); charges, trials and appeals are the existing ones |
| Justice jobs | `engine/legalCareers.js` | A quick "work a case" brief for police and detectives, and briefs for lawyers and judges | Left as it was. The new engine is the deep path for investigators |
| Careers | `data/careers.js`, `data/occupations.js`, `engine/career.js`, `engine/hiring.js` | Police, detective, forensic science, private investigation, prosecution, defense and judiciary tracks; payroll; promotions | Ranks map to levels of these tracks so the ordinary payroll pays them. FBI, DEA and ATF tracks were added |
| Employers | `engine/employers.js` | Persistent organizations with staff and history | Each agency and field office is a registered employer |
| Business | `engine/business.js` | Businesses with staff, cash, rent, partners, sale | A private investigation agency is a business type gated by a license |
| Medical careers | `engine/medicine/` | A model for a deep yearly career engine with migration and a hub | Followed for structure. Forensic pathology for a player physician is **not** built |
| Time | `engine/turns.js` | 3-, 6- and 12-month turns; the year itself runs once | Anything with a duration is dated in months and released on its date |
| Story Director | `data/events`, `engine/effects.js` | Queued scenes with effects | 38 queued scenes and an `inv` effect |
| Canonical events | `engine/chronicle.js` (`recordEvent`) | Public life events | Career milestones are recorded as public events; case files never are |
| Journalism | `data/careers.js` (journalist) | A career track | A journalist sees the public record of cases in court (partial) |

## Support matrix

| Area | Status |
|---|---|
| Local police (US municipal, county, state) | **Playable**: preparation, application with assessments and a dated decision, academy over real time, field training with a persistent training officer, probation, patrol work |
| Police elsewhere | **Simplified**: one national service per city, marked simplified |
| Detective selection | **Playable**: a vacancy, an assessment, a real rival applicant, a panel decision; transfers between units |
| Burglary | **Playable** (the Ashford Street case is a burglary template) |
| Robbery, homicide, missing persons, financial fraud, cybercrime | **Playable** as case templates with their own clues and explanations; cybercrime needs the web to exist |
| Organized crime, special victims, family, juvenile, corruption, arson, major crimes | **Registry only**: units exist; their cases draw on the general templates |
| Cold cases | **Playable**: inactive for three years becomes cold; reopening when a laboratory method that was not used becomes available; history kept |
| Professional standards | **Playable** in a basic form: complaints about the player decided by someone else; complaints the player investigates, with conflict checks |
| Promotions and leadership | **Playable**: police, detective and federal ladders; each needs years, standing, a vacancy and beats a rival; chief and SAC are appointed |
| FBI | **Playable**: eligibility (simplified), four dated stages, selection, academy, a field office, a partner and supervisor, federal cases |
| DEA, ATF | **Playable** to the same depth as the FBI, with their own eligibility, academies and offices; their cases use the same templates (no drug or firearms case packs yet) |
| Task forces | **Partial**: a US robbery or fraud case may gain a federal partner, as one shared case |
| Private investigation | **Playable**: license by exam, an agency on the business engine, clients who come or not by price and reputation, lawful steps only, fees paid once |
| Forensic scientist (crossover) | **Partial**: requests from real cases on the bench; the report joins the same case file |
| Journalist (crossover) | **Partial**: the public record of cases in court |
| Medical examiner | **Partial**: homicide files carry an examiner's findings, with cause and manner kept apart; a player physician cannot issue them |
| Forensic psychology, wrongful-conviction units, politics of policing | **Not built** |

## Rules the engine keeps

- One case, one identity: the investigation, its evidence, the charge, the trial and any appeal are records in `state.justice`.
- Every clue has a source: a case's facts are set from what happened when the case is made, and each step reveals what it can reach, once.
- Facts, claims and hypotheses are kept apart. Witnesses can be sure and wrong; hypotheses follow the clues found, not the truth.
- Laboratory results are decided when requested and released on their date; they can be inconclusive or unable to evaluate, and they report on evidence, not on guilt.
- A records order needs a lawful basis in the file; a person of interest may decline to talk; pressing a witness taints the statement and the court rules it out.
- The report comes before a referral; the prosecutor decides on charges; the court decides the verdict (engine/cases.js). Leaving out what helps the defense costs integrity at once and, when it comes out, ends the case and brings a complaint.
- Access is enforced in `views.js`: each role gets a new object with only what it may see; the truth is never copied into a view.
- The Family Archive sees the career (`legacySummary`) and cases only as far as a court made them public.
- Older saves keep their police officers and detectives; earlier casework is recorded as unknown; no case is invented.

## Sources

`SOURCES` in `js/data/investigations.js` names the page each rule is modeled on (FBI, DEA, ATF, BLS, NIJ, DOJ). These pages could not be
fetched from the build environment, so every rule is marked `verified: false` and is a simplified gameplay rule until checked.

## Tests

- `node tests/investigations.mjs`: the engine (11 sections, including the same two years at 12-, 6- and 3-month turns).
- `node tests/investigations-ui.mjs`: the screen in a real browser, at phone and desktop widths.
