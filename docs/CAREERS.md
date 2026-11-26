# Careers, jobs and working life

How work is modeled in Pathways: what an occupation, an employer, a job and a contract are; how people get
hired, paid, promoted and laid off; who they work with; how work fits around the rest of a life; and what the
family remembers of it afterward.

Everything here is gameplay configuration. Pay bands, working-time law, benefits and rank names are simplified,
unverified, and scaled by each country's wages (`localWage`) and each city's pay (`payK`). They are not real
salaries or legal advice.

## The pieces

| Concept | What it is | Where |
|---|---|---|
| Career family | A field of work (19 of them: business, tech, health, law, education, hospitality, retail, trades, science, transport, public safety, media, entertainment, beauty, government, land and animals, sport, unusual work, military) | `js/data/occupations.js` `FAMILIES` |
| Career track | A ladder of titles that belong together (Junior developer → … → App founder). 193 tracks, 714 titles | `js/data/careers.js` (the original 44) + `js/data/occupations.js` `TRACKS` |
| Occupation | One title on a track; aliases are other names for the same work | each track's `levels` and `aliases` |
| Employer | A persistent organization in a city: name, size, culture, finances, staff, history | `js/engine/employers.js` |
| Job posting | A real opening at an employer for a rung of a track, with pay, hours and an expiry | `state.jobs.postings` |
| Offer | What an employer proposes after an interview; negotiable | `p.career.offers`, `js/engine/hiring.js` |
| Contract | The job held: employer, title, level, salary, hours, overtime, remote, leave | `p.career` |
| Side job | Part-time work beside (or instead of) a main job | `p.career.partTime`, `p.career.sides`, `js/engine/sideJobs.js` |
| Freelance practice | Services, prices, reputation, clients, contracts | `p.career.freelance`, `js/engine/freelance.js` |
| Workplace | The boss, coworkers, direct reports and mentors: ordinary NPCs with working lives of their own | `js/engine/workplace.js` |
| Recruiter | The job recruiter on Find a Job (three looks a year); for someone with a record, some looks are a headhunter's step up, from an NPC recruiter kept for good | `js/engine/jobSearch.js`, `js/engine/recruiters.js` |
| Record | Every job with its employer and dates; experience by track; milestones; the family's careers | `js/engine/careerRecord.js` |

The career engine itself (`js/engine/career.js`) is the one that was already there: requirements, interviews and
auditions, the yearly review, raises, promotions, firing, gigs, fame, retirement. The new modules plug into it,
so old and new tracks behave alike, and NPC working lives (`js/engine/npcLives.js`) draw from the same catalog.

## Adding work

A new track is one entry in `TRACKS` (`js/data/occupations.js`). Nothing else changes. Its fields are described at
the top of that file; the ones from the original engine are described at the top of `js/data/careers.js`.
`node tests/careers.mjs` checks that every requirement, branch, rank list, certificate and family names
something real.

- **Requirements** are occupation-specific: a degree in particular majors, a program (medical, law, nursing…),
  a trade apprenticeship, a certificate (`altCert`; `altOnly` when it is the only way in), years of experience in
  named tracks (`experience`), age, fitness, a clean record. University is never required by default.
- **Branches** (`from`) let someone move across from a rung of one track into another at the same employer:
  senior developer → engineering management or the staff-engineer track; teacher → school leadership; police
  officer → detective. `branchOnly` tracks are reached that way, or by `experience`, never hired into cold.
  Licenses still apply: a nurse cannot branch into surgery.
- **Local titles** (`titlesBy`) rename the ranks in a country; service branches have their own rank names
  (`BRANCH_RANKS`). Military branches differ by country (`MILITARY_BRANCHES`).

## The working year

`tickWork()` in `js/engine/career.js`, called by the year processor where `tickCareer()` used to be:

1. Employers have a year (`tickEmployers`): finances follow the economy; weak ones cut jobs or close; openings
   are posted, taken by other applicants, or expire. Only cities the player is watching get new openings each
   year; background employers are aggregate.
2. Offers lapse (`tickOffers`).
3. The main job's review (`tickCareer`): closure or layoff, experience, performance (skill, discipline, a
   mentor, stress, satisfaction, leave, luck), deployments and missions, promotion (which needs a free seat:
   `vacancyOdds`), raises, fame, retirement age.
