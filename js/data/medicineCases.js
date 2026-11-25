// Patient cases for the physician career (engine/medicine/cases.js). Fictional and simplified:
// each case is a short game scenario written at the level of a general reader, built to reward the
// habits of good care (listening, examining, choosing tests that will change the plan, consent,
// honest conversations and follow-up) rather than doing the most. NOTHING HERE IS MEDICAL ADVICE.
// Medicines are only ever described by what they are for, never by name with an amount, a route or a
// schedule; procedures are named the way a hospital's list names them, never how they are done; the
// decisions inside an operation are about judgment and teamwork, not technique. Test, procedure and
// specialty ids are those of data/medicine.js. Cases with an early minYear use only what existed then.
const C = (o) => ({ tier: 'routine', ages: [18, 80], minYear: 1900, tests: [], plans: [], ...o });

/** @type {object[]} */
export const CASES = [
  // ======================================================================================
  // FAMILY MEDICINE
  // ======================================================================================
  C({
    id: 'fam_bp_first', specialty: ['family', 'internal'], ages: [40, 70], minYear: 1970, followUp: 'fam_bp_review',
    label: 'A routine checkup',
    intro: "{patient}, {age}, has come in for a checkup because a pharmacy machine gave a high blood pressure reading.",
    history: "No chest pain, headaches or breathlessness. A parent had a stroke in their sixties. Work has been stressful, meals are often takeout, and exercise has slipped.",
    exam: "Blood pressure is high on two careful readings in the clinic. Heart, lungs and pulses are normal and the eyes show no changes.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Kidney function is normal; cholesterol is a little high.' },
      { test: 'urine', value: 'neutral', result: 'No protein or blood in the urine.' },
      { test: 'ecg', value: 'neutral', result: 'A normal heart tracing.' },
      { test: 'ct', value: 'low', result: 'A scan of the body finds nothing relevant and adds radiation and cost.' },
    ],
    differential: [
      { id: 'hypertension', label: 'High blood pressure' },
      { id: 'white_coat', label: 'Nervousness in the clinic only' },
      { id: 'kidney', label: 'Kidney disease raising the pressure' },
    ],
    diagnosis: 'hypertension',
    plans: [
      { id: 'confirm_plan', label: 'Confirm with home readings, talk through salt, activity and stress, agree a plan together and review soon', quality: 'best' },
      { id: 'med_now', label: 'Start a medicine to lower blood pressure today without rechecking', quality: 'ok' },
      { id: 'reassure', label: 'Tell them it is probably nerves and not to worry', quality: 'poor' },
      { id: 'scan_all', label: 'Order every scan available to be thorough', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} tracks readings at home, changes a few habits, and the blood pressure settles with a plan they helped choose.",
      fair: "{patient}'s blood pressure improves slowly, with a few missed follow-ups along the way.",
      poor: "{patient} drifts away from care and returns months later with the blood pressure still high.",
    },
  }),
  C({
    id: 'fam_bp_review', specialty: ['family', 'internal'], ages: [41, 71], minYear: 1970, followUpOnly: true,
    label: 'Blood pressure review',
    intro: "{patient}, {age}, returns for a yearly review of the blood pressure plan started last year.",
    history: "Home readings are much better. Since a medicine was changed a few months ago, the ankles swell by evening, which {patient} finds annoying enough to consider stopping everything.",
    exam: "Blood pressure is well controlled. There is mild swelling at both ankles; the heart and lungs sound normal.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Kidney function and salts are normal.' },
      { test: 'echo', value: 'low', result: 'A normal heart scan that was not needed to explain the swelling.' },
      { test: 'angiogram', value: 'low', result: 'An invasive heart test with no reason behind it.' },
    ],
    differential: [
      { id: 'side_effect', label: 'A known side effect of the blood pressure medicine' },
      { id: 'heart_failure', label: 'A weak heart' },
      { id: 'clot', label: 'A clot in the leg' },
    ],
    diagnosis: 'side_effect',
    plans: [
      { id: 'adjust', label: 'Explain the likely cause, agree a switch to a different kind of medicine, and recheck in a few weeks', quality: 'best' },
      { id: 'keep', label: 'Ask them to put up with it', quality: 'ok' },
      { id: 'stop_all', label: 'Stop all treatment since the numbers look good now', quality: 'poor' },
      { id: 'cardio', label: 'Refer for an angiogram to be safe', quality: 'poor', refer: 'cardiology' },
    ],
    outcomes: {
      good: "{patient}'s ankles settle after the switch and the blood pressure stays well controlled.",
      fair: "{patient} keeps taking the medicine but grumbles about the swelling.",
      poor: "{patient} stops treatment and the blood pressure climbs again.",
    },
  }),
  C({
    id: 'fam_diabetes_new', specialty: ['family', 'internal'], ages: [35, 75], minYear: 1960, followUp: 'fam_diabetes_review', tier: 'intermediate',
    label: 'Tired and thirsty',
    intro: "{patient}, {age}, has been tired for months and is getting up at night to use the bathroom.",
    history: "Always thirsty lately, with some blurred vision and slow-healing scratches. A sibling has diabetes. Weight has crept up over the years.",
    exam: "Overweight, otherwise well. Feet have normal feeling and pulses.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Blood sugar is clearly high, in the diabetes range.' },
      { test: 'urine', value: 'useful', result: 'Sugar in the urine and no infection.' },
      { test: 'blood_special', value: 'neutral', result: 'The longer-term sugar measure confirms months of high readings.' },
      { test: 'mri', value: 'low', result: 'A brain scan for tiredness that finds nothing.' },
    ],
    differential: [
      { id: 't2dm', label: 'Type 2 diabetes' },
      { id: 'thyroid', label: 'An underactive thyroid' },
      { id: 'uti', label: 'A urine infection' },
      { id: 'depression', label: 'Low mood causing tiredness' },
    ],
    diagnosis: 't2dm',
    needs: ['blood_basic'],
    plans: [
      { id: 'explain_plan', label: 'Explain the diagnosis, agree food and activity goals, discuss starting a medicine, arrange diabetes education and follow-up', quality: 'best' },
      { id: 'pills_only', label: 'Hand over a prescription and see them next year', quality: 'poor' },
      { id: 'diet_only', label: 'Advise diet alone without follow-up', quality: 'ok' },
      { id: 'refer_endo', label: 'Refer straight to an endocrinologist for routine type 2 diabetes', quality: 'ok', refer: 'endocrinology' },
    ],
    outcomes: {
      good: "{patient} joins a diabetes class, makes steady changes, and the sugar comes down over a few months.",
      fair: "{patient}'s sugars improve partly; the plan needs adjusting at the next visit.",
      poor: "{patient} feels overwhelmed and stops coming in, and the sugars stay high.",
    },
  }),
  C({
    id: 'fam_diabetes_review', specialty: ['family', 'internal'], ages: [36, 76], minYear: 1960, followUpOnly: true,
    label: 'Diabetes review',
    intro: "{patient}, {age}, returns for the yearly diabetes review a year after the diagnosis.",
    history: "Feeling better and sticking to most of the plan. Mentions tingling in the toes at night.",
    exam: "Sensation is reduced in both feet when tested; the skin is intact and pulses are present.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'The long-term sugar measure has improved a great deal.' },
      { test: 'urine', value: 'useful', result: 'A small leak of protein in the urine.' },
      { test: 'exam_focused', value: 'useful', result: 'A careful foot check confirms reduced feeling in both feet.' },
      { test: 'xray', value: 'low', result: 'Normal foot bones; it does not test the nerves.' },
    ],
    differential: [
      { id: 'neuropathy', label: 'Early nerve changes from diabetes' },
      { id: 'well', label: 'No complications at all' },
      { id: 'infection', label: 'A foot infection' },
    ],
    diagnosis: 'neuropathy',
    plans: [
      { id: 'foot_care', label: 'Teach daily foot care, protect the kidneys, and refer to podiatry for regular foot checks', quality: 'best', refer: 'podiatry' },
      { id: 'next_year', label: 'Note it and check the feet again next year', quality: 'ok' },
      { id: 'blame', label: 'Tell them they must try harder with the diet', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} checks their feet every day and the podiatrist catches a small pressure spot early.",
      fair: "{patient} keeps up some of the foot care, and the numbness stays stable.",
      poor: "{patient} misses foot checks and develops a blister that is slow to heal.",
    },
  }),
  C({
    id: 'fam_child_cough', specialty: ['family'], ages: [2, 10], guardian: true, household: true,
    label: 'A child with a cough',
    intro: "{patient}, {age}, has had a cough and runny nose for five days. A parent brings them in, worried because the cough is worse at night.",
    history: "Eating less but drinking well, playing between bouts. A low fever for two days. A sibling had the same cold last week. {patient} says their throat is scratchy.",
    exam: "Comfortable, breathing easily, with a red throat and a clear chest. Ears look normal.",
    tests: [
      { test: 'xray', value: 'low', result: 'A normal chest X-ray: radiation without a reason.' },
      { test: 'blood_basic', value: 'low', result: 'Mildly abnormal in a way that is typical of a virus, and a frightened child.' },
      { test: 'culture', value: 'neutral', result: 'Grows nothing of note.' },
    ],
    differential: [
      { id: 'viral', label: 'A common cold virus' },
      { id: 'pneumonia', label: 'Pneumonia' },
      { id: 'asthma', label: 'Asthma' },
    ],
    diagnosis: 'viral',
    plans: [
      { id: 'safety_net', label: 'Explain it is a virus, advise fluids and rest, and tell the family which signs mean come back', quality: 'best' },
      { id: 'antibiotics', label: 'Prescribe antibiotics just in case', quality: 'poor' },
      { id: 'xray_all', label: 'Send for chest X-ray and blood tests to reassure the parent', quality: 'poor' },
      { id: 'talk_parent_only', label: 'Speak only to the parent and ignore what the child says', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s cough fades over the next week, and the family knows what to watch for next time.",
      fair: "{patient} recovers, though the parent calls twice more for reassurance.",
      poor: "{patient} recovers, but the family leaves expecting antibiotics for every cold.",
    },
  }),
  C({
    id: 'fam_caregiver_strain', specialty: ['family', 'internal'], ages: [40, 70], minYear: 1960, household: true,
    label: 'Not sleeping',
    intro: "{patient}, {age}, asks for something to help with sleep.",
    history: "{patient} has looked after a parent with dementia for two years, mostly alone. Sleep is broken, friends have dropped away, and patience is running thin. No thoughts of self-harm.",
    exam: "Tired and tearful but well otherwise. Blood pressure is normal.",
    tests: [
      { test: 'screening_tool', value: 'useful', result: 'A mood questionnaire suggests moderate low mood and high stress.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal blood counts and thyroid.' },
      { test: 'mri', value: 'low', result: 'A normal brain scan that does not touch the real problem.' },
    ],
    differential: [
      { id: 'carer_strain', label: 'Caregiver exhaustion with low mood' },
      { id: 'insomnia', label: 'Simple insomnia' },
      { id: 'thyroid', label: 'Thyroid trouble' },
    ],
    diagnosis: 'carer_strain',
    plans: [
      { id: 'support', label: 'Listen, connect them with respite care and caregiver support, offer counseling, and book a review; offer to see the parent too', quality: 'best' },
      { id: 'sleeping_pill', label: 'Give a sleeping pill and nothing else', quality: 'poor' },
      { id: 'counsel_only', label: 'Suggest counseling and leave the rest to them', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} gets two afternoons of respite a week, sleeps better, and brings the parent in for a care review.",
      fair: "{patient} feels heard but finds support services slow to arrange.",
      poor: "{patient} keeps going alone and returns more exhausted a few months later.",
    },
  }),
  C({
    id: 'fam_low_back_pain', specialty: ['family', 'internal'], minYear: 1900, ages: [20, 65],
    label: 'Back pain',
    intro: "{patient}, {age}, hurt their lower back lifting boxes two days ago.",
    history: "Pain across the low back, worse with bending. No numbness, no weakness, no problems with bladder or bowels, no fever, no history of cancer.",
    exam: "Muscles are tight and tender; leg strength, feeling and reflexes are normal.",
    tests: [
      { test: 'mri', value: 'low', result: 'Shows wear common at this age that does not explain the pain and may worry the patient.' },
      { test: 'xray', value: 'low', result: 'A normal spine X-ray that changes nothing.' },
      { test: 'exam_focused', value: 'useful', result: 'A careful nerve examination finds no warning signs.' },
    ],
    differential: [
      { id: 'strain', label: 'A muscle strain' },
      { id: 'disc', label: 'A slipped disc pressing on a nerve' },
      { id: 'serious', label: 'A serious spinal problem' },
    ],
    diagnosis: 'strain',
    plans: [
      { id: 'active', label: 'Reassure, advise staying gently active with simple pain relief, and explain which warning signs mean return', quality: 'best' },
      { id: 'bed_rest', label: 'Strict bed rest for two weeks', quality: 'poor' },
      { id: 'scan_now', label: 'Order an MRI to be certain', quality: 'poor', minYear: 1985 },
      { id: 'refer_surgeon', label: 'Refer to a spine surgeon', quality: 'poor', refer: 'spine' },
    ],
    outcomes: {
      good: "{patient} is back at work within a couple of weeks.",
      fair: "{patient} takes a month to recover fully, cautious about lifting.",
      poor: "{patient} stays off work for weeks, worried that the back is badly damaged.",
    },
  }),
  C({
    id: 'fam_fever_1920', specialty: ['family', 'internal'], minYear: 1900, ages: [20, 70], tier: 'intermediate',
    label: 'Fever and cough',
    intro: "{patient}, {age}, has a fever, a cough and pain on one side of the chest when breathing in.",
    history: "Started suddenly three days ago with shaking chills. Brings up rust-colored phlegm. Was well before.",
    exam: "Feverish and breathing fast. One side of the chest sounds dull, with crackles.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A patch of pneumonia in one lung.' },
      { test: 'culture', value: 'neutral', result: 'Phlegm grows a common pneumonia germ.' },
      { test: 'blood_basic', value: 'neutral', result: 'A raised white cell count.' },
    ],
    differential: [
      { id: 'pneumonia', label: 'Pneumonia' },
      { id: 'tb', label: 'Tuberculosis' },
      { id: 'flu', label: 'Influenza alone' },
    ],
    diagnosis: 'pneumonia',
    plans: [
      { id: 'nursing', label: 'Bed rest, fluids, careful nursing and a daily visit to watch for the crisis', quality: 'best', maxYear: 1944 },
      { id: 'antibiotics', label: 'Start antibiotics, explain warning signs, and arrange a review in two days', quality: 'best', minYear: 1945 },
      { id: 'send_home', label: 'Send home with no follow-up', quality: 'poor' },
      { id: 'hospital_all', label: 'Admit to the hospital for observation', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient}'s fever breaks and the cough clears over a few weeks.",
      fair: "{patient} recovers slowly, weak for a month afterward.",
      poor: "{patient} becomes much sicker and needs a long stay in the hospital before recovering.",
    },
  }),

  // ======================================================================================
  // INTERNAL MEDICINE
  // ======================================================================================
  C({
    id: 'int_anemia', specialty: ['internal', 'family'], ages: [50, 80], minYear: 1970, tier: 'intermediate',
    label: 'Always tired',
    intro: "{patient}, {age}, says they get out of breath on the stairs and have no energy.",
    history: "Gradual over six months. Some indigestion. No obvious bleeding noticed. Eats a normal diet.",
    exam: "Pale. Heart and lungs are normal. The belly is soft.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'A low blood count with small red cells, the pattern of iron deficiency.' },
      { test: 'blood_special', value: 'useful', result: 'Iron stores are very low.' },
      { test: 'endoscopy', value: 'useful', result: 'A camera look finds an ulcer in the stomach that has been slowly bleeding.' },
      { test: 'mri', value: 'low', result: 'A scan that does not look at the cause.' },
    ],
    differential: [
      { id: 'iron_gi', label: 'Iron deficiency from slow bleeding in the gut' },
      { id: 'heart', label: 'Heart failure' },
      { id: 'thyroid', label: 'An underactive thyroid' },
    ],
    diagnosis: 'iron_gi',
    needs: ['blood_basic'],
    plans: [
      { id: 'find_cause', label: 'Explain the finding, replace the iron, and arrange a camera test of the gut to find the cause', quality: 'best', refer: 'gi' },
      { id: 'iron_only', label: 'Replace the iron and do nothing more', quality: 'poor' },
      { id: 'transfuse', label: 'Arrange a blood transfusion today', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient}'s ulcer is found and treated, and the energy comes back over two months.",
      fair: "{patient} improves, though the cause takes a while to pin down.",
      poor: "{patient}'s blood count drops again because the cause was not found in time.",
    },
  }),
  C({
    id: 'int_heart_failure', specialty: ['internal', 'cardiology'], ages: [55, 85], minYear: 1915, tier: 'intermediate',
    label: 'Breathless at night',
    intro: "{patient}, {age}, wakes at night short of breath and has swollen ankles.",
    history: "Sleeps propped up on three pillows. Had a heart attack years ago. Weight up several pounds in two weeks.",
    exam: "Crackles at both lung bases, swollen ankles and raised neck veins.",
    tests: [
      { test: 'xray', value: 'useful', result: 'An enlarged heart with fluid in the lungs.' },
      { test: 'echo', value: 'useful', result: 'The heart pumps weakly.' },
      { test: 'ecg', value: 'neutral', result: 'Signs of an old heart attack.' },
      { test: 'angiogram', value: 'low', result: 'Not the next step for a patient with fluid on the lungs.' },
    ],
    differential: [
      { id: 'hf', label: 'Heart failure' },
      { id: 'pneumonia', label: 'Pneumonia' },
      { id: 'kidney', label: 'Kidney failure' },
    ],
    diagnosis: 'hf',
    needs: ['xray'],
    plans: [
      { id: 'rest_old', label: 'Bed rest, limit salt and fluids, a heart medicine, and close visits', quality: 'best', maxYear: 1974 },
      { id: 'modern_hf', label: 'Treatment to clear the fluid and support the heart, daily weights at home, and close follow-up with the heart team', quality: 'best', minYear: 1975 },
      { id: 'water_only', label: 'Treat the fluid and send home without follow-up', quality: 'poor' },
      { id: 'icu', label: 'Admit to intensive care straight away', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} loses the extra fluid, sleeps flat again, and learns to watch the scales.",
      fair: "{patient} improves but returns once in the year with more fluid.",
      poor: "{patient} is readmitted several times and finds daily life much harder.",
    },
  }),
  C({
    id: 'int_preop', specialty: ['internal', 'family'], ages: [60, 80], minYear: 1975,
    label: 'Clearance for surgery',
    intro: "{patient}, {age}, has been sent by an orthopedic surgeon for a check before a knee replacement.",
    history: "Walks a mile every morning with the dog and climbs two flights of stairs without trouble. Well-controlled blood pressure. No chest pain.",
    exam: "Normal heart and lung examination. Blood pressure is fine.",
    tests: [
      { test: 'blood_basic', value: 'neutral', result: 'Normal blood count and kidney function.' },
      { test: 'echo', value: 'low', result: 'A normal heart scan that was not needed in an active patient.' },
      { test: 'angiogram', value: 'low', result: 'An invasive test with its own risks and no reason behind it.' },
      { test: 'ecg', value: 'neutral', result: 'Unchanged from last year.' },
    ],
    differential: [
      { id: 'fit', label: 'Fit for surgery with usual care' },
      { id: 'heart_risk', label: 'A hidden heart problem' },
      { id: 'unfit', label: 'Too frail for surgery' },
    ],
    diagnosis: 'fit',
    plans: [
      { id: 'document', label: 'Document good fitness, give advice about medicines before surgery, and write to the surgeon', quality: 'best' },
      { id: 'all_tests', label: 'Order every heart test to be safe before signing off', quality: 'poor' },
      { id: 'delay', label: 'Postpone surgery until a cardiologist has seen them', quality: 'poor', refer: 'cardiology' },
    ],
    outcomes: {
      good: "{patient} has the knee replaced on schedule and does well.",
      fair: "{patient} has surgery after a short, unnecessary delay.",
      poor: "{patient}'s surgery is delayed for months by tests that changed nothing.",
    },
  }),
  C({
    id: 'int_thyroid', specialty: ['internal', 'family', 'endocrinology'], ages: [30, 70], minYear: 1960, sex: 'female',
    label: 'Feeling slow',
    intro: "{patient}, {age}, has felt slow, cold and heavy for the past year.",
    history: "Gained weight without eating more, constipated, skin dry. Her mother had a thyroid problem.",
    exam: "Dry skin, a slow pulse and slightly slow reflexes. The thyroid is not enlarged.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'Thyroid tests show an underactive gland.' },
      { test: 'blood_basic', value: 'neutral', result: 'Cholesterol is a little high.' },
      { test: 'ultrasound', value: 'low', result: 'A normal-looking thyroid; the scan was not needed.' },
    ],
    differential: [
      { id: 'hypothyroid', label: 'An underactive thyroid' },
      { id: 'depression', label: 'Depression' },
      { id: 'age', label: 'Just getting older' },
    ],
    diagnosis: 'hypothyroid',
    needs: ['blood_special'],
    plans: [
      { id: 'replace', label: 'Explain, start thyroid hormone replacement, and recheck the blood in a few weeks', quality: 'best' },
      { id: 'diet', label: 'Advise a diet for the weight', quality: 'poor' },
      { id: 'refer_endo', label: 'Refer to an endocrinologist before doing anything', quality: 'ok', refer: 'endocrinology' },
    ],
    outcomes: {
      good: "{patient} feels like herself again within a few months.",
      fair: "{patient} improves, with the dose needing a couple of adjustments.",
      poor: "{patient} stays tired for another year before the cause is treated.",
    },
  }),
  C({
    id: 'int_falls', specialty: ['internal', 'family'], ages: [75, 95], minYear: 1960, tier: 'intermediate',
    label: 'A fall at home',
    intro: "{patient}, {age}, fell at home for the second time this month. A daughter comes along.",
    history: "Takes eleven different medicines from four doctors. Feels dizzy on standing. No loss of consciousness. Wants very much to stay living at home.",
    exam: "Blood pressure drops on standing. A small bruise on the hip; walks slowly but safely with a cane.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A review of every medicine finds two that lower blood pressure and one that causes drowsiness.' },
      { test: 'blood_basic', value: 'neutral', result: 'Mild kidney changes for age.' },
      { test: 'mri', value: 'low', result: 'An unneeded brain scan.' },
      { test: 'gait', value: 'useful', result: 'Balance is reduced but improves with support.' },
    ],
    differential: [
      { id: 'meds', label: 'Too many medicines causing dizziness' },
      { id: 'stroke', label: 'A small stroke' },
      { id: 'heart_rhythm', label: 'A heart rhythm problem' },
    ],
    diagnosis: 'meds',
    plans: [
      { id: 'deprescribe', label: 'Review the medicines with them and the daughter, stop what is not needed, arrange balance therapy and a home safety check', quality: 'best' },
      { id: 'nursing_home', label: 'Advise moving to a nursing home whatever they want', quality: 'poor' },
      { id: 'add_med', label: 'Add a medicine for dizziness', quality: 'poor' },
      { id: 'walker', label: 'Give a walker and see them in a year', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} stops falling once the medicines are trimmed, and stays at home.",
      fair: "{patient} falls once more but is steadier after therapy.",
      poor: "{patient} keeps falling and loses confidence about leaving the house.",
    },
  }),
  C({
    id: 'int_typhoid_1910', specialty: ['internal', 'infectious', 'family'], ages: [15, 60], minYear: 1900, tier: 'intermediate',
    label: 'A fever that will not break',
    intro: "{patient}, {age}, has had a fever climbing a little higher each day for a week.",
    history: "Headache, a poor appetite and stomach aches. Several neighbors draw water from the same well and two are also ill.",
    exam: "Feverish with a slow pulse for the fever. A few faint rose-colored spots on the belly and a tender abdomen.",
    tests: [
      { test: 'culture', value: 'useful', result: 'Blood culture grows the germ of typhoid fever.' },
      { test: 'blood_basic', value: 'neutral', result: 'A low white cell count.' },
      { test: 'xray', value: 'low', result: 'A chest X-ray that shows nothing relevant.' },
    ],
    differential: [
      { id: 'typhoid', label: 'Typhoid fever' },
      { id: 'flu', label: 'Influenza' },
      { id: 'malaria', label: 'Malaria' },
    ],
    diagnosis: 'typhoid',
    plans: [
      { id: 'old_care', label: 'Careful nursing, fluids and a light diet, separation from others, and a warning to the health department about the well', quality: 'best', maxYear: 1949 },
      { id: 'modern', label: 'Start antibiotics, separate from others, and report to public health so the water is checked', quality: 'best', minYear: 1950 },
      { id: 'home_quiet', label: 'Treat at home and say nothing about the well', quality: 'poor' },
      { id: 'purge', label: 'Give a strong purge to clear the bowels', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient} recovers over several weeks, and the well is closed before more neighbors fall ill.",
      fair: "{patient} recovers slowly after a relapse.",
      poor: "{patient} has a long and serious illness, and several more neighbors catch the fever.",
    },
  }),

  // ======================================================================================
  // PEDIATRICS
  // ======================================================================================
  C({
    id: 'peds_newborn_check', specialty: ['pediatrics', 'family'], ages: [0, 0], minYear: 1950, guardian: true, household: true,
    label: 'A newborn visit',
    intro: "{patient}, a few days old, comes in with both parents for a first checkup.",
    history: "Feeding every two to three hours, plenty of wet diapers. The parents are tired and full of questions about sleep and crying.",
    exam: "Healthy weight gain since birth, a mild yellow tinge to the skin of the face only, and a normal examination.",
    tests: [
      { test: 'blood_basic', value: 'neutral', result: 'Jaundice level is well below where treatment would be needed.' },
      { test: 'ultrasound', value: 'low', result: 'A normal scan the baby did not need.' },
      { test: 'developmental', value: 'neutral', result: 'Normal newborn reflexes.' },
    ],
    differential: [
      { id: 'healthy', label: 'A healthy newborn with mild normal jaundice' },
      { id: 'serious_jaundice', label: 'Serious jaundice' },
      { id: 'infection', label: 'A newborn infection' },
    ],
    diagnosis: 'healthy',
    plans: [
      { id: 'support', label: 'Reassure, support feeding, talk about safe sleep, explain when to call, and book the next visit', quality: 'best' },
      { id: 'admit', label: 'Admit the baby for observation', quality: 'poor' },
      { id: 'rush', label: 'Examine quickly and leave the questions unanswered', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} thrives, and the parents leave feeling more confident.",
      fair: "{patient} does well, though the parents call often in the first weeks.",
      poor: "{patient} is fine, but the parents feel brushed off and stop coming to checkups.",
    },
  }),
  C({
    id: 'peds_speech', specialty: ['pediatrics', 'family'], ages: [2, 3], minYear: 1950, guardian: true, tier: 'intermediate',
    label: 'A developmental concern',
    intro: "{patient}, {age}, has only a handful of words. A grandparent who looks after them most days is worried.",
    history: "Points and waves, enjoys games, and follows simple instructions. Had several ear infections last winter. A cousin talked late.",
    exam: "A friendly, active child with good eye contact. Fluid is visible behind both eardrums.",
    tests: [
      { test: 'developmental', value: 'useful', result: 'Social and motor skills are on track; expressive speech is behind.' },
      { test: 'exam_focused', value: 'useful', result: 'A hearing check suggests muffled hearing in both ears.' },
      { test: 'mri', value: 'low', result: 'A brain scan that needs sedation and is not indicated.' },
      { test: 'eeg', value: 'low', result: 'No reason for this test.' },
    ],
    differential: [
      { id: 'hearing', label: 'Speech delay with glue ear affecting hearing' },
      { id: 'autism', label: 'Autism' },
      { id: 'normal', label: 'Normal variation' },
    ],
    diagnosis: 'hearing',
    needs: ['developmental'],
    plans: [
      { id: 'hearing_speech', label: 'Arrange a formal hearing test and speech therapy, talk through reading and play at home, and review in three months', quality: 'best' },
      { id: 'wait', label: 'Say they will grow out of it and see them next year', quality: 'poor' },
      { id: 'label', label: 'Tell the family it is probably autism', quality: 'poor' },
      { id: 'ent', label: 'Refer to ENT for the ears and nothing else', quality: 'ok', refer: 'ent' },
    ],
    outcomes: {
      good: "{patient}'s hearing improves and words arrive fast with speech therapy.",
      fair: "{patient} catches up gradually over the next year.",
      poor: "{patient} starts school still behind with speech.",
    },
  }),
  C({
    id: 'peds_worried_parent', specialty: ['pediatrics', 'family'], ages: [1, 5], minYear: 1950, guardian: true,
    label: 'A worried parent',
    intro: "{patient}, {age}, has had a fever for a day. The parent has read frightening things online and is very anxious.",
    history: "Drinking well, still playing when the fever comes down, a runny nose. All vaccines are up to date.",
    exam: "Alert and smiling, well hydrated. A rash that fades when pressed. Neck moves freely.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The rash blanches, and there are no warning signs.' },
      { test: 'blood_basic', value: 'low', result: 'A needle test that upsets the child and changes nothing.' },
      { test: 'urine', value: 'neutral', result: 'A clear urine sample.' },
    ],
    differential: [
      { id: 'viral', label: 'A viral illness' },
      { id: 'meningitis', label: 'Meningitis' },
      { id: 'uti', label: 'A urine infection' },
    ],
    diagnosis: 'viral',
    plans: [
      { id: 'explain', label: 'Take the worry seriously, explain the reassuring signs, show what to watch for, and invite them back any time', quality: 'best' },
      { id: 'dismiss', label: 'Tell the parent they are overreacting', quality: 'poor' },
      { id: 'admit', label: 'Admit for tests to calm the parent', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s fever settles in two days and the parent feels able to cope next time.",
      fair: "{patient} gets better; the parent brings them back once more for reassurance.",
      poor: "{patient} recovers, but the parent goes elsewhere feeling dismissed.",
    },
  }),
  C({
    id: 'peds_teen_confidential', specialty: ['pediatrics', 'family'], ages: [14, 17], minYear: 1970, guardian: true, tier: 'intermediate',
    label: 'An adolescent checkup',
    intro: "{patient}, {age}, comes in with a parent for a sports physical, and seems keen for the parent to step out.",
    history: "With the parent out of the room, {patient} says they have been feeling low and stressed about school, and asks whether this will be kept private. No thoughts of self-harm.",
    exam: "Healthy and fit. Quiet, a little tearful when talking about school.",
    tests: [
      { test: 'screening_tool', value: 'useful', result: 'A questionnaire shows mild low mood and anxiety, with no risk of harm.' },
      { test: 'blood_basic', value: 'low', result: 'Normal; not the question being asked.' },
    ],
    differential: [
      { id: 'stress', label: 'Stress and mild low mood' },
      { id: 'depression', label: 'Severe depression' },
      { id: 'physical', label: 'A physical illness' },
    ],
    diagnosis: 'stress',
    plans: [
      { id: 'confidential', label: 'Explain what stays private and when it cannot, agree with them what to share with the parent, offer counseling and a follow-up', quality: 'best' },
      { id: 'tell_parent', label: 'Call the parent back in and tell them everything', quality: 'poor' },
      { id: 'just_physical', label: 'Sign the sports form and move on', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} starts counseling and later chooses to talk to the parent about it.",
      fair: "{patient} comes back once and feels a little better.",
      poor: "{patient} stops trusting doctors with personal worries.",
    },
  }),
  C({
    id: 'peds_asthma', specialty: ['pediatrics', 'family'], ages: [5, 12], minYear: 1970, guardian: true,
    label: 'Coughing at night',
    intro: "{patient}, {age}, coughs at night and wheezes after running at recess. An aunt who is their guardian brings them in.",
    history: "Worse in winter and around the neighbor's cat. Eczema as a baby. Misses some school.",
    exam: "A soft wheeze on breathing out, otherwise well.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Breathing tests improve clearly after an inhaler in the clinic.' },
      { test: 'xray', value: 'low', result: 'A normal chest X-ray.' },
      { test: 'ct', value: 'low', result: 'Radiation a child does not need.' },
    ],
    differential: [
      { id: 'asthma', label: 'Asthma' },
      { id: 'viral', label: 'A lingering cold' },
      { id: 'inhaled', label: 'Something inhaled' },
    ],
    diagnosis: 'asthma',
    needs: ['exam_focused'],
    plans: [
      { id: 'plan', label: 'Explain asthma to the child and guardian, teach inhaler use, give a written action plan, and share it with the school', quality: 'best' },
      { id: 'rescue_only', label: 'Give a reliever inhaler and nothing more', quality: 'ok' },
      { id: 'no_sport', label: 'Advise no more sports', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} sleeps through the night and is back to running at recess.",
      fair: "{patient} improves but has one bad flare in winter.",
      poor: "{patient} keeps missing school with flares.",
    },
  }),
  C({
    id: 'peds_measles_1920', specialty: ['pediatrics', 'family'], ages: [2, 10], minYear: 1900, guardian: true,
    label: 'Fever and a rash',
    intro: "{patient}, {age}, has a high fever, red eyes and a rash spreading from the face downward. A parent is with them.",
    history: "Cough and runny nose for three days before the rash. Several children at school are ill.",
    exam: "Miserable and feverish, with a blotchy rash and small white spots inside the cheeks. The chest is clear.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The pattern is typical of measles; ears and chest are clear for now.' },
      { test: 'xray', value: 'low', result: 'A clear chest; not needed yet.' },
      { test: 'blood_basic', value: 'neutral', result: 'Nothing that changes the plan.' },
    ],
    differential: [
      { id: 'measles', label: 'Measles' },
      { id: 'scarlet', label: 'Scarlet fever' },
      { id: 'allergy', label: 'An allergic rash' },
    ],
    diagnosis: 'measles',
    plans: [
      { id: 'care', label: 'Rest at home away from others, plenty of fluids, a darkened room, and a visit if breathing or ears trouble them', quality: 'best' },
      { id: 'school', label: 'Send back to school once the fever drops', quality: 'poor' },
      { id: 'hospital', label: 'Admit to the hospital fever ward', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} recovers fully in about ten days.",
      fair: "{patient} develops an ear infection that clears with care.",
      poor: "{patient} develops a chest infection and recovers slowly over several weeks.",
    },
  }),
  C({
    id: 'peds_ear_pain', specialty: ['pediatrics', 'family'], ages: [2, 8], minYear: 1950, guardian: true,
    label: 'An earache',
    intro: "{patient}, {age}, woke up crying with ear pain. A parent brings them in.",
    history: "A cold for a few days. A mild fever. Eating and drinking. {patient} says it hurts on one side.",
    exam: "A red, bulging eardrum on one side; otherwise well.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A middle ear infection on one side.' },
      { test: 'ct', value: 'low', result: 'Radiation to the head for a common earache.' },
    ],
    differential: [
      { id: 'otitis', label: 'A middle ear infection' },
      { id: 'outer', label: "Swimmer's ear" },
      { id: 'teething', label: 'Teething' },
    ],
    diagnosis: 'otitis',
    plans: [
      { id: 'watch', label: 'Pain relief and a watch-and-wait plan, with a backup prescription if not better in two days', quality: 'best' },
      { id: 'antibiotics', label: 'Antibiotics straight away for every earache', quality: 'ok' },
      { id: 'refer_ent', label: 'Refer to ENT for ear tubes', quality: 'poor', refer: 'ent' },
    ],
    outcomes: {
      good: "{patient}'s earache settles in two days without needing more.",
      fair: "{patient} needs the backup prescription and recovers.",
      poor: "{patient} is uncomfortable for a week and the family loses sleep.",
    },
  }),

  // ======================================================================================
  // EMERGENCY MEDICINE
  // ======================================================================================
  C({
    id: 'er_chest_pain', specialty: ['emergency'], ages: [45, 80], minYear: 1995, tier: 'intermediate',
    label: 'Chest pain',
    intro: "{patient}, {age}, arrives with a heavy pressure in the chest that started an hour ago.",
    history: "The pain spreads to the left arm, with sweating and nausea. Smokes and has high blood pressure.",
    exam: "Pale and sweaty. Heart rate is fast and blood pressure is normal. Lungs are clear.",
    tests: [
      { test: 'ecg', value: 'useful', result: 'Changes showing a heart attack in progress.' },
      { test: 'troponin', value: 'useful', result: 'Heart blood markers are raised.' },
      { test: 'ct', value: 'low', result: 'A scan of the chest that delays the heart team.' },
      { test: 'xray', value: 'neutral', result: 'Normal chest X-ray.' },
    ],
    differential: [
      { id: 'mi', label: 'A heart attack' },
      { id: 'reflux', label: 'Heartburn' },
      { id: 'anxiety', label: 'A panic attack' },
      { id: 'muscle', label: 'Chest wall strain' },
    ],
    diagnosis: 'mi',
    needs: ['ecg'],
    plans: [
      { id: 'cath', label: 'Start heart attack treatment and call the cardiology team for an urgent catheterization', quality: 'best', refer: 'cardiology' },
      { id: 'observe', label: 'Watch in the department and repeat the tests in six hours', quality: 'poor' },
      { id: 'home', label: 'Send home with antacids', quality: 'unsafe' },
    ],
    triage: {
      text: "Three patients arrive together: {patient} with crushing chest pain and sweating; a young adult with a sprained wrist; a teenager with a sore throat who is drinking fine.",
      options: [
        { id: 'chest', label: 'See the patient with chest pain first', quality: 'best' },
        { id: 'wrist', label: 'Start with the wrist, it is quick', quality: 'poor' },
        { id: 'order', label: 'See them in order of arrival', quality: 'poor' },
      ],
    },
    decision: {
      text: "While waiting for the cardiology team, the monitor shows a dangerous heart rhythm and {patient} becomes unresponsive.",
      options: [
        { id: 'team', label: 'Call for help, start resuscitation and follow the team protocol calmly', quality: 'best' },
        { id: 'wait', label: 'Wait to see if it settles on its own', quality: 'unsafe' },
        { id: 'alone', label: 'Try to manage alone without calling anyone', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s artery is opened within the hour and they go home a few days later.",
      fair: "{patient} recovers but with some lasting weakness of the heart.",
      poor: "{patient} has a large heart attack and a long, difficult recovery.",
    },
  }),
  C({
    id: 'er_stroke', specialty: ['emergency', 'neurology'], ages: [55, 90], minYear: 1996, tier: 'complex',
    label: 'Sudden weakness',
    intro: "{patient}, {age}, could not lift their right arm at breakfast and their speech is slurred.",
    history: "A family member saw it start forty minutes ago. Has an irregular heartbeat. No head injury.",
    exam: "Right arm and face are weak, and speech is hard to understand.",
    tests: [
      { test: 'ct', value: 'useful', result: 'No bleeding in the brain.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal sugar and blood counts.' },
      { test: 'mri', value: 'low', result: 'More detail, but it would cost precious time right now.' },
      { test: 'eeg', value: 'low', result: 'Not useful here and delays treatment.' },
    ],
    differential: [
      { id: 'ischemic', label: 'A stroke from a blocked artery' },
      { id: 'bleed', label: 'A bleed in the brain' },
      { id: 'low_sugar', label: 'Low blood sugar' },
      { id: 'seizure', label: 'After a seizure' },
    ],
    diagnosis: 'ischemic',
    needs: ['ct'],
    plans: [
      { id: 'stroke_team', label: 'Call the stroke team now, explain the options to the patient and family, and start clot-busting treatment if they agree', quality: 'best' },
      { id: 'admit_ward', label: 'Admit to a general ward and review in the morning', quality: 'poor' },
      { id: 'wait_mri', label: 'Wait for an MRI before deciding anything', quality: 'poor' },
    ],
    triage: {
      text: "{patient} with sudden one-sided weakness arrives at the same time as a patient with a cut finger and a patient with back pain who has had it for a week.",
      options: [
        { id: 'stroke', label: 'The sudden weakness: time matters most', quality: 'best' },
        { id: 'finger', label: 'The cut finger first', quality: 'poor' },
        { id: 'back', label: 'The back pain, who has waited longest', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s strength and speech return almost fully over the following days.",
      fair: "{patient} improves but needs weeks of rehabilitation.",
      poor: "{patient} is left with lasting weakness and needs a long rehabilitation.",
    },
  }),
  C({
    id: 'er_sepsis', specialty: ['emergency'], ages: [60, 90], minYear: 1960, tier: 'complex',
    label: 'Confused and feverish',
    intro: "{patient}, {age}, is brought in by family because they are suddenly confused and hot.",
    history: "Burning on passing urine for three days. Has diabetes. Not eating today.",
    exam: "Fever, a fast heart rate, low blood pressure and cool hands. Tender over one kidney.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Raised white cells and signs the kidneys are struggling.' },
      { test: 'culture', value: 'useful', result: 'Blood and urine cultures are sent before treatment.' },
      { test: 'urine', value: 'useful', result: 'Signs of a serious urine infection.' },
      { test: 'mri', value: 'unsafe', result: 'Taking an unstable patient away for a long scan delays urgent treatment.' },
    ],
    differential: [
      { id: 'sepsis', label: 'A severe infection spreading from the kidney' },
      { id: 'stroke', label: 'A stroke' },
      { id: 'dementia', label: 'Worsening memory problems' },
    ],
    diagnosis: 'sepsis',
    plans: [
      { id: 'sepsis_bundle', label: 'Start antibiotics and fluids quickly, monitor closely, and involve intensive care early', quality: 'best' },
      { id: 'wait_results', label: 'Wait for all results before starting treatment', quality: 'poor' },
      { id: 'send_home', label: 'Send home with a urine infection prescription', quality: 'unsafe' },
    ],
    triage: {
      text: "{patient} is confused with low blood pressure and fever. A teenager has a twisted ankle and is walking. An adult has had a headache for two days and is otherwise well.",
      options: [
        { id: 'septic', label: 'The confused patient with low blood pressure', quality: 'best' },
        { id: 'headache', label: 'The headache first', quality: 'poor' },
        { id: 'ankle', label: 'The ankle, to clear the waiting room', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} picks up within a day and leaves the hospital a week later.",
      fair: "{patient} needs a few days in intensive care but recovers.",
      poor: "{patient} becomes very ill and needs a long stay before getting home.",
    },
  }),
  C({
    id: 'er_ankle', specialty: ['emergency', 'family'], ages: [16, 50], minYear: 1960,
    label: 'Twisted ankle',
    intro: "{patient}, {age}, rolled their ankle stepping off a curb.",
    history: "Heard no crack. Could walk four steps right after and walked in from the parking lot.",
    exam: "Swelling and tenderness over the soft tissues on the outside of the ankle. No tenderness over the bones.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The bones are not tender and walking is possible: a fracture is very unlikely.' },
      { test: 'xray', value: 'low', result: 'A normal X-ray that was not needed.' },
      { test: 'mri', value: 'low', result: 'An expensive scan for a simple sprain.' },
    ],
    differential: [
      { id: 'sprain', label: 'An ankle sprain' },
      { id: 'fracture', label: 'A broken ankle' },
      { id: 'tendon', label: 'A torn tendon' },
    ],
    diagnosis: 'sprain',
    plans: [
      { id: 'rice', label: 'Rest, ice, support, early gentle movement and advice on when to return', quality: 'best' },
      { id: 'cast', label: 'Put the ankle in a cast for six weeks', quality: 'poor' },
      { id: 'refer_ortho', label: 'Refer to an orthopedic surgeon', quality: 'poor', refer: 'ortho' },
    ],
    outcomes: {
      good: "{patient} is walking normally within two weeks.",
      fair: "{patient}'s ankle stays sore for a month.",
      poor: "{patient}'s ankle stays stiff and weak for months.",
    },
  }),
  C({
    id: 'er_headache', specialty: ['emergency'], ages: [18, 40], minYear: 1980,
    label: 'A bad headache',
    intro: "{patient}, {age}, has a throbbing headache with nausea and asks for a scan to be sure it is nothing serious.",
    history: "Has had headaches like this a few times a year since being a teenager. It came on gradually. Light hurts the eyes. No fever and no injury.",
    exam: "A normal nerve examination. No neck stiffness. Blood pressure is normal.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A full nerve examination is normal.' },
      { test: 'ct', value: 'low', result: 'A normal scan with radiation it did not need.' },
      { test: 'mri', value: 'low', result: 'Not needed for a typical migraine.' },
    ],
    differential: [
      { id: 'migraine', label: 'A migraine' },
      { id: 'bleed', label: 'A bleed in the brain' },
      { id: 'meningitis', label: 'Meningitis' },
    ],
    diagnosis: 'migraine',
    plans: [
      { id: 'treat_explain', label: 'Treat the pain and nausea, explain why a scan is not needed, give warning signs and suggest follow-up with their doctor', quality: 'best' },
      { id: 'scan_anyway', label: 'Scan anyway because they asked', quality: 'poor' },
      { id: 'strong_pain', label: 'Give strong painkillers to take home', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s headache settles in the department and they leave with a plan to prevent the next one.",
      fair: "{patient} feels better but is unsure about not having a scan.",
      poor: "{patient} returns twice more the same month.",
    },
  }),
  C({
    id: 'er_asthma_child', specialty: ['emergency', 'pediatrics'], ages: [4, 12], minYear: 1970, guardian: true, tier: 'intermediate',
    label: 'A child struggling to breathe',
    intro: "{patient}, {age}, is wheezing and can only say a few words at a time. A parent carried them in.",
    history: "Known asthma, a cold for two days, using the reliever inhaler every hour without much help.",
    exam: "Breathing fast with the chest pulling in. Oxygen level is a little low. Wheeze in both lungs.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A moderate to severe asthma attack.' },
      { test: 'xray', value: 'low', result: 'Usually not needed in a typical attack.' },
      { test: 'blood_basic', value: 'low', result: 'A needle that frightens the child and changes nothing yet.' },
    ],
    differential: [
      { id: 'asthma', label: 'An asthma attack' },
      { id: 'pneumonia', label: 'Pneumonia' },
      { id: 'foreign_body', label: 'Something inhaled' },
    ],
    diagnosis: 'asthma',
    plans: [
      { id: 'treat', label: 'Give oxygen and breathing treatments right away, keep the parent close, reassess often and admit if not improving', quality: 'best' },
      { id: 'xray_first', label: 'X-ray first, then treat', quality: 'poor' },
      { id: 'home', label: 'One treatment and home', quality: 'poor' },
    ],
    triage: {
      text: "{patient}, a child who can speak only a few words between breaths, arrives with an adult with a nosebleed that has stopped and a toddler with a mild fever who is playing.",
      options: [
        { id: 'asthma', label: 'The child struggling to breathe', quality: 'best' },
        { id: 'nose', label: 'The nosebleed', quality: 'poor' },
        { id: 'toddler', label: 'The toddler, because they are youngest', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is breathing easily within a few hours and goes home with a better asthma plan.",
      fair: "{patient} needs a night on the children's ward.",
      poor: "{patient} needs intensive care for a day before improving.",
    },
  }),
  C({
    id: 'er_crash', specialty: ['emergency'], ages: [20, 45], minYear: 1980, tier: 'high', episode: 'crash_trauma',
    label: 'Road accident',
    intro: "{patient}, {age}, arrives by ambulance after a car crash on the highway.",
    history: "The paramedics say {patient} was the driver and was briefly knocked out. Now complains of belly pain and a painful thigh.",
    exam: "Awake but drowsy. Fast heart rate, low blood pressure, a tender belly, and a deformed thigh that has been splinted.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'A quick bedside scan shows blood in the belly.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood is sent for matching and counts.' },
      { test: 'mri', value: 'unsafe', result: 'A long scan away from the resuscitation area would be dangerous now.' },
      { test: 'xray', value: 'neutral', result: 'The chest X-ray is clear; the thigh bone is broken.' },
    ],
    differential: [
      { id: 'internal_bleeding', label: 'Bleeding inside the belly' },
      { id: 'thigh_only', label: 'Blood loss from the thigh alone' },
      { id: 'heart', label: 'A heart problem caused the crash' },
    ],
    diagnosis: 'internal_bleeding',
    needs: ['ultrasound'],
    plans: [
      { id: 'resus', label: 'Activate the trauma team, start blood products, keep the patient warm and arrange the operating room with the trauma surgeon', quality: 'best', refer: 'trauma' },
      { id: 'scan_everything', label: 'Send for scans of every part of the body first', quality: 'poor' },
      { id: 'ward', label: 'Admit to the ward for observation', quality: 'unsafe' },
    ],
    triage: {
      text: "Three people from the same crash arrive together: {patient}, the driver, with low blood pressure and belly pain; a passenger walking and talking with a sore neck; a second passenger with a cut on the arm that has stopped bleeding.",
      options: [
        { id: 'driver', label: 'The driver with low blood pressure', quality: 'best' },
        { id: 'neck', label: 'The passenger with the sore neck', quality: 'ok' },
        { id: 'arm', label: 'The passenger with the cut arm', quality: 'poor' },
      ],
    },
    decision: {
      text: "During the resuscitation, the blood pressure keeps falling despite fluids.",
      options: [
        { id: 'escalate', label: 'Tell the team clearly, call the trauma surgeon to come now, and move toward the operating room', quality: 'best' },
        { id: 'more_scans', label: 'Insist on a full set of scans first', quality: 'poor' },
        { id: 'quiet', label: 'Keep it to yourself and hope it improves', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} reaches the operating room quickly and stabilizes.",
      fair: "{patient} stabilizes after some delay and a large transfusion.",
      poor: "{patient} becomes very unstable before reaching surgery and has a long recovery ahead.",
    },
  }),

  // ======================================================================================
  // PSYCHIATRY
  // ======================================================================================
  C({
    id: 'psych_depression_1', specialty: ['psychiatry', 'family'], ages: [22, 60], minYear: 1960, followUp: 'psych_depression_2', tier: 'intermediate',
    label: 'Low for months',
    intro: "{patient}, {age}, was referred by their doctor after months of feeling flat and hopeless.",
    history: "Sleeping badly, not enjoying anything, struggling at work. A relationship ended last spring. Has had passing thoughts that life is not worth it but no plans, and talks about a sister they would not want to hurt.",
    exam: "Slowed, quiet, makes little eye contact but engages when asked about the sister.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A careful conversation over the full hour builds a clear picture of a depressive episode.' },
      { test: 'screening_tool', value: 'useful', result: 'A questionnaire supports moderate depression.' },
      { test: 'blood_basic', value: 'neutral', result: 'Thyroid and blood counts are normal.' },
      { test: 'mri', value: 'low', result: 'A brain scan with nothing to find.' },
    ],
    differential: [
      { id: 'depression', label: 'Depression' },
      { id: 'grief', label: 'Ordinary sadness after a loss' },
      { id: 'bipolar', label: 'Bipolar disorder' },
    ],
    diagnosis: 'depression',
    needs: ['history_detail'],
    plans: [
      { id: 'together', label: 'Agree a plan together: talking therapy, discuss a medicine and its side effects, write a safety plan, and meet again in two weeks', quality: 'best' },
      { id: 'pill_only', label: 'Prescribe a medicine and book a visit in three months', quality: 'poor' },
      { id: 'admit', label: 'Admit to the hospital against their wishes', quality: 'poor' },
      { id: 'cheer_up', label: 'Advise them to get out more', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} starts therapy, keeps the safety plan by the bed, and notices small improvements within weeks.",
      fair: "{patient} improves slowly, with a few missed sessions.",
      poor: "{patient} feels unheard and drops out of care for a while.",
    },
  }),
  C({
    id: 'psych_depression_2', specialty: ['psychiatry', 'family'], ages: [23, 61], minYear: 1960, followUpOnly: true, followUp: 'psych_depression_3', tier: 'intermediate',
    label: 'Review: mood',
    intro: "{patient}, {age}, returns for review a year after starting treatment for depression.",
    history: "Much better: sleeping, back at work, seeing friends. Wants to stop the medicine because they feel well now, but worries about relapse.",
    exam: "Brighter, warm, good eye contact. No thoughts of self-harm.",
    tests: [
      { test: 'screening_tool', value: 'useful', result: 'Scores are now in the normal range.' },
      { test: 'blood_basic', value: 'low', result: 'Not needed today.' },
    ],
    differential: [
      { id: 'remission', label: 'Depression in remission' },
      { id: 'relapse', label: 'A relapse beginning' },
      { id: 'mania', label: 'An elevated mood' },
    ],
    diagnosis: 'remission',
    plans: [
      { id: 'shared', label: 'Talk through the benefits and risks of stopping, agree a slow, supervised plan if they choose it, and keep the safety plan and a follow-up', quality: 'best' },
      { id: 'stop_now', label: 'Tell them to stop the medicine today', quality: 'poor' },
      { id: 'forever', label: 'Insist they must stay on it for life', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} tapers off slowly with support and stays well.",
      fair: "{patient} has a wobble while tapering and slows the plan down.",
      poor: "{patient} stops suddenly and feels unwell for several weeks.",
    },
  }),
  C({
    id: 'psych_depression_3', specialty: ['psychiatry', 'family'], ages: [24, 62], minYear: 1960, followUpOnly: true, tier: 'intermediate',
    label: 'Review: a hard year',
    intro: "{patient}, {age}, returns a year later after a hard few months: a job loss and a parent's illness.",
    history: "Recognizes early signs from before: poor sleep and withdrawing. Reached out early this time, as agreed in the plan. No thoughts of self-harm.",
    exam: "Tired and worried, but engaged and hopeful.",
    tests: [
      { test: 'screening_tool', value: 'useful', result: 'Mild symptoms, much less than at the first visit.' },
      { test: 'history_detail', value: 'useful', result: 'Their own early warning plan worked as intended.' },
    ],
    differential: [
      { id: 'early_relapse', label: 'Early signs of a relapse, caught in time' },
      { id: 'stress', label: 'Normal stress only' },
      { id: 'severe', label: 'A severe relapse' },
    ],
    diagnosis: 'early_relapse',
    plans: [
      { id: 'restart', label: 'Praise the early call, restart therapy sessions, discuss whether to restart the medicine together, and review in a month', quality: 'best' },
      { id: 'nothing', label: 'Reassure them and do nothing', quality: 'poor' },
      { id: 'admit', label: 'Arrange admission to the hospital', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} gets through the hard months without sliding back into a deep depression.",
      fair: "{patient} struggles for a while but stays connected to care.",
      poor: "{patient}'s mood drops further before it lifts again.",
    },
  }),
  C({
    id: 'psych_veteran_1920', specialty: ['psychiatry', 'internal', 'family'], ages: [22, 40], minYear: 1919, sex: 'male', tier: 'intermediate',
    label: 'Cannot sleep',
    intro: "{patient}, {age}, a former soldier, has not slept properly since coming home from the war.",
    history: "Wakes with nightmares, startles at loud noises, and has stopped going to the shop where he worked. His wife says he is short-tempered and then ashamed of it.",
    exam: "Restless, watchful, a tremor in the hands. Physically well.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A patient, unhurried talk brings out what he has been carrying since the war.' },
      { test: 'screening_tool', value: 'useful', result: 'Answers fit a lasting reaction to frightening experiences.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
    ],
    differential: [
      { id: 'trauma_reaction', label: 'A lasting reaction to the war' },
      { id: 'weakness', label: 'Weakness of character' },
      { id: 'thyroid', label: 'An overactive thyroid' },
    ],
    diagnosis: 'trauma_reaction',
    plans: [
      { id: 'listen', label: 'Listen without judgment, agree a plan of regular talking sessions, a steady routine and gradual return to work, and see him again soon', quality: 'best' },
      { id: 'asylum', label: 'Commit him to an asylum', quality: 'poor' },
      { id: 'pull_together', label: 'Tell him to pull himself together', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} sleeps better over months and returns to the shop part-time.",
      fair: "{patient} has good weeks and bad weeks but keeps coming back.",
      poor: "{patient} withdraws further, and his family struggles.",
    },
  }),
  C({
    id: 'psych_panic', specialty: ['psychiatry', 'family'], ages: [18, 35], minYear: 1970,
    label: 'Sudden attacks of fear',
    intro: "{patient}, {age}, has had several sudden attacks of racing heart and terror and has started avoiding buses.",
    history: "Attacks last ten minutes, with tingling and a feeling of dying. Two emergency visits found nothing wrong with the heart. Little caffeine; no drugs.",
    exam: "Anxious but well. Heart sounds and pulse are normal.",
    tests: [
      { test: 'ecg', value: 'neutral', result: 'A normal heart tracing, as before.' },
      { test: 'screening_tool', value: 'useful', result: 'Answers fit panic disorder.' },
      { test: 'angiogram', value: 'low', result: 'An invasive heart test without any reason.' },
    ],
    differential: [
      { id: 'panic', label: 'Panic disorder' },
      { id: 'heart', label: 'A heart rhythm problem' },
      { id: 'thyroid', label: 'An overactive thyroid' },
    ],
    diagnosis: 'panic',
    plans: [
      { id: 'cbt', label: 'Explain what panic is, start a talking therapy that works on fear and avoidance, discuss medicine as an option, and follow up', quality: 'best' },
      { id: 'sedative', label: 'Give a strong sedative to take whenever an attack starts', quality: 'poor' },
      { id: 'more_heart', label: 'Refer for more heart tests', quality: 'poor', refer: 'cardiology' },
    ],
    outcomes: {
      good: "{patient} rides the bus again within a few months.",
      fair: "{patient} has fewer attacks but still avoids crowded places.",
      poor: "{patient}'s world shrinks as avoidance grows.",
    },
  }),
  C({
    id: 'psych_delirium', specialty: ['psychiatry'], ages: [70, 95], minYear: 1960, tier: 'intermediate',
    label: 'A ward consultation',
    intro: "The surgical ward asks for a psychiatry opinion on {patient}, {age}, who has become agitated and confused two days after a hip operation.",
    history: "The family says {patient} was sharp and independent before. Confusion comes and goes, worse at night. New pain medicines; has not passed urine much.",
    exam: "Drowsy then restless, inattentive, picking at the sheets. Bladder is full.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Signs of dehydration and mild infection.' },
      { test: 'urine', value: 'useful', result: 'A urine infection.' },
      { test: 'screening_tool', value: 'useful', result: 'A short attention test confirms acute confusion.' },
      { test: 'mri', value: 'low', result: 'Moving an agitated patient for a scan adds little.' },
    ],
    differential: [
      { id: 'delirium', label: 'Delirium (acute confusion with a medical cause)' },
      { id: 'dementia', label: 'Dementia' },
      { id: 'psychosis', label: 'A new psychiatric illness' },
    ],
    diagnosis: 'delirium',
    plans: [
      { id: 'treat_cause', label: 'Advise the team to treat the infection and the bladder, review the medicines, keep family and familiar things close, and avoid sedation where possible', quality: 'best' },
      { id: 'sedate', label: 'Recommend strong sedation to keep them quiet', quality: 'poor' },
      { id: 'transfer', label: 'Transfer to the psychiatric unit', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s confusion clears within days and they go home to rehabilitation.",
      fair: "{patient} clears slowly and needs a longer stay.",
      poor: "{patient} stays confused for weeks and loses strength.",
    },
  }),

  // ======================================================================================
  // DERMATOLOGY
  // ======================================================================================
  C({
    id: 'derm_mole', specialty: ['dermatology', 'family'], ages: [30, 75], minYear: 1950, tier: 'intermediate',
    label: 'A changing mole',
    intro: "{patient}, {age}, has noticed that a mole on their back has changed.",
    history: "A partner noticed it growing darker and larger over the summer. Lots of sunburns as a child.",
    exam: "An uneven, two-colored mole with an irregular edge, larger than the others.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Close inspection shows a pattern that needs a biopsy.' },
      { test: 'biopsy', value: 'useful', result: 'An early melanoma, thin, removed with a margin.' },
      { test: 'ct', value: 'low', result: 'Body scanning is not needed before knowing what it is.' },
    ],
    differential: [
      { id: 'melanoma', label: 'A melanoma' },
      { id: 'mole', label: 'An ordinary mole' },
      { id: 'seb_k', label: 'A harmless age spot' },
    ],
    diagnosis: 'melanoma',
    needs: ['biopsy'],
    plans: [
      { id: 'biopsy', label: 'Explain the concern, take a biopsy with consent, and book a visit to discuss the result in person', quality: 'best', procedure: 'derm_biopsy' },
      { id: 'watch', label: 'Photograph it and check again in a year', quality: 'poor' },
      { id: 'freeze', label: 'Freeze it off without a sample', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient}'s early melanoma is fully removed and regular skin checks begin.",
      fair: "{patient} needs a second, wider removal but does well.",
      poor: "{patient}'s melanoma is found later than it should have been.",
    },
  }),
  C({
    id: 'derm_eczema', specialty: ['dermatology', 'pediatrics'], ages: [1, 8], minYear: 1950, guardian: true,
    label: 'Itchy skin',
    intro: "{patient}, {age}, scratches all night. A parent brings them in, exhausted.",
    history: "Dry, itchy patches in the elbow and knee creases since infancy. Bubble baths every night. A parent has hay fever.",
    exam: "Dry, red, scratched skin in the creases with no signs of infection.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A typical eczema pattern.' },
      { test: 'blood_special', value: 'low', result: 'Allergy blood tests that are often misleading here.' },
      { test: 'biopsy', value: 'low', result: 'A painful test the child does not need.' },
    ],
    differential: [
      { id: 'eczema', label: 'Eczema' },
      { id: 'scabies', label: 'Scabies' },
      { id: 'psoriasis', label: 'Psoriasis' },
    ],
    diagnosis: 'eczema',
    plans: [
      { id: 'skin_care', label: 'Explain eczema, show a daily moisturizing routine, gentle washing, and a treatment cream for flares, with a follow-up', quality: 'best' },
      { id: 'diet', label: 'Cut out several foods to see if it helps', quality: 'poor' },
      { id: 'parent_only', label: 'Talk only to the parent and ignore what helps the child', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} sleeps through the night again within weeks.",
      fair: "{patient} improves but has flares in winter.",
      poor: "{patient}'s skin stays inflamed and the family is worn out.",
    },
  }),
  C({
    id: 'derm_psoriasis', specialty: ['dermatology'], ages: [20, 65], minYear: 1960,
    label: 'Scaly patches',
    intro: "{patient}, {age}, has thick scaly patches on the elbows and knees and stopped wearing short sleeves.",
    history: "On and off for years, worse with stress. Some stiffness in the fingers in the morning.",
    exam: "Well-defined red plaques with silvery scale. Pitting of the fingernails.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Typical psoriasis, with nail changes.' },
      { test: 'xray', value: 'neutral', result: 'Hand X-rays show no joint damage yet.' },
      { test: 'biopsy', value: 'low', result: 'Not needed when the picture is this clear.' },
    ],
    differential: [
      { id: 'psoriasis', label: 'Psoriasis' },
      { id: 'eczema', label: 'Eczema' },
      { id: 'fungal', label: 'A fungal infection' },
    ],
    diagnosis: 'psoriasis',
    plans: [
      { id: 'plan', label: 'Talk about how it affects their life, agree a treatment plan, ask about the joints and arrange a rheumatology opinion, and follow up', quality: 'best' },
      { id: 'cream_only', label: 'Give a cream and say there is nothing more to do', quality: 'poor' },
      { id: 'strongest', label: 'Start the strongest treatment available straight away', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient}'s skin clears a great deal, and early joint symptoms are treated in time.",
      fair: "{patient}'s skin improves but the joints need more attention.",
      poor: "{patient} gives up on treatment and keeps covering up.",
    },
  }),
  C({
    id: 'derm_cosmetic', specialty: ['dermatology', 'plastic'], ages: [35, 70], minYear: 1980, cosmetic: true,
    label: 'A cosmetic consultation',
    intro: "{patient}, {age}, would like advice about wrinkles and sun spots on the face.",
    history: "Spends a lot of time outdoors without sunscreen. Has realistic hopes and a budget in mind.",
    exam: "Sun damage and fine lines. One rough, scaly spot on the temple looks different from the rest.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Mostly sun damage, plus one spot that should be checked.' },
      { test: 'biopsy', value: 'useful', result: 'The rough spot is a precancerous sun spot.' },
      { test: 'ct', value: 'low', result: 'No place for this.' },
    ],
    differential: [
      { id: 'sun_damage', label: 'Sun damage with one precancerous spot' },
      { id: 'cancer', label: 'Skin cancer' },
      { id: 'aging', label: 'Ordinary aging only' },
    ],
    diagnosis: 'sun_damage',
    plans: [
      { id: 'honest', label: 'Treat the precancerous spot first, talk honestly about cosmetic options and costs, and recommend daily sunscreen', quality: 'best' },
      { id: 'upsell', label: 'Sell the most expensive package and ignore the odd spot', quality: 'poor' },
      { id: 'refuse', label: 'Refuse to discuss cosmetic treatment at all', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient}'s spot is treated, the skin looks fresher, and sunscreen becomes a habit.",
      fair: "{patient} is pleased with part of the treatment.",
      poor: "{patient} feels pressured and does not come back.",
    },
  }),

  // ======================================================================================
  // NEUROLOGY
  // ======================================================================================
  C({
    id: 'neuro_migraine', specialty: ['neurology', 'family'], ages: [18, 50], minYear: 1960,
    label: 'Frequent headaches',
    intro: "{patient}, {age}, has headaches on most days and has been referred by their doctor.",
    history: "Migraines since school, now almost daily. Takes over-the-counter painkillers nearly every day. Sleep is poor and coffee intake is high.",
    exam: "A normal nerve examination and normal eyes.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A headache diary shows painkillers on most days of the month.' },
      { test: 'mri', value: 'low', result: 'A normal scan that does not change the plan.' },
      { test: 'eeg', value: 'low', result: 'Not useful for headaches.' },
    ],
    differential: [
      { id: 'overuse', label: 'Migraine made worse by frequent painkillers' },
      { id: 'tumor', label: 'A brain tumor' },
      { id: 'tension', label: 'Tension headaches' },
    ],
    diagnosis: 'overuse',
    plans: [
      { id: 'plan', label: 'Explain the painkiller cycle, agree a plan to cut back, discuss a preventive medicine, improve sleep and caffeine, and review with a diary', quality: 'best' },
      { id: 'stronger', label: 'Prescribe stronger painkillers', quality: 'poor' },
      { id: 'scan', label: 'Order an MRI to reassure', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s headache days fall sharply within three months.",
      fair: "{patient} improves after a difficult first few weeks.",
      poor: "{patient} keeps having daily headaches.",
    },
  }),
  C({
    id: 'neuro_seizure', specialty: ['neurology', 'emergency'], ages: [18, 40], minYear: 1985, tier: 'intermediate',
    label: 'A first seizure',
    intro: "{patient}, {age}, had a seizure at work yesterday and is now well.",
    history: "A coworker saw stiffening and jerking for a minute, then confusion. No previous episodes. Very little sleep this week. Drives to work.",
    exam: "A normal nerve examination; a bitten tongue.",
    tests: [
      { test: 'eeg', value: 'useful', result: 'Some abnormal activity that suggests a tendency to seizures.' },
      { test: 'mri', value: 'useful', result: 'A normal brain scan.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal salts and sugar.' },
    ],
    differential: [
      { id: 'epilepsy', label: 'A seizure, possibly the start of epilepsy' },
      { id: 'faint', label: 'A faint' },
      { id: 'heart', label: 'A heart rhythm problem' },
    ],
    diagnosis: 'epilepsy',
    needs: ['eeg'],
    plans: [
      { id: 'discuss', label: 'Explain the findings, discuss together whether to start a medicine, cover sleep, safety and the driving rules, and follow up', quality: 'best' },
      { id: 'ignore_driving', label: 'Leave out the driving rules to avoid upsetting them', quality: 'poor' },
      { id: 'nothing', label: 'Call it a one-off and discharge', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} has no further seizures and understands how to stay safe.",
      fair: "{patient} has one more seizure before the plan settles.",
      poor: "{patient} has another seizure while driving and is lucky no one is hurt.",
    },
  }),
  C({
    id: 'neuro_parkinson', specialty: ['neurology', 'internal'], ages: [55, 85], minYear: 1970, tier: 'intermediate',
    label: 'A shaking hand',
    intro: "{patient}, {age}, has a tremor in one hand and their writing has become small.",
    history: "Slower getting dressed. Lost sense of smell years ago. A spouse says they act out dreams.",
    exam: "A resting tremor on one side, stiffness and slow movements. Walks with a shorter arm swing.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A careful examination shows the typical signs.' },
      { test: 'mri', value: 'neutral', result: 'Normal for age; helps exclude other causes.' },
      { test: 'blood_special', value: 'low', result: 'Not helpful here.' },
    ],
    differential: [
      { id: 'parkinson', label: "Parkinson's disease" },
      { id: 'essential', label: 'A harmless tremor' },
      { id: 'stroke', label: 'Small strokes' },
    ],
    diagnosis: 'parkinson',
    plans: [
      { id: 'together', label: 'Share the diagnosis with care, discuss treatment options, exercise and therapy, and plan regular visits', quality: 'best' },
      { id: 'leaflet', label: 'Hand over a leaflet and see them next year', quality: 'poor' },
      { id: 'surgery', label: 'Refer straight away for brain surgery', quality: 'poor', refer: 'neurosurg' },
    ],
    outcomes: {
      good: "{patient} stays active and independent for years with treatment and exercise.",
      fair: "{patient} manages well, with some adjustments along the way.",
      poor: "{patient} struggles to adjust and loses confidence.",
    },
  }),

  // ======================================================================================
  // CARDIOLOGY
  // ======================================================================================
  C({
    id: 'card_angina', specialty: ['cardiology', 'internal'], ages: [50, 80], minYear: 1975, tier: 'intermediate',
    label: 'Chest tightness on exertion',
    intro: "{patient}, {age}, gets chest tightness walking uphill that goes away with rest.",
    history: "Happens for two months, always with effort, never at rest. Ex-smoker with high cholesterol.",
    exam: "Normal heart sounds and blood pressure.",
    tests: [
      { test: 'ecg', value: 'useful', result: 'Changes on an exercise test that point to narrowed arteries.' },
      { test: 'blood_basic', value: 'neutral', result: 'High cholesterol.' },
      { test: 'echo', value: 'neutral', result: 'Normal heart pumping.' },
      { test: 'angiogram', value: 'low', result: 'An invasive test that is not the first step for stable symptoms.' },
    ],
    differential: [
      { id: 'angina', label: 'Stable angina' },
      { id: 'reflux', label: 'Reflux' },
      { id: 'muscle', label: 'A strained muscle' },
    ],
    diagnosis: 'angina',
    needs: ['ecg'],
    plans: [
      { id: 'medical', label: 'Start medicines for symptoms and cholesterol, discuss lifestyle, and consider an angiogram if symptoms persist', quality: 'best' },
      { id: 'cath_now', label: 'Take straight to the catheterization lab for stents', quality: 'ok', procedure: 'card_cath' },
      { id: 'nothing', label: 'Reassure and discharge', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s symptoms settle and they walk farther every month.",
      fair: "{patient} still gets symptoms on hills and needs a further test.",
      poor: "{patient}'s symptoms worsen and they come back through the emergency department.",
    },
  }),
  C({
    id: 'card_afib', specialty: ['cardiology', 'internal', 'family'], ages: [60, 90], minYear: 1960,
    label: 'An irregular heartbeat',
    intro: "{patient}, {age}, has noticed a fluttering in the chest on and off for weeks.",
    history: "Some tiredness. No fainting. High blood pressure. Worries about strokes because a friend had one.",
    exam: "An irregularly irregular pulse. Otherwise well.",
    tests: [
      { test: 'ecg', value: 'useful', result: 'Atrial fibrillation.' },
      { test: 'echo', value: 'useful', result: 'A slightly enlarged upper heart chamber.' },
      { test: 'blood_basic', value: 'neutral', result: 'Thyroid and kidney function are normal.' },
      { test: 'angiogram', value: 'low', result: 'Not the question here.' },
    ],
    differential: [
      { id: 'af', label: 'Atrial fibrillation' },
      { id: 'ectopics', label: 'Harmless extra beats' },
      { id: 'anxiety', label: 'Anxiety' },
    ],
    diagnosis: 'af',
    needs: ['ecg'],
    plans: [
      { id: 'shared', label: 'Explain stroke risk honestly, decide together about a blood thinner and rate control, and follow up', quality: 'best' },
      { id: 'ignore_risk', label: 'Control the rate and skip the stroke conversation', quality: 'poor' },
      { id: 'insist', label: 'Insist on a blood thinner without discussing it', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} understands the choice, starts treatment, and feels better.",
      fair: "{patient} takes some time to settle on a plan.",
      poor: "{patient} stops treatment without understanding why it mattered.",
    },
  }),
  C({
    id: 'card_multivessel', specialty: ['cardiology'], ages: [55, 80], minYear: 1970, tier: 'complex',
    label: 'Angiogram results',
    intro: "{patient}, {age}, has diabetes and angina that is not controlled by medicine, and has had an angiogram.",
    history: "Chest pain on short walks despite treatment. Wants to get back to gardening. Good support at home.",
    exam: "Well at rest. Heart pumping is mildly reduced.",
    tests: [
      { test: 'angiogram', value: 'useful', result: 'Narrowing in three main heart arteries, including the main stem.' },
      { test: 'echo', value: 'useful', result: 'Mildly reduced heart pumping.' },
      { test: 'troponin', value: 'neutral', result: 'Normal: no current heart attack.' },
    ],
    differential: [
      { id: 'multivessel', label: 'Severe disease in several heart arteries' },
      { id: 'single', label: 'One narrow artery' },
      { id: 'spasm', label: 'Artery spasm' },
    ],
    diagnosis: 'multivessel',
    needs: ['angiogram'],
    plans: [
      { id: 'heart_team', label: 'Discuss at a heart team meeting with the cardiothoracic surgeons and refer for bypass surgery', quality: 'best', refer: 'ctsurg' },
      { id: 'stent_all', label: 'Place as many stents as possible right away', quality: 'poor', procedure: 'card_cath' },
      { id: 'medicine_only', label: 'Add more medicine and wait', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} has bypass surgery after a full discussion and is gardening again by summer.",
      fair: "{patient} improves but the decision takes longer than it needed to.",
      poor: "{patient}'s angina keeps limiting daily life.",
    },
  }),
  C({
    id: 'card_palpitations', specialty: ['cardiology', 'family'], ages: [18, 40], minYear: 1975,
    label: 'Skipped beats',
    intro: "{patient}, {age}, feels the heart skip a beat a few times a day, mostly when lying in bed.",
    history: "No fainting, chest pain or breathlessness. Three energy drinks a day during exams.",
    exam: "Normal heart sounds; healthy.",
    tests: [
      { test: 'ecg', value: 'useful', result: 'Occasional harmless extra beats.' },
      { test: 'echo', value: 'neutral', result: 'A normal heart structure.' },
      { test: 'angiogram', value: 'low', result: 'Invasive and unnecessary.' },
    ],
    differential: [
      { id: 'ectopics', label: 'Harmless extra beats' },
      { id: 'af', label: 'Atrial fibrillation' },
      { id: 'heart_disease', label: 'Structural heart disease' },
    ],
    diagnosis: 'ectopics',
    plans: [
      { id: 'reassure', label: 'Explain the finding, suggest cutting the energy drinks, and say when to come back', quality: 'best' },
      { id: 'medicine', label: 'Start a heart rhythm medicine', quality: 'poor' },
      { id: 'cath', label: 'Arrange a catheter study', quality: 'poor', procedure: 'card_cath' },
    ],
    outcomes: {
      good: "{patient} cuts the energy drinks and the skips nearly vanish.",
      fair: "{patient} still notices them sometimes but no longer worries.",
      poor: "{patient} keeps worrying and visits the emergency department again.",
    },
  }),

  // ======================================================================================
  // RADIOLOGY (reading: the request, what the images show, how it is reported)
  // ======================================================================================
  C({
    id: 'rad_head_bleed', specialty: ['radiology'], ages: [60, 90], minYear: 1976, tier: 'complex',
    label: 'Head scan request',
    intro: "The emergency department requests a head CT for {patient}, {age}, who fell and has become drowsy.",
    history: "The request says {patient} takes a blood thinner and was confused on arrival.",
    exam: "The scan shows a fresh collection of blood over the surface of the brain, pushing the brain slightly to one side.",
    tests: [
      { test: 'ct', value: 'useful', result: 'The images are clear enough to report now.' },
      { test: 'mri', value: 'low', result: 'An extra scan would only delay the call.' },
    ],
    differential: [
      { id: 'subdural', label: 'An acute bleed over the brain surface' },
      { id: 'stroke', label: 'An old stroke' },
      { id: 'artifact', label: 'A scanning artifact' },
    ],
    diagnosis: 'subdural',
    plans: [
      { id: 'call', label: 'Call the referring team now, suggest a neurosurgery opinion, and document the call in the report', quality: 'best' },
      { id: 'queue', label: 'Leave it in the routine report queue', quality: 'poor' },
      { id: 'email', label: 'Send an email and move on', quality: 'poor' },
    ],
    outcomes: {
      good: "Because the call went straight through, {patient} sees neurosurgery within the hour.",
      fair: "{patient}'s team gets the message after a short delay.",
      poor: "{patient}'s treatment is delayed while the report waits in a queue.",
    },
  }),
  C({
    id: 'rad_nodule', specialty: ['radiology'], ages: [50, 80], minYear: 1980,
    label: 'Chest scan report',
    intro: "{patient}, {age}, had a chest CT ordered by the emergency department to look for a blood clot.",
    history: "The request asks only about a clot. {patient} is a former smoker.",
    exam: "No clot. There is a small, smooth nodule in one lung that was not the question being asked.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A chest X-ray from five years ago is found, and the nodule may be faintly visible then too.' },
      { test: 'ct', value: 'neutral', result: 'The current study is already enough to describe it.' },
    ],
    differential: [
      { id: 'benign', label: 'Probably a harmless nodule that needs a follow-up scan' },
      { id: 'cancer', label: 'Certainly lung cancer' },
      { id: 'clot', label: 'A blood clot' },
    ],
    diagnosis: 'benign',
    plans: [
      { id: 'report_rec', label: 'Report no clot, describe the nodule clearly with a follow-up recommendation, and make sure the primary doctor receives it', quality: 'best' },
      { id: 'ignore', label: 'Answer only the question asked and leave the nodule out', quality: 'poor' },
      { id: 'alarm', label: 'Call it cancer and recommend an urgent biopsy', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s follow-up scan shows the nodule is stable and harmless.",
      fair: "{patient}'s follow-up happens, a few months later than recommended.",
      poor: "{patient}'s nodule is forgotten until it turns up again years later.",
    },
  }),
  C({
    id: 'rad_free_air', specialty: ['radiology'], ages: [40, 85], minYear: 1920, tier: 'complex',
    label: 'Abdominal film request',
    intro: "A surgical ward requests imaging for {patient}, {age}, who has sudden severe belly pain.",
    history: "The request mentions a history of stomach ulcers.",
    exam: "There is air under the diaphragm, outside the bowel, which means a hole somewhere in the gut.",
    tests: [
      { test: 'xray', value: 'useful', result: 'An upright film shows the free air clearly.' },
      { test: 'ct', value: 'neutral', result: 'Would add detail but must not delay the call.' },
    ],
    differential: [
      { id: 'perforation', label: 'A perforated ulcer or bowel' },
      { id: 'normal', label: 'Normal gas in the bowel' },
      { id: 'obstruction', label: 'A blocked bowel' },
    ],
    diagnosis: 'perforation',
    plans: [
      { id: 'call_surgeon', label: 'Call the surgical team now and document the call', quality: 'best' },
      { id: 'routine', label: 'Put it in the routine reporting list', quality: 'poor' },
      { id: 'more_imaging', label: 'Ask for more scans before saying anything', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} is in the operating room within hours and recovers.",
      fair: "{patient} has surgery after some delay and a slower recovery.",
      poor: "{patient}'s surgery is delayed and the recovery is long and complicated.",
    },
  }),
  C({
    id: 'rad_wrist', specialty: ['radiology'], ages: [18, 40], minYear: 1920,
    label: 'Wrist film request',
    intro: "An urgent care clinic sends wrist X-rays for {patient}, {age}, who fell on an outstretched hand.",
    history: "The request says there is tenderness at the base of the thumb.",
    exam: "No fracture line is clearly seen, but the soft tissue near one small wrist bone looks a little swollen.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Extra angled views are suggested in the report.' },
      { test: 'mri', value: 'neutral', result: 'Could settle the question if symptoms persist.' },
    ],
    differential: [
      { id: 'occult', label: 'A possible hidden fracture of a small wrist bone' },
      { id: 'normal', label: 'A normal wrist' },
      { id: 'sprain', label: 'Definitely only a sprain' },
    ],
    diagnosis: 'occult',
    plans: [
      { id: 'hedge', label: 'Report that a hidden fracture cannot be excluded and recommend a splint and repeat imaging', quality: 'best' },
      { id: 'normal', label: 'Report as normal', quality: 'poor' },
      { id: 'surgery', label: 'Recommend urgent surgery', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} is splinted, and the repeat image shows a small fracture caught early.",
      fair: "{patient}'s fracture is confirmed a little later than ideal but heals.",
      poor: "{patient}'s missed fracture heals poorly and causes lasting wrist pain.",
    },
  }),

  // ======================================================================================
  // PATHOLOGY
  // ======================================================================================
  C({
    id: 'path_frozen', specialty: ['pathology'], ages: [40, 80], minYear: 1920, tier: 'complex',
    label: 'An urgent request from the operating room',
    intro: "A surgeon operating on {patient}, {age}, sends a piece of tissue and is waiting for an answer before deciding how much to remove.",
    history: "The request asks whether the edge of what has been removed is clear of tumor.",
    exam: "Under the microscope, the tissue at one edge still contains tumor cells.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'A quick preparation of the tissue is clear enough to answer.' },
    ],
    differential: [
      { id: 'positive', label: 'Tumor at the edge' },
      { id: 'clear', label: 'Clear edge' },
      { id: 'uncertain', label: 'Too uncertain to call' },
    ],
    diagnosis: 'positive',
    plans: [
      { id: 'phone', label: 'Call the operating room directly, state the finding clearly, and confirm it was heard and recorded', quality: 'best' },
      { id: 'note', label: 'Write it in the final report next week', quality: 'poor' },
      { id: 'guess', label: 'Say it is probably clear to save time', quality: 'unsafe' },
    ],
    outcomes: {
      good: "The surgeon removes a little more tissue and {patient}'s final edges are clear.",
      fair: "{patient} needs a second, smaller operation later.",
      poor: "{patient} needs a larger second operation because the message was not clear.",
    },
  }),
  C({
    id: 'path_melanoma', specialty: ['pathology'], ages: [30, 75], minYear: 1950, tier: 'intermediate',
    label: 'A skin biopsy',
    intro: "A dermatologist sends a skin biopsy from {patient}, {age}, from a changing mole.",
    history: "The request notes the mole grew and darkened over months.",
    exam: "The slides show a melanoma that is thin and has not spread deeply; one side edge is close.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'Special stains confirm the cell type.' },
    ],
    differential: [
      { id: 'melanoma', label: 'A thin melanoma' },
      { id: 'atypical', label: 'An unusual but harmless mole' },
      { id: 'bcc', label: 'A different, slow-growing skin cancer' },
    ],
    diagnosis: 'melanoma',
    plans: [
      { id: 'report_call', label: 'Issue a clear report with the depth and margins, and call the dermatologist so the patient is seen promptly', quality: 'best' },
      { id: 'report_only', label: 'Issue the report and assume it will be read', quality: 'ok' },
      { id: 'vague', label: 'Report it vaguely as atypical', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} has a wider excision quickly and is cured.",
      fair: "{patient}'s follow-up is arranged a few weeks late but goes well.",
      poor: "{patient}'s vague report causes confusion and a delay in treatment.",
    },
  }),
  C({
    id: 'path_lipoma', specialty: ['pathology'], ages: [30, 70], minYear: 1920,
    label: 'A routine specimen',
    intro: "A general surgeon sends a soft lump removed from the back of {patient}, {age}.",
    history: "The lump had been there for years and was removed because it rubbed on clothing.",
    exam: "The slides show ordinary fat cells in a thin capsule, with nothing worrying.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'The whole specimen is sampled and looks benign throughout.' },
    ],
    differential: [
      { id: 'lipoma', label: 'A harmless fatty lump' },
      { id: 'sarcoma', label: 'A rare soft tissue cancer' },
      { id: 'cyst', label: 'A skin cyst' },
    ],
    diagnosis: 'lipoma',
    plans: [
      { id: 'routine', label: 'Report it in the routine way, clearly and on time', quality: 'best' },
      { id: 'urgent_call', label: 'Call the surgeon urgently in the middle of an operation about it', quality: 'poor' },
      { id: 'extra_stains', label: 'Order every special stain available', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} gets the reassuring result at the next clinic visit.",
      fair: "{patient}'s result arrives a little slowly.",
      poor: "{patient} waits weeks and worries for nothing.",
    },
  }),

  // ======================================================================================
  // ANESTHESIOLOGY (fitness for a procedure, the plan, the patient through it)
  // ======================================================================================
  C({
    id: 'anes_sleep_apnea', specialty: ['anesthesiology'], ages: [45, 75], minYear: 1980, tier: 'intermediate',
    label: 'Pre-operative assessment',
    intro: "{patient}, {age}, is booked for a gallbladder operation and comes to the pre-operative clinic.",
    history: "Snores loudly, wakes up tired, and a spouse says breathing stops at night. High blood pressure. Has never been tested for sleep apnea.",
    exam: "A large neck, a small mouth opening and a crowded throat. Heart and lungs are normal.",
    tests: [
      { test: 'screening_tool', value: 'useful', result: 'A sleep apnea questionnaire scores high risk.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
      { test: 'angiogram', value: 'low', result: 'No reason for an invasive heart test.' },
    ],
    differential: [
      { id: 'osa', label: 'Likely sleep apnea, with a possibly difficult airway' },
      { id: 'fit', label: 'No extra risk' },
      { id: 'heart', label: 'Heart failure' },
    ],
    diagnosis: 'osa',
    plans: [
      { id: 'plan_ahead', label: 'Plan for a possibly difficult airway with the right team and equipment, closer monitoring after surgery, and refer for a sleep study', quality: 'best', procedure: 'anes_care' },
      { id: 'cancel', label: 'Cancel the operation indefinitely', quality: 'poor' },
      { id: 'routine', label: 'Proceed as routine and plan nothing extra', quality: 'poor' },
    ],
    decision: {
      text: "At the start of the anesthetic, the airway is harder to manage than expected and oxygen levels begin to fall.",
      options: [
        { id: 'call_help', label: 'Call for help early, use the planned backup, and talk the team through it', quality: 'best' },
        { id: 'keep_trying', label: 'Keep trying the same approach alone', quality: 'poor' },
        { id: 'hide', label: 'Say nothing to the surgeon', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient}'s operation goes smoothly because the team was ready, and the sleep study leads to treatment.",
      fair: "{patient}'s airway is tricky but managed, and the recovery needs extra monitoring.",
      poor: "{patient} has a frightening moment at the start and needs a night in intensive care.",
    },
  }),
  C({
    id: 'anes_child_tonsils', specialty: ['anesthesiology'], ages: [4, 10], minYear: 1950, guardian: true,
    label: 'A frightened child',
    intro: "{patient}, {age}, is due for a tonsil operation and is clinging to a parent and crying.",
    history: "Had a cold last week, now better. No allergies. The parent asks to stay until {patient} is asleep.",
    exam: "Clear chest, no fever. Large tonsils.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The cold has cleared; the chest is clear.' },
      { test: 'blood_basic', value: 'low', result: 'A needle the child did not need.' },
    ],
    differential: [
      { id: 'fit', label: 'Fit for the operation' },
      { id: 'chest_infection', label: 'A chest infection' },
      { id: 'unfit', label: 'Too unwell to proceed' },
    ],
    diagnosis: 'fit',
    plans: [
      { id: 'parent_present', label: 'Explain in simple words, let the parent stay until {patient} is asleep, and use a gentle start', quality: 'best', procedure: 'anes_care' },
      { id: 'hold_down', label: 'Send the parent out and proceed quickly', quality: 'poor', procedure: 'anes_care' },
      { id: 'cancel', label: 'Cancel because the child is upset', quality: 'ok' },
    ],
    decision: {
      text: "During the operation the child's breathing becomes noisy and the oxygen dips a little.",
      options: [
        { id: 'team', label: 'Tell the surgeon, pause, and manage the airway calmly together', quality: 'best' },
        { id: 'ignore', label: 'Wait and see', quality: 'poor' },
        { id: 'rush', label: 'Ask the surgeon to finish as fast as possible', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} wakes up calm, with the parent at the bedside.",
      fair: "{patient} is upset on waking but settles quickly.",
      poor: "{patient} has a difficult wake-up and dreads hospitals afterward.",
    },
  }),
  C({
    id: 'anes_urgent_cesarean', specialty: ['anesthesiology', 'obgyn'], ages: [20, 42], minYear: 1960, sex: 'female', tier: 'complex',
    label: 'An urgent cesarean',
    intro: "The obstetric team calls: {patient}, {age}, needs an urgent cesarean delivery because labor has stopped progressing.",
    history: "Healthy pregnancy. Has an epidural in place that is working well. Ate a light meal hours ago.",
    exam: "Mother is stable. The baby's heart rate is reassuring for now.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The epidural is working and can be extended.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal blood count.' },
    ],
    differential: [
      { id: 'regional', label: 'Suitable for regional anesthesia so she can be awake' },
      { id: 'general', label: 'Needs a general anesthetic' },
      { id: 'unfit', label: 'Not fit to proceed' },
    ],
    diagnosis: 'regional',
    plans: [
      { id: 'regional', label: 'Explain the plan to her, extend the regional anesthesia so she is awake for the birth, and keep her partner close', quality: 'best', procedure: 'anes_care' },
      { id: 'general', label: 'Give a general anesthetic without discussing it', quality: 'poor', procedure: 'anes_care' },
      { id: 'delay', label: 'Wait an hour to see if labor restarts', quality: 'poor' },
    ],
    decision: {
      text: "Just after the birth, the mother's blood pressure drops and she feels faint.",
      options: [
        { id: 'communicate', label: 'Tell the obstetrician, treat it calmly, and reassure the mother', quality: 'best' },
        { id: 'silent', label: 'Treat it quietly without telling anyone', quality: 'poor' },
        { id: 'leave', label: 'Ignore it, it will pass', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} meets her baby awake and well, and recovers smoothly.",
      fair: "{patient} feels unwell for a while after the birth but recovers.",
      poor: "{patient} loses more blood than usual and needs a longer recovery.",
    },
  }),
  C({
    id: 'anes_crash', specialty: ['anesthesiology'], ages: [20, 45], minYear: 1980, tier: 'high', episode: 'crash_trauma',
    label: 'Trauma to the operating room',
    intro: "The trauma surgeon is taking {patient}, {age}, a driver injured in a road crash, straight to the operating room.",
    history: "Bleeding inside the belly, a broken thigh bone, and a brief loss of consciousness at the scene. Unknown when {patient} last ate.",
    exam: "Drowsy, pale, fast pulse, low blood pressure despite fluids.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Blood count falling; blood is matched and ready.' },
      { test: 'ct', value: 'unsafe', result: 'More scans now would delay stopping the bleeding.' },
    ],
    differential: [
      { id: 'hemorrhage', label: 'Ongoing bleeding needing urgent surgery' },
      { id: 'stable', label: 'Stable enough to wait' },
      { id: 'heart', label: 'A primary heart problem' },
    ],
    diagnosis: 'hemorrhage',
    plans: [
      { id: 'trauma_plan', label: 'Plan a general anesthetic suited to a bleeding, possibly full-stomach patient, with blood ready and the team briefed', quality: 'best', procedure: 'anes_care' },
      { id: 'delay', label: 'Wait until the blood pressure is normal before starting', quality: 'poor' },
      { id: 'no_brief', label: 'Start without a team briefing to save time', quality: 'poor', procedure: 'anes_care' },
    ],
    decision: {
      text: "As the operation begins, the blood pressure drops sharply.",
      options: [
        { id: 'pause_team', label: 'Tell the surgeon, call for more help and blood, and work through it together', quality: 'best' },
        { id: 'hurry', label: 'Ask the surgeon to hurry and say nothing else', quality: 'poor' },
        { id: 'stop', label: 'Leave the room to fetch supplies yourself', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} stays stable through surgery and goes to intensive care in good shape.",
      fair: "{patient} needs a lot of blood but makes it through.",
      poor: "{patient} is very unstable during the operation and the recovery ahead is long.",
    },
  }),

  // ======================================================================================
  // PODIATRY
  // ======================================================================================
  C({
    id: 'pod_diabetic_ulcer', specialty: ['podiatry'], ages: [45, 85], minYear: 1975, tier: 'intermediate',
    label: 'A sore on the foot',
    intro: "{patient}, {age}, has diabetes and a sore under the ball of the foot that is not healing.",
    history: "Did not feel it start. Walks a lot at work in worn shoes. Smokes.",
    exam: "A clean, shallow sore under the forefoot with thick callus around it. Feeling is reduced; pulses are faint.",
    tests: [
      { test: 'vascular_doppler', value: 'useful', result: 'Blood flow to the foot is reduced but adequate for healing.' },
      { test: 'xray', value: 'useful', result: 'No bone infection.' },
      { test: 'blood_basic', value: 'neutral', result: 'Sugar control is poor.' },
      { test: 'mri', value: 'low', result: 'Not needed for a clean, shallow sore.' },
    ],
    differential: [
      { id: 'neuropathic', label: 'A pressure sore from nerve damage' },
      { id: 'osteomyelitis', label: 'A bone infection' },
      { id: 'ischemic', label: 'A sore from very poor circulation' },
    ],
    diagnosis: 'neuropathic',
    needs: ['vascular_doppler'],
    plans: [
      { id: 'offload', label: 'Take pressure off the sore with a special boot, clean away callus, check it weekly, and work with their doctor on sugars and smoking', quality: 'best', procedure: 'pod_minor' },
      { id: 'cream', label: 'Give a cream and see them in three months', quality: 'poor' },
      { id: 'amputate', label: 'Refer for amputation', quality: 'unsafe', refer: 'vascular' },
    ],
    outcomes: {
      good: "{patient}'s sore heals in eight weeks and new shoes keep it closed.",
      fair: "{patient}'s sore heals slowly over a few months.",
      poor: "{patient}'s sore becomes infected and needs a hospital stay.",
    },
  }),
  C({
    id: 'pod_heel_runner', specialty: ['podiatry', 'ortho_sports'], ages: [25, 60], minYear: 1960,
    label: 'Heel pain',
    intro: "{patient}, {age}, a keen runner, has sharp heel pain with the first steps every morning.",
    history: "Increased mileage for a marathon. Old, worn-out running shoes. Pain eases as they warm up.",
    exam: "Tender at the front of the heel underneath. Tight calf muscles.",
    tests: [
      { test: 'gait', value: 'useful', result: 'Overpronation and worn shoes add strain.' },
      { test: 'xray', value: 'low', result: 'A heel spur common in people without pain.' },
      { test: 'mri', value: 'low', result: 'Not needed at this stage.' },
    ],
    differential: [
      { id: 'plantar_fasciitis', label: 'Plantar fasciitis' },
      { id: 'stress_fracture', label: 'A stress fracture' },
      { id: 'nerve', label: 'A trapped nerve' },
    ],
    diagnosis: 'plantar_fasciitis',
    plans: [
      { id: 'conservative', label: 'Stretching, new shoes, a short break in mileage, and supportive inserts, with a review in six weeks', quality: 'best' },
      { id: 'surgery', label: 'Book an operation on the heel', quality: 'poor', procedure: 'pod_rearfoot' },
      { id: 'stop_running', label: 'Tell them to give up running for good', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} is back to full training in two months.",
      fair: "{patient}'s pain settles slowly over half a year.",
      poor: "{patient}'s pain lingers and they miss the race.",
    },
  }),
  C({
    id: 'pod_flatfoot_orthotics', specialty: ['podiatry'], ages: [10, 50], minYear: 1960,
    label: 'Aching feet',
    intro: "{patient}, {age}, has tired, aching arches by the end of each day on their feet.",
    history: "A shop worker on hard floors all day. Both feet ache equally. No injury.",
    exam: "Flexible flat feet that form an arch on tiptoe. No tenderness over tendons.",
    tests: [
      { test: 'gait', value: 'useful', result: 'The feet roll in during walking, increasing strain on the arches.' },
      { test: 'xray', value: 'low', result: 'Not needed for flexible flat feet.' },
    ],
    differential: [
      { id: 'flexible_flatfoot', label: 'Flexible flat feet with overuse' },
      { id: 'tendon', label: 'A failing tendon' },
      { id: 'arthritis', label: 'Arthritis' },
    ],
    diagnosis: 'flexible_flatfoot',
    needs: ['gait'],
    plans: [
      { id: 'orthotics', label: 'Custom orthotics, supportive shoes, and strengthening exercises, with a review', quality: 'best' },
      { id: 'surgery', label: 'Recommend reconstruction', quality: 'poor', procedure: 'pod_rearfoot' },
      { id: 'nothing', label: 'Say flat feet are normal and do nothing', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} finishes work shifts without aching feet.",
      fair: "{patient} is better on most days.",
      poor: "{patient} keeps aching and starts to limp by evening.",
    },
  }),
  C({
    id: 'pod_bunion', specialty: ['podiatry'], ages: [35, 70], minYear: 1970, tier: 'intermediate',
    label: 'A painful bunion',
    intro: "{patient}, {age}, has a bunion that hurts in every shoe.",
    history: "A year of wider shoes, pads and inserts has not helped. Pain limits walking. Healthy and does not smoke. Understands recovery takes months.",
    exam: "A large bunion with the big toe drifting toward the others. Good circulation and feeling.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A moderate to severe bunion with a healthy joint surface.' },
      { test: 'vascular_doppler', value: 'neutral', result: 'Good blood flow.' },
      { test: 'mri', value: 'low', result: 'Adds nothing to the X-ray here.' },
    ],
    differential: [
      { id: 'bunion', label: 'A bunion that has failed non-surgical care' },
      { id: 'gout', label: 'Gout' },
      { id: 'arthritis', label: 'Severe big toe arthritis' },
    ],
    diagnosis: 'bunion',
    needs: ['xray'],
    plans: [
      { id: 'correct', label: 'Discuss risks, benefits and recovery, get consent, and correct the bunion', quality: 'best', procedure: 'pod_forefoot' },
      { id: 'more_pads', label: 'Try pads for another year', quality: 'ok' },
      { id: 'both_feet', label: 'Operate on both feet at once, including the one that does not hurt', quality: 'poor', procedure: 'pod_forefoot' },
    ],
    decision: {
      text: "In the operating room, the team time-out shows the consent form lists the other foot.",
      options: [
        { id: 'stop_check', label: 'Stop, check with the patient and records, and correct the paperwork before starting', quality: 'best' },
        { id: 'proceed', label: 'Proceed on the foot you remember', quality: 'unsafe' },
        { id: 'cancel', label: 'Cancel without speaking to anyone', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} walks comfortably in normal shoes six months later.",
      fair: "{patient} has a slow recovery with some stiffness.",
      poor: "{patient} has a wound problem that delays healing.",
    },
  }),
  C({
    id: 'pod_refer_ischemia', specialty: ['podiatry'], ages: [60, 90], minYear: 1975, tier: 'intermediate',
    label: 'A cold foot',
    intro: "{patient}, {age}, came for a nail trim but mentions the foot has been cold and painful at night.",
    history: "Pain wakes them and is eased by hanging the leg over the bed. Long-time smoker. Calf cramps after a short walk.",
    exam: "A pale, cool foot with no pulses and a small dark spot on one toe.",
    tests: [
      { test: 'vascular_doppler', value: 'useful', result: 'Very poor blood flow to the foot.' },
      { test: 'xray', value: 'low', result: 'Does not help with the blood supply.' },
    ],
    differential: [
      { id: 'critical_ischemia', label: 'Severe loss of blood flow to the foot' },
      { id: 'neuropathy', label: 'Nerve pain' },
      { id: 'gout', label: 'Gout' },
    ],
    diagnosis: 'critical_ischemia',
    needs: ['vascular_doppler'],
    plans: [
      { id: 'refer_vascular', label: 'Explain the concern and refer to vascular surgery urgently, today', quality: 'best', refer: 'vascular' },
      { id: 'trim_only', label: 'Trim the nails and book a routine visit', quality: 'poor' },
      { id: 'debride', label: 'Clean up the dark spot in the office', quality: 'unsafe', procedure: 'pod_minor' },
    ],
    outcomes: {
      good: "{patient} has blood flow restored, and the toe heals.",
      fair: "{patient} has the blood flow improved but loses the tip of one toe.",
      poor: "{patient}'s foot worsens before the vascular team can help.",
    },
  }),
  C({
    id: 'pod_rearfoot_recon', specialty: ['podiatry'], ages: [45, 70], minYear: 1985, tier: 'complex',
    label: 'A collapsing arch',
    intro: "{patient}, {age}, has a foot that has been flattening for two years and now hurts on the outside of the ankle.",
    history: "Braces, orthotics and therapy have been tried for over a year. Healthy, a nonsmoker, with family support for a long recovery.",
    exam: "A rigid flat foot that does not form an arch on tiptoe, with the heel turned out.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Collapse of the arch with stiff, arthritic joints at the back of the foot.' },
      { test: 'mri', value: 'neutral', result: 'Confirms a worn-out tendon.' },
      { test: 'gait', value: 'neutral', result: 'A flat-footed gait.' },
    ],
    differential: [
      { id: 'rigid_flatfoot', label: 'Advanced adult flatfoot with a failed tendon' },
      { id: 'flexible', label: 'A flexible flat foot' },
      { id: 'sprain', label: 'An ankle sprain' },
    ],
    diagnosis: 'rigid_flatfoot',
    needs: ['xray'],
    plans: [
      { id: 'reconstruct', label: 'Talk through the long recovery and risks, get consent, and plan a rearfoot reconstruction', quality: 'best', procedure: 'pod_rearfoot' },
      { id: 'orthotics_again', label: 'Try a new set of insoles', quality: 'poor' },
      { id: 'refer', label: 'Refer to a foot and ankle surgeon', quality: 'ok', refer: 'foot_ankle' },
    ],
    decision: {
      text: "Partway through the operation, the bone quality is softer than the images suggested.",
      options: [
        { id: 'adapt', label: 'Pause, discuss options with the team, and adapt the plan within what was consented', quality: 'best' },
        { id: 'push_on', label: 'Carry on exactly as planned', quality: 'poor' },
        { id: 'extend', label: 'Add a larger operation the patient did not consent to', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} walks without pain a year later.",
      fair: "{patient} has a slow recovery but is better than before.",
      poor: "{patient}'s bones are slow to heal and need a longer time in a cast.",
    },
  }),

  // ======================================================================================
  // GENERAL SURGERY
  // ======================================================================================
  C({
    id: 'gs_appendicitis', specialty: ['gensurg', 'peds_surgery'], ages: [12, 50], minYear: 1900, tier: 'intermediate',
    label: 'Belly pain',
    intro: "{patient}, {age}, has belly pain that started around the navel and moved to the lower right side.",
    history: "Began yesterday, with no appetite and some vomiting. Walking and coughing make it worse.",
    exam: "Mild fever, tender in the lower right belly with guarding.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'A raised white cell count.' },
      { test: 'ultrasound', value: 'useful', result: 'A swollen appendix.' },
      { test: 'ct', value: 'neutral', result: 'Confirms appendicitis; useful when the picture is unclear.' },
      { test: 'urine', value: 'neutral', result: 'No infection.' },
    ],
    differential: [
      { id: 'appendicitis', label: 'Appendicitis' },
      { id: 'gastro', label: 'A stomach bug' },
      { id: 'kidney_stone', label: 'A kidney stone' },
      { id: 'ovarian', label: 'An ovarian problem' },
    ],
    diagnosis: 'appendicitis',
    plans: [
      { id: 'operate', label: 'Explain the risks and benefits, get consent, and remove the appendix today', quality: 'best', procedure: 'gs_abdominal' },
      { id: 'home', label: 'Send home with pain relief', quality: 'unsafe' },
      { id: 'wait_days', label: 'Watch for several days before deciding', quality: 'poor' },
    ],
    decision: {
      text: "During the operation the appendix has burst and there is infection around it.",
      options: [
        { id: 'adapt', label: 'Tell the team, adapt the plan, and plan careful aftercare and antibiotics', quality: 'best' },
        { id: 'ignore', label: 'Finish as if it were routine', quality: 'poor' },
        { id: 'rush', label: 'Hurry to finish and skip the wash-out discussion', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} goes home in two days and is back to normal in two weeks.",
      fair: "{patient} has a wound infection that settles with care.",
      poor: "{patient} develops an abscess and needs a longer stay.",
    },
  }),
  C({
    id: 'gs_hernia', specialty: ['gensurg'], ages: [30, 80], minYear: 1900,
    label: 'A lump in the groin',
    intro: "{patient}, {age}, has a lump in the groin that comes and goes.",
    history: "Gets bigger when lifting or coughing and aches by evening. Pushes back in easily. Works in a warehouse.",
    exam: "A soft lump that goes back in when lying down. No tenderness.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A typical groin hernia.' },
      { test: 'ultrasound', value: 'neutral', result: 'Confirms a hernia; usually not needed.' },
      { test: 'ct', value: 'low', result: 'Radiation for a diagnosis already clear on examination.' },
    ],
    differential: [
      { id: 'hernia', label: 'An inguinal hernia' },
      { id: 'lymph', label: 'A swollen gland' },
      { id: 'lipoma', label: 'A fatty lump' },
    ],
    diagnosis: 'hernia',
    plans: [
      { id: 'repair', label: 'Discuss a planned repair since it is bothering them at work, get consent, and book the operation', quality: 'best', procedure: 'gs_hernia' },
      { id: 'watch', label: 'Watchful waiting with advice on warning signs', quality: 'ok' },
      { id: 'truss_forever', label: 'Tell them to wear a support for life and never operate', quality: 'poor' },
    ],
    decision: {
      text: "During the repair the anesthesiologist says the patient's heart rate has become irregular.",
      options: [
        { id: 'pause', label: 'Pause and work through it with the anesthesia team before continuing', quality: 'best' },
        { id: 'hurry', label: 'Hurry to finish', quality: 'poor' },
        { id: 'ignore', label: 'Carry on without discussing it', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is back at work in a few weeks without the ache.",
      fair: "{patient} has some bruising and is slower to return to lifting.",
      poor: "{patient} has a lingering ache in the groin for months.",
    },
  }),
  C({
    id: 'gs_gallstones', specialty: ['gensurg'], ages: [30, 70], minYear: 1970, tier: 'intermediate',
    label: 'Pain after meals',
    intro: "{patient}, {age}, has had several attacks of pain under the right ribs after fatty meals.",
    history: "Each attack lasts a few hours and has sent them to the emergency department twice. No jaundice.",
    exam: "Tender under the right ribs. No fever or yellowing.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'Gallstones with a thickened gallbladder wall.' },
      { test: 'blood_basic', value: 'useful', result: 'Liver tests are normal.' },
      { test: 'ct', value: 'low', result: 'Ultrasound already answers the question.' },
      { test: 'endoscopy', value: 'low', result: 'Not needed without signs of a stone in the bile duct.' },
    ],
    differential: [
      { id: 'biliary_colic', label: 'Gallstone attacks' },
      { id: 'ulcer', label: 'A stomach ulcer' },
      { id: 'hepatitis', label: 'Hepatitis' },
    ],
    diagnosis: 'biliary_colic',
    needs: ['ultrasound'],
    plans: [
      { id: 'cholecystectomy', label: 'Discuss options and risks, get consent, and plan removal of the gallbladder', quality: 'best', procedure: 'gs_abdominal' },
      { id: 'diet', label: 'Advise a low-fat diet only', quality: 'ok' },
      { id: 'wait', label: 'Wait until it becomes an emergency', quality: 'poor' },
    ],
    decision: {
      text: "During the operation, the anatomy is unclear and the surgeon cannot be certain which duct is which.",
      options: [
        { id: 'pause_senior', label: 'Stop, call a senior colleague, and choose the safer approach even if it takes longer', quality: 'best' },
        { id: 'guess', label: 'Make a best guess and continue', quality: 'unsafe' },
        { id: 'rush', label: 'Press on to keep the list on time', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} goes home the next day and the attacks stop.",
      fair: "{patient} needs an extra night in the hospital but does well.",
      poor: "{patient} has a bile leak that needs another procedure.",
    },
  }),
  C({
    id: 'gs_silent_stones', specialty: ['gensurg'], ages: [40, 80], minYear: 1975,
    label: 'A referral about gallstones',
    intro: "{patient}, {age}, was found to have gallstones on a scan done for another reason and was told they need surgery.",
    history: "Has never had any pain, jaundice or fever. Nervous about operations.",
    exam: "A soft, non-tender belly.",
    tests: [
      { test: 'ultrasound', value: 'neutral', result: 'A few small gallstones in an otherwise normal gallbladder.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal liver tests.' },
      { test: 'ct', value: 'low', result: 'Adds nothing.' },
    ],
    differential: [
      { id: 'silent', label: 'Gallstones causing no symptoms' },
      { id: 'colic', label: 'Gallstone attacks' },
      { id: 'cancer', label: 'A gallbladder cancer' },
    ],
    diagnosis: 'silent',
    plans: [
      { id: 'no_op', label: 'Explain that silent gallstones usually need no operation, describe the warning signs, and leave the door open', quality: 'best' },
      { id: 'operate', label: 'Operate anyway to be safe', quality: 'poor', procedure: 'gs_abdominal' },
      { id: 'repeat_scans', label: 'Book scans every six months', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} leaves relieved and never needs an operation.",
      fair: "{patient} worries for a while but stays well.",
      poor: "{patient} is anxious and seeks surgery elsewhere.",
    },
  }),
  C({
    id: 'gs_obstruction', specialty: ['gensurg'], ages: [40, 85], minYear: 1920, tier: 'complex',
    label: 'Vomiting and a swollen belly',
    intro: "{patient}, {age}, has been vomiting with a swollen belly and no bowel movement for two days.",
    history: "Had abdominal surgery years ago. Cramping pain that comes in waves.",
    exam: "A swollen, mildly tender belly with no signs of a strangulated bowel. Pulse and temperature are normal.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Dilated loops of small bowel, typical of a blockage.' },
      { test: 'ct', value: 'useful', result: 'A blockage from scar tissue with healthy-looking bowel.' },
      { test: 'blood_basic', value: 'useful', result: 'Mild dehydration; no signs of a dying bowel.' },
    ],
    differential: [
      { id: 'adhesions', label: 'A bowel blockage from old scar tissue' },
      { id: 'gastro', label: 'A stomach bug' },
      { id: 'cancer', label: 'A bowel cancer' },
    ],
    diagnosis: 'adhesions',
    needs: ['xray'],
    plans: [
      { id: 'trial', label: 'Rest the bowel with fluids and a tube to drain the stomach, examine often, and operate if it does not settle or worsens', quality: 'best' },
      { id: 'operate_now', label: 'Operate immediately', quality: 'ok', procedure: 'gs_abdominal' },
      { id: 'home', label: 'Send home with laxatives', quality: 'unsafe' },
    ],
    decision: {
      text: "On the second evening, the nurse reports the pain is worse and the pulse is rising.",
      options: [
        { id: 'reassess', label: 'Come and examine now, review with the team, and take the patient to the operating room if needed', quality: 'best' },
        { id: 'morning', label: 'Review on the morning round', quality: 'poor' },
        { id: 'pain_only', label: 'Increase pain relief by phone', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s blockage settles without surgery in three days.",
      fair: "{patient} needs an operation but recovers well.",
      poor: "{patient} needs an operation late and has a slow recovery.",
    },
  }),
  C({
    id: 'gs_abscess', specialty: ['gensurg', 'family', 'emergency'], ages: [18, 60], minYear: 1900,
    label: 'A painful lump',
    intro: "{patient}, {age}, has a hot, painful lump under the arm that has grown over three days.",
    history: "Started as a small spot. No fever. Healthy otherwise.",
    exam: "A red, tender, soft swelling with a pointed center.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A collection of pus under the skin.' },
      { test: 'ultrasound', value: 'neutral', result: 'Confirms a small collection.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'abscess', label: 'A skin abscess' },
      { id: 'lymph', label: 'A swollen lymph gland' },
      { id: 'tumor', label: 'A tumor' },
    ],
    diagnosis: 'abscess',
    plans: [
      { id: 'drain', label: 'Explain, get consent, and drain it under local anesthetic, with wound care advice', quality: 'best', procedure: 'office_minor' },
      { id: 'antibiotics_only', label: 'Antibiotics alone', quality: 'ok' },
      { id: 'theater', label: 'Book a full operation under general anesthesia', quality: 'poor', procedure: 'gs_abdominal' },
    ],
    outcomes: {
      good: "{patient} feels better the same day and the wound heals in two weeks.",
      fair: "{patient} needs a second visit before it heals.",
      poor: "{patient}'s abscess returns and needs draining again.",
    },
  }),

  // ======================================================================================
  // ORTHOPEDIC SURGERY
  // ======================================================================================
  C({
    id: 'ortho_wrist_1900', specialty: ['ortho', 'emergency', 'family'], ages: [50, 85], minYear: 1900,
    label: 'A fall on the hand',
    intro: "{patient}, {age}, slipped on ice and landed on an outstretched hand.",
    history: "Immediate pain and swelling of the wrist. Right-handed. Lives alone.",
    exam: "A swollen, bent wrist with intact feeling and good circulation in the fingers.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A broken wrist bone, tilted but not shattered.' },
      { test: 'ct', value: 'low', result: 'Not needed for a simple wrist fracture.' },
    ],
    differential: [
      { id: 'wrist_fracture', label: 'A broken wrist' },
      { id: 'sprain', label: 'A sprain' },
      { id: 'dislocation', label: 'A dislocation' },
    ],
    diagnosis: 'wrist_fracture',
    needs: ['xray'],
    plans: [
      { id: 'set_cast', label: 'Gently set the bone under pain relief, put it in a cast, check the fingers, and arrange follow-up and help at home', quality: 'best' },
      { id: 'operate', label: 'Operate on every wrist fracture', quality: 'poor', procedure: 'or_fracture' },
      { id: 'sling_only', label: 'Give a sling and send home', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s wrist heals straight in six weeks.",
      fair: "{patient}'s wrist heals with some stiffness.",
      poor: "{patient}'s wrist heals crooked and aches in cold weather.",
    },
  }),
  C({
    id: 'ortho_hip_fracture', specialty: ['ortho'], ages: [70, 95], minYear: 1960, tier: 'complex',
    label: 'Cannot stand after a fall',
    intro: "{patient}, {age}, fell at home and cannot stand. The leg looks shorter and turned out.",
    history: "Was walking with a cane before. Lives with a spouse. Has some heart disease and takes a blood thinner.",
    exam: "Pain on any movement of the hip. Feeling and circulation in the foot are normal.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A fracture of the top of the thigh bone.' },
      { test: 'blood_basic', value: 'useful', result: 'Mild anemia and normal kidney function.' },
      { test: 'ecg', value: 'neutral', result: 'Stable heart rhythm.' },
      { test: 'mri', value: 'low', result: 'Not needed; the X-ray is clear.' },
    ],
    differential: [
      { id: 'hip_fracture', label: 'A hip fracture' },
      { id: 'bruise', label: 'A bruised hip' },
      { id: 'pelvis', label: 'A pelvic fracture' },
    ],
    diagnosis: 'hip_fracture',
    needs: ['xray'],
    plans: [
      { id: 'fix_soon', label: 'Plan surgery within a day or two with the anesthesia and medical teams, discuss risks with the patient and spouse, and start early rehabilitation', quality: 'best', procedure: 'or_fracture' },
      { id: 'bed_rest', label: 'Treat with weeks of bed rest', quality: 'poor' },
      { id: 'delay_tests', label: 'Delay surgery for a week of extra heart tests', quality: 'poor' },
    ],
    decision: {
      text: "Partway through, the anesthesiologist reports the patient's blood pressure has dropped.",
      options: [
        { id: 'pause', label: 'Pause and work through it with the team', quality: 'best' },
        { id: 'hurry', label: 'Hurry to finish', quality: 'poor' },
        { id: 'ignore', label: 'Carry on and let anesthesia handle it alone', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is walking with a frame two days later and goes home within a few weeks.",
      fair: "{patient} has a spell of confusion after surgery but recovers.",
      poor: "{patient} recovers slowly and needs more help at home than before.",
    },
  }),
  C({
    id: 'ortho_knee_oa_severe', specialty: ['ortho'], ages: [55, 85], minYear: 1975, tier: 'intermediate',
    label: 'A worn-out knee',
    intro: "{patient}, {age}, has knee pain that wakes them at night and now limits walking to one block.",
    history: "Years of weight loss efforts, physical therapy, injections and pain relief have stopped helping. Wants to keep up with grandchildren.",
    exam: "A bowed, stiff knee with grinding. Good circulation.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Severe arthritis with bone rubbing on bone.' },
      { test: 'mri', value: 'low', result: 'Adds nothing when the X-ray shows severe arthritis.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal, fit for surgery.' },
    ],
    differential: [
      { id: 'oa', label: 'Severe knee arthritis' },
      { id: 'meniscus', label: 'A torn cartilage' },
      { id: 'gout', label: 'Gout' },
    ],
    diagnosis: 'oa',
    needs: ['xray'],
    plans: [
      { id: 'replace', label: 'Discuss what replacement can and cannot do, risks and rehabilitation, get consent, and plan a knee replacement', quality: 'best', procedure: 'or_joint' },
      { id: 'scope', label: 'Offer a keyhole clean-out of the joint', quality: 'poor', procedure: 'or_arthroscopy' },
      { id: 'more_injections', label: 'Keep giving injections', quality: 'ok' },
    ],
    decision: {
      text: "The nurse at the time-out notices the implant ordered is a different size from the plan.",
      options: [
        { id: 'stop', label: 'Stop and check the plan and stock together before going further', quality: 'best' },
        { id: 'make_do', label: 'Use what is there and adjust as you go', quality: 'poor' },
        { id: 'blame', label: 'Snap at the nurse and carry on', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} walks to the park with the grandchildren six months later.",
      fair: "{patient} has a stiff knee for months but is better than before.",
      poor: "{patient} develops a wound infection that delays recovery.",
    },
  }),
  C({
    id: 'ortho_knee_oa_mild', specialty: ['ortho', 'family'], ages: [45, 70], minYear: 1975,
    label: 'Knee pain',
    intro: "{patient}, {age}, has an aching knee and asks for a knee replacement like a friend had.",
    history: "Aches after long walks; no pain at night. Has not tried physical therapy. Gained weight recently.",
    exam: "Mild swelling, full movement, a little grinding.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Mild arthritis only.' },
      { test: 'mri', value: 'low', result: 'Shows wear that does not change the plan.' },
    ],
    differential: [
      { id: 'mild_oa', label: 'Mild knee arthritis' },
      { id: 'severe_oa', label: 'Severe arthritis' },
      { id: 'ligament', label: 'A ligament injury' },
    ],
    diagnosis: 'mild_oa',
    plans: [
      { id: 'conservative', label: 'Explain that surgery is not the right step now; agree physical therapy, weight and activity goals, and review', quality: 'best' },
      { id: 'replace', label: 'Book a knee replacement since they asked', quality: 'poor', procedure: 'or_joint' },
      { id: 'scope', label: 'Offer keyhole surgery', quality: 'poor', procedure: 'or_arthroscopy' },
    ],
    outcomes: {
      good: "{patient} gets stronger and the knee bothers them far less.",
      fair: "{patient} improves somewhat and comes back in a few years.",
      poor: "{patient} feels dismissed and the knee stays sore.",
    },
  }),
  C({
    id: 'ortho_child_forearm', specialty: ['ortho', 'pediatrics', 'emergency'], ages: [5, 12], minYear: 1900, guardian: true,
    label: 'A hurt arm',
    intro: "{patient}, {age}, fell off the monkey bars. A grandparent brings them in.",
    history: "{patient} says the arm hurts in the middle and does not want to move it. No other injuries.",
    exam: "A bent forearm with good feeling and color in the fingers.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Both forearm bones are broken with some angle; the growth plates are fine.' },
      { test: 'ct', value: 'low', result: 'Radiation the child does not need.' },
    ],
    differential: [
      { id: 'forearm_fracture', label: 'A broken forearm' },
      { id: 'sprain', label: 'A sprain' },
      { id: 'elbow', label: 'An elbow injury' },
    ],
    diagnosis: 'forearm_fracture',
    needs: ['xray'],
    plans: [
      { id: 'reduce_cast', label: 'Explain to the child and grandparent, straighten the arm under sedation or anesthetic, cast it, and arrange follow-up', quality: 'best' },
      { id: 'operate', label: 'Operate with metal plates', quality: 'poor', procedure: 'or_fracture' },
      { id: 'ignore_child', label: 'Talk only to the grandparent and never explain to the child', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s arm heals straight, and they show off the signed cast at school.",
      fair: "{patient} needs the cast adjusted once.",
      poor: "{patient}'s arm heals with a slight bend that needs watching.",
    },
  }),
  C({
    id: 'ortho_crash', specialty: ['ortho'], ages: [20, 45], minYear: 1980, tier: 'complex', episode: 'crash_trauma',
    label: 'A broken thigh bone',
    intro: "{patient}, {age}, was injured in a road crash. The trauma team has stopped bleeding in the belly and now asks orthopedics about a broken thigh bone.",
    history: "Was briefly knocked out at the scene. Now in intensive care, stable for the last six hours.",
    exam: "A splinted, shortened thigh. Feeling and pulses in the foot are normal. The skin is intact.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A broken thigh bone in the middle of the shaft.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood count stable after transfusion.' },
      { test: 'mri', value: 'low', result: 'Not needed for this fracture.' },
    ],
    differential: [
      { id: 'femur', label: 'A broken thigh bone needing fixation' },
      { id: 'hip', label: 'A hip dislocation' },
      { id: 'knee', label: 'A knee ligament injury only' },
    ],
    diagnosis: 'femur',
    needs: ['xray'],
    plans: [
      { id: 'fix_timed', label: 'Agree timing with the trauma, anesthesia and intensive care teams, then fix the fracture once stable, with consent from the patient or family', quality: 'best', procedure: 'or_fracture' },
      { id: 'traction', label: 'Weeks of traction in bed', quality: 'ok' },
      { id: 'operate_now', label: 'Operate straight away regardless of the other injuries', quality: 'poor', procedure: 'or_fracture' },
    ],
    decision: {
      text: "During the fixation, the anesthesiologist says oxygen levels are falling.",
      options: [
        { id: 'pause', label: 'Pause, work through it with the team, and agree whether to finish quickly or stop', quality: 'best' },
        { id: 'press', label: 'Press on without discussion', quality: 'poor' },
        { id: 'leave', label: 'Leave it to anesthesia and keep working', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s leg is fixed and they are standing with help within days.",
      fair: "{patient}'s fracture heals more slowly than hoped.",
      poor: "{patient} has a setback with breathing after the operation but recovers in time.",
    },
  }),

  // ======================================================================================
  // ORTHOPEDIC SPORTS MEDICINE
  // ======================================================================================
  C({
    id: 'sports_acl', specialty: ['ortho_sports'], ages: [16, 35], minYear: 1985, tier: 'intermediate', followUp: 'sports_acl_review',
    label: 'Knee injury',
    intro: "{patient}, {age}, twisted a knee playing basketball and felt something give.",
    history: "Heard a pop, the knee swelled within hours, and it now gives way on turning. Plays competitively and wants to return.",
    exam: "A swollen knee that slides forward more than the other side.",
    tests: [
      { test: 'mri', value: 'useful', result: 'A torn front cruciate ligament with a small cartilage tear.' },
      { test: 'xray', value: 'neutral', result: 'No fracture.' },
      { test: 'ct', value: 'low', result: 'Does not show ligaments well.' },
    ],
    differential: [
      { id: 'acl', label: 'A torn knee ligament' },
      { id: 'sprain', label: 'A sprain' },
      { id: 'kneecap', label: 'A dislocated kneecap' },
    ],
    diagnosis: 'acl',
    needs: ['mri'],
    plans: [
      { id: 'reconstruct', label: 'Explain the options, start prehabilitation, and with consent plan a ligament reconstruction once the swelling settles', quality: 'best', procedure: 'or_ligament' },
      { id: 'rehab_only', label: 'Rehabilitation alone and a change of sport', quality: 'ok' },
      { id: 'play_on', label: 'Strap it up and return to play this week', quality: 'unsafe' },
    ],
    decision: {
      text: "In the operating room, the team notices the scheduled side on the board does not match the marked knee.",
      options: [
        { id: 'stop', label: 'Stop, confirm with the patient and records, and correct it before starting', quality: 'best' },
        { id: 'proceed', label: 'Go with the marked knee and fix the board later', quality: 'poor' },
        { id: 'board', label: 'Go with the board', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient}'s knee is stable and rehabilitation starts the next day.",
      fair: "{patient}'s knee is stiff for longer than expected.",
      poor: "{patient} has a setback in rehabilitation and needs more time.",
    },
  }),
  C({
    id: 'sports_acl_review', specialty: ['ortho_sports'], ages: [17, 36], minYear: 1985, followUpOnly: true,
    label: 'Knee review',
    intro: "{patient}, {age}, returns for review a year after a knee ligament reconstruction and is eager to play again.",
    history: "Rehabilitation went well. The knee feels stable. A big tournament is next month.",
    exam: "A stable knee with full movement. The thigh muscles are still slightly weaker than the other side.",
    tests: [
      { test: 'gait', value: 'useful', result: 'Hop tests show the operated leg is a little short of the other.' },
      { test: 'mri', value: 'low', result: 'A scan that will not change the return-to-play decision.' },
    ],
    differential: [
      { id: 'almost', label: 'Healing well, but not quite ready for full play' },
      { id: 'retear', label: 'A new tear' },
      { id: 'ready', label: 'Fully ready' },
    ],
    diagnosis: 'almost',
    plans: [
      { id: 'targeted', label: 'Agree a few more weeks of targeted strength work with the physical therapist and a staged return, discussed with the athlete and coach', quality: 'best' },
      { id: 'play_now', label: 'Clear for the tournament today', quality: 'poor' },
      { id: 'retire', label: 'Advise giving up the sport', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} returns stronger and plays the rest of the season without problems.",
      fair: "{patient} returns but misses a few games with soreness.",
      poor: "{patient} rushes back and strains the knee again.",
    },
  }),
  C({
    id: 'sports_clavicle', specialty: ['ortho_sports', 'ortho'], ages: [18, 50], minYear: 1950,
    label: 'A shoulder injury',
    intro: "{patient}, {age}, came off a bicycle during a race and landed on the shoulder.",
    history: "Pain over the collarbone. A competitive amateur cyclist. No numbness.",
    exam: "A tender bump on the collarbone. Skin intact, good feeling and pulses in the arm.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A collarbone fracture in the middle, slightly out of line but not badly shortened.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'clavicle', label: 'A broken collarbone' },
      { id: 'ac', label: 'A shoulder joint sprain' },
      { id: 'dislocation', label: 'A dislocated shoulder' },
    ],
    diagnosis: 'clavicle',
    needs: ['xray'],
    plans: [
      { id: 'sling_rehab', label: 'Sling for comfort, early gentle movement, physical therapy and a planned return to riding, discussing surgery as an option', quality: 'best' },
      { id: 'operate', label: 'Fix it surgically straight away', quality: 'ok', procedure: 'or_fracture' },
      { id: 'race', label: 'Race again next weekend', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s collarbone heals and they ride again in about three months.",
      fair: "{patient}'s collarbone heals with a small bump.",
      poor: "{patient}'s collarbone is slow to heal.",
    },
  }),
  C({
    id: 'sports_shoulder_rehab', specialty: ['ortho_sports', 'ortho', 'pmr'], ages: [30, 60], minYear: 1985,
    label: 'A painful shoulder',
    intro: "{patient}, {age}, a recreational swimmer, has shoulder pain when reaching overhead and asks about an operation.",
    history: "Gradual over three months after increasing training. No injury. No weakness. Has not had physical therapy.",
    exam: "Pain in a band when lifting the arm, but strength is normal.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Signs of an irritated tendon, no tear.' },
      { test: 'ultrasound', value: 'neutral', result: 'A thickened tendon, intact.' },
      { test: 'mri', value: 'low', result: 'Shows age-related changes that tempt surgery that will not help.' },
    ],
    differential: [
      { id: 'tendinopathy', label: 'An irritated rotator cuff tendon' },
      { id: 'tear', label: 'A torn tendon' },
      { id: 'frozen', label: 'A frozen shoulder' },
    ],
    diagnosis: 'tendinopathy',
    plans: [
      { id: 'rehab', label: 'A structured physical therapy program, adjusted training, and a review in three months', quality: 'best' },
      { id: 'scope', label: 'Keyhole surgery to shave the bone', quality: 'poor', procedure: 'or_arthroscopy' },
      { id: 'rest', label: 'Complete rest in a sling', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} swims pain-free after three months of exercises.",
      fair: "{patient} improves slowly and modifies their stroke.",
      poor: "{patient} stops the exercises and the shoulder stays sore.",
    },
  }),

  // ======================================================================================
  // HAND, SPINE, FOOT AND ANKLE
  // ======================================================================================
  C({
    id: 'hand_carpal_tunnel', specialty: ['hand', 'plastic', 'ortho'], ages: [40, 80], minYear: 1960, tier: 'intermediate',
    label: 'Numb fingers',
    intro: "{patient}, {age}, has numbness in the thumb and first fingers that wakes them at night.",
    history: "Night splints for six months helped at first but no longer do. Drops cups now.",
    exam: "Reduced feeling in the thumb and two fingers, with wasting of the muscle at the base of the thumb.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Signs of a squeezed nerve at the wrist, with muscle weakness.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
      { test: 'blood_basic', value: 'neutral', result: 'Thyroid and sugar are normal.' },
    ],
    differential: [
      { id: 'cts', label: 'Carpal tunnel syndrome' },
      { id: 'neck', label: 'A trapped nerve in the neck' },
      { id: 'neuropathy', label: 'A general nerve condition' },
    ],
    diagnosis: 'cts',
    plans: [
      { id: 'release', label: 'Explain that the muscle wasting means it is time, get consent, and plan a nerve release', quality: 'best', procedure: 'or_hand' },
      { id: 'more_splints', label: 'Keep using splints', quality: 'poor' },
      { id: 'refer_neuro', label: 'Refer to neurology for more tests first', quality: 'ok', refer: 'neurology' },
    ],
    decision: {
      text: "Just before starting, the patient tells the nurse they are unsure and frightened.",
      options: [
        { id: 'talk', label: 'Stop, sit with them, answer questions, and only proceed if they still agree', quality: 'best' },
        { id: 'reassure_quick', label: 'Say it will be fine and start', quality: 'poor' },
        { id: 'cancel', label: 'Cancel without discussion', quality: 'ok' },
      ],
    },
    outcomes: {
      good: "{patient} sleeps through the night again and grip slowly improves.",
      fair: "{patient}'s numbness improves but the thumb muscle stays a little weak.",
      poor: "{patient} has a tender scar for several months.",
    },
  }),
  C({
    id: 'spine_sciatica_no_op', specialty: ['spine', 'neurosurg', 'ortho'], ages: [25, 60], minYear: 1985,
    label: 'Leg pain from the back',
    intro: "{patient}, {age}, has shooting pain down one leg for five weeks and was sent for a surgical opinion.",
    history: "Already improving a little each week. No weakness, no bladder or bowel trouble. Back at desk work.",
    exam: "Pain when the straight leg is raised. Strength and reflexes are normal.",
    tests: [
      { test: 'mri', value: 'neutral', result: 'A disc bulge touching a nerve root.' },
      { test: 'exam_focused', value: 'useful', result: 'No weakness or warning signs.' },
      { test: 'ct', value: 'low', result: 'Adds radiation and nothing new.' },
    ],
    differential: [
      { id: 'sciatica', label: 'Sciatica from a disc, getting better' },
      { id: 'cauda', label: 'A spinal emergency' },
      { id: 'hip', label: 'A hip problem' },
    ],
    diagnosis: 'sciatica',
    plans: [
      { id: 'conservative', label: 'Explain that most get better on their own, continue activity and physical therapy, and review; surgery stays an option if it does not', quality: 'best' },
      { id: 'operate', label: 'Book an operation on the disc now', quality: 'poor', procedure: 'ns_spine' },
      { id: 'bed_rest', label: 'Strict bed rest', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s leg pain is gone within three months without surgery.",
      fair: "{patient} has occasional twinges but is back to normal life.",
      poor: "{patient}'s pain lingers and they lose confidence in their back.",
    },
  }),
  C({
    id: 'spine_compression', specialty: ['spine', 'neurosurg'], ages: [30, 70], minYear: 1985, tier: 'complex',
    label: 'Weak legs and back pain',
    intro: "{patient}, {age}, has severe back pain and since this morning both legs feel weak and numb.",
    history: "Cannot feel the toilet paper when wiping and has not passed urine since waking.",
    exam: "Weakness in both legs, numbness around the bottom, and a full bladder.",
    tests: [
      { test: 'mri', value: 'useful', result: 'A large disc pressing on the nerves at the bottom of the spine.' },
      { test: 'xray', value: 'low', result: 'Cannot show the nerves and wastes time.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
    ],
    differential: [
      { id: 'cauda', label: 'Severe nerve compression at the base of the spine' },
      { id: 'sciatica', label: 'Simple sciatica' },
      { id: 'uti', label: 'A urine infection' },
    ],
    diagnosis: 'cauda',
    needs: ['mri'],
    plans: [
      { id: 'urgent_decompress', label: 'Explain the urgency honestly, get consent, and operate to relieve the pressure today', quality: 'best', procedure: 'ns_spine' },
      { id: 'next_week', label: 'Book surgery for next week', quality: 'unsafe' },
      { id: 'physio', label: 'Physical therapy', quality: 'poor' },
    ],
    decision: {
      text: "The operating room is busy and the coordinator suggests waiting until tomorrow's list.",
      options: [
        { id: 'escalate', label: 'Explain the urgency to the coordinator and senior staff and secure a room today', quality: 'best' },
        { id: 'accept', label: 'Accept tomorrow', quality: 'poor' },
        { id: 'argue', label: 'Shout at the coordinator', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s strength and bladder control return over the following weeks.",
      fair: "{patient} recovers walking but has some lasting numbness.",
      poor: "{patient} is left with bladder problems despite surgery.",
    },
  }),
  C({
    id: 'fa_ankle_instability', specialty: ['foot_ankle', 'ortho'], ages: [18, 45], minYear: 1985, tier: 'intermediate',
    label: 'An ankle that keeps giving way',
    intro: "{patient}, {age}, has sprained the same ankle over and over and it now gives way on uneven ground.",
    history: "A year of balance training and bracing with a physical therapist has not stopped it. Plays soccer on weekends.",
    exam: "The ankle ligaments on the outside are loose compared to the other side. Good strength.",
    tests: [
      { test: 'xray', value: 'neutral', result: 'No arthritis or fracture.' },
      { test: 'mri', value: 'useful', result: 'Torn and stretched outer ankle ligaments.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'instability', label: 'Chronic ankle instability' },
      { id: 'fracture', label: 'An old missed fracture' },
      { id: 'arthritis', label: 'Ankle arthritis' },
    ],
    diagnosis: 'instability',
    needs: ['mri'],
    plans: [
      { id: 'reconstruct', label: 'Discuss risks and recovery, get consent, and plan an ankle ligament reconstruction', quality: 'best', procedure: 'or_foot' },
      { id: 'more_brace', label: 'Another year of bracing', quality: 'ok' },
      { id: 'fuse', label: 'Offer to fuse the ankle', quality: 'poor' },
    ],
    decision: {
      text: "During the operation, the tissue is weaker than expected.",
      options: [
        { id: 'adapt', label: 'Pause, discuss with the team, and use the backup plan that was consented', quality: 'best' },
        { id: 'push', label: 'Carry on regardless', quality: 'poor' },
        { id: 'abandon', label: 'Stop without a plan', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} plays soccer again with a stable ankle.",
      fair: "{patient}'s ankle is stable but stiff.",
      poor: "{patient}'s ankle is slow to recover.",
    },
  }),

  // ======================================================================================
  // NEUROSURGERY
  // ======================================================================================
  C({
    id: 'ns_meningioma', specialty: ['neurosurg'], ages: [40, 75], minYear: 1985, tier: 'complex',
    label: 'A brain tumor consultation',
    intro: "{patient}, {age}, has been referred after a scan for months of headaches and a change in personality noticed by family.",
    history: "Family say {patient} has become flat and forgetful. One seizure last week. Otherwise healthy, with a close family.",
    exam: "Mildly slowed thinking; otherwise a normal nerve examination.",
    tests: [
      { test: 'mri', value: 'useful', result: 'A large, well-defined tumor on the surface of the brain, pressing on the frontal lobe, with the look of a usually benign type.' },
      { test: 'ct', value: 'neutral', result: 'Shows the tumor less clearly.' },
      { test: 'eeg', value: 'neutral', result: 'Some irritation near the tumor.' },
    ],
    differential: [
      { id: 'meningioma', label: 'A likely benign tumor of the brain lining' },
      { id: 'glioma', label: 'A tumor inside the brain' },
      { id: 'abscess', label: 'An abscess' },
    ],
    diagnosis: 'meningioma',
    needs: ['mri'],
    plans: [
      { id: 'resect', label: 'Explain the findings, the aims and the risks with the patient and family, take time over consent, and plan removal', quality: 'best', procedure: 'ns_cranial' },
      { id: 'watch', label: 'Repeat the scan in a year', quality: 'poor' },
      { id: 'family_only', label: 'Decide with the family and leave the patient out of it', quality: 'poor' },
    ],
    decision: {
      text: "Late in the operation, the anesthesiologist reports a sudden change in blood pressure and the scrub nurse is concerned about bleeding.",
      options: [
        { id: 'pause', label: 'Pause, communicate clearly, and decide with the team whether to stop and leave a small part behind', quality: 'best' },
        { id: 'chase', label: 'Keep going to remove every last piece', quality: 'poor' },
        { id: 'silence', label: 'Work on in silence', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} wakes up clearer, and the family says they have their old self back.",
      fair: "{patient} recovers well but needs a period of rehabilitation.",
      poor: "{patient} has some weakness after surgery that improves only partly.",
    },
  }),
  C({
    id: 'ns_chronic_subdural', specialty: ['neurosurg'], ages: [65, 95], minYear: 1920, tier: 'complex',
    label: 'Increasing confusion',
    intro: "{patient}, {age}, has become more confused and unsteady over three weeks after a minor bump on the head.",
    history: "A family member noticed slurred words and a weak hand. Takes a blood thinner for the heart.",
    exam: "Drowsy but rousable, mild weakness on one side.",
    tests: [
      { test: 'ct', value: 'useful', result: 'A collection of old blood over the brain, pushing it to one side.' },
      { test: 'blood_basic', value: 'useful', result: 'Clotting is affected by the blood thinner.' },
      { test: 'mri', value: 'low', result: 'More detail is not needed.' },
    ],
    differential: [
      { id: 'subdural', label: 'A slow bleed over the brain' },
      { id: 'stroke', label: 'A stroke' },
      { id: 'dementia', label: 'Dementia' },
    ],
    diagnosis: 'subdural',
    plans: [
      { id: 'drain', label: 'Discuss with the patient and family, reverse the blood thinner with the medical team, and drain the collection', quality: 'best', procedure: 'ns_cranial', minYear: 1976 },
      { id: 'old_drain', label: 'Drain the collection based on the examination findings, with consent', quality: 'best', procedure: 'ns_cranial', maxYear: 1975 },
      { id: 'observe', label: 'Watch and wait', quality: 'poor' },
      { id: 'nursing_home', label: 'Arrange a nursing home for dementia', quality: 'poor' },
    ],
    decision: {
      text: "After the operation, {patient} becomes more drowsy on the ward.",
      options: [
        { id: 'review', label: 'Come and examine at once, repeat the scan, and discuss with the team', quality: 'best' },
        { id: 'phone', label: 'Advise by phone to let them sleep', quality: 'poor' },
        { id: 'morning', label: 'Review in the morning', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is back to their usual self within a week.",
      fair: "{patient} improves slowly and needs a little more help at home.",
      poor: "{patient}'s collection returns and needs a second procedure.",
    },
  }),
  C({
    id: 'ns_myelopathy', specialty: ['neurosurg', 'spine'], ages: [50, 80], minYear: 1985, tier: 'intermediate',
    label: 'Clumsy hands',
    intro: "{patient}, {age}, has trouble with buttons and has become unsteady on their feet.",
    history: "Gradual over a year. Neck stiffness. Has fallen twice.",
    exam: "Clumsy hands, brisk reflexes and an unsteady walk.",
    tests: [
      { test: 'mri', value: 'useful', result: 'Narrowing in the neck pressing on the spinal cord.' },
      { test: 'xray', value: 'neutral', result: 'Arthritis in the neck.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
    ],
    differential: [
      { id: 'myelopathy', label: 'Pressure on the spinal cord in the neck' },
      { id: 'ms', label: 'Multiple sclerosis' },
      { id: 'carpal', label: 'Carpal tunnel syndrome' },
    ],
    diagnosis: 'myelopathy',
    needs: ['mri'],
    plans: [
      { id: 'decompress', label: 'Explain that surgery aims to stop it getting worse, discuss the risks, get consent, and plan the operation', quality: 'best', procedure: 'ns_spine' },
      { id: 'collar', label: 'A neck collar and review in a year', quality: 'poor' },
      { id: 'promise', label: 'Promise surgery will cure everything', quality: 'poor', procedure: 'ns_spine' },
    ],
    decision: {
      text: "The nerve monitoring team reports a change in signals during the operation.",
      options: [
        { id: 'pause', label: 'Stop, check with the monitoring and anesthesia teams, and work through the checklist', quality: 'best' },
        { id: 'continue', label: 'Assume it is a false alarm and continue', quality: 'poor' },
        { id: 'blame', label: 'Blame the equipment', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s walking steadies and the hands stop getting worse.",
      fair: "{patient} stays the same, which was the main goal.",
      poor: "{patient} has a temporary weakness after surgery that slowly recovers.",
    },
  }),
  C({
    id: 'ns_crash', specialty: ['neurosurg'], ages: [20, 45], minYear: 1980, tier: 'complex', episode: 'crash_trauma',
    label: 'Head injury after a crash',
    intro: "{patient}, {age}, was the driver in a road crash and was briefly knocked out. The trauma team asks for a neurosurgery opinion on the head scan.",
    history: "Has had an operation on the belly for bleeding and is now in intensive care. Was talking before the operation.",
    exam: "Opens eyes to voice and follows commands when sedation is lightened. Pupils are equal.",
    tests: [
      { test: 'ct', value: 'useful', result: 'A small bruise on the surface of the brain and a thin layer of blood, with no pressure on the brain.' },
      { test: 'mri', value: 'low', result: 'Moving an intensive care patient for this adds risk without changing the plan.' },
      { test: 'blood_basic', value: 'neutral', result: 'Clotting is normal.' },
    ],
    differential: [
      { id: 'minor_contusion', label: 'A small brain bruise that does not need surgery' },
      { id: 'large_bleed', label: 'A large bleed needing surgery' },
      { id: 'normal', label: 'No brain injury' },
    ],
    diagnosis: 'minor_contusion',
    needs: ['ct'],
    plans: [
      { id: 'observe', label: 'Advise close nerve checks, a repeat scan, and clear criteria for calling neurosurgery back; no operation now', quality: 'best' },
      { id: 'operate', label: 'Operate to remove the small bruise', quality: 'poor', procedure: 'ns_cranial' },
      { id: 'sign_off', label: 'Sign off and leave no plan', quality: 'poor' },
    ],
    decision: {
      text: "Overnight, the intensive care nurse calls to say one pupil looks a little larger.",
      options: [
        { id: 'come_scan', label: 'Come in, examine, and repeat the scan straight away with the intensive care team', quality: 'best' },
        { id: 'morning', label: 'Ask them to recheck in the morning', quality: 'poor' },
        { id: 'phone_sedate', label: 'Suggest more sedation by phone', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient}'s repeat scan is stable and they wake up without lasting problems.",
      fair: "{patient} has headaches and poor concentration for some months.",
      poor: "{patient} needs a longer period of brain-injury rehabilitation.",
    },
  }),
  C({
    id: 'ns_watchful', specialty: ['neurosurg'], ages: [40, 80], minYear: 1985,
    label: 'A scan finding',
    intro: "{patient}, {age}, had a brain scan after a minor fall and was told there is a small tumor. They are frightened.",
    history: "No symptoms at all. The fall was a trip on a step.",
    exam: "A normal nerve examination.",
    tests: [
      { test: 'mri', value: 'useful', result: 'A small, calcified, benign-looking tumor of the brain lining, not pressing on anything.' },
      { test: 'ct', value: 'neutral', result: 'Shows the same thing.' },
    ],
    differential: [
      { id: 'small_meningioma', label: 'A small benign tumor causing no symptoms' },
      { id: 'cancer', label: 'A brain cancer' },
      { id: 'bleed', label: 'A bleed from the fall' },
    ],
    diagnosis: 'small_meningioma',
    needs: ['mri'],
    plans: [
      { id: 'surveillance', label: 'Explain calmly what it is, recommend watchful waiting with a repeat scan, and give clear reasons to come back', quality: 'best' },
      { id: 'operate', label: 'Remove it now to be safe', quality: 'poor', procedure: 'ns_cranial' },
      { id: 'dismiss', label: 'Say it is nothing and offer no follow-up', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} is reassured, and the tumor is unchanged on every scan for years.",
      fair: "{patient} worries before each scan but stays well.",
      poor: "{patient} feels anxious and uncertain without a clear plan.",
    },
  }),

  // ======================================================================================
  // CARDIOTHORACIC SURGERY
  // ======================================================================================
  C({
    id: 'ct_bypass', specialty: ['ctsurg', 'ct_integrated'], ages: [55, 80], minYear: 1970, tier: 'complex',
    label: 'Bypass referral',
    intro: "{patient}, {age}, has been referred by the cardiologist after an angiogram showed severe disease in three heart arteries.",
    history: "Diabetic, chest pain on short walks despite medicines. The cardiologist and surgeon have both seen the films. Wants to understand the choice.",
    exam: "Well at rest. Healthy leg veins.",
    tests: [
      { test: 'angiogram', value: 'useful', result: 'Three-vessel disease, including the main stem.' },
      { test: 'echo', value: 'useful', result: 'Mildly reduced pumping.' },
      { test: 'blood_basic', value: 'neutral', result: 'Kidney function is normal.' },
    ],
    differential: [
      { id: 'three_vessel', label: 'Severe disease in three arteries, suited to bypass' },
      { id: 'single', label: 'One narrowing suited to a stent' },
      { id: 'none', label: 'No significant disease' },
    ],
    diagnosis: 'three_vessel',
    needs: ['angiogram'],
    plans: [
      { id: 'heart_team', label: 'Review the case with the cardiologist as a heart team, explain options and risks honestly, and with consent offer bypass surgery', quality: 'best', procedure: 'ct_bypass' },
      { id: 'operate_no_team', label: 'Book the operation without discussing it with the cardiologist', quality: 'ok', procedure: 'ct_bypass' },
      { id: 'refuse', label: 'Send back to cardiology without a view', quality: 'poor', refer: 'cardiology' },
    ],
    decision: {
      text: "Coming off the heart-lung machine, the heart is slow to recover and the perfusionist is worried.",
      options: [
        { id: 'team', label: 'Pause, talk it through with anesthesia and the perfusionist, and give the heart more support and time', quality: 'best' },
        { id: 'force', label: 'Push on to finish quickly', quality: 'poor' },
        { id: 'blame', label: 'Blame the perfusionist and carry on', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is walking the corridors in four days and pain-free at three months.",
      fair: "{patient} has an irregular heartbeat after surgery that settles.",
      poor: "{patient} has a slow recovery with a long stay in intensive care.",
    },
  }),
  C({
    id: 'ct_aortic_valve', specialty: ['ctsurg', 'ct_integrated'], ages: [60, 85], minYear: 1975, tier: 'complex',
    label: 'A tight heart valve',
    intro: "{patient}, {age}, has fainted twice while walking and was found to have a heart murmur.",
    history: "Breathless on stairs for a year. Otherwise fit and independent.",
    exam: "A loud murmur over the heart. Blood pressure is low-normal.",
    tests: [
      { test: 'echo', value: 'useful', result: 'A severely narrowed aortic valve.' },
      { test: 'angiogram', value: 'neutral', result: 'Heart arteries are clear.' },
      { test: 'ecg', value: 'neutral', result: 'A thickened heart muscle.' },
    ],
    differential: [
      { id: 'as', label: 'Severe aortic stenosis' },
      { id: 'faint', label: 'Simple fainting' },
      { id: 'epilepsy', label: 'Seizures' },
    ],
    diagnosis: 'as',
    needs: ['echo'],
    plans: [
      { id: 'valve', label: 'Explain that symptoms mean it is time, discuss surgical and other valve options with the heart team, get consent, and replace the valve', quality: 'best', procedure: 'ct_valve' },
      { id: 'watch', label: 'Watch and repeat the scan in a year', quality: 'poor' },
      { id: 'exercise', label: 'Advise more exercise', quality: 'unsafe' },
    ],
    decision: {
      text: "The anesthesiologist reports the blood pressure dropping as anesthesia begins.",
      options: [
        { id: 'pause', label: 'Pause and manage it together before going further', quality: 'best' },
        { id: 'hurry', label: 'Hurry onto the heart-lung machine without discussion', quality: 'poor' },
        { id: 'ignore', label: 'Ignore it', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} has no more fainting and walks freely within months.",
      fair: "{patient} needs a pacemaker after surgery but recovers well.",
      poor: "{patient} has a complicated recovery with a long hospital stay.",
    },
  }),
  C({
    id: 'ct_lung', specialty: ['ctsurg', 'ct_integrated'], ages: [50, 80], minYear: 1985, tier: 'complex',
    label: 'A lung mass',
    intro: "{patient}, {age}, has a mass in one lung found on a scan, and a biopsy has shown an early lung cancer.",
    history: "Stopped smoking two years ago. Walks a mile a day. The case was discussed at the tumor board.",
    exam: "Normal breathing at rest; good exercise tolerance.",
    tests: [
      { test: 'ct', value: 'useful', result: 'A single small tumor with no spread seen.' },
      { test: 'biopsy', value: 'useful', result: 'An early non-small cell lung cancer.' },
      { test: 'exam_focused', value: 'useful', result: 'Breathing tests show enough lung reserve for surgery.' },
    ],
    differential: [
      { id: 'early_cancer', label: 'Early lung cancer suitable for surgery' },
      { id: 'infection', label: 'An infection' },
      { id: 'advanced', label: 'Advanced cancer' },
    ],
    diagnosis: 'early_cancer',
    needs: ['biopsy'],
    plans: [
      { id: 'resect', label: 'Discuss the tumor board advice, the aims and risks, get consent, and remove the affected part of the lung', quality: 'best', procedure: 'ct_thoracic' },
      { id: 'wait', label: 'Watch it for a year', quality: 'poor' },
      { id: 'refer_onc', label: 'Send to oncology without discussing surgery', quality: 'ok', refer: 'heme_onc' },
    ],
    decision: {
      text: "During the operation, the anesthesiologist says oxygen levels are falling on one lung.",
      options: [
        { id: 'pause', label: 'Pause and work through it with the anesthesia team', quality: 'best' },
        { id: 'rush', label: 'Hurry to finish', quality: 'poor' },
        { id: 'ignore', label: 'Keep going without comment', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} goes home in five days, with the cancer fully removed.",
      fair: "{patient} has an air leak that keeps them in the hospital a little longer.",
      poor: "{patient} develops pneumonia after surgery and recovers slowly.",
    },
  }),
  C({
    id: 'ct_aorta_watch', specialty: ['ctsurg', 'ct_integrated', 'vascular'], ages: [50, 80], minYear: 1980, tier: 'intermediate',
    label: 'An enlarged aorta',
    intro: "{patient}, {age}, was told after a scan that the main artery in the chest is enlarged.",
    history: "No pain. High blood pressure that is not well controlled. Worried it will burst.",
    exam: "Normal examination apart from high blood pressure.",
    tests: [
      { test: 'ct', value: 'useful', result: 'The chest aorta is moderately enlarged, below the size where surgery is usually advised.' },
      { test: 'echo', value: 'useful', result: 'A normal aortic valve.' },
      { test: 'angiogram', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'moderate_aneurysm', label: 'A moderately enlarged aorta, not yet at the size for surgery' },
      { id: 'dissection', label: 'A tear in the aorta' },
      { id: 'normal', label: 'A normal aorta' },
    ],
    diagnosis: 'moderate_aneurysm',
    needs: ['ct'],
    plans: [
      { id: 'surveillance', label: 'Explain the size and risk calmly, control blood pressure, advise on heavy lifting, and plan regular scans', quality: 'best' },
      { id: 'operate', label: 'Operate now to be safe', quality: 'poor', procedure: 'ct_valve' },
      { id: 'discharge', label: 'Discharge without follow-up', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s aorta stays stable over years of checks.",
      fair: "{patient}'s aorta grows slowly and will need surgery one day.",
      poor: "{patient} misses scans and the aorta grows unnoticed.",
    },
  }),
  C({
    id: 'ct_declines', specialty: ['ctsurg', 'ct_integrated', 'cardiology'], ages: [80, 95], minYear: 1975, tier: 'complex',
    label: 'A difficult choice',
    intro: "{patient}, {age}, has severe heart valve disease and has been offered surgery.",
    history: "Lives independently, is clear-thinking, and has thought about it carefully with family. Does not want an operation and would rather focus on comfort and time at home.",
    exam: "Breathless on mild exertion. Fully alert and understands the risks.",
    tests: [
      { test: 'echo', value: 'useful', result: 'Severe valve narrowing.' },
      { test: 'blood_basic', value: 'neutral', result: 'Mild kidney changes.' },
      { test: 'angiogram', value: 'low', result: 'Not needed if surgery is not wanted.' },
    ],
    differential: [
      { id: 'severe_valve', label: 'Severe valve disease in a capable patient who declines surgery' },
      { id: 'confused', label: 'A patient who cannot make the decision' },
      { id: 'mild', label: 'Mild valve disease' },
    ],
    diagnosis: 'severe_valve',
    plans: [
      { id: 'respect', label: 'Make sure they understand, respect the choice, and arrange medical treatment, palliative care support and an open door to change their mind', quality: 'best' },
      { id: 'pressure', label: 'Keep pressing until they agree to surgery', quality: 'poor' },
      { id: 'family_override', label: 'Ask the family to consent instead', quality: 'poor' },
      { id: 'abandon', label: 'Discharge from clinic with no further care', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} spends their remaining time at home, comfortable and in control of their care.",
      fair: "{patient} has some hard days but feels respected.",
      poor: "{patient} feels their wishes were not fully heard.",
    },
  }),
  C({
    id: 'tx_heart_eval', specialty: ['ct_heart_transplant'], ages: [25, 65], minYear: 1985, tier: 'high',
    label: 'Heart transplant assessment',
    intro: "{patient}, {age}, has end-stage heart failure and has been referred for a transplant assessment.",
    history: "Breathless at rest despite full treatment. Supportive family. Has stopped smoking and drinking. Understands lifelong treatment will be needed.",
    exam: "Breathless, swollen ankles, but alert and well-informed.",
    tests: [
      { test: 'echo', value: 'useful', result: 'Very poor heart function.' },
      { test: 'blood_special', value: 'useful', result: 'Tissue matching and infection screening are complete.' },
      { test: 'angiogram', value: 'neutral', result: 'Pressures in the lungs are acceptable for a transplant.' },
    ],
    differential: [
      { id: 'candidate', label: 'A suitable transplant candidate' },
      { id: 'not_candidate', label: 'Not suitable' },
      { id: 'early', label: 'Too early for a transplant' },
    ],
    diagnosis: 'candidate',
    needs: ['blood_special'],
    plans: [
      { id: 'list', label: 'Present to the transplant committee, list fairly by the allocation rules, and prepare the patient and family with full consent', quality: 'best' },
      { id: 'jump', label: 'Push them ahead of others on the list', quality: 'unsafe' },
      { id: 'decline', label: 'Turn them down without a committee review', quality: 'poor' },
    ],
    decision: {
      text: "A donor heart is offered, but the team notices a mismatch in the paperwork for the organ.",
      options: [
        { id: 'verify', label: 'Stop, verify with the organ organization and the team, and only proceed when it is confirmed', quality: 'best' },
        { id: 'proceed', label: 'Proceed anyway, time is short', quality: 'unsafe' },
        { id: 'decline_silent', label: 'Decline the heart without telling anyone why', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} receives a new heart after a careful match and walks out of the hospital weeks later.",
      fair: "{patient} has a rejection episode in the first year that is treated.",
      poor: "{patient} waits a long time on the list and becomes more unwell.",
    },
  }),

  // ======================================================================================
  // TRAUMA SURGERY
  // ======================================================================================
  C({
    id: 'tr_crash', specialty: ['trauma', 'gensurg'], ages: [20, 45], minYear: 1980, tier: 'high', episode: 'crash_trauma',
    label: 'Trauma call',
    intro: "The emergency team calls the trauma surgeon for {patient}, {age}, a driver injured in a road crash.",
    history: "Belly pain, a broken thigh bone, and a brief loss of consciousness. Low blood pressure since arrival.",
    exam: "Pale, a fast pulse and low blood pressure despite fluids. The belly is tense and tender.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'Free blood in the belly.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood count falling.' },
      { test: 'ct', value: 'unsafe', result: 'Sending an unstable patient to the scanner risks collapse there.' },
    ],
    differential: [
      { id: 'spleen_bleed', label: 'Major bleeding in the belly needing surgery' },
      { id: 'stable', label: 'Stable enough to observe' },
      { id: 'pelvis', label: 'Bleeding from the pelvis' },
    ],
    diagnosis: 'spleen_bleed',
    needs: ['ultrasound'],
    plans: [
      { id: 'operate', label: 'Explain the urgency to the patient or family, take them to the operating room now, and brief the anesthesia team', quality: 'best', procedure: 'tr_emergency' },
      { id: 'scan_first', label: 'CT scan first', quality: 'poor' },
      { id: 'observe', label: 'Observe on the ward', quality: 'unsafe' },
    ],
    triage: {
      text: "Two patients from the crash need the trauma surgeon: {patient}, the driver, unstable with belly bleeding; and a passenger who is stable with a broken wrist.",
      options: [
        { id: 'driver', label: 'The unstable driver', quality: 'best' },
        { id: 'passenger', label: 'The stable passenger, who arrived first', quality: 'poor' },
        { id: 'both', label: 'Split time between both', quality: 'ok' },
      ],
    },
    decision: {
      text: "In the operating room, the bleeding is controlled, but the patient is cold and the blood is not clotting well.",
      options: [
        { id: 'damage_control', label: 'Agree with the team to do only what is needed now and continue in intensive care', quality: 'best' },
        { id: 'fix_all', label: 'Keep going to repair everything at once', quality: 'poor' },
        { id: 'no_talk', label: 'Decide alone without telling anesthesia', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s bleeding is stopped and they reach intensive care stable.",
      fair: "{patient} needs a second planned operation but stabilizes.",
      poor: "{patient} has a difficult course in intensive care before improving.",
    },
  }),
  C({
    id: 'tr_spleen_stable', specialty: ['trauma', 'gensurg'], ages: [16, 50], minYear: 1985, tier: 'intermediate',
    label: 'A fall from a bike',
    intro: "{patient}, {age}, came off a mountain bike and hit the handlebars with the left side.",
    history: "Left-sided belly and shoulder tip pain. No head injury.",
    exam: "Normal blood pressure and pulse, tender on the left upper belly.",
    tests: [
      { test: 'ct', value: 'useful', result: 'A small tear in the spleen with no active bleeding.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood count is stable on two checks.' },
      { test: 'mri', value: 'low', result: 'Adds nothing.' },
    ],
    differential: [
      { id: 'spleen_minor', label: 'A small spleen injury in a stable patient' },
      { id: 'rib', label: 'A broken rib only' },
      { id: 'major_bleed', label: 'Major bleeding' },
    ],
    diagnosis: 'spleen_minor',
    needs: ['ct'],
    plans: [
      { id: 'observe', label: 'Admit for close observation, repeat blood counts, and keep the operating room informed in case it changes', quality: 'best' },
      { id: 'operate', label: 'Remove the spleen now', quality: 'poor', procedure: 'tr_emergency' },
      { id: 'home', label: 'Send home today', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient} keeps the spleen and goes home after a few days.",
      fair: "{patient} needs a longer stay but no operation.",
      poor: "{patient}'s spleen bleeds again and needs an operation.",
    },
  }),
  C({
    id: 'tr_ribs_elderly', specialty: ['trauma', 'critical_care'], ages: [70, 95], minYear: 1980, tier: 'intermediate',
    label: 'A fall down stairs',
    intro: "{patient}, {age}, fell down a few stairs and has painful ribs.",
    history: "Pain on breathing. Uses an inhaler for lung disease. Lives alone.",
    exam: "Tender over several ribs, shallow breathing. Normal blood pressure.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Several broken ribs on one side; no collapsed lung.' },
      { test: 'ct', value: 'neutral', result: 'Confirms the fractures; no other injuries.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
    ],
    differential: [
      { id: 'rib_fractures', label: 'Several broken ribs in an older patient' },
      { id: 'bruise', label: 'Bruising only' },
      { id: 'heart', label: 'A heart attack' },
    ],
    diagnosis: 'rib_fractures',
    needs: ['xray'],
    plans: [
      { id: 'support', label: 'Admit for good pain control, breathing exercises and early walking, with close monitoring', quality: 'best' },
      { id: 'home', label: 'Send home with simple pain relief', quality: 'poor' },
      { id: 'operate', label: 'Operate on the ribs straight away', quality: 'poor', procedure: 'tr_emergency' },
    ],
    outcomes: {
      good: "{patient} breathes comfortably and goes home within a week.",
      fair: "{patient} develops a mild chest infection that settles.",
      poor: "{patient} develops pneumonia and needs a longer stay.",
    },
  }),
  C({
    id: 'tr_unstable_pelvis', specialty: ['trauma'], ages: [25, 70], minYear: 1985, tier: 'high',
    label: 'A crush injury',
    intro: "{patient}, {age}, was pinned by a forklift at a warehouse.",
    history: "Pain in the hips and lower belly. Paramedics placed a pelvic binder.",
    exam: "Low blood pressure and a fast pulse. Pelvis is unstable. The belly is soft.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A broken pelvis.' },
      { test: 'ultrasound', value: 'useful', result: 'No blood in the belly.' },
      { test: 'mri', value: 'unsafe', result: 'Far too long for an unstable patient.' },
    ],
    differential: [
      { id: 'pelvic_bleed', label: 'Bleeding from a broken pelvis' },
      { id: 'belly_bleed', label: 'Bleeding in the belly' },
      { id: 'spinal', label: 'A spinal cord injury' },
    ],
    diagnosis: 'pelvic_bleed',
    needs: ['xray'],
    plans: [
      { id: 'team', label: 'Keep the binder, give blood, and call radiology and orthopedics to stop the bleeding together', quality: 'best', refer: 'radiology' },
      { id: 'open_belly', label: 'Operate on the belly', quality: 'poor', procedure: 'tr_emergency' },
      { id: 'wait', label: 'Wait for more scans', quality: 'poor' },
    ],
    triage: {
      text: "{patient}, with low blood pressure and an unstable pelvis, arrives with a coworker who has a sprained wrist and another who is shaken but unhurt.",
      options: [
        { id: 'pelvis', label: 'The patient with the pelvic injury', quality: 'best' },
        { id: 'wrist', label: 'The wrist', quality: 'poor' },
        { id: 'shaken', label: 'The shaken coworker', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s bleeding is controlled, and they reach the ward within days.",
      fair: "{patient} needs a long transfusion and a stay in intensive care.",
      poor: "{patient} has a long, hard recovery with several operations.",
    },
  }),

  // ======================================================================================
  // PEDIATRIC SURGERY
  // ======================================================================================
  C({
    id: 'ps_pyloric', specialty: ['peds_surgery'], ages: [0, 0], minYear: 1975, guardian: true, tier: 'intermediate',
    label: 'A baby who keeps vomiting',
    intro: "{patient}, five weeks old, has forceful vomiting after every feed. The parents are exhausted and frightened.",
    history: "Hungry straight after vomiting. Fewer wet diapers. Was well until two weeks ago.",
    exam: "A hungry, slightly dry baby. A small lump felt in the upper belly during a feed.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'A thickened outlet muscle of the stomach.' },
      { test: 'blood_basic', value: 'useful', result: 'Salt imbalance from vomiting.' },
      { test: 'ct', value: 'low', result: 'Radiation a baby does not need.' },
    ],
    differential: [
      { id: 'pyloric', label: 'Pyloric stenosis' },
      { id: 'reflux', label: 'Reflux' },
      { id: 'infection', label: 'A stomach infection' },
    ],
    diagnosis: 'pyloric',
    needs: ['ultrasound'],
    plans: [
      { id: 'correct_then_operate', label: 'Correct the fluids and salts first, explain to the parents, get consent, and operate once safe', quality: 'best', procedure: 'ps_surgery' },
      { id: 'operate_now', label: 'Operate immediately before correcting the salts', quality: 'poor', procedure: 'ps_surgery' },
      { id: 'formula', label: 'Change the formula', quality: 'poor' },
    ],
    decision: {
      text: "Just before surgery, the anesthesiologist says the salts are still not quite right.",
      options: [
        { id: 'wait', label: 'Agree to wait a few hours until it is safe', quality: 'best' },
        { id: 'push', label: 'Insist on going ahead now', quality: 'poor' },
        { id: 'override', label: 'Overrule anesthesia', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is feeding happily within a day and goes home.",
      fair: "{patient} vomits a little for a few days but settles.",
      poor: "{patient} needs a longer stay to get feeding back on track.",
    },
  }),
  C({
    id: 'ps_appendicitis', specialty: ['peds_surgery'], ages: [5, 14], minYear: 1975, guardian: true, tier: 'intermediate',
    label: 'A child with belly pain',
    intro: "{patient}, {age}, has belly pain and a fever. A parent brings them in.",
    history: "Pain moved to the lower right side overnight. Not hungry. {patient} says it hurts to jump.",
    exam: "Tender in the lower right belly. Mild fever.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'A swollen appendix.' },
      { test: 'blood_basic', value: 'useful', result: 'Raised white cells.' },
      { test: 'ct', value: 'low', result: 'Radiation a child does not need when ultrasound is clear.' },
    ],
    differential: [
      { id: 'appendicitis', label: 'Appendicitis' },
      { id: 'gastro', label: 'A stomach bug' },
      { id: 'constipation', label: 'Constipation' },
    ],
    diagnosis: 'appendicitis',
    needs: ['ultrasound'],
    plans: [
      { id: 'operate', label: 'Explain to the parent and in simple words to the child, get consent and the child\'s agreement, and operate', quality: 'best', procedure: 'ps_surgery' },
      { id: 'home', label: 'Send home to see how it goes', quality: 'unsafe' },
      { id: 'ignore_child', label: 'Talk only to the parent', quality: 'poor', procedure: 'ps_surgery' },
    ],
    decision: {
      text: "During the operation, the anesthesiologist says the child's temperature is dropping.",
      options: [
        { id: 'pause', label: 'Pause and fix it together with warming before going on', quality: 'best' },
        { id: 'hurry', label: 'Hurry to finish', quality: 'poor' },
        { id: 'ignore', label: 'Ignore it', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is home in two days and back at school in a week.",
      fair: "{patient} has a mild wound infection that clears.",
      poor: "{patient} develops an abscess and needs a longer stay.",
    },
  }),
  C({
    id: 'ps_inguinal_infant', specialty: ['peds_surgery'], ages: [0, 1], minYear: 1950, guardian: true,
    label: 'A bulge in the groin',
    intro: "{patient}, a baby, has a bulge in the groin that appears when crying. The parents noticed it at bath time.",
    history: "Feeding well, no vomiting. The bulge goes away when calm.",
    exam: "A soft groin bulge that goes back in easily.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A typical infant groin hernia.' },
      { test: 'ultrasound', value: 'neutral', result: 'Confirms it; not usually needed.' },
      { test: 'ct', value: 'low', result: 'Not appropriate.' },
    ],
    differential: [
      { id: 'hernia', label: 'An inguinal hernia' },
      { id: 'hydrocele', label: 'A fluid collection' },
      { id: 'gland', label: 'A swollen gland' },
    ],
    diagnosis: 'hernia',
    plans: [
      { id: 'planned_repair', label: 'Explain the risks of waiting, get the parents\' consent, and book a planned repair soon, with warning signs meanwhile', quality: 'best', procedure: 'ps_surgery' },
      { id: 'wait_years', label: 'Wait until school age', quality: 'poor' },
      { id: 'tape', label: 'Tape a coin over it', quality: 'unsafe' },
    ],
    decision: {
      text: "In the operating room, the team realizes the baby has not been given the planned pre-operative check by the anesthesia team.",
      options: [
        { id: 'pause', label: 'Pause and let anesthesia complete the check before starting', quality: 'best' },
        { id: 'skip', label: 'Skip it; it is a short operation', quality: 'unsafe' },
        { id: 'grumble', label: 'Complain loudly about delays', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is home the same day and the hernia does not return.",
      fair: "{patient} is fussy for a few days after the operation.",
      poor: "{patient}'s hernia returns and needs a second repair.",
    },
  }),

  // ======================================================================================
  // VASCULAR, PLASTIC, TRANSPLANT, COLORECTAL, SURGICAL ONCOLOGY
  // ======================================================================================
  C({
    id: 'vasc_aaa', specialty: ['vascular', 'vascular_integrated'], ages: [65, 85], minYear: 1980, tier: 'complex',
    label: 'A large aneurysm',
    intro: "{patient}, {age}, had a screening ultrasound that showed a large swelling of the main artery in the belly.",
    history: "No pain. Former smoker. Has a heart condition that is stable.",
    exam: "A pulsing mass in the belly. Leg pulses are present.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'An aneurysm above the size where repair is usually advised.' },
      { test: 'ct', value: 'useful', result: 'Shows the shape needed to plan repair.' },
      { test: 'echo', value: 'neutral', result: 'Adequate heart function.' },
    ],
    differential: [
      { id: 'large_aaa', label: 'A large abdominal aortic aneurysm' },
      { id: 'small_aaa', label: 'A small aneurysm' },
      { id: 'mass', label: 'A tumor' },
    ],
    diagnosis: 'large_aaa',
    needs: ['ultrasound'],
    plans: [
      { id: 'repair', label: 'Explain the risk of rupture against the risk of surgery, discuss repair options, get consent, and plan repair', quality: 'best', procedure: 'vs_repair' },
      { id: 'watch', label: 'Scan again in two years', quality: 'poor' },
      { id: 'scare', label: 'Book surgery tomorrow without a discussion', quality: 'poor', procedure: 'vs_repair' },
    ],
    decision: {
      text: "During the repair, the anesthesiologist reports the kidneys are making less urine.",
      options: [
        { id: 'pause', label: 'Pause, check together, and adjust the plan', quality: 'best' },
        { id: 'hurry', label: 'Hurry to finish', quality: 'poor' },
        { id: 'ignore', label: 'Ignore it', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s aneurysm is repaired and they are home within a week.",
      fair: "{patient}'s kidneys take a few days to recover.",
      poor: "{patient} has a long recovery with complications.",
    },
  }),
  C({
    id: 'vasc_claudication', specialty: ['vascular', 'vascular_integrated'], ages: [55, 85], minYear: 1975,
    label: 'Calf pain on walking',
    intro: "{patient}, {age}, gets calf cramps after walking two blocks, which ease with rest.",
    history: "Still smokes. Diabetes. No pain at rest and no sores.",
    exam: "Weak foot pulses. Warm feet with healthy skin.",
    tests: [
      { test: 'vascular_doppler', value: 'useful', result: 'Moderately reduced blood flow to the legs.' },
      { test: 'angiogram', value: 'low', result: 'An invasive test not needed for stable symptoms.' },
      { test: 'ct', value: 'low', result: 'Not needed now.' },
    ],
    differential: [
      { id: 'claudication', label: 'Narrowed leg arteries causing walking pain' },
      { id: 'sciatica', label: 'Sciatica' },
      { id: 'critical', label: 'Severe loss of blood flow' },
    ],
    diagnosis: 'claudication',
    needs: ['vascular_doppler'],
    plans: [
      { id: 'conservative', label: 'Support stopping smoking, a supervised walking program, medicines to protect the arteries, and a review', quality: 'best' },
      { id: 'operate', label: 'Bypass the leg arteries now', quality: 'poor', procedure: 'vs_repair' },
      { id: 'nothing', label: 'Say it is just age', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} quits smoking and walks twice as far within months.",
      fair: "{patient} improves a little.",
      poor: "{patient} keeps smoking and the walking distance shrinks.",
    },
  }),
  C({
    id: 'pl_breast_recon', specialty: ['plastic', 'plastic_integrated'], ages: [30, 70], minYear: 1985, sex: 'female', tier: 'complex',
    label: 'A reconstruction consultation',
    intro: "{patient}, {age}, is having a mastectomy for breast cancer and wants to talk about reconstruction.",
    history: "The cancer team plans radiation after surgery. Unsure whether she wants reconstruction now, later or at all.",
    exam: "Healthy, nonsmoker.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Suitable for several kinds of reconstruction.' },
      { test: 'mri', value: 'neutral', result: 'Already done by the cancer team.' },
    ],
    differential: [
      { id: 'candidate', label: 'A good candidate whose choice and timing matter' },
      { id: 'unsuitable', label: 'Not suitable for reconstruction' },
      { id: 'cosmetic', label: 'A cosmetic request' },
    ],
    diagnosis: 'candidate',
    plans: [
      { id: 'shared', label: 'Explain all options including no reconstruction, coordinate timing with the cancer team, and let her decide without pressure', quality: 'best', procedure: 'pl_reconstruction' },
      { id: 'push', label: 'Recommend the most complex option without discussing others', quality: 'poor', procedure: 'pl_reconstruction' },
      { id: 'refuse', label: 'Tell her to come back after all cancer treatment, without explaining why', quality: 'ok' },
    ],
    decision: {
      text: "During the reconstruction, the blood supply to the new tissue looks uncertain.",
      options: [
        { id: 'pause', label: 'Pause, review with the team, and take the extra time to secure it', quality: 'best' },
        { id: 'rush', label: 'Finish quickly and hope', quality: 'poor' },
        { id: 'hide', label: 'Leave it out of the notes', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} is happy with her choice and her recovery.",
      fair: "{patient} needs a small second procedure for symmetry.",
      poor: "{patient} has a wound healing problem that takes months to settle.",
    },
  }),
  C({
    id: 'pl_cosmetic_consult', specialty: ['plastic', 'plastic_integrated'], ages: [25, 65], minYear: 1970, cosmetic: true,
    label: 'A cosmetic consultation',
    intro: "{patient}, {age}, would like eyelid surgery for heavy upper eyelids.",
    history: "Has thought about it for two years. Realistic expectations. Healthy, nonsmoker.",
    exam: "Excess skin on both upper eyelids, healthy eyes.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Suitable for the operation.' },
      { test: 'ct', value: 'low', result: 'No reason.' },
    ],
    differential: [
      { id: 'suitable', label: 'A suitable candidate with realistic goals' },
      { id: 'body_image', label: 'A body image concern that surgery will not fix' },
      { id: 'eye_disease', label: 'An eye disease' },
    ],
    diagnosis: 'suitable',
    plans: [
      { id: 'consent', label: 'Discuss realistic results, risks, recovery and cost; offer a cooling-off period and book if they still wish', quality: 'best', procedure: 'pl_cosmetic' },
      { id: 'upsell', label: 'Suggest a facelift too', quality: 'poor', procedure: 'pl_cosmetic' },
      { id: 'same_day', label: 'Operate the same week without time to think', quality: 'poor', procedure: 'pl_cosmetic' },
    ],
    decision: {
      text: "During the operation under local anesthetic, the patient becomes anxious and asks to stop.",
      options: [
        { id: 'pause', label: 'Pause, reassure, and only continue with their agreement', quality: 'best' },
        { id: 'continue', label: 'Carry on, it is nearly done', quality: 'poor' },
        { id: 'sedate', label: 'Sedate them heavily without discussing it', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is pleased with a natural result.",
      fair: "{patient} has swelling that takes weeks to settle.",
      poor: "{patient} has a small asymmetry that needs a touch-up.",
    },
  }),
  C({
    id: 'tx_kidney_living', specialty: ['transplant'], ages: [25, 65], minYear: 1970, tier: 'complex',
    label: 'A living kidney donor',
    intro: "{patient}, {age}, has kidney failure, and a sibling has offered to donate a kidney.",
    history: "On dialysis for two years. The sibling seems eager but quiet when the parents are in the room.",
    exam: "{patient} is fit for a transplant.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'A good tissue match.' },
      { test: 'ct', value: 'useful', result: "The donor's kidneys and vessels are suitable." },
      { test: 'urine', value: 'neutral', result: 'Donor kidney function is normal.' },
    ],
    differential: [
      { id: 'suitable_pair', label: 'A suitable pair, provided the donor freely consents' },
      { id: 'unsuitable', label: 'An unsuitable match' },
      { id: 'too_sick', label: 'The recipient is too unwell' },
    ],
    diagnosis: 'suitable_pair',
    needs: ['blood_special'],
    plans: [
      { id: 'independent', label: 'Make sure the donor has an independent advocate and a private conversation, with a free choice to withdraw, before planning the transplant', quality: 'best', procedure: 'tx_kidney' },
      { id: 'proceed', label: 'Proceed now that the match is good', quality: 'poor', procedure: 'tx_kidney' },
      { id: 'family_meeting', label: 'Talk to the donor only with the whole family present', quality: 'poor' },
    ],
    decision: {
      text: "After the operation, the new kidney is slow to make urine.",
      options: [
        { id: 'review', label: 'Review with the nephrology team, check the blood flow, and explain to the patient', quality: 'best' },
        { id: 'wait', label: 'Wait a few days without checking', quality: 'poor' },
        { id: 'hide', label: 'Say nothing to the patient', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s new kidney works well and they come off dialysis.",
      fair: "{patient}'s kidney is slow to start but works after a week.",
      poor: "{patient} has a rejection episode that needs treatment.",
    },
  }),
  C({
    id: 'tx_liver_listing', specialty: ['transplant'], ages: [30, 65], minYear: 1985, tier: 'high',
    label: 'A liver transplant referral',
    intro: "{patient}, {age}, has liver failure from alcohol-related disease and has been referred for transplant.",
    history: "Has been sober for some months with a support program and family backing. A wealthy relative offers a large donation if {patient} is moved up the list.",
    exam: "Jaundiced and tired. Alert and engaged in the assessment.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'Severity scores place {patient} on the list by medical need.' },
      { test: 'ct', value: 'useful', result: 'No liver cancer; vessels suitable.' },
      { test: 'blood_basic', value: 'neutral', result: 'Poor liver function.' },
    ],
    differential: [
      { id: 'candidate', label: 'A candidate who meets the listing criteria' },
      { id: 'not_yet', label: 'Not yet a candidate' },
      { id: 'too_well', label: 'Too well for transplant' },
    ],
    diagnosis: 'candidate',
    needs: ['blood_special'],
    plans: [
      { id: 'fair', label: 'Present to the committee, list by medical need under the allocation rules, decline the donation offer, and support sobriety', quality: 'best' },
      { id: 'accept_money', label: 'Accept the donation and move them up', quality: 'unsafe' },
      { id: 'refuse_stigma', label: 'Refuse because of the cause of the liver disease', quality: 'poor' },
    ],
    decision: {
      text: "A liver becomes available, and {patient} is next by medical need.",
      options: [
        { id: 'consent', label: 'Confirm consent with {patient}, brief the team, and proceed', quality: 'best' },
        { id: 'skip', label: 'Skip to someone you know personally', quality: 'unsafe' },
        { id: 'delay', label: 'Delay to finish other work', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} receives a liver fairly allocated, recovers, and stays sober.",
      fair: "{patient} has a difficult first few months but stabilizes.",
      poor: "{patient} has complications that need a long hospital stay.",
    },
  }),
  C({
    id: 'cr_colon_cancer', specialty: ['colorectal', 'gensurg'], ages: [45, 85], minYear: 1975, tier: 'complex',
    label: 'A colon cancer diagnosis',
    intro: "{patient}, {age}, had a colonoscopy for blood in the stool that found a cancer.",
    history: "Some tiredness, no weight loss. Fit and independent. Scared about needing a bag.",
    exam: "Mild pallor; the belly is soft.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'A colon cancer.' },
      { test: 'ct', value: 'useful', result: 'No spread to the liver or lungs.' },
      { test: 'blood_basic', value: 'neutral', result: 'Mild anemia.' },
    ],
    differential: [
      { id: 'localized', label: 'A localized colon cancer' },
      { id: 'spread', label: 'Cancer that has spread' },
      { id: 'polyp', label: 'A benign polyp' },
    ],
    diagnosis: 'localized',
    needs: ['biopsy'],
    plans: [
      { id: 'resect', label: 'Discuss the tumor board plan, answer worries about a stoma honestly, get consent, and remove the affected bowel', quality: 'best', procedure: 'gs_colorectal' },
      { id: 'delay', label: 'Wait six months to see if it grows', quality: 'unsafe' },
      { id: 'no_questions', label: 'Book surgery without discussing concerns', quality: 'poor', procedure: 'gs_colorectal' },
    ],
    decision: {
      text: "During the operation, the joined bowel does not look healthy enough to trust.",
      options: [
        { id: 'safe', label: 'Discuss with the team and choose the safer option, even if it means a temporary stoma, as covered in the consent', quality: 'best' },
        { id: 'risk', label: 'Join it anyway to avoid a stoma', quality: 'poor' },
        { id: 'unconsented', label: 'Do a much larger operation not discussed with the patient', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} recovers well and the cancer is fully removed.",
      fair: "{patient} has a temporary stoma that is reversed later.",
      poor: "{patient} has a leak that needs a second operation.",
    },
  }),
  C({
    id: 'so_pancreas', specialty: ['surg_onc', 'gensurg'], ages: [50, 80], minYear: 1980, tier: 'high',
    label: 'A pancreas tumor',
    intro: "{patient}, {age}, turned yellow without pain and a scan found a tumor in the head of the pancreas.",
    history: "Some weight loss. Fit, active, and wants to know the honest picture.",
    exam: "Jaundiced, otherwise well.",
    tests: [
      { test: 'ct', value: 'useful', result: 'A tumor that has not grown into the major blood vessels.' },
      { test: 'biopsy', value: 'useful', result: 'Pancreatic cancer.' },
      { test: 'blood_special', value: 'neutral', result: 'A raised tumor marker.' },
    ],
    differential: [
      { id: 'resectable', label: 'A pancreatic cancer that can be removed' },
      { id: 'unresectable', label: 'A cancer that cannot be removed' },
      { id: 'stone', label: 'A gallstone' },
    ],
    diagnosis: 'resectable',
    needs: ['ct'],
    plans: [
      { id: 'mdt', label: 'Discuss at the tumor board, explain the size of the operation and the honest outlook, get consent, and plan resection', quality: 'best', procedure: 'so_resection' },
      { id: 'refuse', label: 'Say nothing can be done', quality: 'poor' },
      { id: 'oversell', label: 'Promise a cure', quality: 'poor', procedure: 'so_resection' },
    ],
    decision: {
      text: "Partway through, the tumor is found to involve a major vessel more than the scan showed.",
      options: [
        { id: 'team', label: 'Stop, discuss with senior colleagues, and decide within the consent whether it is safe to continue', quality: 'best' },
        { id: 'push', label: 'Push ahead regardless', quality: 'poor' },
        { id: 'silent', label: 'Close without recording what was found', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} recovers from a major operation with the tumor removed.",
      fair: "{patient} has a long recovery but goes on to further treatment.",
      poor: "{patient} has serious complications and a long hospital stay.",
    },
  }),

  // ======================================================================================
  // OBSTETRICS AND GYNECOLOGY, MATERNAL-FETAL MEDICINE
  // ======================================================================================
  C({
    id: 'ob_first_prenatal', specialty: ['obgyn', 'family'], ages: [18, 42], minYear: 1920, sex: 'female',
    label: 'A first prenatal visit',
    intro: "{patient}, {age}, is about nine weeks pregnant and comes for her first prenatal visit with her partner.",
    history: "A planned first pregnancy. Some morning sickness. Healthy, no medicines. Has questions about work, exercise and food.",
    exam: "Healthy, normal blood pressure. The uterus size fits the dates.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Normal blood count and blood group.' },
      { test: 'urine', value: 'useful', result: 'No infection or protein.' },
      { test: 'ultrasound', value: 'useful', result: 'A single pregnancy with a heartbeat, dates confirmed.' },
      { test: 'ct', value: 'unsafe', result: 'Radiation in early pregnancy with no reason.' },
    ],
    differential: [
      { id: 'healthy', label: 'A healthy early pregnancy' },
      { id: 'twins', label: 'Twins' },
      { id: 'ectopic', label: 'A pregnancy outside the womb' },
    ],
    diagnosis: 'healthy',
    plans: [
      { id: 'care_plan', label: 'Answer their questions, explain screening choices without pressure, advise on food, activity and warning signs, and plan the visits ahead', quality: 'best' },
      { id: 'rush', label: 'Do the tests and skip the questions', quality: 'poor' },
      { id: 'all_tests', label: 'Order every possible test regardless of their wishes', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} leaves informed and confident about the months ahead.",
      fair: "{patient} has a few questions left over for next time.",
      poor: "{patient} feels rushed and unsure what happens next.",
    },
  }),
  C({
    id: 'ob_delivery', specialty: ['obgyn', 'family'], ages: [18, 42], minYear: 1900, sex: 'female', tier: 'intermediate', followUp: 'ob_birth_review',
    label: 'In labor',
    intro: "{patient}, {age}, is in labor with her first baby and has a birth plan she cares about.",
    history: "A healthy pregnancy. Labor has been progressing steadily. Her partner is with her.",
    exam: "The cervix is fully open and she is pushing. The baby is head down.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: "The baby's heart rate is checked regularly and is normal so far." },
      { test: 'ultrasound', value: 'low', result: 'Not needed at this stage.' },
    ],
    differential: [
      { id: 'normal_labor', label: 'Normal labor' },
      { id: 'obstructed', label: 'Obstructed labor' },
      { id: 'breech', label: 'A breech baby' },
    ],
    diagnosis: 'normal_labor',
    plans: [
      { id: 'support', label: 'Support her birth plan, keep her informed, and attend the delivery', quality: 'best', procedure: 'ob_delivery' },
      { id: 'cesarean', label: 'Recommend a cesarean to speed things up', quality: 'poor', procedure: 'ob_cesarean' },
      { id: 'leave', label: 'Leave her to the nurses and come back later', quality: 'poor' },
    ],
    decision: {
      text: "During pushing, the baby's heart rate slows and does not recover quickly.",
      options: [
        { id: 'team', label: 'Tell her and the team calmly, change position, call for help, and prepare to speed up the birth if needed', quality: 'best' },
        { id: 'wait', label: 'Wait and see', quality: 'poor' },
        { id: 'silent', label: 'Act without explaining anything to her', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} delivers a healthy baby and feels she was part of every decision.",
      fair: "{patient} needs some help at the end but mother and baby are well.",
      poor: "{patient} has a difficult birth and a slow physical recovery.",
    },
  }),
  C({
    id: 'ob_birth_review', specialty: ['obgyn', 'family'], ages: [19, 43], minYear: 1900, sex: 'female', followUpOnly: true,
    label: 'A follow-up conversation',
    intro: "{patient}, {age}, returns a year after the birth of her first baby to talk about it, and about whether to have another.",
    history: "The birth ended in a rush and she still thinks about it. She would like another child but feels anxious about labor. Sleeping and eating well; enjoys her baby.",
    exam: "Well, with a healed body. Talks openly but becomes tearful describing the birth.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'Going through the birth notes together helps her understand what happened and why.' },
      { test: 'screening_tool', value: 'neutral', result: 'No signs of depression.' },
      { test: 'ultrasound', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'birth_fear', label: 'Lasting worry after a frightening birth' },
      { id: 'depression', label: 'Postpartum depression' },
      { id: 'physical', label: 'A physical complication' },
    ],
    diagnosis: 'birth_fear',
    plans: [
      { id: 'debrief', label: 'Go through the birth together, explain the options for next time, offer counseling, and make a plan she helps shape', quality: 'best' },
      { id: 'brush_off', label: 'Tell her the baby is healthy so it does not matter', quality: 'poor' },
      { id: 'decide_for_her', label: 'Tell her she must have a cesarean next time', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} feels heard and leaves with a plan for a future pregnancy.",
      fair: "{patient} feels a little better and plans to talk again.",
      poor: "{patient} feels dismissed and carries the worry alone.",
    },
  }),
  C({
    id: 'ob_refer_mfm', specialty: ['obgyn', 'family'], ages: [20, 42], minYear: 1975, sex: 'female', tier: 'intermediate',
    label: 'A pregnancy check',
    intro: "{patient}, {age}, is twenty-eight weeks pregnant with twins and has swollen hands and a headache.",
    history: "Has had diabetes since childhood. The headache started yesterday.",
    exam: "Blood pressure is high. Swelling of the hands and face.",
    tests: [
      { test: 'urine', value: 'useful', result: 'Protein in the urine.' },
      { test: 'blood_basic', value: 'useful', result: 'Liver tests are slightly raised.' },
      { test: 'ultrasound', value: 'useful', result: 'Both babies are growing, one a little smaller.' },
      { test: 'ct', value: 'low', result: 'Not needed and adds radiation.' },
    ],
    differential: [
      { id: 'preeclampsia', label: 'Preeclampsia in a high-risk pregnancy' },
      { id: 'migraine', label: 'A migraine' },
      { id: 'normal', label: 'Normal swelling of pregnancy' },
    ],
    diagnosis: 'preeclampsia',
    needs: ['urine'],
    plans: [
      { id: 'refer', label: 'Admit, start monitoring, explain the situation, and involve maternal-fetal medicine today', quality: 'best', refer: 'mfm' },
      { id: 'home', label: 'Send home and recheck in a week', quality: 'unsafe' },
      { id: 'deliver', label: 'Deliver immediately without specialist input', quality: 'poor', procedure: 'ob_cesarean' },
    ],
    outcomes: {
      good: "{patient} is cared for by the specialist team and the twins are born safely weeks later.",
      fair: "{patient}'s twins arrive early but do well in the neonatal unit.",
      poor: "{patient} becomes very unwell before delivery and recovers slowly.",
    },
  }),
  C({
    id: 'ob_fibroids', specialty: ['obgyn'], ages: [30, 50], minYear: 1975, sex: 'female', tier: 'intermediate',
    label: 'Heavy periods',
    intro: "{patient}, {age}, has very heavy periods that keep her home from work.",
    history: "Getting worse over two years, with tiredness. Hopes to have children in the future. Tried medicines without success.",
    exam: "An enlarged, firm uterus. Pale.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'Several fibroids, one large one bulging into the womb.' },
      { test: 'blood_basic', value: 'useful', result: 'Anemia.' },
      { test: 'mri', value: 'neutral', result: 'Maps the fibroids; sometimes useful for planning.' },
    ],
    differential: [
      { id: 'fibroids', label: 'Fibroids' },
      { id: 'cancer', label: 'A cancer of the womb' },
      { id: 'hormonal', label: 'A hormone imbalance' },
    ],
    diagnosis: 'fibroids',
    needs: ['ultrasound'],
    plans: [
      { id: 'myomectomy', label: 'Discuss all options, respect her wish to keep fertility, treat the anemia, get consent, and remove the fibroids', quality: 'best', procedure: 'gyn_surgery' },
      { id: 'hysterectomy', label: 'Recommend removing the womb', quality: 'poor', procedure: 'gyn_surgery' },
      { id: 'iron_only', label: 'Treat the anemia and do nothing else', quality: 'ok' },
    ],
    decision: {
      text: "During the operation, there is more bleeding than expected.",
      options: [
        { id: 'pause', label: 'Pause, tell the anesthesia team, and work through it together', quality: 'best' },
        { id: 'hurry', label: 'Hurry to finish', quality: 'poor' },
        { id: 'unconsented', label: 'Remove the womb, which she did not consent to', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient}'s periods become manageable and her energy returns.",
      fair: "{patient} needs a blood transfusion but recovers well.",
      poor: "{patient} has a slow recovery after heavy bleeding.",
    },
  }),
  C({
    id: 'mfm_preeclampsia', specialty: ['mfm'], ages: [20, 42], minYear: 1975, sex: 'female', tier: 'complex',
    label: 'A high-risk referral',
    intro: "{patient}, {age}, is thirty-two weeks pregnant and has been sent in with rising blood pressure.",
    history: "A first pregnancy. A headache today and some blurred vision. Very anxious about the baby.",
    exam: "High blood pressure, brisk reflexes, swelling. The baby is moving.",
    tests: [
      { test: 'urine', value: 'useful', result: 'Protein in the urine.' },
      { test: 'blood_basic', value: 'useful', result: 'Platelets are dropping and liver tests are rising.' },
      { test: 'ultrasound', value: 'useful', result: 'The baby is a little small with good blood flow.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'severe_pe', label: 'Severe preeclampsia' },
      { id: 'mild_pe', label: 'Mild preeclampsia' },
      { id: 'migraine', label: 'A migraine' },
    ],
    diagnosis: 'severe_pe',
    needs: ['blood_basic'],
    plans: [
      { id: 'stabilize_plan', label: 'Admit, control blood pressure, give a medicine to help the baby\'s lungs mature, involve neonatology, and plan delivery timing with her', quality: 'best' },
      { id: 'wait_term', label: 'Aim to wait until full term at home', quality: 'unsafe' },
      { id: 'no_talk', label: 'Make all decisions without explaining them to her', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} is stabilized and delivers a few days later; mother and baby do well.",
      fair: "{patient}'s baby needs a few weeks in the neonatal unit.",
      poor: "{patient} becomes very unwell and needs intensive care after the birth.",
    },
  }),

  // ======================================================================================
  // OPHTHALMOLOGY, ENT, UROLOGY
  // ======================================================================================
  C({
    id: 'oph_cataract', specialty: ['ophthalmology'], ages: [60, 90], minYear: 1975,
    label: 'Cloudy vision',
    intro: "{patient}, {age}, has blurry vision and glare from headlights that has made night driving impossible.",
    history: "Gradual over two years. New glasses did not help. Wants to keep driving and reading.",
    exam: "A dense cataract in one eye. The back of the eye looks healthy.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A cataract that explains the poor vision.' },
      { test: 'mri', value: 'low', result: 'No reason for a brain scan.' },
      { test: 'ultrasound', value: 'neutral', result: 'Measures the eye for the lens.' },
    ],
    differential: [
      { id: 'cataract', label: 'A cataract' },
      { id: 'macular', label: 'Macular degeneration' },
      { id: 'glaucoma', label: 'Glaucoma' },
    ],
    diagnosis: 'cataract',
    plans: [
      { id: 'operate', label: 'Explain the benefits and risks, get consent, and plan cataract surgery on the worse eye', quality: 'best', procedure: 'oph_cataract' },
      { id: 'glasses', label: 'Prescribe stronger glasses', quality: 'poor' },
      { id: 'both_now', label: 'Operate on both eyes the same day', quality: 'ok', procedure: 'oph_cataract' },
    ],
    decision: {
      text: "During the operation, the patient starts to move and talk.",
      options: [
        { id: 'pause', label: 'Pause, reassure them, and continue only when settled', quality: 'best' },
        { id: 'continue', label: 'Keep going', quality: 'unsafe' },
        { id: 'scold', label: 'Tell them off', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} sees clearly and drives at night again.",
      fair: "{patient}'s vision improves but they still need glasses.",
      poor: "{patient} has swelling in the eye that delays recovery.",
    },
  }),
  C({
    id: 'oph_floaters', specialty: ['ophthalmology'], ages: [50, 75], minYear: 1950,
    label: 'New floaters',
    intro: "{patient}, {age}, has noticed new floaters in one eye over the past two days.",
    history: "Some brief flashes of light at the edge of vision. No curtain over the vision. Short-sighted.",
    exam: "A careful look at the back of the eye shows the gel has separated, with no tear or detachment.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'No retinal tear on a full dilated examination.' },
      { test: 'ct', value: 'low', result: 'Not useful for this.' },
      { test: 'ultrasound', value: 'neutral', result: 'Only needed if the view is poor.' },
    ],
    differential: [
      { id: 'pvd', label: 'Gel separation at the back of the eye, without a tear' },
      { id: 'detachment', label: 'A retinal detachment' },
      { id: 'migraine', label: 'A migraine aura' },
    ],
    diagnosis: 'pvd',
    needs: ['exam_focused'],
    plans: [
      { id: 'reassure', label: 'Explain what has happened, give clear warning signs to return the same day, and arrange a check in a few weeks', quality: 'best' },
      { id: 'operate', label: 'Book surgery', quality: 'poor' },
      { id: 'no_signs', label: 'Reassure without warning signs', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s floaters fade over months and the follow-up is clear.",
      fair: "{patient} worries but the floaters slowly settle.",
      poor: "{patient} is not sure when to come back and misses early warning signs.",
    },
  }),
  C({
    id: 'ent_tonsils', specialty: ['ent'], ages: [4, 14], minYear: 1950, guardian: true,
    label: 'Sore throats',
    intro: "{patient}, {age}, has had many sore throats this year. A parent brings a diary of them.",
    history: "Seven documented bouts of tonsillitis this year, each with fever and missed school. Snores. {patient} says they are tired of being ill.",
    exam: "Large tonsils, no current infection.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'The diary confirms frequent, well-documented episodes.' },
      { test: 'ct', value: 'low', result: 'No reason for a scan.' },
      { test: 'blood_basic', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'recurrent', label: 'Recurrent tonsillitis meeting the threshold for surgery' },
      { id: 'viral', label: 'Ordinary colds' },
      { id: 'allergy', label: 'Allergies' },
    ],
    diagnosis: 'recurrent',
    plans: [
      { id: 'tonsillectomy', label: 'Discuss the benefits and risks with the parent and child, get consent and the child\'s agreement, and plan removal of the tonsils', quality: 'best', procedure: 'ent_surgery' },
      { id: 'wait', label: 'Wait another year and see', quality: 'ok' },
      { id: 'ignore_child', label: 'Decide with the parent and never explain anything to the child', quality: 'poor', procedure: 'ent_surgery' },
    ],
    decision: {
      text: "At the end of the operation, the scrub nurse says the instrument count does not match.",
      options: [
        { id: 'stop_count', label: 'Stop, recount with the team, and do not finish until it is resolved', quality: 'best' },
        { id: 'ignore', label: 'Assume the count is wrong and finish', quality: 'unsafe' },
        { id: 'blame', label: 'Blame the nurse', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is back at school with far fewer sore throats.",
      fair: "{patient} has a painful week of recovery before improving.",
      poor: "{patient} has some bleeding after surgery and needs a night back in the hospital.",
    },
  }),
  C({
    id: 'ent_hoarse', specialty: ['ent'], ages: [50, 80], minYear: 1975, tier: 'intermediate',
    label: 'A hoarse voice',
    intro: "{patient}, {age}, has had a hoarse voice for six weeks.",
    history: "A long-time smoker. No cold beforehand. Some trouble swallowing lately.",
    exam: "A lump on one vocal cord seen with a small scope in the clinic. No lumps in the neck.",
    tests: [
      { test: 'endoscopy', value: 'useful', result: 'An irregular growth on one vocal cord.' },
      { test: 'ct', value: 'useful', result: 'No spread to the neck glands.' },
      { test: 'biopsy', value: 'useful', result: 'An early cancer of the vocal cord.' },
    ],
    differential: [
      { id: 'larynx_cancer', label: 'An early voice box cancer' },
      { id: 'nodule', label: 'A singer\'s nodule' },
      { id: 'laryngitis', label: 'Laryngitis' },
    ],
    diagnosis: 'larynx_cancer',
    needs: ['biopsy'],
    plans: [
      { id: 'biopsy_mdt', label: 'Explain the concern, take a biopsy under anesthesia with consent, discuss at the tumor board, and support stopping smoking', quality: 'best', procedure: 'ent_surgery' },
      { id: 'voice_rest', label: 'Voice rest for a few months', quality: 'poor' },
      { id: 'radical', label: 'Remove the voice box now without a biopsy', quality: 'unsafe' },
    ],
    decision: {
      text: "During the biopsy, the anesthesiologist says the airway is narrower than expected.",
      options: [
        { id: 'team', label: 'Pause and agree a safe airway plan together', quality: 'best' },
        { id: 'push', label: 'Carry on as planned', quality: 'poor' },
        { id: 'silent', label: 'Say nothing', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s early cancer is treated and the voice is kept.",
      fair: "{patient} needs more treatment but does well.",
      poor: "{patient}'s treatment is delayed and recovery is harder.",
    },
  }),
  C({
    id: 'uro_stone', specialty: ['urology', 'emergency'], ages: [25, 60], minYear: 1980,
    label: 'Severe side pain',
    intro: "{patient}, {age}, has waves of severe pain from the side to the groin and cannot sit still.",
    history: "Started this morning. Some blood in the urine. No fever. Had a stone years ago.",
    exam: "Restless, tender over one kidney, no fever.",
    tests: [
      { test: 'urine', value: 'useful', result: 'Blood in the urine, no infection.' },
      { test: 'ct', value: 'useful', result: 'A small stone in the tube from the kidney, likely to pass.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal kidney function.' },
    ],
    differential: [
      { id: 'stone', label: 'A small kidney stone' },
      { id: 'appendicitis', label: 'Appendicitis' },
      { id: 'aneurysm', label: 'An artery problem' },
    ],
    diagnosis: 'stone',
    needs: ['ct'],
    plans: [
      { id: 'pass', label: 'Pain relief, a medicine that helps the stone pass, fluids, and clear advice to return if fever develops', quality: 'best' },
      { id: 'operate', label: 'Remove the stone surgically now', quality: 'poor', procedure: 'uro_surgery' },
      { id: 'no_follow', label: 'Pain relief and no follow-up', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} passes the stone within days.",
      fair: "{patient} takes two weeks to pass the stone.",
      poor: "{patient}'s stone gets stuck and needs a procedure later.",
    },
  }),
  C({
    id: 'uro_bph', specialty: ['urology', 'family', 'internal'], ages: [55, 85], minYear: 1970, sex: 'male',
    label: 'Getting up at night',
    intro: "{patient}, {age}, gets up four times a night to pass urine and has a weak stream.",
    history: "Gradual over years. No blood in the urine. No weight loss. Bothered but not desperate.",
    exam: "A smoothly enlarged prostate. Bladder not distended.",
    tests: [
      { test: 'urine', value: 'useful', result: 'No infection or blood.' },
      { test: 'blood_basic', value: 'useful', result: 'Normal kidney function.' },
      { test: 'ultrasound', value: 'neutral', result: 'Bladder empties reasonably.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'bph', label: 'An enlarged prostate' },
      { id: 'cancer', label: 'Prostate cancer' },
      { id: 'diabetes', label: 'Diabetes' },
    ],
    diagnosis: 'bph',
    plans: [
      { id: 'stepwise', label: 'Discuss lifestyle changes and a medicine first, explain surgery as an option if that fails, and review', quality: 'best' },
      { id: 'operate', label: 'Operate on the prostate now', quality: 'ok', procedure: 'uro_surgery' },
      { id: 'dismiss', label: 'Tell him it is just age', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} sleeps through most nights after a few months.",
      fair: "{patient} improves somewhat and may consider surgery later.",
      poor: "{patient} keeps waking and stops coming to clinic.",
    },
  }),

  // ======================================================================================
  // PHYSICAL MEDICINE AND REHABILITATION, PAIN MEDICINE
  // ======================================================================================
  C({
    id: 'pmr_stroke_rehab', specialty: ['pmr', 'neurology'], ages: [50, 85], minYear: 1960, tier: 'intermediate',
    label: 'Rehabilitation after a stroke',
    intro: "{patient}, {age}, had a stroke two weeks ago and has come to the rehabilitation unit.",
    history: "Weak on one side, speech improving. Lives with a spouse in a two-story house. Wants to walk the dog again.",
    exam: "Weakness of one arm and leg, a stiff hand, mild trouble swallowing. Low mood.",
    tests: [
      { test: 'gait', value: 'useful', result: 'Can walk short distances with a frame and help.' },
      { test: 'screening_tool', value: 'useful', result: 'Mild depression after the stroke.' },
      { test: 'mri', value: 'low', result: 'A repeat brain scan changes nothing for rehabilitation.' },
    ],
    differential: [
      { id: 'rehab_candidate', label: 'Recovering from stroke with good potential for rehabilitation' },
      { id: 'new_stroke', label: 'A new stroke' },
      { id: 'no_potential', label: 'No rehabilitation potential' },
    ],
    diagnosis: 'rehab_candidate',
    plans: [
      { id: 'team_goals', label: 'Set goals with the patient and spouse, coordinate therapy, speech and swallowing support, treat the low mood, and plan the home', quality: 'best' },
      { id: 'nursing_home', label: 'Recommend a nursing home straight away', quality: 'poor' },
      { id: 'pt_only', label: 'Physical therapy alone', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} goes home walking with a cane and walks the dog by spring.",
      fair: "{patient} goes home with more help than hoped but keeps improving.",
      poor: "{patient}'s low mood slows progress and the stay is long.",
    },
  }),
  C({
    id: 'pmr_amputation', specialty: ['pmr'], ages: [45, 80], minYear: 1960, tier: 'intermediate',
    label: 'Planning for a prosthesis',
    intro: "{patient}, {age}, had a lower leg amputation for diabetes complications and is starting rehabilitation.",
    history: "Has a supportive partner. Worried about returning to work as a bus dispatcher. Phantom sensations at night.",
    exam: "The limb is healing well. Good strength in the other leg and arms.",
    tests: [
      { test: 'gait', value: 'useful', result: 'Good balance and strength for walking with a prosthesis.' },
      { test: 'vascular_doppler', value: 'neutral', result: 'Fair circulation in the other leg.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'prosthesis_ready', label: 'A good candidate for a prosthesis' },
      { id: 'wheelchair', label: 'Better suited to a wheelchair only' },
      { id: 'infection', label: 'A wound infection' },
    ],
    diagnosis: 'prosthesis_ready',
    plans: [
      { id: 'team', label: 'Plan the prosthesis with the patient and the team, treat phantom pain, protect the other foot, and plan a return to work', quality: 'best' },
      { id: 'wheelchair', label: 'Provide a wheelchair and close the case', quality: 'poor' },
      { id: 'rush', label: 'Fit a prosthesis before the limb has healed', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} walks with a prosthesis and returns to work within the year.",
      fair: "{patient} walks with a prosthesis at home and uses a wheelchair for long distances.",
      poor: "{patient} has problems with the fit that delay walking for months.",
    },
  }),
  C({
    id: 'pain_chronic_back', specialty: ['pain', 'pmr'], ages: [35, 70], minYear: 1985, tier: 'intermediate',
    label: 'Years of back pain',
    intro: "{patient}, {age}, has had back pain for five years and was referred after asking for stronger painkillers.",
    history: "Two operations elsewhere did not help. Stopped working and sleeps poorly. Feels nobody believes the pain.",
    exam: "Reduced movement, no nerve weakness. Visibly frustrated and tired.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'Sleep, mood and loss of work all feed into the pain.' },
      { test: 'screening_tool', value: 'useful', result: 'Moderate depression and high distress.' },
      { test: 'mri', value: 'low', result: 'A repeat scan shows the same old changes.' },
    ],
    differential: [
      { id: 'chronic_pain', label: 'Chronic pain affecting the whole of life' },
      { id: 'new_injury', label: 'A new spine injury' },
      { id: 'faking', label: 'Exaggerating for medicines' },
    ],
    diagnosis: 'chronic_pain',
    plans: [
      { id: 'multidisciplinary', label: 'Believe the pain, agree goals together, and build a plan with movement, therapy for mood and sleep, careful medicine review, and regular follow-up', quality: 'best' },
      { id: 'escalate', label: 'Prescribe stronger painkillers and see them in six months', quality: 'poor' },
      { id: 'injection', label: 'Offer an injection as the whole plan', quality: 'ok', procedure: 'pain_procedure' },
      { id: 'blame', label: 'Suggest they are exaggerating', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} sleeps better, moves more, and returns to part-time work.",
      fair: "{patient} still has pain but feels more in control.",
      poor: "{patient} feels dismissed and the pain dominates life.",
    },
  }),

  // ======================================================================================
  // GASTROENTEROLOGY
  // ======================================================================================
  C({
    id: 'gi_screening', specialty: ['gi', 'family', 'internal'], ages: [45, 75], minYear: 1975,
    label: 'A screening visit',
    intro: "{patient}, {age}, has come for bowel cancer screening after a positive stool test.",
    history: "No symptoms. A parent had bowel cancer in their seventies. Nervous about the test.",
    exam: "Normal.",
    tests: [
      { test: 'endoscopy', value: 'useful', result: 'Two small polyps are found and removed.' },
      { test: 'ct', value: 'low', result: 'Not the right first test.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal blood count.' },
    ],
    differential: [
      { id: 'polyps', label: 'Polyps found on screening' },
      { id: 'cancer', label: 'Bowel cancer' },
      { id: 'normal', label: 'A normal bowel' },
    ],
    diagnosis: 'polyps',
    needs: ['endoscopy'],
    plans: [
      { id: 'scope', label: 'Explain the test and prepare them kindly, perform a colonoscopy with consent, and arrange follow-up of the results', quality: 'best', procedure: 'gi_endoscopy' },
      { id: 'ignore', label: 'Tell them the positive test is probably false', quality: 'poor' },
      { id: 'surgery', label: 'Refer for surgery', quality: 'poor', refer: 'colorectal' },
    ],
    outcomes: {
      good: "{patient}'s polyps are removed and screening continues on schedule.",
      fair: "{patient} needs a repeat test because the preparation was poor.",
      poor: "{patient} has some bleeding after the polyp removal that settles in the hospital.",
    },
  }),
  C({
    id: 'gi_reflux', specialty: ['gi', 'family', 'internal'], ages: [25, 55], minYear: 1975,
    label: 'Heartburn',
    intro: "{patient}, {age}, has heartburn most evenings and wants a camera test.",
    history: "Worse after large late meals and coffee. No weight loss, no trouble swallowing, no vomiting, no bleeding.",
    exam: "Normal.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'No warning signs at all.' },
      { test: 'endoscopy', value: 'low', result: 'Mild irritation only; not needed without warning signs.' },
      { test: 'ct', value: 'low', result: 'Not useful.' },
    ],
    differential: [
      { id: 'gerd', label: 'Acid reflux' },
      { id: 'cancer', label: 'A stomach cancer' },
      { id: 'heart', label: 'A heart problem' },
    ],
    diagnosis: 'gerd',
    plans: [
      { id: 'trial', label: 'Explain why no camera test is needed now, suggest meal and sleep changes plus an acid-reducing medicine trial, and review', quality: 'best' },
      { id: 'scope', label: 'Perform an endoscopy because they asked', quality: 'poor', procedure: 'gi_endoscopy' },
      { id: 'surgery', label: 'Refer for anti-reflux surgery', quality: 'poor', refer: 'gensurg' },
    ],
    outcomes: {
      good: "{patient}'s heartburn settles with a few changes.",
      fair: "{patient} improves but still has occasional heartburn.",
      poor: "{patient} keeps having symptoms and seeks tests elsewhere.",
    },
  }),

  // ======================================================================================
  // PULMONARY AND CRITICAL CARE, CRITICAL CARE, NEONATOLOGY
  // ======================================================================================
  C({
    id: 'pulm_copd', specialty: ['pulm_cc', 'internal', 'emergency'], ages: [55, 85], minYear: 1970, tier: 'complex',
    label: 'Breathless and wheezy',
    intro: "{patient}, {age}, is struggling to breathe and has been coughing up more phlegm for three days.",
    history: "Long-standing lung disease from smoking. Has an advance care plan saying they would accept a breathing mask but not a breathing tube.",
    exam: "Breathing fast and using neck muscles. Wheeze throughout. Drowsy.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Carbon dioxide is building up in the blood.' },
      { test: 'xray', value: 'useful', result: 'No pneumonia or collapsed lung.' },
      { test: 'ct', value: 'low', result: 'Not needed now.' },
    ],
    differential: [
      { id: 'copd_flare', label: 'A flare of chronic lung disease' },
      { id: 'pneumonia', label: 'Pneumonia' },
      { id: 'heart_failure', label: 'Heart failure' },
    ],
    diagnosis: 'copd_flare',
    needs: ['blood_basic'],
    plans: [
      { id: 'niv', label: 'Start breathing treatments and a breathing mask, respect the advance care plan, and monitor closely in the unit', quality: 'best', procedure: 'icu_procedure' },
      { id: 'tube', label: 'Put in a breathing tube despite their wishes', quality: 'poor' },
      { id: 'ward', label: 'Send to the general ward with an inhaler', quality: 'poor' },
    ],
    triage: {
      text: "Three referrals reach the unit at once: {patient}, drowsy with rising carbon dioxide; a stable patient with asthma who is improving; a patient for routine follow-up.",
      options: [
        { id: 'drowsy', label: 'The drowsy patient with rising carbon dioxide', quality: 'best' },
        { id: 'asthma', label: 'The improving asthma patient', quality: 'poor' },
        { id: 'routine', label: 'The routine follow-up', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} improves on the mask and leaves the unit in a few days.",
      fair: "{patient} needs a longer stay but recovers.",
      poor: "{patient} recovers slowly and needs more help at home.",
    },
  }),
  C({
    id: 'pulm_pneumonia_icu', specialty: ['pulm_cc', 'critical_care'], ages: [40, 80], minYear: 1960, tier: 'complex',
    label: 'Low oxygen',
    intro: "{patient}, {age}, is on the ward with pneumonia, and oxygen levels are falling despite oxygen.",
    history: "Admitted two days ago. Healthy before. Wants everything done and the family to be kept informed.",
    exam: "Breathing fast, tired, and confused at times. Crackles in both lungs.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Pneumonia spreading to both lungs.' },
      { test: 'blood_basic', value: 'useful', result: 'Low oxygen and signs of strain.' },
      { test: 'culture', value: 'useful', result: 'A common pneumonia germ grows.' },
      { test: 'mri', value: 'unsafe', result: 'Moving a failing patient for a long scan is dangerous.' },
    ],
    differential: [
      { id: 'resp_failure', label: 'Breathing failure from severe pneumonia' },
      { id: 'clot', label: 'A clot in the lungs' },
      { id: 'heart', label: 'Heart failure' },
    ],
    diagnosis: 'resp_failure',
    needs: ['xray'],
    plans: [
      { id: 'icu', label: 'Move to intensive care, support breathing as needed with consent, review the antibiotics, and update the family', quality: 'best', procedure: 'icu_procedure' },
      { id: 'wait', label: 'Watch on the ward until morning', quality: 'unsafe' },
      { id: 'no_family', label: 'Treat without updating the family', quality: 'poor' },
    ],
    triage: {
      text: "{patient} is getting worse on the ward, while another patient in the unit is ready to move out and a third is stable on a breathing machine.",
      options: [
        { id: 'deteriorating', label: 'See the deteriorating ward patient first and arrange a bed', quality: 'best' },
        { id: 'stable', label: 'Round on the stable patient first', quality: 'poor' },
        { id: 'paperwork', label: 'Finish the transfer paperwork first', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} recovers after a few days of breathing support.",
      fair: "{patient} needs a week in intensive care and a slow recovery.",
      poor: "{patient} has a long intensive care stay and months of recovery.",
    },
  }),
  C({
    id: 'cc_crash', specialty: ['critical_care', 'pulm_cc'], ages: [20, 45], minYear: 1980, tier: 'high', episode: 'crash_trauma',
    label: 'Intensive care after a crash',
    intro: "{patient}, {age}, is in intensive care after a road crash, an operation to stop bleeding in the belly, and a fixed thigh bone.",
    history: "Day three. Still on a breathing machine. A small brain bruise is being watched. The family is frightened and has many questions.",
    exam: "Lightly sedated, responding to voice. Blood pressure stable without support. Oxygen needs falling.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Blood counts stable; kidneys recovering.' },
      { test: 'xray', value: 'useful', result: 'Lungs clearing.' },
      { test: 'ct', value: 'neutral', result: 'The brain bruise is unchanged.' },
      { test: 'mri', value: 'low', result: 'Not needed and risky to transport for.' },
    ],
    differential: [
      { id: 'recovering', label: 'Recovering and ready to try breathing alone' },
      { id: 'sepsis', label: 'A new infection' },
      { id: 'brain', label: 'A worsening brain injury' },
    ],
    diagnosis: 'recovering',
    needs: ['blood_basic'],
    plans: [
      { id: 'wean_family', label: 'Plan a breathing trial with the team, watch for confusion, start early movement, and hold a family meeting with honest updates', quality: 'best', procedure: 'icu_procedure' },
      { id: 'keep_sedated', label: 'Keep deeply sedated for another week to be safe', quality: 'poor' },
      { id: 'no_family', label: 'Skip the family meeting; they will hear eventually', quality: 'poor' },
    ],
    triage: {
      text: "On the morning round, three patients need attention: {patient}, ready for a breathing trial; a new admission with falling blood pressure; a patient waiting for a ward bed.",
      options: [
        { id: 'new_unstable', label: 'The new admission with falling blood pressure', quality: 'best' },
        { id: 'crash', label: 'The breathing trial first', quality: 'ok' },
        { id: 'bed', label: 'The patient waiting for a ward bed', quality: 'poor' },
      ],
    },
    decision: {
      text: "After the breathing tube comes out, {patient} becomes agitated and confused that night.",
      options: [
        { id: 'delirium_care', label: 'Look for causes, reorient them, involve the family, and use sedation only if truly needed', quality: 'best' },
        { id: 'heavy_sedation', label: 'Sedate heavily to keep them quiet', quality: 'poor' },
        { id: 'restrain', label: 'Restrain them and review in the morning', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} leaves intensive care within days and starts rehabilitation.",
      fair: "{patient} has a period of confusion that slowly clears.",
      poor: "{patient} needs the breathing machine again for a while before improving.",
    },
  }),
  C({
    id: 'neo_preterm', specialty: ['neonatology'], ages: [0, 0], minYear: 1975, guardian: true, tier: 'complex',
    label: 'A premature baby',
    intro: "{patient} was born ten weeks early and is breathing with difficulty. The parents are at the bedside.",
    history: "The mother received a medicine before birth to help the baby's lungs. Born quickly after labor started.",
    exam: "A small baby grunting and pulling in with each breath. Oxygen levels are a little low.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Lungs that have not yet fully matured.' },
      { test: 'blood_basic', value: 'useful', result: 'Sugar is low-normal; signs of strain on breathing.' },
      { test: 'culture', value: 'useful', result: 'Sent to look for infection.' },
      { test: 'mri', value: 'low', result: 'Not appropriate now.' },
    ],
    differential: [
      { id: 'rds', label: 'Breathing difficulty of prematurity' },
      { id: 'sepsis', label: 'A newborn infection' },
      { id: 'heart', label: 'A heart problem' },
    ],
    diagnosis: 'rds',
    needs: ['xray'],
    plans: [
      { id: 'support', label: 'Gentle breathing support, warmth, careful feeding, and time with the parents explaining each step', quality: 'best', procedure: 'icu_procedure' },
      { id: 'maximal', label: 'Every invasive treatment at once', quality: 'poor' },
      { id: 'no_parents', label: 'Keep the parents out of the unit', quality: 'poor' },
    ],
    triage: {
      text: "Three babies need attention: {patient}, premature and working hard to breathe; a full-term baby feeding well under lights for mild jaundice; a baby due to go home.",
      options: [
        { id: 'preterm', label: 'The premature baby struggling to breathe', quality: 'best' },
        { id: 'jaundice', label: 'The baby under lights', quality: 'poor' },
        { id: 'discharge', label: 'The discharge paperwork', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} grows steadily and goes home with the parents a few weeks before the due date.",
      fair: "{patient} needs breathing support for longer but does well.",
      poor: "{patient} has a long stay in the unit with several setbacks.",
    },
  }),
  C({
    id: 'neo_ttn', specialty: ['neonatology', 'pediatrics'], ages: [0, 0], minYear: 1975, guardian: true,
    label: 'A fast-breathing newborn',
    intro: "{patient}, born an hour ago by planned cesarean at full term, is breathing fast. The parents are worried.",
    history: "A healthy pregnancy. No fever in the mother. The waters broke at the time of the cesarean.",
    exam: "Pink, breathing fast with mild effort, good oxygen levels.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Mild fast breathing; otherwise well.' },
      { test: 'xray', value: 'neutral', result: 'Some fluid in the lungs.' },
      { test: 'culture', value: 'neutral', result: 'No growth.' },
      { test: 'ct', value: 'low', result: 'Radiation a newborn does not need.' },
    ],
    differential: [
      { id: 'ttn', label: 'Slow clearing of fluid from the lungs' },
      { id: 'sepsis', label: 'An infection' },
      { id: 'heart', label: 'A heart problem' },
    ],
    diagnosis: 'ttn',
    plans: [
      { id: 'observe', label: 'Observe closely with the parents, support feeding, and explain it usually settles within a day or two', quality: 'best' },
      { id: 'intubate', label: 'Put in a breathing tube', quality: 'poor', procedure: 'icu_procedure' },
      { id: 'ignore', label: 'Send to the regular nursery without monitoring', quality: 'poor' },
    ],
    triage: {
      text: "{patient} is breathing fast but pink with good oxygen, while a baby on the unit has a falling oxygen level and a third is asleep after a feed.",
      options: [
        { id: 'falling', label: 'The baby with falling oxygen', quality: 'best' },
        { id: 'fast', label: 'The fast-breathing baby first', quality: 'ok' },
        { id: 'asleep', label: 'The sleeping baby', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s breathing settles within a day and the family goes home together.",
      fair: "{patient} needs a little oxygen for a day.",
      poor: "{patient} stays on the unit for several days of observation.",
    },
  }),

  // ======================================================================================
  // MEDICAL SUBSPECIALTIES
  // ======================================================================================
  C({
    id: 'onc_lymphoma', specialty: ['heme_onc'], ages: [20, 75], minYear: 1975, tier: 'complex',
    label: 'Swollen glands',
    intro: "{patient}, {age}, has painless lumps in the neck and was referred after a biopsy.",
    history: "Night sweats and weight loss for two months. Works full time and has two children. Wants honest information.",
    exam: "Several firm, painless lumps in the neck and armpit.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'A lymphoma of a type that often responds well to treatment.' },
      { test: 'ct', value: 'useful', result: 'Glands in the neck and chest only.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood counts are fine for treatment.' },
    ],
    differential: [
      { id: 'lymphoma', label: 'A lymphoma' },
      { id: 'infection', label: 'An infection' },
      { id: 'other_cancer', label: 'Spread from another cancer' },
    ],
    diagnosis: 'lymphoma',
    needs: ['biopsy'],
    plans: [
      { id: 'discuss', label: 'Share the diagnosis honestly and kindly, discuss treatment aims and side effects, involve them in the choice, and connect them with support', quality: 'best' },
      { id: 'jargon', label: 'Explain in technical language and hand over a consent form', quality: 'poor' },
      { id: 'hide', label: 'Tell the family but not the patient', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} completes treatment and goes into remission.",
      fair: "{patient} has a hard time with side effects but finishes treatment.",
      poor: "{patient}'s treatment is interrupted by an infection and takes longer.",
    },
  }),
  C({
    id: 'endo_thyroid_nodule', specialty: ['endocrinology'], ages: [25, 70], minYear: 1975,
    label: 'A lump in the neck',
    intro: "{patient}, {age}, noticed a lump in the front of the neck in the mirror.",
    history: "No pain, no voice change, no trouble swallowing. No radiation exposure as a child.",
    exam: "A smooth lump in the thyroid that moves on swallowing.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'Normal thyroid function.' },
      { test: 'ultrasound', value: 'useful', result: 'A nodule with features that are probably benign.' },
      { test: 'biopsy', value: 'neutral', result: 'A needle sample shows benign cells.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'benign_nodule', label: 'A benign thyroid nodule' },
      { id: 'cancer', label: 'A thyroid cancer' },
      { id: 'goiter', label: 'A goiter' },
    ],
    diagnosis: 'benign_nodule',
    needs: ['ultrasound'],
    plans: [
      { id: 'monitor', label: 'Explain the reassuring findings and arrange a follow-up ultrasound', quality: 'best' },
      { id: 'surgery', label: 'Refer for removal of the thyroid', quality: 'poor', refer: 'ent' },
      { id: 'discharge', label: 'Discharge without follow-up', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient}'s nodule stays the same on the next scan.",
      fair: "{patient} worries between scans but stays well.",
      poor: "{patient} has an operation they did not need elsewhere.",
    },
  }),
  C({
    id: 'endo_type1_young', specialty: ['endocrinology', 'internal'], ages: [18, 25], minYear: 1960, tier: 'intermediate',
    label: 'Moving to adult care',
    intro: "{patient}, {age}, has had type 1 diabetes since childhood and is moving from the children's clinic to adult care.",
    history: "Just started college. Sugars have been all over the place. Skips checks around friends. Was admitted once last year very unwell.",
    exam: "Healthy-looking, a little guarded.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'The long-term sugar measure is high.' },
      { test: 'urine', value: 'useful', result: 'No protein leak yet.' },
      { test: 'screening_tool', value: 'useful', result: 'Signs of stress and diabetes burnout.' },
    ],
    differential: [
      { id: 'burnout', label: 'Diabetes burnout during a life transition' },
      { id: 'eating', label: 'An eating disorder' },
      { id: 'type2', label: 'Type 2 diabetes' },
    ],
    diagnosis: 'burnout',
    plans: [
      { id: 'partnership', label: 'Listen without judgment, agree small realistic goals, connect with a diabetes educator and peer support, and keep in close touch', quality: 'best' },
      { id: 'lecture', label: 'Lecture them about complications', quality: 'poor' },
      { id: 'parents', label: 'Call their parents to supervise', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} finds a routine that fits student life, and the sugars steady.",
      fair: "{patient} improves slowly with some setbacks.",
      poor: "{patient} drifts out of care and is admitted unwell again.",
    },
  }),
  C({
    id: 'neph_ckd', specialty: ['nephrology'], ages: [75, 95], minYear: 1975, tier: 'complex',
    label: 'Failing kidneys',
    intro: "{patient}, {age}, has slowly failing kidneys and has come to discuss what happens next.",
    history: "Kidney function has fallen steadily. Has heart disease and is frail but clear-thinking. Values time at home with grandchildren more than anything.",
    exam: "Mild swelling, otherwise comfortable.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Very low kidney function.' },
      { test: 'urine', value: 'neutral', result: 'Protein in the urine.' },
      { test: 'ultrasound', value: 'neutral', result: 'Small kidneys.' },
    ],
    differential: [
      { id: 'esrd', label: 'Kidney failure nearing the need for dialysis' },
      { id: 'acute', label: 'A sudden, reversible kidney injury' },
      { id: 'stable', label: 'Stable kidney disease' },
    ],
    diagnosis: 'esrd',
    needs: ['blood_basic'],
    plans: [
      { id: 'shared', label: 'Explain dialysis and conservative care honestly, support their choice, and plan care around what matters to them', quality: 'best' },
      { id: 'insist', label: 'Insist on dialysis', quality: 'poor' },
      { id: 'avoid', label: 'Avoid the conversation and keep checking blood tests', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} chooses the path that fits their values and lives well at home.",
      fair: "{patient} takes time to decide but feels supported.",
      poor: "{patient} ends up starting dialysis in a crisis without having planned for it.",
    },
  }),
  C({
    id: 'rheum_ra', specialty: ['rheumatology', 'internal'], ages: [25, 65], minYear: 1960, tier: 'intermediate',
    label: 'Painful hands',
    intro: "{patient}, {age}, has painful, swollen finger joints and stiffness every morning.",
    history: "Stiff for over an hour after waking for three months. Tired. Struggling to open jars at work.",
    exam: "Swollen, tender knuckles on both hands.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'Antibodies typical of rheumatoid arthritis.' },
      { test: 'blood_basic', value: 'useful', result: 'Raised inflammation markers.' },
      { test: 'xray', value: 'neutral', result: 'No joint damage yet.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'ra', label: 'Rheumatoid arthritis' },
      { id: 'oa', label: 'Wear-and-tear arthritis' },
      { id: 'viral', label: 'A viral arthritis' },
    ],
    diagnosis: 'ra',
    needs: ['blood_special'],
    plans: [
      { id: 'early_treatment', label: 'Explain the diagnosis, start a disease-modifying medicine early after discussing side effects, arrange therapy and regular monitoring', quality: 'best' },
      { id: 'painkillers', label: 'Painkillers only', quality: 'poor' },
      { id: 'wait', label: 'Wait and see if it settles', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s joints settle and work becomes easy again.",
      fair: "{patient} needs a second medicine before things settle.",
      poor: "{patient}'s joints flare repeatedly while treatment is adjusted.",
    },
  }),
  C({
    id: 'id_traveler', specialty: ['infectious', 'internal'], ages: [18, 65], minYear: 1920, tier: 'intermediate',
    label: 'A fever after travel',
    intro: "{patient}, {age}, has fevers and shaking chills a week after returning from a trip.",
    history: "Visited family in a tropical region. Did not take malaria prevention. Headache and aches.",
    exam: "Feverish, mildly yellow eyes, enlarged spleen.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'A blood film shows malaria parasites.' },
      { test: 'blood_special', value: 'useful', result: 'Confirms the species.' },
      { test: 'culture', value: 'neutral', result: 'No bacteria.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'malaria', label: 'Malaria' },
      { id: 'dengue', label: 'Dengue fever' },
      { id: 'typhoid', label: 'Typhoid fever' },
    ],
    diagnosis: 'malaria',
    needs: ['blood_basic'],
    plans: [
      { id: 'treat', label: 'Admit, start malaria treatment promptly, monitor closely, and explain prevention for future trips', quality: 'best' },
      { id: 'home', label: 'Send home to rest', quality: 'unsafe' },
      { id: 'wait', label: 'Wait for the fever pattern to become clear', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} recovers quickly with treatment.",
      fair: "{patient} has a few days of high fevers before improving.",
      poor: "{patient} becomes very unwell before recovering.",
    },
  }),
  C({
    id: 'pc_murmur', specialty: ['peds_cardiology', 'pediatrics'], ages: [2, 10], minYear: 1975, guardian: true,
    label: 'A heart murmur',
    intro: "{patient}, {age}, was found to have a heart murmur at a checkup. A parent is very worried.",
    history: "Active and growing well. No fainting or breathlessness. {patient} wants to know if they can still play soccer.",
    exam: "A soft murmur that changes with position. Otherwise normal.",
    tests: [
      { test: 'echo', value: 'useful', result: 'A structurally normal heart.' },
      { test: 'ecg', value: 'neutral', result: 'Normal.' },
      { test: 'angiogram', value: 'low', result: 'Invasive and unnecessary.' },
    ],
    differential: [
      { id: 'innocent', label: 'An innocent murmur' },
      { id: 'hole', label: 'A hole in the heart' },
      { id: 'valve', label: 'A valve problem' },
    ],
    diagnosis: 'innocent',
    needs: ['echo'],
    plans: [
      { id: 'reassure', label: 'Explain to the parent and child that the heart is normal, and that soccer is fine', quality: 'best' },
      { id: 'restrict', label: 'Advise no sports to be safe', quality: 'poor' },
      { id: 'follow_forever', label: 'Book yearly heart scans', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} goes back to soccer, and the parent leaves reassured.",
      fair: "{patient}'s parent stays a little anxious for a while.",
      poor: "{patient} is kept out of sports for no reason.",
    },
  }),
];

export const CASE_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));
