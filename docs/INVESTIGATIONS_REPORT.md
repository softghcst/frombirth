# Investigations — final engineering report

The report the Detective & Federal Investigations Career Engine 2.0 prompt asks for (Part 85), with the Connected
Investigations, Forensics & Justice World 3.0 addendum. What works is described in `docs/INVESTIGATIONS.md`; this
says what was built, in which commit, how it was tested, and what is still missing.

## Completed phases

| Phase | Status | Main files | What it added | Commit |
|---|---|---|---|---|
| Engine: agencies, recruitment, academies, cases, federal and private | Done | `js/engine/investigations/{core,agencies,careers,casework,views,oversight,private,drama,index}.js`, `js/data/investigations.js` | Agencies with stable ids, applications with dated decisions, academy and field training over real time, detective selection, the shared case engine on the Justice Engine's records, FBI/DEA/ATF, private licensing | `cf17ded2` |
| My Investigations hub and case file | Done | `js/ui/investigations.js` | The hub, role-based sections, the case file with its tabs, the notebook | `7d3ed502` |
| Engine tests, browser test, documentation | Done | `tests/investigations.mjs`, `tests/investigations-ui.mjs`, `docs/INVESTIGATIONS.md` | Eleven engine sections, the screen at phone and desktop widths | `c6e05046`, `4a735454` |
| Case packs, conviction review, romance rules, legacy | Done | `casework.js`, `drama.js`, `js/data/investigations.js` | Arson, corruption, drugs, firearms, family and juvenile cases; reviews of convictions; supervision rules; the next generation | `a9c63ddd` |
| Forensic medicine, policing, journalism (3.0) | Done | `forensicMed.js`, `policing.js`, `crossover.js` | Medical examiners and forensic psychiatrists, budgets and oversight boards, sheriffs, journalism from the public record | `27748f89` |
| Special careers and studying | Done | `js/ui/tabs/work.js`, `careers.js`, `js/data/majors.js` | The entry under Special careers; degrees that count; new majors | `7db085b7` |
| Lawyers, Family Archive, icon | Done | `legal.js`, `lawCases.js`, `lawPractice.js`, `js/ui/animals.js` | Referred cases worked by player lawyers as the same case; Law enforcement legacy | `4005b4a4` |
| Working life | Done | `workplace.js` | Caseload, federal transfers and squads, task force meetings, private agency staff, honors, work after retiring | `19a06598` |
| The local world | Done | `local.js`, `casework.js` | Real employers, real neighbors, community meetings, cross-examination of the investigator | `6ee55281` |
| Shared incidents, corporate investigators | Done | `local.js`, `legal.js`, `js/data/law.js` | Fatal collisions with the hospital, the family's claim and the insurer; in-house investigators | `6e9f1de3` |
| Homicide scenes, more federal agencies | Done | `drama.js`, `js/data/events/stories/investigations.js`, `js/data/occupations.js` | Eight homicide scenes; the US Marshals, Secret Service, HSI and IRS-CI | `1aa74d07` |
| Forensic scientist | Done | `forensicLab.js` | A discipline, a backlog, proficiency and accreditation, testimony, promotion | `0f1c749c` |
| Unions and national reform | Done | `unions.js`, `reform.js` | Contracts, representation, working to rule; four national measures that change the engine | `4d467abd` |
| Forensic psychology | Done | `forensicPsych.js` | Consultations, parole risk assessments, care for officers | `8e21811c` |
| Police outside the US | Done | `js/data/investigations.js`, `agencies.js`, `careers.js` | The UK, Canada, Australia, France and Japan | `8ae36128` |
| Careers around the cases | Done | `allied.js`, `js/data/occupations.js` | Analysts, probation officers, victim advocates, court reporters, inspectors general, compliance and insurance investigators; digital forensic examiners | `a061a070` |
| Conviction review careers, accountants, hospitals, pay, the editor's desk | Done | `integrity.js`, `books.js`, `medical.js`, `pay.js`, `crossover.js` | The last items of the 3.0 addendum | `b42a2a35` |

## Tests

Commands run (Node 22, and the preinstalled Chromium through Playwright for the browser tests):

```
node tests/investigations.mjs        # the engine: 30 sections
node tests/investigations-law.mjs    # lawyers, collisions and claims
node tests/investigations-ui.mjs     # the screen, at 390px and 1280px wide
for f in tests/*.mjs; do node "$f"; done   # the whole suite
```

- Passing: `investigations.mjs` (30 sections), `investigations-law.mjs` (46 checks), `investigations-ui.mjs` (38 checks),
  and the rest of the suite: 131 of 132 test files pass.
- Failing: `tests/name-variety.mjs` (some small countries, such as Mauritius and the Seychelles, have too few first names and surnames). It fails on `main` as well and is unrelated to the investigations work.
- Not run: tests on physical devices (only emulated phone and desktop widths).
- Environmental blockers: the agencies' own pages could not be fetched from the build environment, so no rule was
  checked against its source (every `SOURCES` entry is `verified: false`).

## Career coverage

| Career | Genuinely playable? |
|---|---|
| Local police (US municipal, county, state) | Yes |
| Police in the UK, Canada, Australia, France, Japan | Yes, simplified rules |
| Police elsewhere | Simplified: one national service |
| Detective | Yes |
| Homicide | Yes, with its own scenes |
| Burglary | Yes |
| Missing persons | Yes |
| Financial investigation | Yes (detectives, the FBI, IRS-CI, forensic accountants and auditors) |
| Cybercrime | Yes, where the technology exists in the year |
| FBI | Yes |
| Other federal agencies (DEA, ATF, US Marshals, Secret Service, HSI, IRS-CI) | Yes |
| Private investigation, own agency, corporate investigator | Yes |

## Case integration

| Rule | Holds? | How it is checked |
|---|---|---|
| Witnesses are persistent | Yes | Witnesses are NPCs in `state.npcs`, some real neighborhood residents; the same people in court and in later cases |
| Evidence persists | Yes | Evidence records in `state.justice.evidence`, with custody logs on the case file |
| Legal authorization works | Yes | Records orders need a basis in the file; medical information needs consent or an order |
| Prosecutor referrals work | Yes | The report comes first; the prosecutor decides on charges |
| Court proceedings use the same case identity | Yes | One case from incident to appeal; player lawyers work that case (`legal.js`) |
| Case outcomes persist | Yes | Outcomes on the file and the court case; recorded once |
| Cold cases can reopen | Yes | When an unused laboratory method becomes available |
| Save/reload is stable | Yes | Checked in the engine test and in the browser after a reload |

## Incomplete systems

- Every career the 3.0 addendum lists now has playable work (see the table in `docs/INVESTIGATIONS.md`). The careers
  around the cases have one piece of work a year each, simpler than the investigator's own career.
- Agency rules are simplified gameplay rules, unverified against the agencies' own pages.
- Police outside the five modeled countries are one simplified national service.
- Police unions follow one simplified rule everywhere: officers may not strike.
- No test runs on physical devices.
