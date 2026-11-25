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
| Arson, public corruption, drug supply, firearms trafficking, domestic and family, juvenile | **Playable** as case packs described in data (`PACKS`); family cases offer support first and let the person harmed decide whether to give an account |
| Organized crime, special victims, major crimes | **Playable** through the packs above (drugs and firearms; family; robbery, homicide, arson) |
| Cold cases | **Playable**: inactive for three years becomes cold; reopening when a laboratory method that was not used becomes available; history kept |
| Professional standards | **Playable** in a basic form: complaints about the player decided by someone else; complaints the player investigates, with conflict checks |
| Promotions and leadership | **Playable**: police, detective and federal ladders; each needs years, standing, a vacancy and beats a rival; chief and SAC are appointed |
| FBI | **Playable**: eligibility (simplified), four dated stages, selection, academy, a field office, a partner and supervisor, federal cases |
| DEA, ATF | **Playable** to the same depth as the FBI, each with its own case types: the DEA drug supply, the ATF firearms and arson; the FBI fraud, cybercrime, corruption, robbery and homicide |
| Task forces | **Playable**: a US robbery or fraud case may gain a federal partner, as one shared case; a yearly task force meeting (share everything, agree who does what, or hold leads back; holding back year after year ends it) |
| Private investigation | **Playable**: license by exam, an agency on the business engine, clients who come or not by price and reputation, lawful steps only, fees paid once |
| Forensic scientist (crossover) | **Partial**: requests from real cases on the bench; the report joins the same case file |
| Medical examiner | **Playable** for a physician who completes the Forensic Pathology fellowship (after pathology): death referrals from real investigations; cause and manner of death found separately; toxicology takes time; findings the evidence does not support are refused; the signed report is the examiner's finding in the same case file |
| Forensic psychiatry | **Playable** for a physician who completes the Forensic Psychiatry fellowship (after psychiatry): competency evaluations ordered by a court in a real case; the role and the limits of confidentiality come first; a firm opinion needs a structured assessment; the court decides |
| Policing and accountability | **Playable**: department budgets read from the country's police policy and the mayor's safety budget, with effects on laboratory time, caseload hours and training; a chief's yearly priority; a civilian oversight board proposed by a mayor or council member and voted on, with arguments on both sides; elected sheriffs |
| Journalism | **Playable**: stories on cases in the public record, from the court record, willing sources, requests for comment and verification; case files refused; an unverified error needs a correction; a verified story about a conviction draws public attention, which decides nothing |
| Conviction review | **Playable**: a conviction with kept evidence that can be tested anew can be reviewed; a result pointing elsewhere goes to the appeal court as new evidence, which decides; the first verdict stays on the record |
| Romance at work | **Playable** within rules: never across supervision (either way); partners who are together must declare it and are given new working partners |
| The next generation | **Playable**: an ancestor's public career is in My Investigations → Family Legacy; their cases stay in the records under their name and may come back to a descendant who investigates |
| Caseload | **Playable**: one case a year can be the priority (more hours on it, fewer on the rest); support can be asked for once a year and the supervisor decides; a partner can take a case's routine steps, never its judgment calls (`workplace.js`) |
| Moves within an agency | **Playable** for federal agents: a transfer to another field office after some years, or a squad place (FBI white-collar, cyber, corruption, violent crime; DEA enforcement and diversion; ATF firearms and arson), each decided after six months on the record. Police units were already playable through detective selection |
| Private agency staff | **Playable**: an open matter can be given to a member of the agency's staff, who closes it by its due date with lawful steps only |
| Honors and high-profile cases | **Playable**: commendations, medals of merit, recognition for clearing an innocent person, investigator of the year, decided on integrity and how the work was done, never on arrest counts; a homicide or corruption case in court adds a little fame (publicity is not reputation) |
| After retiring | **Playable**: academy instructor, investigative consultant, expert witness (each with yearly pay), and one memoir: from the public record, or telling what case files held (a breach) |
| The local world | **Playable**: burglary, fraud, cybercrime and arson cases happen at a real employer of the city when one fits (its history records the report); a cyber case names the reporting person's real Digital Life account when they have one; a witness may be a real resident of one of the city's neighborhoods, the same person the player could meet (`local.js`). Places and people are chosen by stable keys |
| Community meetings | **Playable** for local police: each neighborhood's meeting once a year (listen, present the figures, or defend the department); trust in the police is kept per neighborhood; a tip from a meeting is a lead to check, never evidence |
| The investigator on the stand | **Playable**: cross-examination on custody, pressure on witnesses, inconclusive laboratory results and other suspects, drawn from the file; a denial the file contradicts is found out, weakens the investigator's evidence at trial and can bring a complaint; owning a weakness keeps their word good |
| Shared incidents | **Playable**: a fatal collision (careless driving, impairment, or an accident nobody could have avoided) is one incident several careers meet: the person struck dies at a real hospital of the city, and when the investigation ends the family claims against the driver. A civil litigator is offered the claim (`collision_claim`), with the investigation's outcome as its evidence; if no lawyer takes it within a year, the driver's insurer settles it, or refuses it when the investigation found it unavoidable |
| Corporate investigators | **Playable**: with a license, five years of investigative work or a relevant degree, a post on a real company's investigations team (the private investigation track, salaried); one internal matter a year, lawful steps only, no police powers; a crime is for the company to report |
| Lawyers | **Playable**: a referred case in court is assigned to a player public defender or prosecutor, or offered to a private criminal defense lawyer (`investigations/legal.js`). It is the same court case, defendant and witnesses; the evidence is the investigation's, and what it found decides what can be challenged (pressure → excluded statement, custody gap, unlawful search). Cross-examination works only on an eyewitness's real limitation. What an incomplete report left out may be disclosed late, and then helps the defense. While a lawyer has the case the investigation's own court step waits; the verdict is written once on the court case and recorded in the file |
| Family Archive | **Playable**: Family Archive → Law enforcement legacy shows each officer, detective, agent and investigator in the family (and the player), with the cases they led that reached a court |
| Forensic psychology outside the courts, police unions, national police reform | **Not built** |

## Studying for the work

Work → Special careers → 🕵️ Law Enforcement & Investigations. The overview's **Ways in** card sets out each route.

- Police work is open from high school (21 or older) through the academy; a degree is not required to start. A degree adds to the
  entrance assessment and academy readiness; relevant majors (criminal justice, criminology, psychology, political science, forensic science,
  communications) add more.
- Detective selection favors relevant degrees, and units favor their own (accounting or finance for fraud, cybersecurity or computer science
  for cybercrime, forensic science for homicide, psychology for special victims).
- Captain, deputy chief, chief, detective lieutenant and federal leadership ask for a bachelor's degree; a degree finished part-time while
  serving counts from then on.
- Federal agencies require a degree and value varied backgrounds (accounting, technology, law, languages, science, criminal justice).
- A relevant degree gives a one-time head start in the skills it teaches, and shortens a private investigator's license by a year.
- New majors: Criminology, Forensic Science (from 1975), Cybersecurity (from 2000), Accounting.

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

- `node tests/investigations.mjs`: the engine (18 sections, including the same two years at 12-, 6- and 3-month turns).
- `node tests/investigations-law.mjs`: a referred case worked by a player defender, prosecutor and private lawyer; a fatal collision's hospital, family claim and insurer.
- `node tests/investigations-ui.mjs`: the screen in a real browser, at phone and desktop widths.
