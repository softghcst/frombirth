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
  broad published picture, and labelled as such in the files themselves;
- nothing is generated freely: conditions, medicines, therapies and the rules
  joining them are fixed, curated data (`js/data/health/`) that a reviewer can
  read line by line.

## Sources

Conditions and their care:
NICE guidance NG222 (depression), CG78 (borderline personality disorder),
CG185 (bipolar disorder), NG87 (ADHD), CG113 (generalised anxiety and panic),
CG159 (social anxiety), CG31 (OCD), NG116 (PTSD), NG69 (eating disorders),
CG178 (psychosis and schizophrenia), CG128/CG142 (autism), NG217 (epilepsy),
NG62 (cerebral palsy), NG134 (depression in children);
NIMH health topics for each mental health condition;
NHS condition pages (dyslexia, dyscalculia, phobias, agoraphobia, Tourette's,
migraine, hearing loss, counselling, peer support);
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

### The care calendar

The rest of Pathways moves a year at a time. Health care moves a week at a
time inside the year: a medicine is reviewed after a few weeks, and a skills
group meets every week. A date is an absolute week (`year × 52 + week`).
"Let the weeks pass" in My Health moves the calendar on to the next
appointment, within the current year; "Live another year" runs whatever weeks
are left before the year turns. Each week runs in a fixed order (see
`engine/health/index.js`), so a medicine cannot help before it starts, a change
cannot come before a review, and a prescription that has ended is never
charged again.

### Truth and diagnosis

A condition can be present and unrecognised for years. Symptoms are
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
antidepressant without a mood stabiliser. No medicine is listed as treating BPD.

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
and skills practised; a hard week is a setback, never a loss of skills; no
number of sessions cures anything. Skills open choices in everyday scenes (a
disagreement with a partner offers a "say what you need" response to someone who
has practised it) without deciding how they go. Session notes refer only to
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
half; it scales the likelihood of later-onset conditions (normalised so the
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
where practised DBT skills open new responses; and a support-focused scene for
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

## Not built yet

- **Historical eras** do not exist in the game (every life starts in the present
  year). Every service, therapy, medicine, device and diagnosis carries the year
  it became available and its period names, and the checks prove the 1800 case,
  so the health engine is ready for eras when they come.
- **Physical health** keeps the older yearly illness model alongside the new
  record: common illnesses, injuries and the existing chronic conditions are
  treated through "See a doctor" as before. Epilepsy, migraine, cystic fibrosis
  and haemophilia have the new model; diabetes, heart disease and cancer have
  not been moved over.
- **Insurance** reuses the existing cover model (who pays what share); there is
  no separate health insurance policy record, claims or prior authorisation.
- **NPC health** is lighter than the player's: important people have
  conditions, diagnoses and what they have shared, but no treatment of their own.
- **Workplace and school discrimination** are not modelled beyond accommodations
  being refused where there is no law requiring them.
- **Hospital stays, crisis services and rehabilitation goals** are present as
  services and scenes, not as their own systems.
- **Clinical review**, as above.
