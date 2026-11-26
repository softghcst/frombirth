# Health, mental health, disability and accessibility

How the health engine is built, where its content comes from, and what has
not been reviewed. Pathways is a game. Nothing in it is medical advice, and it
never shows doses or tells a player how to take, combine or stop a medicine.

## Clinical review status

**No clinician has reviewed this content yet.** It was compiled from the public
guidance listed below and is written to stay inside what that guidance says. It
should be reviewed by qualified clinicians, against the guidance that applies in
each country, before anyone describes it as clinically accurate. Until then:

- the condition catalog, the rule registry and the medication catalog are
  presented in-game as a simulation, not as facts about real treatment;
- every number in the data files is **game tuning**, chosen to sit near the
  broad published picture, and labeled as such in the files themselves;
- nothing is generated freely: conditions, medicines, therapies and the rules
  joining them are fixed, curated data (`js/data/health/`) that a reviewer can
  read line by line.

## Sources

Conditions and their care:
NICE guidance NG222 (depression), CG78 (borderline personality disorder),
CG185 (bipolar disorder), NG87 (ADHD), CG113 (generalized anxiety and panic),
CG159 (social anxiety), CG31 (OCD), NG116 (PTSD), NG69 (eating disorders),
CG178 (psychosis and schizophrenia), CG128/CG142 (autism), NG217 (epilepsy),
NG62 (cerebral palsy), NG134 (depression in children);
NIMH health topics for each mental health condition;
NHS condition pages (dyslexia, dyscalculia, phobias, agoraphobia, Tourette's,
migraine, hearing loss, counseling, peer support);
WHO fact sheets (autism, epilepsy, deafness and hearing loss, blindness and
vision impairment, spinal cord injury, rehabilitation) and ICD-11.

Medicines: MedlinePlus drug information for each medicine (side-effect
categories and how common they are); FDA, EMA and MHRA approval histories for
the years each became available; the STAR*D trial (Rush et al., 2006) as the
broad orientation for how often a first antidepressant leads to remission.

DBT: Linehan, *Cognitive-Behavioral Treatment of Borderline Personality
Disorder* (1993) and *DBT Skills Training Manual* (2nd ed., 2015) for the four
modules, their skills, and the standard cycle of a skills group.

Disability and accessibility: the WHO International Classification of
Functioning, Disability and Health (ICF), which separates a person's condition,
their activities, their participation and the barriers in their surroundings;
the UN Convention on the Rights of Persons with Disabilities; national
disability laws for the years from which reasonable adjustments were required
(`ACCESS_LAW` in `js/data/health/supports.js`).

Heredity: MedlinePlus Genetics for each single-gene condition's inheritance
pattern and rough frequency; Faraone & Larsson (2019) and Sandin et al. (2017)
for twin-study heritability of ADHD and autism. Heritability is used only to
shape how much conditions cluster in simulated families, never as anyone's
chance of having a condition.

## How it is built

| File | What it holds |
| --- | --- |
| `js/data/health/conditions.js` | 39 conditions, each with its names over time, onset, inherited factor, experiences, who can diagnose it and what care is usual |
| `js/data/health/symptoms.js` | experiences, each listing the several things it can come from |
| `js/data/health/medications.js` | 20 medicines by generic name, what each may be used for, from when, by whom, side-effect categories and monitoring |
| `js/data/health/therapies.js` | 35 therapies, groups, allied-health services and support groups, kept apart by kind |
| `js/data/health/providers.js` | professions and their scope; kinds of clinic and when they existed |
| `js/data/health/supports.js` | support needs, equipment, accommodations, home adaptations, disability law by country |
| `js/data/health/genetics.js` | shared inherited factors and single-gene variants |
| `js/engine/health/record.js` | the health record: conditions apart from diagnoses; migration of older saves |
| `js/engine/health/care.js` | clinics and clinicians (ordinary NPCs, kept for life), appointments, assessment, diagnosis and revision, the care plan |
| `js/engine/health/rules.js` | the rule registry every prescription and referral passes through |
| `js/engine/health/meds.js` | medication trials, follow-ups, proposals, adjustment, supervised switching and stopping |
| `js/engine/health/therapy.js` | therapy courses, standing groups, sessions, DBT skills, setbacks |
| `js/engine/health/course.js` | onset, episodes, remission and recurrence; experiences; day-to-day functioning |
| `js/engine/health/access.js` | needs, equipment, accommodations, home, and the barriers they remove |
| `js/engine/health/heredity.js` | genomes, inheritance, predisposition, what a person is born with |
| `js/engine/health/story.js` | private milestones, telling people, other people's health, family medical history, event hooks |
| `js/engine/health/index.js` | the weekly care tick, the yearly tick, health at birth and for an heir |
| `js/ui/health/hub.js` | My Health, the Treatment Journey and the DBT Journey |
| `js/data/events/health.js` | scenes driven by the health record |
| `tests/health.mjs` | the checks, including both required vertical slices |
| `js/engine/health/contraception.js` | contraception and family planning: see docs/CONTRACEPTION.md |