4. Side jobs (`tickSides`): experience, raises, campus jobs reviewed when the course ends.
5. The workplace (`tickWorkplace`): coworkers who left are kept as former colleagues; bosses replaced; teams for
   managers; mentors found; mentees promoted.
6. Freelance contracts finish or fail (`tickFreelance`).
7. Stress, satisfaction and burnout settle (`tickWorkLife`); long hours are felt at home.
8. Old leads lapse, and an old mentor may bring one (`tickRecruiters`). Headhunting comes through the job recruiter.
9. Milestones are checked (`checkAchievements`).

Payroll runs afterward in `tickFinance`, through `runPayroll` (`js/engine/worklife.js`): every source (main job,
part-time jobs, finished freelance contracts, pension, unemployment benefit) is listed, paid once per year
(`paidYear`), taxed once, and kept as last year's pay stub. Hourly work is paid by the hours worked, overtime at
time and a half; commission and tips vary with performance and charm; failed freelance work pays a part at most.
A job lost during the review is not paid for the following year.

Actions during a year are keyed to the year of age (as the rest of the game does). The tick and payroll look
back at `age − 1`, the year just lived.

## Finding ordinary work

Work that is not a special career is found from Work → Find work (the hub's Find a job section,
`js/engine/jobSearch.js`). The whole market is not shown at once; there are two ways in:

- **This year's openings**: a list of about a dozen drawn once a year from the openings in the player's city and
  remote ones in the country, one per line of work. About twelve in a steady year, fourteen in a boom, nine in a
  recession. Most are jobs the player can apply for; the rest are greyed with what they would need. The list stays
  the same all year (`p.flags.jobList`, keyed to the year of age), and most of it is new the next year.
  Prominent openings (`prominent()`: a large or major employer, or a senior post) stay: once listed they are held
  open for `PROMINENT_YEARS` (3) years, nobody else takes them and they do not lapse (`post.featuredUntil`, which
  the employer tick respects), and the list shows when they were first listed. Other openings someone takes during
  the year stay on that year's list, marked closed.
