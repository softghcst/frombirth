# Contraception, reproductive health and family planning

How birth control works in Pathways, where its numbers come from, and what has not been reviewed. Pathways is a
game. Nothing in it is medical advice. The screens never tell a player how to use, start or stop a real method.

## Clinical review status

**No clinician has reviewed this content.** On 2026-11-26 the figures were checked against the live CDC
(contraception overview, Selected Practice Recommendations), NHS (method pages) and FDA (birth control) pages. Each
source in `js/data/health/contraception.js` records what it confirmed. That check changed three things: the cervical
cap's typical-use rate (22%, CDC), the implant's duration in the UK (5 years, NHS), and how often a vasectomy is
confirmed at the first test (80% by 12 weeks, CDC). The US MEC, ACOG and Office on Women's Health pages were not
read that day and stay unverified. Where the sources differ (fertility awareness: CDC 2–23%, NHS 24% typical use),
the game uses the CDC figure and says so.

## Sources

- CDC, Contraception: https://www.cdc.gov/contraception/about/ (effectiveness chart; United States)
- CDC, US Medical Eligibility Criteria for Contraceptive Use (2024): https://www.cdc.gov/contraception/hcp/usmec/
- CDC, US Selected Practice Recommendations (2024): https://www.cdc.gov/contraception/hcp/usspr/
- ACOG, Birth control FAQs: https://www.acog.org/womens-health/faqs/birth-control
- NHS, Contraception guide: https://www.nhs.uk/contraception/ (United Kingdom)
- US Office on Women's Health: https://womenshealth.gov/a-z-topics/birth-control-methods

## Files

| File | What it holds |
| --- | --- |
| `js/data/health/contraception.js` | the method registry (21 methods), emergency options, side-effect profiles, provider scope, country profiles, life stages, sources |
| `js/engine/health/contraception.js` | the record, the monthly clock, effectiveness and risk, eligibility, providers, money, starting, switching, removal, permanent methods, emergency contraception, postpartum care, scenes |
| `js/ui/health/contraception.js` | My Health → Reproductive health, and the Birth Control & Family Planning page (nine sections) |
| `js/data/events/repro.js` | the scenes, all queued by the engine from saved facts |
| `tests/contraception.mjs` | the engine checks, including the Part 41 vertical slice and the 3/6/12-month equivalence |
| `tests/contraception-ui.mjs` | the browser check at phone and desktop widths |
| `js/data/medicineCases.js` (`contra_*`) | the physician's side: nine patient cases (counseling with a migraine history, IUD placement and its follow-up, implant removal, emergency contraception, sterilization, postpartum, a confidential teen visit, vasectomy) |
| `tests/obgyn-contraception.mjs` | privileges, referral, the cases played, judgment |

## The physician's side

A player in the medical career sees contraception patients among the year's cases (OB-GYN, family medicine, and for
some cases urology, emergency medicine and pediatrics). Procedures are privileges by specialty
(`js/data/medicine.js`): OB-GYNs place IUDs and implants and perform tubal sterilization; family physicians place
implants and refer IUDs; urologists perform vasectomies. A plan needing a procedure the physician does not hold
becomes a referral. The cases reward the history that changes the choice, laying out every suitable option without
pushing one, consent, and pausing when the patient asks. Deferring to a partner's or a parent's wishes over the
patient's own decision is always marked poor or unsafe practice, and costs integrity. The player's own care is never
their own: the health screen lists what they may provide for patients, read from the same privileges.

## How it fits the existing game

- **Pregnancy remains the existing resolvers' job.** `engine/children.js surpriseChance` (a couple living together,
  rolled once a year), `engine/bonds.js maybeConceive` and `engine/romance.js hookUp` (a night together), and the
  teen story in `engine/loveStories.js` (which honors a specific method, not the unspecified default) still decide. They now ask the
  contraception engine for a relative risk. The contraception engine never starts a pregnancy itself. The one
  exception is settling an emergency-contraception decision, and it settles that exposure's own roll, which was
  already drawn. It never creates a second pregnancy.
- **Time.** Months on the World Clock (`state.year × 12 + state.month`). Refills, renewals, injections, device expiry
  and side effects are processed month by month, in order, by 3- and 6-month turns (`engine/turns.js`) and at the
  turn of the year (`engine/yearProcessor.js`). No game dice are used there.
- **Risk.** A method's first-year failure percentage becomes a relative risk against no method (85%). The resolver's
  yearly chance P0 is combined month by month: P = 1 − Π(1 − P0·rr)^(1/12). A whole year on one method gives exactly
  P0·rr. A full year's failure rate is never applied per turn. Two methods together use partial dependence
  (`combine`, DEPENDENCE = 0.3), between naive multiplication and the better method alone.
- **Equivalence.** The yearly couple roll is keyed to the life and the year (`yearRoll`). It still spends one game
  die so other systems' sequences do not shift. Four 3-month turns, two 6-month turns and one 12-month turn give the
  same pregnancies for the same exposure history. Other systems' dice already drift apart between turn lengths
  (checked against the code before this change). That is outside this feature.
- **Health Engine reuse.** Clinics and clinicians (`care.js`, with two new facilities and six new professions),
  attended appointments, `charge()` and insurance claims (with a new `covered` option for no-cost-sharing rules).
  The record lives at `p.health.contraception`.
- **Older saves.** A life saved before this change keeps its unspecified "birth control" (`legacyDefault`) with the
  same small yearly chance as before, until the player chooses. If the old switch was off, the life has no method.
  No record is invented.

## Game approximations (labeled as such)

- Per-person adherence (`adherence`, decided once) moves daily-use methods between perfect and typical use. A
  progestin-only pill's missed-dose window scales this: 3 hours is less forgiving than 24.
- After its configured duration, a device is no longer counted as protecting. It stays in place (and on record) until
  replaced or removed.
- The menstrual picture is an approximate baseline plus a method's bleeding pattern. The game has no day-by-day cycle.
- Menopause age is drawn once per person (median 51, varying widely). After it, the pregnancy risk is zero.
- Emergency contraception "residual" shares are approximations of published ranges (copper IUD far the most
  effective, ulipristal more than levonorgestrel).
- Country profiles cover a few documented milestones (US, UK, Japan, Ireland, France, Germany, Canada, Australia).
  Every other country uses the default profile: methods appear in their first year, and young people's access
  "varies". No exact historical approval date was invented for countries without one here.

## Not modeled

Lactational amenorrhea as a method, withdrawal, the contraceptive sponge, enzyme-inducing medicines (none in the
medication catalog), smoking, a history of blood clots, specific cancer types (the catalog has one "cancer"), and a
day-by-day menstrual cycle. An NPC partner's own contraception is not tracked. A player whose partner could become
pregnant can use external condoms, vasectomy and family planning.
