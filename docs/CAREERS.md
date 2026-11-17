# Careers, jobs and working life

How work is modelled in Pathways: what an occupation, an employer, a job and a contract are; how people get
hired, paid, promoted and laid off; who they work with; how work fits around the rest of a life; and what the
family remembers of it afterwards.

Everything here is gameplay configuration. Pay bands, working-time law, benefits and rank names are simplified,
unverified, and scaled by each country's wages (`localWage`) and each city's pay (`payK`). They are not real
salaries or legal advice.

## The pieces

| Concept | What it is | Where |
|---|---|---|
| Career family | A field of work (19 of them: business, tech, health, law, education, hospitality, retail, trades, science, transport, public safety, media, entertainment, beauty, government, land and animals, sport, unusual work, military) | `js/data/occupations.js` `FAMILIES` |
| Career track | A ladder of titles that belong together (Junior developer → … → App founder). 193 tracks, 714 titles | `js/data/careers.js` (the original 44) + `js/data/occupations.js` `TRACKS` |
| Occupation | One title on a track; aliases are other names for the same work | each track's `levels` and `aliases` |
| Employer | A persistent organisation in a city: name, size, culture, finances, staff, history | `js/engine/employers.js` |
| Job posting | A real opening at an employer for a rung of a track, with pay, hours and an expiry | `state.jobs.postings` |
| Offer | What an employer proposes after an interview; negotiable | `p.career.offers`, `js/engine/hiring.js` |
| Contract | The job held: employer, title, level, salary, hours, overtime, remote, leave | `p.career` |
| Side job | Part-time work beside (or instead of) a main job | `p.career.partTime`, `p.career.sides`, `js/engine/sideJobs.js` |
| Freelance practice | Services, prices, reputation, clients, contracts | `p.career.freelance`, `js/engine/freelance.js` |
| Workplace | The boss, coworkers, direct reports and mentors: ordinary NPCs with working lives of their own | `js/engine/workplace.js` |
| Recruiter | An NPC who brings real openings to someone with a record | `js/engine/recruiters.js` |
| Record | Every job with its employer and dates; experience by track; milestones; the family's careers | `js/engine/careerRecord.js` |

The career engine itself (`js/engine/career.js`) is the one that was already there: requirements, interviews and
auditions, the yearly review, raises, promotions, firing, gigs, fame, retirement. The new modules plug into it,
so old and new tracks behave alike, and NPC working lives (`js/engine/npcLives.js`) draw from the same catalog.

## Adding work

A new track is one entry in `TRACKS` (`js/data/occupations.js`). Nothing else changes. Its fields are described at
the top of that file; the ones from the original engine are described at the top of `js/data/careers.js`.
`node tests/careers.mjs` checks that every requirement, branch, rank list, certificate and family names
something real.

- **Requirements** are occupation-specific: a degree in particular majors, a programme (medical, law, nursing…),
  a trade apprenticeship, a certificate (`altCert`; `altOnly` when it is the only way in), years of experience in
  named tracks (`experience`), age, fitness, a clean record. University is never required by default.
- **Branches** (`from`) let someone move across from a rung of one track into another at the same employer:
  senior developer → engineering management or the staff-engineer track; teacher → school leadership; police
  officer → detective. `branchOnly` tracks are reached that way, or by `experience`, never hired into cold.
  Licences still apply: a nurse cannot branch into surgery.
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
8. Recruiters and old mentors bring leads (`tickRecruiters`).
9. Milestones are checked (`checkAchievements`).

Payroll runs afterwards in `tickFinance`, through `runPayroll` (`js/engine/worklife.js`): every source (main job,
part-time jobs, finished freelance contracts, pension, unemployment benefit) is listed, paid once per year
(`paidYear`), taxed once, and kept as last year's payslip. Hourly work is paid by the hours worked, overtime at
time and a half; commission and tips vary with performance and charm; failed freelance work pays a part at most.
A job lost during the review is not paid for the following year.

Actions during a year are keyed to the year of age (as the rest of the game does). The tick and payroll look
back at `age − 1`, the year just lived.

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
`js/engine/legacy.js`). Licences are never inherited.

## What is not here yet

- **Business ownership** as a company the player owns, with payroll and staff of their own. "Owner" and
  "contractor" rungs exist at the top of some tracks and count as running a business for the milestones, but
  there is no separate company ledger. Freelancers cannot yet hire.
- **Workplace romance** uses the existing romance system as it stands; there are no workplace-specific power
  and policy rules yet.
- **Spouses' career events** (a spouse's overseas offer, negotiating childcare between two careers) use the
  existing family and NPC-life events; there is no dedicated two-career negotiation.
- **Criminal careers** (organised crime, dealing, street hustling) are not employment and are not in the
  catalog: they belong to the crime system (`js/engine/justice.js`), with its own consequences.
- **Elected office** is not a job posting: it goes through the elections and politics systems. Holding high
  office rules out other paid work.
- **Royal household staff** as an employer is not modelled; royals in line may take military service only, as
  before.

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
| Apprentice electrician, plumber, carpenter, mechanic | An apprenticeship is part of the Education system (`apprenticeship` and `technical` programmes); finishing one opens the qualified rung of the trade track |
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
| Counselor | `counsellor (alias) as "school counselor"` |
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
| Customer support representative | `contact_centre (alias)` |
| Call center worker | `contact_centre (alias)` |
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
| Model | `modelling (alias)` |
| Talent agent | `talent_agency (rung 2)` |
| Entertainment manager | `talent_agency (alias)` |
| Grocery bagger | `grocery (rung 1)` |
| Retail associate | `banker (rung 2) as "associate"` |
| Boutique associate | `fashion_retail (rung 1)` |
| Sales associate | `sales (rung 2)` |
| Customer service representative | `contact_centre (rung 2)` |
| Call center agent | `contact_centre (rung 1)` |
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