- **The job recruiter**: brings one opening the player qualifies for, mostly in their city, never one already on
  the list. Not keen? Ask for another, twice more: three looks a year (`RECRUITER_LOOKS`), then nothing until
  next year (`p.flags.jobRecruiter`). The last pitch can still be looked at again. A recruiter's opening gets a
  small word put in at the interview (`RECRUITER_BONUS`). Someone with a record (a civilian job, age 20 or more,
  two years' experience) is sometimes headhunted instead: a look, at odds that grow with good reviews,
  experience, seniority and fame (`headhuntOdds`), is a named recruiter's step up in their own line of work,
  often a rung higher, sometimes in another city or abroad (`stepUp`), with a stronger word at the interview
  (`STEP_UP_BONUS`). Recruiters no longer write in on their own; the Offers & contacts page keeps offers, and
  leads from old mentors who have moved on.

Either way, applying is the same interview or audition, then an offer under Offers & recruiters.

## Time

`weeklyLoad()` counts every commitment: the main job and overtime, part-time jobs, freelance contracts, school
or study, and the commute (none when remote). `canFit()` is the one check every new commitment goes through:
the country's working age and its limit on hours for under-18s (`js/data/workLaw.js`), the hours in a week,
and contracts that forbid outside work (judges, diplomats, intelligence, the military, holders of high office).

## Saves

`ensureCareer()` fills in what an older save lacks, keeping its job, pay and years (years in field become
experience in that track). `state.jobs` is created the first time a city's market is looked at. Nothing is
re-paid: payroll is guarded by `paidYear`. When a life passes to an heir, `careerRecord` gains the parent's
working life and the employers carry over (`passOn` in `js/engine/careerRecord.js`, called from
`js/engine/legacy.js`). Licenses are never inherited.

## Owning a business

`js/data/business.js` (32 kinds) and `js/engine/business.js`. A business is a company, not a job: it has its own
account, borrowing, premises (`sites`), reputation and quality, and the player owns a share of it (`stake`).
It is also an employer on the map (`owned: true`), so the people who work there have a real place of work; the
yearly employer tick leaves it alone and it never advertises on the job board.

- **Starting** needs the money (or part of it borrowed by the business), age 18, and for some kinds a trade,
  a license, a degree or years in the work. A freelancer with a strong name in the same line starts cheaper,
  with their clients. A contract that forbids outside work forbids this too; so does high office, and the crown.
- **The year** (`tickBusinesses`, before payroll): capacity comes from the staff (their skill, loyalty and
  time there), the owner's hours and skill, and whether anyone is steering (a manager, or the owner). Custom
  comes from reputation, price, the economy, marketing and luck. Wages, rent, supplies, overheads and interest
  come first. The owner is paid from profit (`draw`), through payroll, once, taxed as income; partners get
  their share. Reputation moves slowly toward what the place deserves.
- **Failure**: two years in a row overdrawn and it closes. Half of any debts it cannot cover fall on the owner.
  Its record stays.
- **Staff** are NPCs with lives of their own; they leave for better pay, if the place is struggling, or because
  life moves them on. Friends and family can be offered jobs. A manager is needed to step back, or to open a
  second site.
- **Ending it**: sell (a buyer must be found; the staff stay on under the new owner), close, hand it to a
  grown child in life, or name an heir. On the owner's death the named heir (or a child, if nobody was named)
  owns it: they inherit the ownership, not the manager's chair. Abroad, a business with a manager carries on and
  pays out across the border; one without is wound up.

### Tax on business profit

Each country taxes business profit at its own rate (`PROFIT_TAX` in `js/data/business.js`, gameplay
configuration, unverified), with a lower rate on the first slice of profit where the country has one. Losses
are carried forward (`lossCarry`) and set against later profit. The tax comes out of the business's account
before the owners take anything; what they take is then taxed as their income. A sole trader (working alone,
no partners) pays no profit tax: their profit is their income, taxed once.

## Two careers, one household

`js/engine/couple.js`. A spouse has a working life of their own, with an employer. The household plan,
agreed between the two of them in the hub's Household section, says:

- **whose career comes first** (`balanced`, `mine`, `theirs`): it tilts both partners' chances of promotion,
  and how fair the spouse finds it, year by year. Giving way is always agreed; asking them to give way can be
  refused, more often when their own career is going somewhere.
- **who looks after children under 12** (`shared`, `me`, `them`, `paid`): childcare takes real hours from the
  player's week (and so from the time budget every commitment is checked against), or money every year if it is
  paid for. A spouse who takes most of it goes part-time, on part-time pay, until the children are older.

Moving city for the player's own job usually costs the spouse theirs (unless it can be done from anywhere, or
their employer has somewhere to put them), and it is felt more if their career was meant to come first.
Scenes come from the state of the household: a spouse losing their job, both stretched too thin with small
children, a spouse wanting to retrain (two years at college, then a new field), and a spouse offered a bigger job
while the children are small.

## Scenes of working life

`js/data/events/career.js`, with their effects in `js/engine/workEvents.js` (the `work` effect type):

- **Work and home**: a school show against a deadline, going part-time for childcare, a promotion in another
  city when a spouse's work is here, an argument about what all the work is for, a trip over an anniversary.
- **The life of a workplace**: a new manager, the company being bought, a bonus, a project canceled, a
  colleague's retirement, a secondment.
- **By field**: health, education, technology, hospitality, trades, retail, government, science, transport,
  public safety, media, law, the land, business and sport each have their own. There are deliberately none for
  acting, music or other entertainment careers: productions, tours and releases are left for their own system.
- **Owning a business**: a cash-in-hand offer, a struggling member of staff, a big customer who wants more.
- **A relationship at work** uses the ordinary romance system. Someone who reports to the player cannot be
  asked out. A relationship with a colleague is noticed sooner or later (`work_romance_noticed`); one where one
  partner has a say over the other's work is raised as a conflict (`work_romance_conflict`) until one of them
  moves.
- **A child's curiosity** (`kid_asks_work`): taking them to work can inspire them (`flags.inspiredBy`);
  telling them to find their own way means they are never steered (`flags.ownPath`). Children lean toward a
  parent's field where they qualify, and are never made to follow it (`npcLives.careersFor`).

## Royals at work

The monarch and the heir serve the crown and, at most, the armed forces, and do not go into trade. Other members
of the royal family may hold a profession (a princess who trained as a doctor is a doctor), except inside the
government they must stand apart from. A royal with a profession of their own is thought the better of
(`royalWorkBlock` in `js/engine/career.js`).

## What is not here yet

- **Entertainment careers with their own gameplay** (productions, tours, albums, contracts between projects,
  awards). Actors, singers, dancers and models get in by audition and climb a ladder; the rest is left for a
  separate fame system.