### The care calendar

The rest of Pathways moves a year at a time. Health care moves a week at a
time inside the year: a medicine is reviewed after a few weeks, and a skills
group meets every week. A date is an absolute week (`year × 52 + week`).
"Let the weeks pass" in My Health moves the calendar on to the next
appointment, within the current year; "Age up" runs whatever weeks
are left before the year turns. Each week runs in a fixed order (see
`engine/health/index.js`), so a medicine cannot help before it starts, a change
cannot come before a review, and a prescription that has ended is never
charged again.

### Truth and diagnosis

A condition can be present and unrecognized for years. Symptoms are
experiences with several possible explanations; an assessment weighs how long
things have gone on, what else could explain them and whether the clinician may
diagnose that condition, and can end in a diagnosis, a referral, a review, or
nothing at all. Diagnoses can be uncertain, revised (the old one is kept,
marked revised) or second-guessed by a second opinion. Bipolar disorder seen
only during a low episode is diagnosed as depression and revised after a high
episode, which is how it often goes in life.

### Medication

Every prescription passes the rule registry: diagnosed condition, a use listed
for that medicine, available in this year and country, the right age, a
prescriber whose profession may prescribe that kind of medicine, nothing it is
avoided with, no second antidepressant on top, and in bipolar disorder no
antidepressant without a mood stabilizer. No medicine is listed as treating BPD.

How a medicine works for a person (how much it helps, how soon, which side
effects, whether its effect fades later) is decided when the trial starts from
the person, the medicine and the condition, so it never changes on reload, and
two people on the same medicine fare differently. Benefit builds over weeks.
Follow-ups classify the response only from what has been observed (early,
improving, partial, adequate, insufficient, poorly tolerated) and the clinician
proposes options; the player chooses, or lets the clinician's recommendation
stand if they have asked for that. Changes are adjustments, supervised switches
(the old medicine reduced over two weeks while the new one starts) or gradual
reductions; stopping at once is never offered, and coming off some medicines
can bring a few unsettled weeks. Every trial stays in the record.

### Therapy and DBT

Clinicians are NPCs who stay with the player: they age, move clinics, retire and
hand over, with the history kept. Groups are standing groups at a clinic with
the same facilitators and members, running their own cycle. Individual DBT and
the DBT skills group are separate courses. Progress comes from sessions attended
and skills practiced; a hard week is a setback, never a loss of skills; no
number of sessions cures anything. Skills open choices in everyday scenes (a
disagreement with a partner offers a "say what you need" response to someone who
has practiced it) without deciding how they go. Session notes refer only to
things that happened in the life.

### Disability and accessibility

Needs, equipment, accommodations and the accessibility of home are separate from
conditions. A need can be recorded without a diagnosis. Asking for an
accommodation shares the need, never the diagnosis. Barriers cost marks at
school or performance at work; accommodations remove that cost; nothing changes
intelligence. A person can decline equipment (hearing aids, a cochlear implant, a
prosthesis) and that preference is respected, not counted as an unmet need.

### Heredity

Polygenic predisposition is inherited as the parents' average plus a fresh
half; it scales the likelihood of later-onset conditions (normalized so the
population average is unchanged) and decides, with the rest of the liability,
which neurodevelopmental conditions a person is born with. Single-gene
conditions follow dominant, recessive, X-linked and mitochondrial patterns, with
rare new variants. Genes follow biological parents only. A parent's diagnosis is
never copied to a child, and predisposition never creates a diagnosis.

### Health in everyday play

A dot on the Self tab shows when care needs the player (a decision waiting, or
an appointment this week), and after each year a waiting decision is put in
front of the player with a link to My Health. Scenes follow the health record
and only fire when they fit: seeking help for low mood or worry; school and
university assessments; telling a partner about a diagnosis (or not); getting
back on track after recovery; making sense of an ADHD diagnosis; a child of the
player's beginning to show a difference present from birth, noticed and (if the
parent chooses) assessed, with the result recorded on the child; supporting a
partner through their own hard stretch without becoming their therapist; an
inaccessible venue; a loud party for someone with sensory needs; a meeting with
no interpreter, where asking is a real accommodation request; a disagreement
where practiced DBT skills open new responses; and a support-focused scene for
hard stretches.