- **Criminal careers** (organized crime, dealing, street hustling) are not employment and are not in the
  catalog: they belong to the crime system (`js/engine/justice.js`), with its own consequences.
- **Elected office** is not a job posting: it goes through the elections and politics systems. Holding high
  office rules out other paid work.
- **Royal household staff** as an employer is not modeled.
- **Pass-through and dividend rules**: an owner's draw is taxed as ordinary income everywhere; countries'
  special treatment of dividends or small-business income is not modeled.

## Balance

Two simulations in `scripts/balance/` play many lives quickly and print the shape of the results. They are not
pass/fail tests; re-run them after changing pay, hiring or business figures.

```bash
node scripts/balance/careers.mjs 17 32 typical   # whole working lives, a player who takes any job they qualify for
node scripts/balance/careers.mjs 17 32 best      # the same, always going for the best-paid job
node scripts/balance/business.mjs 23 12          # every kind of business over fifteen years, competent full-time owner
```

What they showed after tuning (and what the tuning was):

| Measure | Result | Changed to get there |
|---|---|---|
| Pay, typical player, ages 25–64 | median 1.15× the national average; bottom tenth 0.7×, top tenth 2.1× | Senior posts need most of the usual years in that line of work itself; related fields count a quarter, not half |
| Pay, ambitious player | median about 2.4× | Raises stop 10% above the employer's band (was 25%); every rung up has more competition |
| Graduates against non-graduates | about 30% more | Office, technical and public employers prefer a degree where it is not required, more so higher up |
| Employed, ages 25–64 | about 95% of years for a player who keeps applying; about one layoff a life | — |
| Business failure in fifteen years | restaurants, shops and boutiques 40–50%; cafés, bakeries, garages 15–35%; low-overhead practices rarely | Rivals open where a business does well and take a share of custom; rare serious setbacks (a fire, a lawsuit, a lost client) |
| Owner's take | 1–3× a staff wage a year | Medical, dental and veterinary practices earned too much, and were cut; bookshops could not survive, and were helped |

## Source audit

The three BitLife wiki pages named in the brief (Careers, Careers/Jobs, Careers/Occupation) and Career
Collections could **not be read**: the session's network policy refused the connection to
`bitlife-life-simulator.fandom.com`. This audit therefore compares the catalog against the occupations the
specification itself lists (its Parts 1–3 and section 3), which it describes as drawn from those pages. It is
not an exhaustive extraction from the wiki. Allowing that host and re-running the audit would close the gap.

Of 369 distinct occupations named in the specification, 362 have a home in the catalog (a rung, an alias or a
local title of a track, a part-time job, or a freelance service). The other seven are covered elsewhere on
purpose:

| Named | Why it is not a catalog job |
|---|---|
| Apprentice electrician, plumber, carpenter, mechanic | An apprenticeship is part of the Education system (`apprenticeship` and `technical` programs); finishing one opens the qualified rung of the trade track |
| Professional dog walker, Pet sitter | Freelance services (`dog_walking`, `pet_sitting`) and one-off gigs |
| Politician | Elected office goes through the politics and elections systems |

Intentionally excluded: mafia, dealer and street hustler (crime system, not employment, as above). Reference-game
salaries and promotion tables were not copied; every pay band and ladder here was written for Pathways.

### Every named occupation, and where it lives

| Named in the specification | Where it lives in Pathways |
|---|---|
| Receptionist | `office (alias)` |
| Administrative assistant | `admin_support (rung 2)` |
| Secretary | `office (alias)` |
| Executive assistant | `admin_support (rung 3)` |
| Office manager | `office (rung 3)` |
| Accountant | `accountant (rung 2)` |
| Auditor | `audit (rung 2)` |
| Financial analyst | `fin_analysis (rung 1)` |
| Banker | `fin_advice (alias)` |
| Financial advisor | `fin_advice (alias)` |
| Recruiter | `recruitment (alias)` |
| Human resources specialist | `hr (alias)` |
| Marketing specialist | `marketing (alias)` |
| Business analyst | `corporate (rung 1)` |
| Consultant | `consulting (rung 2)` |
| Operations manager | `corporate (rung 3)` |
| Director | `corporate (rung 4)` |
| Vice president | `banker (rung 3)` |
| Managing director | `banker (rung 4)` |
| Corporate president | `corporate (alias)` |
| IT technician | `it (alias)` |
| Programmer | `software (alias)` |
| Software developer | `software (alias)` |
| Software engineer | `software (alias)` |
| Database administrator | `dba (rung 2)` |
| Cybersecurity analyst | `banker (rung 1) as "analyst"` |
| Data scientist | `data (rung 2)` |
| Game developer | `gamedev (rung 2)` |
| Systems engineer | `engineer (alias)` |
| Civil engineer | `civil_eng (rung 2)` |
| Mechanical engineer | `mech_eng (rung 2)` |
| Electrical engineer | `elec_eng (rung 2)` |
| Engineering manager | `eng_mgmt (rung 1)` |
| Engineering director | `corporate (rung 4) as "director"` |
| Nursing assistant | `care_assist (rung 1)` |
| Nurse | `nurse (rung 1) as "staff nurse"` |
| Advanced practice nurse | `adv_nurse (alias)` |
| Midwife | `midwife (rung 1)` |
| Pharmacist | `pharmacist (rung 1)` |
| Physician | `doctor (rung 2)` |
| Surgeon | `surgery (rung 2)` |
| Psychiatrist | `psychiatry (rung 2)` |
| Dentist | `dentist (rung 2)` |
| Dental hygienist | `dental_hyg (rung 1)` |
| Veterinarian | `vet (alias)` |
| Physical therapist | `physio (alias)` |
| Occupational therapist | `ot (rung 1)` |
| Hospital administrator | `office (rung 2) as "administrator"` |
| Legal assistant | `paralegal (rung 1)` |
| Paralegal | `paralegal (rung 2)` |
| Attorney | `lawyer (alias)` |
| Prosecutor | `prosecutor (rung 2)` |
| Public defender | `defender (rung 1)` |
| Legal counsel | `lawyer (alias)` |
| Judge | `judiciary (alias)` |
| Court clerk | `court_clerk (rung 1)` |
| Corrections officer | `corrections (rung 1)` |
| Detective | `detective (rung 1)` |
| Forensic investigator | `forensics (rung 2)` |
| Police officer | `police (rung 1)` |
| Police sergeant | `police (local title)` |
| Police chief | `police (alias)` |
| Tutor | `part-time: tutor_pt` |
| Teaching assistant | `early_years (rung 1)` |
| Preschool teacher | `early_years (rung 2)` |
| Elementary teacher | `primary (rung 2)` |
| Secondary teacher | `teacher (alias)` |
| Counselor | `counselor (alias) as "school counselor"` |
| School administrator | `school_admin (alias)` |
| Principal | `consulting (rung 4)` |
| Professor | `academic (rung 4)` |
| Research assistant | `research_asst (rung 1)` |
| Research scientist | `scientist (rung 2)` |
| Dean | `uni_admin (rung 2)` |
| University administrator | `uni_admin (alias)` |
| Dishwasher | `kitchen (alias)` |
| Busser | `front_house (rung 1)` |
| Food runner | `front_house (alias)` |
| Host | `front_house (alias)` |
| Server | `front_house (rung 2)` |
| Bartender | `bar (rung 2)` |
| Barista | `cafe (rung 1)` |
| Cook | `kitchen (alias)` |
| Apprentice chef | `fine_dining (alias)` |
| Sous chef | `kitchen (rung 3)` |
| Executive chef | `fine_dining (rung 6)` |
| Pastry chef | `pastry (rung 3)` |
| Baker | `pastry (rung 2)` |
| Sommelier | `sommelier (rung 2)` |
| Hotel receptionist | `hotel (rung 2)` |
| Concierge | `hotel (rung 3)` |
| Hotel manager | `hotel (rung 5)` |
| Travel agent | `travel (rung 2)` |
| Tour guide | `travel (rung 1)` |
| Cashier | `grocery (rung 2)` |
| Retail sales associate | `banker (rung 2) as "associate"` |
| Store supervisor | `retail (rung 2) as "supervisor"` |
| Shift manager | `retail (alias)` |
| Store manager | `retail (rung 3)` |
| Customer support representative | `contact_center (alias)` |
| Call center worker | `contact_center (alias)` |
| Telemarketer | `sales (rung 1)` |
| Stylist | `hair_stylist (rung 2)` |
| Fashion consultant | `fashion_retail (alias)` |
| Electrician | `electrician (rung 1) as "qualified electrician"` |
| Plumber | `plumber (rung 1) as "qualified plumber"` |
| Carpenter | `carpenter (rung 1) as "qualified carpenter"` |
| Welder | `welder (rung 1) as "qualified welder"` |
| Mechanic | `mechanic (rung 1) as "qualified mechanic"` |
| Painter | `painting (alias)` |
| Landscaper | `landscaping (rung 2)` |
| Construction worker | `construction (rung 1)` |
| HVAC technician | `hvac (alias)` |
| Maintenance worker | `maintenance (rung 1)` |
| Tailor | `tailoring (rung 2)` |
| Blacksmith | `smithing (rung 2)` |
| Biologist | `biology (rung 2)` |
| Marine biologist | `marine_bio (rung 2)` |
| Archaeologist | `archaeology (rung 2)` |
| Chemist | `chemistry (rung 2)` |
| Physicist | `physics (rung 2)` |
| Environmental scientist | `environment (rung 2)` |
| Laboratory technician | `lab (rung 2)` |
| Agricultural researcher | `agri_science (alias)` |
| Wildlife specialist | `wildlife (alias)` |
| Biotechnologist | `biotech (rung 2)` |
| Taxi driver | `taxi (rung 1)` |
| Ride-share driver | `taxi (alias)` |
| Truck driver | `driver (rung 2)` |
| Delivery driver | `driver (rung 1)` |
| Courier | `driver (alias)` |
| Commercial pilot | `pilot (rung 3)` |
| Flight attendant | `cabin (rung 1)` |
| Aircraft engineer | `aircraft (alias)` |
| Warehouse worker | `warehouse (alias)` |
| Supply chain coordinator | `logistics (alias)` |
| Ship crew member | `maritime (alias)` |
| Writer | `author (rung 1) as "unpublished writer"` |
| Journalist | `journalist (alias)` |
| Editor | `journalist (rung 4)` |
| Animator | `animation (rung 2)` |
| Graphic designer | `graphic (rung 2)` |
| Photographer | `photography (rung 2)` |
| Filmmaker | `production (alias)` |
| Film editor | `production (alias)` |
| Makeup artist | `bridal (rung 2) as "bridal makeup artist"` |
| Fashion designer | `fashion_design (rung 2)` |
| Voice actor | `voice (rung 2)` |
| Broadcaster | `broadcast (alias)` |
| Advertising creative | `copywriting (alias)` |
| Postal worker | `postal (alias)` |
| Firefighter | `firefighter (rung 1)` |
| Municipal employee | `municipal (alias)` |
| Emergency dispatcher | `dispatch (rung 1)` |
| Public administrator | `civil_service (alias)` |
| Social worker | `social_work (rung 2)` |
| Sanitation worker | `sanitation (rung 1)` |
| Government staff | `civil_service (alias)` |
| Farmer | `farming (alias)` |
| Agricultural worker | `farming (alias)` |
| Beekeeper | `beekeeping (rung 2)` |
| Fisherman | `fishing (alias)` |
| Deckhand | `maritime (rung 1)` |
| Fishing vessel engineer | `fishing (rung 2)` |
| Ship captain | `maritime (rung 5)` |
| Forestry worker | `forestry (rung 1)` |
| Park ranger | `ranger (rung 2)` |
| Fitness instructor | `fitness (rung 2)` |
| Personal trainer | `fitness (rung 3)` |
| Swimming instructor | `swim_teach (alias)` |
| Lifeguard | `lifeguard (rung 1)` |
| Dance instructor | `coaching (alias)` |
| Sports coach | `coaching (alias)` |
| Golf instructor | `coaching (alias)` |
| Recreation center employee | `recreation (alias)` |
| Water slide tester | `waterslide (rung 1)` |
| Mystery shopper | `part-time: mystery` |
| Pet behavior consultant | `animal_training (alias)` |
| Professional mascot | `theme_park (alias)` |
| Laboratory assistant | `lab (rung 1)` |
| Junior biologist | `biology (rung 1)` |
| Senior biologist | `biology (rung 3)` |
| Microbiologist | `microbio (rung 2)` |
| Geologist | `geology (rung 2)` |
| Meteorologist | `meteorology (rung 2)` |
| Astronomer | `astronomy (rung 2)` |
| Research director | `scientist (rung 4)` |
| University researcher | `broadcast (rung 2) as "researcher"` |
| Head server | `front_house (rung 3)` |
| Senior bartender | `bar (rung 3)` |
| Restaurant crew member | `cafe (alias)` |
| Shift supervisor | `cafe (rung 2)` |
| Restaurant manager | `front_house (rung 4)` |
| General manager | `front_house (rung 5)` |
| Line cook | `kitchen (rung 2)` |
| Short order cook | `kitchen (alias) as "cook"` |
| Chef tournant | `fine_dining (alias)` |
| Saucier | `fine_dining (alias)` |
| Junior sous chef | `fine_dining (rung 3)` |
| Chef de cuisine | `fine_dining (rung 5)` |
| Bellhop | `hotel (alias)` |
| Housekeeper | `hotel (rung 1)` |
| Event coordinator | `events (rung 2)` |
| Wedding planner | `events (rung 3)` |
| Master electrician | `electrician (rung 3)` |
| Master plumber | `plumber (rung 3)` |
| Construction supervisor | `retail (rung 2) as "supervisor"` |
| Construction manager | `construction (rung 4)` |
| Auto mechanic | `mechanic (alias)` |
| Master mechanic | `mechanic (rung 3)` |
| Roofer | `roofing (rung 2)` |
| Chimney sweep | `chimney (rung 1)` |
| Heavy equipment operator | `equipment (rung 2)` |
| Building inspector | `inspector (rung 1)` |
| General contractor | `construction (rung 5)` |
| Bus driver | `bus (rung 1)` |
| Train operator | `rail (rung 2)` |
| Railroad engineer | `rail (rung 3)` |
| Pilot trainee | `pilot (rung 1)` |
| Co-pilot | `pilot (rung 2)` |
| Chief pilot | `pilot (rung 4)` |
| Air traffic controller | `atc (rung 2)` |
| Aircraft mechanic | `aircraft (rung 1)` |
| Airport operations manager | `airport (rung 4)` |
| Ship deckhand | `maritime (alias)` |
| Deck officer | `maritime (rung 3)` |
| Logistics coordinator | `logistics (rung 1)` |
| Warehouse manager | `warehouse (rung 3)` |
| Supply chain manager | `logistics (rung 3)` |
| Mail carrier | `postal (rung 1)` |
| Security guard | `security (rung 1)` |
| Police recruit | `police (alias)` |
| Police lieutenant | `police (rung 3) as "lieutenant"` |
| Police captain | `police (alias)` |
| Probationary firefighter | `firefighter (alias)` |
| Fire equipment operator | `firefighter (alias)` |
| Fire lieutenant | `firefighter (local title)` |
| Fire captain | `firefighter (local title)` |
| Battalion chief | `firefighter (alias)` |
| Assistant fire chief | `firefighter (alias)` |
| Fire chief | `firefighter (rung 4)` |
| Emergency medical technician | `ems (rung 1)` |
| Paramedic | `ems (rung 2)` |
| Emergency management specialist | `emergency_mgmt (rung 2)` |
| Newspaper delivery worker | `part-time: paper_round` |
| Journalism intern | `journalist (alias)` |
| Junior reporter | `journalist (rung 1)` |
| Reporter | `journalist (rung 2)` |
| Investigative journalist | `journalist (alias)` |
| News anchor | `broadcast (rung 4)` |
| Radio host | `broadcast (rung 3)` |
| Podcast host | `front_house (alias) as "host"` |
| Photojournalist | `photography (rung 3)` |
| Copywriter | `copywriting (rung 2)` |
| Senior editor | `publishing (rung 3)` |
| Editor-in-chief | `journalist (rung 5)` |
| Technical writer | `tech_writing (rung 1)` |
| Novelist | `author (alias)` |
| Screenwriter | `screenwriting (rung 3)` |
| Publisher | `publishing (rung 4)` |
| Public relations specialist | `pr (alias)` |
| Communications director | `pr (rung 4)` |
| Social media manager | `social_media (rung 2)` |
| Content creator | `influencer (rung 1)` |
| Background actor | `actor (rung 1)` |
| Commercial actor | `actor (alias)` |
| Television actor | `actor (alias)` |
| Film actor | `actor (alias)` |
| Theater actor | `actor (alias)` |
| Musical theater performer | `mt_performer (alias)` |
| Stunt performer | `stunts (rung 2)` |
| Casting assistant | `casting (rung 1)` |
| Casting director | `casting (rung 3)` |
| Film director | `directing (alias)` |
| Producer | `production (rung 4)` |
| Camera operator | `production (rung 2)` |
| Video editor | `production (rung 3)` |
| Hair stylist | `hair_stylist (rung 2) as "stylist"` |
| Costume designer | `fashion_design (alias)` |
| Dancer | `dance (alias)` |
| Choreographer | `dance (rung 4)` |
| Singer | `singer (rung 1) as "pub singer"` |
| Background vocalist | `music_prod (alias)` |
| Musician | `orchestra (alias)` |
| Composer | `music_prod (alias)` |
| Music producer | `music_prod (rung 3)` |
| Disk jockey | `music_prod (alias)` |
| Orchestra musician | `orchestra (alias)` |
| Orchestra conductor | `orchestra (alias)` |
| Model | `modeling (alias)` |
| Talent agent | `talent_agency (rung 2)` |
| Entertainment manager | `talent_agency (alias)` |
| Grocery bagger | `grocery (rung 1)` |
| Retail associate | `banker (rung 2) as "associate"` |
| Boutique associate | `fashion_retail (rung 1)` |
| Sales associate | `sales (rung 2)` |
| Customer service representative | `contact_center (rung 2)` |
| Call center agent | `contact_center (rung 1)` |
| Assistant store manager | `grocery (rung 4)` |
| District manager | `retail (alias)` |
| Regional retail manager | `retail (alias)` |
| Visual merchandiser | `fashion_retail (rung 3)` |
| Inventory specialist | `inventory (rung 2)` |
| Personal shopper | `fashion_retail (rung 2)` |
| Farmhand | `farming (rung 1)` |
| Ranch worker | `ranching (rung 2)` |
| Ranch manager | `ranching (rung 3)` |
| Agricultural technician | `agri_science (rung 1)` |
| Agricultural scientist | `agri_science (rung 2)` |
| Fisher | `fishing (alias)` |
| Fishing deckhand | `fishing (rung 1)` |
| Fishing captain | `fishing (rung 4)` |
| Forester | `forestry (rung 3)` |
| Lumberjack | `forestry (rung 2)` |
| Conservation officer | `ranger (rung 3)` |
| Wildlife biologist | `wildlife (rung 2)` |
| Animal caretaker | `animal_care (rung 1)` |
| Veterinary assistant | `animal_care (rung 2)` |
| Animal trainer | `animal_training (rung 2)` |
| Animal behavior consultant | `animal_training (alias)` |
| Zookeeper | `animal_care (rung 3)` |
| Marine conservation specialist | `marine_bio (alias)` |
| Government clerk | `civil_service (rung 1)` |
| Administrative officer | `civil_service (rung 2)` |
| Public policy analyst | `policy (alias)` |
| Legislative assistant | `policy (alias)` |
| Diplomatic assistant | `diplomacy (rung 1)` |
| Diplomat | `diplomacy (rung 3)` |
| Foreign service officer | `diplomacy (rung 2)` |
| Civil service manager | `civil_service (rung 4)` |
| Urban planner | `planning (rung 2)` |
| Municipal administrator | `municipal (rung 3)` |
| Tax officer | `tax (rung 1)` |
| Government inspector | `tax (alias)` |
| Intelligence analyst | `intelligence (rung 1)` |
| Government department director | `corporate (rung 4) as "director"` |
| Business intern | `corporate (alias)` |
| Project coordinator | `project_mgmt (rung 1)` |
| Project manager | `project_mgmt (rung 2)` |
| Department manager | `corporate (alias)` |
| Senior vice president | `corporate (rung 6)` |
| Executive vice president | `corporate (rung 7)` |
| Chief financial officer | `fin_analysis (rung 4)` |
| Chief operating officer | `corporate (alias)` |
| Chief technology officer | `eng_mgmt (rung 4)` |
| Chief executive officer | `corporate (rung 8)` |
| Board member | `board (rung 2)` |
| Roadkill removal worker | `highways (alias)` |
| Cat behavior consultant | `animal_training (alias)` |
| Private investigator | `pi (rung 2)` |
| Mall Santa | `seasonal_santa (rung 1)` |
| Arcade attendant | `theme_park (alias)` |
| Theme park attendant | `theme_park (rung 1)` |
| Video game tester | `qa (rung 1)` |
| Golf course attendant | `golf_course (rung 1)` |
| Pool cleaner | `golf_course (alias)` |
| Sign holder | `highways (alias)` |
| Funeral director | `funeral (rung 3)` |
| Mortician | `funeral (rung 2)` |
| Professional organizer | `organizing (alias)` |
| Astronaut | `astronaut (rung 2)` |
| Athlete | `athlete (alias)` |