### Privacy

Diagnoses, therapy, medication and care plans are private. The player can tell
one person at a time, or include a condition (only the fact of it) in the family
medical history. Health milestones are private in the Life Story and left out of
the obituary and the title screen. An heir sees family history, never notes,
sessions or prescriptions. Group members carry no record of why they were there.

### Older saves

A legacy "depression" or "anxiety" becomes a recorded condition with a
diagnosis marked as carried over, with no clinician, assessment, therapy or
medication history invented. Dyslexia used to cost six points of intellect; the
points are given back once.

### Long-term physical conditions

Asthma, high blood pressure, type 2 diabetes, coronary heart disease, cancer
and chronic back pain have moved from the older yearly illness list into the
health record. They begin by age-related likelihood (shaped by inheritance where
relevant), are found at an assessment, in hospital, by a scene where a doctor
finds them, or at a check-up (blood pressure and blood sugar on routine tests;
from fifty, some cancers on screening, as a referral to an oncologist). They
are treated with medicines through the same trials, reviews and rule registry as
everything else (salbutamol and beclometasone, metformin, amlodipine, ramipril,
atorvastatin), and with cardiac rehabilitation, a diabetes education course,
physiotherapy or a pain program. Each year an untreated condition costs
physical health in proportion to how much it is affecting the person. Cancer
grows until it is treated, is staged when it is found, and a course of
treatment (usually with surgery first) ends in remission or not, likelier the
earlier it was found. Older saves keep the benefit of treatment they already
had until a care plan replaces it. Short illnesses and injuries (flu, a broken
arm) stay in the older list and are treated through "See a doctor".

### Hospital stays and rehabilitation

A heart attack, a broken hip, a spinal cord injury, surgery at the start of
cancer treatment, or (only by the player's choice) a short voluntary stay in a
very hard stretch are admissions: weeks on the care calendar, billed once,
during which appointments and sessions wait rather than count as missed. Coming
home can lead to rehabilitation with goals worked through in order and reached
by sessions attended: walking and stairs after a hip fracture; transfers, the
wheelchair and daily life after a spinal cord injury (adapting, not "recovering");
strength and routine after heart problems or cancer. A broken hip heals for
good once its goals are met.

### Insurance

Every health bill is a claim on the cover the player has at that moment: what
was billed, what cover paid, what the player paid. The cover record keeps each
period of cover (public system, through work, private, as a child, none) with
its dates. Private and employer insurers check expensive care first and now and
then refuse it; a refusal can be appealed once. The rules of who is covered come
from the existing per-country model in `engine/systems.js`.

### Other people's care

Family members and partners get care of their own (`engine/health/kincare.js`),
a year at a time. Starting is their decision, likelier when the player
encourages them or goes with them to an appointment. Care has the same parts as
the player's: a therapist who is a persistent clinician at a real clinic near
the player, a course of sessions attended or missed (more get attended when the
player helps them get there), and a medicine that was available in their year,
is used for what they have, suits their age, is never for BPD itself and is not
an antidepressant on its own in bipolar disorder (even if they never told the
player about the bipolar disorder). Each year the medicine is reviewed; one that
is not helping or not tolerated is changed, and the first is kept in their
history. Heart attacks and cancer surgery are hospital stays the player can
visit. Care makes recovery likelier and slows what cancer and heart disease do
to their health; cancer treatment ends in remission or not, likelier the earlier
it was found. The player sees that someone is getting support only if they shared
the condition, and who, what and how it is going only if they chose to share
that too; asking is allowed, and they may say no.

## Not built yet

- **Older treatments.** Historical eras are in the game now (`js/engine/eras.js`,
  docs/HISTORICAL_ERAS.md), and health care follows the year: every service,
  therapy, medicine, device and diagnosis carries the year it became available,
  and nothing is offered before then (`tests/generations-1900.mjs` asks a
  psychiatrist what they could offer for depression in each generation from 1900).
  But the catalog holds today's treatments only. The earliest antidepressant in it
  is from 1986, so a life in the 1950s to 1970s is offered no medicine for
  depression, where in reality there were older ones (tricyclics, MAOIs), and
  past practices such as asylums are not modeled.
- **Workplace and school discrimination** are not modeled beyond accommodations
  being refused where there is no law requiring them.
- **Other people's care** runs a year at a time rather than week by week, and
  their clinicians do not appear in the player's own care team.
- **Clinical review**, as above.
