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
      { id: 'icu', label: 'Admit to the most closely watched beds straight away', quality: 'ok' },
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
    intro: "{patient}, {age}, has had a fever for a day. The parent has heard frightening stories and is very anxious.",
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
      { id: 'medical_old', label: 'Start medicines for the chest pain and blood pressure, talk through diet, smoking and exercise, and consider an angiogram if symptoms persist', quality: 'best', maxYear: 1986 },
      { id: 'medical', label: 'Start medicines for symptoms and cholesterol, discuss lifestyle, and consider an angiogram if symptoms persist', quality: 'best', minYear: 1987 },
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
        { id: 'review', label: 'Come and examine at once, reassess, and discuss with the team', quality: 'best' },
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
      { id: 'operate', label: 'Operate now to be safe', quality: 'poor', procedure: 'ct_aorta' },
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
  // ---------- Contraception and family planning (the patient's side: engine/health/contraception.js) ----------
  // What these reward: listening, the medical history that changes the choice, every suitable option laid out without
  // pushing one, the patient's decision (never a partner's or a parent's), consent, and the procedures this physician
  // actually holds. Nothing here says how a method is used, placed or dosed.
  C({
    id: 'contra_counsel_aura', specialty: ['obgyn', 'family'], ages: [18, 40], minYear: 1974, sex: 'female',
    label: 'Choosing contraception',
    intro: "{patient}, {age}, would like to start contraception and has heard the pill is the easy choice.",
    history: "She gets migraines a few times a year. Asked carefully, she describes zigzag lights in her vision for twenty minutes before each headache. She does not want a baby for some years and would rather not think about it every day.",
    exam: "Blood pressure is normal. Healthy, with nothing else of note.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'The visual warning before each migraine is a migraine aura, which matters for estrogen-containing methods.' },
      { test: 'urine', value: 'neutral', result: 'A pregnancy test is negative.' },
      { test: 'blood_basic', value: 'low', result: 'Normal results that change nothing about the choice.' },
      { test: 'mri', value: 'low', result: 'A brain scan for typical migraines is not needed.' },
    ],
    differential: [
      { id: 'aura', label: 'Migraine with aura: estrogen-containing methods are not suitable' },
      { id: 'any', label: 'Any method would suit her' },
      { id: 'none', label: 'She should not use hormonal contraception at all' },
    ],
    diagnosis: 'aura',
    needs: ['history_detail'],
    plans: [
      { id: 'all_options', label: 'Explain why estrogen is not for her, lay out every suitable option without pushing one, and let her choose', quality: 'best' },
      { id: 'pill_anyway', label: 'Prescribe the combined pill she asked about', quality: 'unsafe' },
      { id: 'push_iud', label: 'Tell her an IUD is the only sensible choice and book it', quality: 'poor' },
      { id: 'pop_only', label: 'Prescribe a progestin-only pill without discussing the alternatives', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} chooses an option that fits her life, understanding why the pill she first asked about was not the one.",
      fair: "{patient} starts a method that is safe for her, and wonders later whether another would have suited her better.",
      poor: "{patient} leaves with a method that was not right for her, and does not come back for a long time.",
    },
  }),
  C({
    id: 'contra_iud_place', specialty: ['obgyn', 'family'], ages: [20, 45], minYear: 1990, sex: 'female', tier: 'intermediate', followUp: 'contra_iud_review',
    label: 'An IUD appointment',
    intro: "{patient}, {age}, has chosen a hormonal IUD, partly hoping it will make her heavy periods lighter.",
    history: "She thought it over after an earlier visit and has read the leaflet. No new partners; she has not had sex since her last period. She is nervous about the procedure.",
    exam: "A normal pelvic examination; the uterus is a normal size.",
    tests: [
      { test: 'urine', value: 'useful', result: 'A pregnancy test is negative.' },
      { test: 'culture', value: 'neutral', result: 'Infection screening is negative.' },
      { test: 'ultrasound', value: 'low', result: 'A scan that was not needed before a routine placement.' },
    ],
    differential: [
      { id: 'ready', label: 'Suitable for placement today' },
      { id: 'pregnant', label: 'Possibly pregnant' },
      { id: 'infection', label: 'An infection to treat first' },
    ],
    diagnosis: 'ready',
    plans: [
      { id: 'place', label: 'Go through what to expect, confirm her consent, and place the IUD, checking in with her throughout', quality: 'best', procedure: 'lc_iud' },
      { id: 'rush', label: 'Place it quickly without explaining much', quality: 'poor', procedure: 'lc_iud' },
      { id: 'talk_out', label: 'Suggest she try the pill instead because it is quicker for the clinic', quality: 'poor' },
    ],
    decision: {
      text: "Partway through, {patient} says it hurts more than she expected and she is not sure she can go on.",
      options: [
        { id: 'pause', label: 'Stop, ask what she wants, and offer to finish another day or with more pain relief', quality: 'best' },
        { id: 'push_on', label: 'Tell her it is nearly done and carry on', quality: 'poor' },
        { id: 'abandon_silent', label: 'Stop without explaining anything', quality: 'ok' },
      ],
    },
    outcomes: {
      good: "{patient} has her IUD, felt in control of the whole visit, and would recommend the clinic to a friend.",
      fair: "{patient} has her IUD, though the visit was harder than it needed to be.",
      poor: "{patient} feels the visit happened to her rather than with her, and is wary of coming back.",
    },
  }),
  C({
    id: 'contra_iud_review', specialty: ['obgyn', 'family'], ages: [20, 46], minYear: 1990, sex: 'female', followUpOnly: true,
    label: 'An IUD follow-up',
    intro: "{patient}, {age}, returns a few months after her hormonal IUD was placed.",
    history: "Her periods are lighter, but she has had irregular spotting that annoys her. No pain, fever or unusual discharge.",
    exam: "Well. A normal examination; the IUD threads are in place.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Everything is as it should be.' },
      { test: 'urine', value: 'neutral', result: 'A pregnancy test is negative.' },
      { test: 'ct', value: 'low', result: 'A scan with no reason behind it.' },
    ],
    differential: [
      { id: 'expected', label: 'Irregular bleeding, common in the first months' },
      { id: 'expelled', label: 'The IUD has come out' },
      { id: 'infection', label: 'An infection' },
    ],
    diagnosis: 'expected',
    plans: [
      { id: 'explain', label: 'Explain that it often settles, go through her options, and respect whether she keeps it or not', quality: 'best' },
      { id: 'remove_now', label: 'Take it out straight away without discussing it', quality: 'poor', procedure: 'lc_iud' },
      { id: 'dismiss', label: 'Tell her to put up with it', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} decides to give it a few more months, and the spotting settles.",
      fair: "{patient} keeps the IUD but feels she had to argue to be heard.",
      poor: "{patient} feels brushed off and stops trusting the clinic.",
    },
  }),
  C({
    id: 'contra_implant_out', specialty: ['family', 'obgyn'], ages: [22, 42], minYear: 1993, sex: 'female',
    label: 'Ready for a change',
    intro: "{patient}, {age}, has had a contraceptive implant for two years and would like it removed: she and her partner want to try for a baby.",
    history: "She has been well on it. Her mother has told her she should wait until she owns a home.",
    exam: "The implant can be felt under the skin of the upper arm.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The implant is easy to feel; removal should be straightforward.' },
      { test: 'blood_special', value: 'low', result: 'Hormone tests that will not change anything.' },
      { test: 'ultrasound', value: 'low', result: 'Imaging is not needed for an implant that can be felt.' },
    ],
    differential: [
      { id: 'removal', label: 'A routine removal at her request' },
      { id: 'deep', label: 'An implant too deep to find' },
      { id: 'too_early', label: 'Too early to remove' },
    ],
    diagnosis: 'removal',
    plans: [
      { id: 'remove', label: 'Remove it as she asks, and talk through getting ready for a pregnancy', quality: 'best', procedure: 'lc_implant' },
      { id: 'wait', label: 'Suggest she waits a year, as her mother said', quality: 'poor' },
      { id: 'partner_sign', label: 'Ask for her partner to come in and agree first', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient} leaves with the implant out and a plan she made herself.",
      fair: "{patient} has it removed after a second visit, a little later than she wanted.",
      poor: "{patient} feels her decision was second-guessed, and goes elsewhere.",
    },
  }),
  C({
    id: 'contra_emergency', specialty: ['family', 'obgyn', 'emergency'], ages: [17, 40], minYear: 1999, sex: 'female',
    label: 'The next day',
    intro: "{patient}, {age}, comes in because a condom broke two nights ago. She does not want to be pregnant.",
    history: "Her period is regular and due in about ten days. She has no medical problems. She is embarrassed and expects to be judged.",
    exam: "Well.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'The timing means emergency contraception is still possible, and soon is better.' },
      { test: 'urine', value: 'neutral', result: 'A pregnancy test is negative, though it is too early to show this time.' },
      { test: 'ultrasound', value: 'low', result: 'A scan cannot help here.' },
    ],
    differential: [
      { id: 'window', label: 'Within the window for emergency contraception' },
      { id: 'too_late', label: 'Too late for emergency contraception' },
      { id: 'pregnant', label: 'Already pregnant' },
    ],
    diagnosis: 'window',
    plans: [
      { id: 'options', label: 'Without judgment, explain the options (an emergency pill now, or a copper IUD, the most effective) and act on her choice today', quality: 'best' },
      { id: 'too_late', label: 'Tell her it is too late to do anything', quality: 'unsafe' },
      { id: 'lecture', label: 'Give her the emergency pill with a lecture about being careful', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} has emergency contraception that day, and her period comes as expected.",
      fair: "{patient} has what she needed, but leaves feeling judged.",
      poor: "{patient} believes nothing could be done, and spends weeks worrying.",
    },
  }),
  C({
    id: 'contra_sterilization', specialty: ['obgyn'], ages: [28, 45], minYear: 1975, sex: 'female', tier: 'intermediate',
    label: 'Asking for sterilization',
    intro: "{patient}, {age}, has three children and has decided she wants a tubal sterilization.",
    history: "She has thought about it for a year. Her husband would rather she did not. She knows about long-acting reversible methods and does not want one.",
    exam: "Healthy.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'Her decision is long considered and her own.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal, as expected before an operation.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'informed', label: 'An informed, competent request' },
      { id: 'pressured', label: 'A request made under pressure' },
      { id: 'temporary', label: 'A passing wish' },
    ],
    diagnosis: 'informed',
    needs: ['history_detail'],
    plans: [
      { id: 'consent', label: 'Counsel her on permanence and the alternatives, take her own consent, and book the procedure', quality: 'best', procedure: 'tubal' },
      { id: 'husband', label: 'Require her husband\'s signature first', quality: 'unsafe' },
      { id: 'refuse', label: 'Refuse because she might change her mind', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} has the procedure she chose, after counseling that respected her decision.",
      fair: "{patient} has the procedure after more delay than she needed.",
      poor: "{patient} is turned away, and her decision is taken out of her hands.",
    },
  }),
  C({
    id: 'contra_postpartum', specialty: ['obgyn', 'family'], ages: [18, 42], minYear: 1974, sex: 'female',
    label: 'Six weeks after the birth',
    intro: "{patient}, {age}, is here for her check six weeks after giving birth, and asks about contraception.",
    history: "She is breastfeeding and believes that means she cannot get pregnant. She would like at least two years before another baby.",
    exam: "Well recovered.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'Her periods have not returned, but she is feeding less at night now.' },
      { test: 'screening_tool', value: 'neutral', result: 'No signs of postpartum depression.' },
      { test: 'blood_special', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'needs_method', label: 'Breastfeeding alone is not reliable for her now; she needs a method that suits breastfeeding' },
      { id: 'protected', label: 'Breastfeeding protects her' },
      { id: 'no_hormones', label: 'No hormones can be used while breastfeeding' },
    ],
    diagnosis: 'needs_method',
    plans: [
      { id: 'options', label: 'Explain why breastfeeding is not enough now, and offer the methods that suit breastfeeding for her to choose from', quality: 'best' },
      { id: 'reassure', label: 'Tell her breastfeeding is enough', quality: 'poor' },
      { id: 'estrogen', label: 'Prescribe the combined pill without asking about feeding', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} chooses a method that suits feeding, and has the spacing she wanted.",
      fair: "{patient} starts a method, though not the best fit for her circumstances.",
      poor: "{patient} is surprised by a pregnancy within the year.",
    },
  }),
  C({
    id: 'contra_teen', specialty: ['family', 'obgyn', 'pediatrics'], ages: [15, 17], minYear: 1985, sex: 'female',
    label: 'A confidential visit',
    intro: "{patient}, {age}, has come alone and asks whether what she says will be kept private.",
    history: "She has a boyfriend her own age and wants to know about contraception and infections. She does not want her parents told.",
    exam: "Well.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A careful, private conversation finds no sign of pressure or harm.' },
      { test: 'culture', value: 'neutral', result: 'Infection screening is offered and negative.' },
      { test: 'blood_special', value: 'low', result: 'Nothing to look for.' },
    ],
    differential: [
      { id: 'confidential', label: 'A young person seeking confidential advice, safe to give where the law allows' },
      { id: 'harm', label: 'A young person at risk of harm' },
      { id: 'parents', label: 'A matter for her parents to decide' },
    ],
    diagnosis: 'confidential',
    needs: ['history_detail'],
    plans: [
      { id: 'confidential', label: 'Explain confidentiality and its limits, give clear advice on contraception and condoms, and offer to help her talk to a trusted adult if she wants', quality: 'best' },
      { id: 'call_parents', label: 'Call her parents without asking her', quality: 'poor' },
      { id: 'refuse', label: 'Send her away until she is older', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} leaves informed, and knows where to come back to.",
      fair: "{patient} gets some answers, though she is unsure what will stay private.",
      poor: "{patient} does not come back, and goes without advice.",
    },
  }),
  C({
    id: 'contra_vasectomy', specialty: ['urology', 'family'], ages: [30, 55], minYear: 1970, sex: 'male',
    label: 'A vasectomy consultation',
    intro: "{patient}, {age}, wants a vasectomy. He and his partner have the children they want.",
    history: "He has thought it through. He assumed it works from the day it is done.",
    exam: "A normal examination.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'His decision is considered and his own.' },
      { test: 'ultrasound', value: 'low', result: 'Not needed before a routine vasectomy.' },
      { test: 'blood_special', value: 'low', result: 'Nothing to look for.' },
    ],
    differential: [
      { id: 'suitable', label: 'Suitable, once he knows it is not immediate' },
      { id: 'not_suitable', label: 'Not suitable' },
      { id: 'immediate', label: 'Suitable, and effective at once' },
    ],
    diagnosis: 'suitable',
    plans: [
      { id: 'consent', label: 'Counsel on permanence, explain another method is needed until a semen test about three months later, take his consent, and book it', quality: 'best', procedure: 'vasectomy' },
      { id: 'no_test', label: 'Book it and tell him he is protected straight away', quality: 'unsafe', procedure: 'vasectomy' },
      { id: 'partner_must', label: 'Insist his partner signs first', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} has the procedure, uses another method until the test, and the test confirms it worked.",
      fair: "{patient} has the procedure, but misses the follow-up test for a while.",
      poor: "{patient} relies on it too early.",
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
      { id: 'stabilize_old', label: 'Admit, control blood pressure, involve the newborn team early, and plan delivery timing with her', quality: 'best', maxYear: 1993 },
      { id: 'stabilize_plan', label: 'Admit, control blood pressure, give a medicine to help the baby\'s lungs mature, involve neonatology, and plan delivery timing with her', quality: 'best', minYear: 1994 },
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
      { id: 'pass_old', label: 'Pain relief, fluids, a strainer to catch the stone, and clear advice to return if fever develops', quality: 'best', maxYear: 2004 },
      { id: 'pass', label: 'Pain relief, a medicine that helps the stone pass, fluids, and clear advice to return if fever develops', quality: 'best', minYear: 2005 },
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
  // ======================================================================================
  // MORE CASES: PSYCHIATRY, DERMATOLOGY, ANESTHESIOLOGY, RADIOLOGY, PATHOLOGY
  // ======================================================================================
  C({
    id: 'psych_first_psychosis', specialty: ['psychiatry'], ages: [18, 28], minYear: 1960, tier: 'intermediate', household: true,
    label: 'Hearing voices',
    intro: "{patient}, {age}, is brought to clinic by a parent who says {patient} has stopped sleeping and talks about being watched.",
    history: "Over three months {patient} has dropped out of classes, stays in their room, and hears voices commenting on what they do. Has been using cannabis most days. No thoughts of harming anyone, but frightened.",
    exam: "Guarded and distracted, but polite. Clear about time and place. Physically well.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A careful history with the parent fills in a slow change over months, with no sudden illness or head injury.' },
      { test: 'blood_basic', value: 'useful', result: 'Normal results, which helps rule out a medical cause.' },
      { test: 'screening_tool', value: 'neutral', result: 'A structured interview supports a first episode of psychosis.' },
      { test: 'mri', value: 'low', result: 'A brain scan with no reason to expect a finding.' },
    ],
    differential: [
      { id: 'psychosis', label: 'A first episode of psychosis' },
      { id: 'drug', label: 'Effects of drug use alone' },
      { id: 'medical', label: 'A medical illness affecting the brain' },
    ],
    diagnosis: 'psychosis',
    plans: [
      { id: 'early_team', label: 'Explain what is happening in plain words, involve {patient} in choosing treatment, link with an early psychosis team, and talk honestly about cannabis', quality: 'best' },
      { id: 'admit_force', label: 'Admit to hospital against their wishes straight away', quality: 'poor' },
      { id: 'phase', label: 'Tell the family it is a phase and to wait', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} trusts the team, stays in treatment, and returns to classes part-time within the year.",
      fair: "{patient} improves but drops in and out of appointments.",
      poor: "{patient} disengages, and the voices return worse a few months later.",
    },
  }),
  C({
    id: 'derm_bcc', specialty: ['dermatology'], ages: [55, 85], minYear: 1950,
    label: 'A pearly spot',
    intro: "{patient}, {age}, has a small spot on the nose that has bled on and off for a year.",
    history: "Worked outdoors for decades. Fair skin that burns easily. Not painful, but it never fully heals.",
    exam: "A small pearly bump with tiny blood vessels on the surface and a crusted center.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'A small sample confirms a slow-growing skin cancer that rarely spreads.' },
      { test: 'exam_focused', value: 'useful', result: 'A full skin check finds no other worrying spots.' },
      { test: 'ct', value: 'low', result: 'A scan this kind of skin cancer does not need.' },
    ],
    differential: [
      { id: 'bcc', label: 'A slow-growing skin cancer (basal cell)' },
      { id: 'melanoma', label: 'Melanoma' },
      { id: 'pimple', label: 'An inflamed pimple' },
    ],
    diagnosis: 'bcc',
    needs: ['biopsy'],
    plans: [
      { id: 'excise', label: 'Explain the result, agree on removal with clear margins, and talk about sun protection and future skin checks', quality: 'best', procedure: 'derm_excision' },
      { id: 'watch', label: 'Leave it and see what happens', quality: 'poor' },
      { id: 'cream_only', label: 'Recommend a moisturizer', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s spot is removed completely, the scar is small, and yearly checks stay clear.",
      fair: "{patient} needs a second small procedure to clear the edges.",
      poor: "{patient}'s spot keeps growing and needs a larger operation later.",
    },
  }),
  C({
    id: 'anes_family_reaction', specialty: ['anesthesiology'], ages: [18, 60], minYear: 1970, tier: 'intermediate',
    label: 'A family warning',
    intro: "{patient}, {age}, is booked for a knee operation and mentions at the pre-operative clinic that a cousin once had a dangerous reaction to an anesthetic.",
    history: "The cousin developed a very high temperature and stiff muscles during an operation years ago. {patient} has never had an anesthetic. Otherwise healthy.",
    exam: "Fit and well. Normal airway, heart and lungs.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A call to the family confirms the cousin was told it runs in families and to warn relatives.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
      { test: 'echo', value: 'low', result: 'A heart scan that does not address the risk.' },
    ],
    differential: [
      { id: 'inherited', label: 'Possible inherited sensitivity to some anesthetic medicines' },
      { id: 'allergy', label: 'An ordinary allergy' },
      { id: 'none', label: 'No relevant risk' },
    ],
    diagnosis: 'inherited',
    plans: [
      { id: 'safe_plan', label: 'Plan an anesthetic that avoids the trigger medicines, brief the team, prepare the emergency kit, and arrange family testing advice', quality: 'best', procedure: 'anes_care' },
      { id: 'routine', label: 'Proceed as routine; it was only a cousin', quality: 'unsafe', procedure: 'anes_care' },
      { id: 'cancel', label: 'Tell {patient} they can never have surgery', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s operation goes smoothly, and the family gets advice about testing.",
      fair: "{patient}'s operation is delayed a week while the plan is sorted out, then goes well.",
      poor: "{patient} has a worrying rise in temperature in recovery that needs urgent treatment.",
    },
  }),
  C({
    id: 'rad_child_appendix', specialty: ['radiology'], ages: [6, 14], minYear: 1980, guardian: true,
    label: 'An ultrasound for belly pain',
    intro: "The children's emergency team asks for an ultrasound of {patient}, {age}, who has pain in the lower right belly.",
    history: "The request says pain since last night, a mild fever and no appetite. The team hopes to avoid a CT scan if possible.",
    exam: "The ultrasound shows a swollen, tender appendix with a little fluid around it.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'The appendix is clearly seen and is inflamed.' },
      { test: 'ct', value: 'low', result: 'Would add radiation to a child without changing the answer.' },
    ],
    differential: [
      { id: 'appendicitis', label: 'Appendicitis' },
      { id: 'glands', label: 'Swollen glands in the belly from a virus' },
      { id: 'normal', label: 'A normal study' },
    ],
    diagnosis: 'appendicitis',
    plans: [
      { id: 'call_report', label: 'Report appendicitis clearly, call the team so the surgeons are asked now, and note that no CT is needed', quality: 'best' },
      { id: 'ct_anyway', label: 'Recommend a CT scan to be sure', quality: 'poor' },
      { id: 'vague', label: 'Write a vague report and leave the decision to them', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} sees the surgeons within the hour and is home in two days.",
      fair: "{patient}'s operation happens a few hours later than it could have.",
      poor: "{patient} waits for an extra scan and the appendix bursts before surgery.",
    },
  }),
  C({
    id: 'path_cervical_screen', specialty: ['pathology'], ages: [25, 60], minYear: 1950, sex: 'female',
    label: 'A screening slide',
    intro: "A routine cervical screening sample from {patient}, {age}, comes to the laboratory.",
    history: "The form says no symptoms. Last screening was five years ago and normal.",
    exam: "Under the microscope, a small group of cells look clearly abnormal, of a kind that can become cancer over years if left.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'Extra preparations of the sample and a colleague\'s second look agree on high-grade change.' },
      { test: 'history_detail', value: 'neutral', result: 'The form adds little beyond the date of the last screen.' },
      { test: 'blood_special', value: 'low', result: 'No blood test answers this question.' },
    ],
    differential: [
      { id: 'precancer', label: 'High-grade precancerous change' },
      { id: 'inflammation', label: 'Inflammation only' },
      { id: 'cancer', label: 'Invasive cancer' },
    ],
    diagnosis: 'precancer',
    plans: [
      { id: 'report_followup', label: 'Report the finding clearly, recommend prompt referral for a closer look, and make sure the result reaches the clinic', quality: 'best' },
      { id: 'repeat', label: 'Recommend a repeat screen in five years', quality: 'unsafe' },
      { id: 'overcall', label: 'Call it cancer to be safe', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} has the area treated in clinic and later screens are normal.",
      fair: "{patient}'s referral is slow but the change is treated in time.",
      poor: "{patient}'s result is lost and the change is only found years later.",
    },
  }),
  C({
    id: 'path_label_mismatch', specialty: ['pathology'], ages: [30, 80], minYear: 1920, sex: 'female', tier: 'intermediate',
    label: 'The wrong name',
    intro: "A breast biopsy arrives for {patient}, {age}, but the name on the jar does not match the name on the form.",
    history: "The tissue shows cancer. The clinic is busy and the surgeon wants the report today.",
    exam: "The sample is good quality and the diagnosis would be easy to make. The question is whose tissue it is.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'A call to the clinic shows two patients were sampled back to back that morning.' },
      { test: 'biopsy', value: 'neutral', result: 'The tissue itself cannot tell you whose it is.' },
    ],
    differential: [
      { id: 'mislabel', label: 'A labeling error that must be resolved before reporting' },
      { id: 'typo', label: 'A harmless typing error' },
      { id: 'fine', label: 'No problem at all' },
    ],
    diagnosis: 'mislabel',
    plans: [
      { id: 'hold_resolve', label: 'Hold the report, contact the clinic to confirm identity with both patients\' samples, and file a safety report', quality: 'best' },
      { id: 'guess', label: 'Report it under the name on the form', quality: 'unsafe' },
      { id: 'discard', label: 'Throw the sample away and ask for a new one without explanation', quality: 'poor' },
    ],
    outcomes: {
      good: "The mix-up is untangled within a day, and {patient} gets the right result and the right care.",
      fair: "{patient}'s result is delayed a few days while the samples are checked.",
      poor: "{patient} is told the wrong result before the error is found.",
    },
  }),

  // ======================================================================================
  // MORE CASES: OPHTHALMOLOGY, ENT, UROLOGY
  // ======================================================================================
  C({
    id: 'oph_angle_closure', specialty: ['ophthalmology'], ages: [55, 85], minYear: 1980, tier: 'intermediate',
    label: 'A painful red eye',
    intro: "{patient}, {age}, has a sudden painful red eye, blurred vision, halos around lights and has been sick.",
    history: "Started in a dark movie theater last night. Farsighted. Has never had eye trouble before.",
    exam: "A red eye with a hazy front, a mid-sized pupil that does not react, and an eye that feels hard.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The eye pressure is very high and the drainage angle is closed.' },
      { test: 'ct', value: 'low', result: 'A head scan that only delays treatment.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
    ],
    differential: [
      { id: 'angle_closure', label: 'Acute closed-angle glaucoma' },
      { id: 'conjunctivitis', label: 'Pink eye' },
      { id: 'migraine', label: 'A migraine' },
    ],
    diagnosis: 'angle_closure',
    needs: ['exam_focused'],
    plans: [
      { id: 'lower_laser', label: 'Lower the pressure urgently with medicines, then a laser treatment in clinic, and treat the other eye to prevent the same', quality: 'best', procedure: 'oph_laser' },
      { id: 'drops_home', label: 'Give soothing drops and send home', quality: 'unsafe' },
      { id: 'tomorrow', label: 'Book a routine clinic next week', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s pressure comes down within hours and the vision recovers fully.",
      fair: "{patient} keeps most of the vision, with some lasting damage at the edges.",
      poor: "{patient} loses some vision in that eye.",
    },
  }),
  C({
    id: 'oph_diabetic_eye', specialty: ['ophthalmology'], ages: [40, 75], minYear: 1975,
    label: 'A diabetic eye check',
    intro: "{patient}, {age}, comes for a yearly diabetic eye check and says the vision seems fine.",
    history: "Diabetes for fifteen years. Admits sugar control has been poor and missed the last two eye checks.",
    exam: "Vision is good. The back of the eye shows new, fragile blood vessels growing near the optic nerve.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A dilated examination confirms new vessel growth.' },
      { test: 'blood_basic', value: 'useful', result: 'Sugar control is poor over recent months.' },
      { test: 'mri', value: 'low', result: 'Not the right test for the eye.' },
    ],
    differential: [
      { id: 'proliferative', label: 'Advanced diabetic eye disease' },
      { id: 'mild', label: 'Mild diabetic changes only' },
      { id: 'normal', label: 'A normal eye' },
    ],
    diagnosis: 'proliferative',
    needs: ['exam_focused'],
    plans: [
      { id: 'treat_coordinate', label: 'Explain that good vision now does not mean safety, start laser treatment in clinic, and work with the family doctor on sugar control', quality: 'best', procedure: 'oph_laser' },
      { id: 'one_year', label: 'Recheck in a year since vision is fine', quality: 'unsafe' },
      { id: 'scold', label: 'Lecture {patient} about missed checks and send them away', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s new vessels shrink, sugar control improves, and the vision stays good.",
      fair: "{patient} needs extra treatments but keeps useful vision.",
      poor: "{patient} has a bleed inside the eye that blurs the vision for months.",
    },
  }),
  C({
    id: 'oph_lazy_eye', specialty: ['ophthalmology'], ages: [3, 6], minYear: 1950, guardian: true,
    label: 'A school vision check',
    intro: "{patient}, {age}, failed a preschool vision screen in one eye. A parent says {patient} seems to see fine.",
    history: "No complaints. A grandparent wore a patch as a child.",
    exam: "One eye sees much less well than the other. The eyes are straight and healthy.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A careful glasses test shows strong far-sightedness in the weaker eye.' },
      { test: 'mri', value: 'low', result: 'A scan needing sedation, with no reason for it.' },
    ],
    differential: [
      { id: 'amblyopia', label: 'A lazy eye from an uneven glasses prescription' },
      { id: 'tumor', label: 'A tumor behind the eye' },
      { id: 'normal', label: 'A normal result' },
    ],
    diagnosis: 'amblyopia',
    plans: [
      { id: 'glasses_patch', label: 'Prescribe glasses, explain patching the good eye for part of each day, make it a game, and review every few months', quality: 'best' },
      { id: 'grow_out', label: 'Say {patient} will grow out of it', quality: 'poor' },
      { id: 'operate', label: 'Book eye muscle surgery', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s weaker eye catches up within a year, and the patch becomes a pirate game.",
      fair: "{patient}'s vision improves but not fully because patching was hard to keep up.",
      poor: "{patient}'s weaker eye stays weak for life.",
    },
  }),
  C({
    id: 'ent_nosebleed', specialty: ['ent'], ages: [60, 90], minYear: 1950,
    label: 'A nosebleed that will not stop',
    intro: "{patient}, {age}, has had a nosebleed for an hour that pinching has not stopped.",
    history: "High blood pressure. Takes a blood thinner for an irregular heartbeat. Feels a little lightheaded.",
    exam: "Steady bleeding from the front of one nostril. Pulse a little fast, blood pressure high.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A bleeding vessel is seen just inside the nostril.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood count is a little low; the blood thinner is working as expected.' },
      { test: 'ct', value: 'low', result: 'No reason to scan.' },
    ],
    differential: [
      { id: 'anterior', label: 'A bleed from the front of the nose' },
      { id: 'tumor', label: 'A tumor in the nose' },
      { id: 'clotting', label: 'A serious bleeding disorder' },
    ],
    diagnosis: 'anterior',
    plans: [
      { id: 'seal_pack', label: 'Seal the vessel in the clinic, pack if needed, and talk with the heart doctor about the blood thinner rather than stopping it alone', quality: 'best', procedure: 'office_minor' },
      { id: 'stop_thinner', label: 'Tell {patient} to stop the blood thinner for good', quality: 'poor' },
      { id: 'or_now', label: 'Take to the operating room', quality: 'poor', procedure: 'ent_surgery' },
    ],
    outcomes: {
      good: "{patient}'s bleeding stops in clinic and does not come back.",
      fair: "{patient} has one more small bleed at home that settles with pressure.",
      poor: "{patient} returns twice with more bleeding.",
    },
  }),
  C({
    id: 'ent_neck_lump', specialty: ['ent'], ages: [45, 80], minYear: 1980, tier: 'intermediate',
    label: 'A lump in the neck',
    intro: "{patient}, {age}, has a painless lump on one side of the neck that has been there for two months.",
    history: "A long-time smoker who drinks most days. A sore throat on one side and an earache on the same side.",
    exam: "A firm, fixed lump in the neck. The throat exam shows an irregular area at the base of the tongue.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'A solid lymph node; a needle sample shows cancer cells.' },
      { test: 'ct', value: 'useful', result: 'Shows the extent of the disease in the throat and neck.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
    ],
    differential: [
      { id: 'throat_cancer', label: 'Throat cancer spread to a neck gland' },
      { id: 'infection', label: 'A swollen gland from infection' },
      { id: 'cyst', label: 'A harmless cyst' },
    ],
    diagnosis: 'throat_cancer',
    needs: ['ultrasound'],
    plans: [
      { id: 'mdt', label: 'Share the result honestly, bring the case to the head and neck cancer team, and support {patient} through the choices, including help to stop smoking', quality: 'best' },
      { id: 'antibiotics', label: 'Try antibiotics for a month first', quality: 'poor' },
      { id: 'remove_lump', label: 'Simply cut out the lump this week', quality: 'poor', procedure: 'ent_surgery' },
    ],
    outcomes: {
      good: "{patient} starts treatment within weeks with a plan the whole team agreed.",
      fair: "{patient}'s treatment begins after some delay.",
      poor: "{patient}'s cancer grows while time is lost on the wrong treatment.",
    },
  }),
  C({
    id: 'ent_glue_ear', specialty: ['ent'], ages: [2, 6], minYear: 1970, guardian: true,
    label: 'Not hearing well',
    intro: "{patient}, {age}, has seemed not to hear well since a run of colds this winter. A parent asks about ear tubes.",
    history: "Turns the TV up and says 'what?' a lot. No ear pain now. Speech is on track.",
    exam: "Dull eardrums with fluid behind them on both sides. Otherwise well.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A hearing test shows a mild loss on both sides, typical of fluid.' },
      { test: 'ct', value: 'low', result: 'Radiation a child does not need.' },
    ],
    differential: [
      { id: 'glue_ear', label: 'Fluid behind the eardrums after colds' },
      { id: 'nerve', label: 'Permanent nerve deafness' },
      { id: 'wax', label: 'Wax only' },
    ],
    diagnosis: 'glue_ear',
    plans: [
      { id: 'watch_recheck', label: 'Explain that this usually clears in a few months, give tips for talking with {patient}, and recheck the hearing in three months', quality: 'best' },
      { id: 'tubes_now', label: 'Book ear tubes this week', quality: 'ok', procedure: 'ent_surgery' },
      { id: 'dismiss', label: 'Say there is nothing wrong', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s fluid clears by spring and the hearing is back to normal.",
      fair: "{patient} needs ear tubes later after the fluid stays.",
      poor: "{patient}'s hearing problem is missed and school starts badly.",
    },
  }),
  C({
    id: 'uro_testis_lump', specialty: ['urology'], ages: [18, 40], minYear: 1975, sex: 'male', tier: 'intermediate',
    label: 'A lump he nearly ignored',
    intro: "{patient}, {age}, found a hard lump on one testicle in the shower a month ago and has been too embarrassed to come in.",
    history: "Painless. No injury. Hopes to have children one day.",
    exam: "A firm, painless lump within one testicle.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'A solid growth inside the testicle.' },
      { test: 'blood_special', value: 'useful', result: 'Tumor markers are raised.' },
      { test: 'mri', value: 'low', result: 'Adds nothing before the plan.' },
    ],
    differential: [
      { id: 'testis_cancer', label: 'Testicular cancer' },
      { id: 'cyst', label: 'A harmless cyst' },
      { id: 'infection', label: 'An infection' },
    ],
    diagnosis: 'testis_cancer',
    needs: ['ultrasound'],
    plans: [
      { id: 'consent_op', label: 'Explain honestly that this is very treatable, offer sperm banking, get consent and remove the testicle soon', quality: 'best', procedure: 'uro_surgery' },
      { id: 'antibiotics', label: 'Try antibiotics and see', quality: 'unsafe' },
      { id: 'wait', label: 'Recheck in six months', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} is treated early, the outlook is excellent, and he is glad he came in.",
      fair: "{patient} needs extra treatment after surgery but does well.",
      poor: "{patient}'s delay means a longer course of treatment.",
    },
  }),
  C({
    id: 'uro_psa_talk', specialty: ['urology'], ages: [55, 70], minYear: 1990, sex: 'male',
    label: 'A screening question',
    intro: "{patient}, {age}, asks whether he should have the prostate blood test because a friend was just diagnosed.",
    history: "No urinary symptoms. No family history. Has heard frightening things from friends.",
    exam: "Well. No abnormality found.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'Talking it through shows what {patient} is most worried about and what he values.' },
      { test: 'blood_special', value: 'neutral', result: 'Can be done after he decides; a raised result leads to more tests.' },
      { test: 'mri', value: 'low', result: 'No reason for a scan without a test result.' },
    ],
    differential: [
      { id: 'screen_question', label: 'A well man deciding about screening' },
      { id: 'cancer', label: 'A known prostate cancer' },
      { id: 'enlarged', label: 'An enlarged prostate causing symptoms' },
    ],
    diagnosis: 'screen_question',
    plans: [
      { id: 'shared', label: 'Explain the possible benefits and harms of screening in plain numbers, and support whatever he decides', quality: 'best' },
      { id: 'biopsy', label: 'Book a prostate biopsy to settle it', quality: 'unsafe', procedure: 'uro_surgery' },
      { id: 'refuse', label: 'Tell him the test is useless', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} makes an informed choice and leaves less frightened.",
      fair: "{patient} has the test without fully understanding what may follow.",
      poor: "{patient} is left anxious and confused.",
    },
  }),
  C({
    id: 'uro_blood_urine', specialty: ['urology'], ages: [55, 85], minYear: 1980, tier: 'intermediate',
    label: 'Blood in the urine',
    intro: "{patient}, {age}, saw red urine twice last week. It was painless and has stopped.",
    history: "Smoked for forty years. Worked in a dye factory when young. No urinary infections.",
    exam: "Well. Nothing abnormal in the belly.",
    tests: [
      { test: 'urine', value: 'useful', result: 'Blood in the urine with no infection.' },
      { test: 'ct', value: 'useful', result: 'A growth in the bladder wall, with healthy kidneys.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal kidney function.' },
    ],
    differential: [
      { id: 'bladder_tumor', label: 'A bladder tumor' },
      { id: 'infection', label: 'A urine infection' },
      { id: 'stone', label: 'A kidney stone' },
    ],
    diagnosis: 'bladder_tumor',
    needs: ['ct'],
    plans: [
      { id: 'resect', label: 'Explain the finding, get consent to look inside the bladder and remove the growth, and plan follow-up and help to stop smoking', quality: 'best', procedure: 'uro_surgery' },
      { id: 'stopped', label: 'Reassure because the bleeding has stopped', quality: 'unsafe' },
      { id: 'antibiotics', label: 'Treat for an infection', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s tumor is found early and removed, and checkups stay clear.",
      fair: "{patient} needs repeat procedures over the following years.",
      poor: "{patient}'s tumor grows deeper before it is treated.",
    },
  }),

  // ======================================================================================
  // MORE CASES: PAIN MEDICINE, PHYSICAL MEDICINE AND REHABILITATION
  // ======================================================================================
  C({
    id: 'pain_widespread', specialty: ['pain', 'pmr'], ages: [30, 60], minYear: 1990, tier: 'intermediate',
    label: 'Pain everywhere',
    intro: "{patient}, {age}, has aching all over the body for two years, poor sleep and constant tiredness.",
    history: "Many tests elsewhere have all been normal. Has stopped working and walking much. Feels nobody believes the pain is real.",
    exam: "Tender in many places, with full strength, normal joints and normal reflexes.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'Sleep, mood and activity have all slid together; {patient} feels heard for the first time.' },
      { test: 'blood_basic', value: 'useful', result: 'Normal results, including thyroid and inflammation markers.' },
      { test: 'mri', value: 'low', result: 'Another scan, likely to find harmless changes and add worry.' },
    ],
    differential: [
      { id: 'fibromyalgia', label: 'A widespread pain condition of the nervous system' },
      { id: 'arthritis', label: 'Inflammatory arthritis' },
      { id: 'imagined', label: 'Pain that is not real' },
    ],
    diagnosis: 'fibromyalgia',
    plans: [
      { id: 'whole_plan', label: 'Name the condition, explain that the pain is real, and build a plan of graded activity, sleep habits and talking therapy with regular reviews', quality: 'best' },
      { id: 'injections', label: 'Offer a series of nerve injections at many sites', quality: 'poor' },
      { id: 'strong_meds', label: 'Start strong pain medicines and see', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} sleeps better, walks daily again and returns to part-time work.",
      fair: "{patient} has good weeks and bad weeks but feels more in control.",
      poor: "{patient} feels dismissed and keeps searching for a new test.",
    },
  }),
  C({
    id: 'pain_cancer_block', specialty: ['pain'], ages: [50, 85], minYear: 1985, tier: 'complex',
    label: 'Cancer pain',
    intro: "{patient}, {age}, has advanced pancreatic cancer and severe belly pain that strong pain medicines are not controlling.",
    history: "The medicines make {patient} too drowsy to talk with family. The main wish is to be comfortable and alert at home.",
    exam: "Thin, in pain, tender in the upper belly. Clear and able to make decisions.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'What matters most is clear: comfort, alertness and being at home.' },
      { test: 'ct', value: 'useful', result: 'The tumor is close to the nerves that carry pain from the belly.' },
      { test: 'blood_basic', value: 'neutral', result: 'Clotting is normal.' },
    ],
    differential: [
      { id: 'nerve_pain', label: 'Pain from the tumor pressing on belly nerves' },
      { id: 'blockage', label: 'A blocked bowel' },
      { id: 'addiction', label: 'Drug-seeking' },
    ],
    diagnosis: 'nerve_pain',
    plans: [
      { id: 'nerve_block', label: 'Discuss the benefits and risks of a nerve block with {patient} and family, get consent, and coordinate with the palliative care team', quality: 'best', procedure: 'pain_procedure' },
      { id: 'more_meds', label: 'Keep raising the pain medicines', quality: 'ok' },
      { id: 'suspect', label: 'Refuse to increase anything for fear of addiction', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s pain eases enough to cut back the drowsy medicines and spend clear days at home with family.",
      fair: "{patient}'s pain improves somewhat, with some drowsiness remaining.",
      poor: "{patient} stays in pain and too drowsy to enjoy time with family.",
    },
  }),
  C({
    id: 'pain_medicine_review', specialty: ['pain'], ages: [35, 70], minYear: 1995, tier: 'intermediate',
    label: 'A long medicine list',
    intro: "{patient}, {age}, takes strong pain medicines every day for back pain after an injury eight years ago and wants to know why they still hurt.",
    history: "The dose has been raised many times. Feels foggy, constipated and low. Fell twice this year. Worried about being cut off.",
    exam: "Slow, guarded movement. No weakness or numbness.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'The medicines no longer help much, and the side effects now shape daily life.' },
      { test: 'screening_tool', value: 'useful', result: 'A mood questionnaire shows moderate depression.' },
      { test: 'mri', value: 'low', result: 'Would show the same old changes.' },
    ],
    differential: [
      { id: 'med_harm', label: 'Long-term pain medicines now doing more harm than good' },
      { id: 'new_injury', label: 'A new spinal injury' },
      { id: 'faking', label: 'Exaggerating for medicines' },
    ],
    diagnosis: 'med_harm',
    plans: [
      { id: 'slow_taper', label: 'Agree a slow, shared plan to reduce the medicines, with support for mood, physical therapy and regular check-ins', quality: 'best' },
      { id: 'stop_now', label: 'Stop the medicines abruptly', quality: 'unsafe' },
      { id: 'increase', label: 'Raise the dose again', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} is on far less medicine a year later, thinking clearly, with pain no worse than before.",
      fair: "{patient} reduces partway and holds there.",
      poor: "{patient} feels abandoned and stops coming.",
    },
  }),
  C({
    id: 'pain_sciatica_injection', specialty: ['pain'], ages: [30, 65], minYear: 1990,
    label: 'Leg pain that will not settle',
    intro: "{patient}, {age}, has had sharp pain down one leg for ten weeks despite physical therapy and simple pain relief.",
    history: "Cannot sit through a workday. No numbness in the groin and no bladder or bowel trouble.",
    exam: "Pain on lifting the straight leg. Strength and reflexes are normal.",
    tests: [
      { test: 'mri', value: 'useful', result: 'A disc bulge presses on one nerve root, matching the symptoms.' },
      { test: 'exam_focused', value: 'useful', result: 'No warning signs of nerve damage.' },
      { test: 'blood_special', value: 'low', result: 'Not relevant.' },
    ],
    differential: [
      { id: 'radicular', label: 'A trapped nerve root from a disc' },
      { id: 'hip', label: 'Hip arthritis' },
      { id: 'cauda', label: 'A spinal emergency' },
    ],
    diagnosis: 'radicular',
    needs: ['mri'],
    plans: [
      { id: 'targeted', label: 'Explain the options, and with consent offer a targeted injection near the nerve to calm the pain while therapy continues', quality: 'best', procedure: 'pain_procedure' },
      { id: 'surgery', label: 'Refer for spine surgery straight away', quality: 'ok', refer: 'spine' },
      { id: 'bed_rest', label: 'Advise bed rest for a month', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s leg pain settles enough to get back to work and therapy.",
      fair: "{patient} has some relief that fades over months.",
      poor: "{patient} stiffens up and the pain lingers.",
    },
  }),

  // ======================================================================================
  // MORE CASES: VASCULAR SURGERY (FELLOWSHIP AND INTEGRATED)
  // ======================================================================================
  C({
    id: 'vasc_carotid', specialty: ['vascular', 'vascular_integrated'], ages: [60, 85], minYear: 2007, tier: 'complex',
    label: 'A warning stroke',
    intro: "{patient}, {age}, lost the vision in one eye for five minutes last week, like a curtain coming down.",
    history: "Smoker with high blood pressure. Vision returned fully. Also had a few minutes of a clumsy hand on the opposite side.",
    exam: "A whooshing sound over the artery in the neck on the same side. Otherwise normal now.",
    tests: [
      { test: 'vascular_doppler', value: 'useful', result: 'A severe narrowing of the neck artery on the side that matches the symptoms.' },
      { test: 'ct', value: 'useful', result: 'No bleeding in the brain and only a tiny old stroke.' },
      { test: 'angiogram', value: 'low', result: 'A heart artery test that answers a different question.' },
    ],
    differential: [
      { id: 'carotid', label: 'A warning stroke from a narrowed neck artery' },
      { id: 'migraine', label: 'A migraine aura' },
      { id: 'eye', label: 'A problem in the eye itself' },
    ],
    diagnosis: 'carotid',
    needs: ['vascular_doppler'],
    plans: [
      { id: 'early_repair', label: 'Explain the risk of a major stroke, start stroke prevention medicines, and with consent clear the artery within two weeks', quality: 'best', procedure: 'vs_repair' },
      { id: 'meds_only', label: 'Medicines only and review in six months', quality: 'ok' },
      { id: 'wait_months', label: 'Put on the routine waiting list', quality: 'poor', procedure: 'vs_repair' },
    ],
    decision: {
      text: "Near the end of the operation, the anesthesiologist says the patient's blood pressure is swinging widely.",
      options: [
        { id: 'pause', label: 'Pause, agree a target with the anesthesiologist, and finish carefully', quality: 'best' },
        { id: 'ignore', label: 'Carry on; it is their job', quality: 'poor' },
        { id: 'rush', label: 'Rush to close', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} has no further warning signs and is back to normal within weeks.",
      fair: "{patient} has a hoarse voice for a few weeks that recovers.",
      poor: "{patient} has a small stroke around the time of the operation and needs rehabilitation.",
    },
  }),
  C({
    id: 'vasc_acute_limb', specialty: ['vascular', 'vascular_integrated'], ages: [60, 90], minYear: 2007, tier: 'high',
    label: 'A cold, white leg',
    intro: "{patient}, {age}, woke with a cold, pale, painful leg and cannot feel the toes.",
    history: "Has an irregular heartbeat and stopped the blood thinner a month ago because of bruising. The leg was normal yesterday.",
    exam: "The leg is white and cold below the knee, with no pulses and reduced feeling. Movement is still present.",
    tests: [
      { test: 'vascular_doppler', value: 'useful', result: 'No flow below the thigh, from a sudden blockage.' },
      { test: 'ecg', value: 'useful', result: 'The irregular heartbeat, a likely source of a clot.' },
      { test: 'mri', value: 'unsafe', result: 'A long scan the leg cannot afford to wait for.' },
    ],
    differential: [
      { id: 'embolus', label: 'A clot that has suddenly blocked the leg artery' },
      { id: 'dvt', label: 'A clot in a leg vein' },
      { id: 'nerve', label: 'A trapped nerve' },
    ],
    diagnosis: 'embolus',
    plans: [
      { id: 'urgent_repair', label: 'Start a blood thinner, explain the urgency and risks honestly, get consent, and restore flow in the operating room today', quality: 'best', procedure: 'vs_repair' },
      { id: 'tomorrow', label: 'Book for the next routine list', quality: 'unsafe', procedure: 'vs_repair' },
      { id: 'thinner_only', label: 'Give a blood thinner and watch', quality: 'poor' },
    ],
    decision: {
      text: "After flow returns, the calf becomes tight and swollen and the nurse reports rising pain.",
      options: [
        { id: 'relieve', label: 'Recognize the swelling pressure, explain to the patient, and relieve it promptly', quality: 'best' },
        { id: 'more_pain_relief', label: 'Increase pain relief and recheck in the morning', quality: 'unsafe' },
        { id: 'elevate', label: 'Raise the leg and wait', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s leg is saved and walking returns, with a clear plan to restart the blood thinner safely.",
      fair: "{patient}'s leg is saved, with some lasting numbness in the foot.",
      poor: "{patient}'s leg is saved but muscle damage leaves a weak foot and a long recovery.",
    },
  }),
  C({
    id: 'vasc_varicose', specialty: ['vascular', 'vascular_integrated'], ages: [35, 65], minYear: 2007,
    label: 'Bulging veins',
    intro: "{patient}, {age}, wants an operation for bulging leg veins that ache at the end of the day.",
    history: "Stands all day at work. No skin changes, ulcers or clots. Has never tried compression stockings.",
    exam: "Visible varicose veins on one calf. Healthy skin and normal pulses.",
    tests: [
      { test: 'vascular_doppler', value: 'useful', result: 'Leaky valves in a surface vein, with healthy deep veins.' },
      { test: 'angiogram', value: 'low', result: 'An invasive artery test with no reason behind it.' },
    ],
    differential: [
      { id: 'varicose', label: 'Simple varicose veins' },
      { id: 'dvt', label: 'A deep vein clot' },
      { id: 'arterial', label: 'Narrowed arteries' },
    ],
    diagnosis: 'varicose',
    plans: [
      { id: 'conservative', label: 'Explain that the veins are not dangerous, try stockings, movement breaks and leg raising, and review if skin changes appear', quality: 'best' },
      { id: 'operate_now', label: 'Operate this month', quality: 'ok', procedure: 'vs_repair' },
      { id: 'dismiss', label: 'Tell them it is just cosmetic and send them away', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s aching eases with stockings and breaks at work, and the veins stay trouble-free.",
      fair: "{patient} finds stockings a nuisance but manages.",
      poor: "{patient} feels brushed off and seeks treatment elsewhere.",
    },
  }),

  // ======================================================================================
  // MORE CASES: PLASTIC SURGERY (FELLOWSHIP AND INTEGRATED)
  // ======================================================================================
  C({
    id: 'pl_burn_contracture', specialty: ['plastic', 'plastic_integrated'], ages: [18, 50], minYear: 1990, tier: 'intermediate',
    label: 'A tight scar',
    intro: "{patient}, {age}, was burned on the arm as a teenager and the scar now stops the elbow from straightening.",
    history: "Works as a mechanic and cannot reach into engines. Has done stretching and splints for years without progress.",
    exam: "A thick, tight band of scar across the inside of the elbow. Healthy skin nearby. Good hand function.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The joint itself is healthy; the scar is the limit.' },
      { test: 'xray', value: 'neutral', result: 'Normal elbow joint.' },
      { test: 'mri', value: 'low', result: 'Adds nothing to the plan.' },
    ],
    differential: [
      { id: 'contracture', label: 'A scar contracture limiting the joint' },
      { id: 'arthritis', label: 'Elbow arthritis' },
      { id: 'nerve', label: 'A nerve injury' },
    ],
    diagnosis: 'contracture',
    plans: [
      { id: 'release_recon', label: 'Talk through realistic goals and recovery, get consent, and release the scar with healthy nearby skin, followed by hand therapy', quality: 'best', procedure: 'pl_reconstruction' },
      { id: 'more_splints', label: 'More splinting', quality: 'poor' },
      { id: 'cosmetic', label: 'Offer only a cosmetic scar treatment', quality: 'poor', procedure: 'pl_cosmetic' },
    ],
    outcomes: {
      good: "{patient} straightens the arm almost fully and is back under the hood of a car.",
      fair: "{patient} gains movement but needs a second, smaller release later.",
      poor: "{patient}'s scar tightens again because therapy stopped too early.",
    },
  }),
  C({
    id: 'pl_face_defect', specialty: ['plastic', 'plastic_integrated'], ages: [55, 90], minYear: 1990, tier: 'intermediate',
    label: 'A gap to close',
    intro: "{patient}, {age}, has had a skin cancer removed from the cheek, leaving a wound too large to close simply.",
    history: "The dermatologist confirmed the edges are clear. {patient} is worried about how it will look at a grandchild's wedding in three months.",
    exam: "A clean wound on the cheek near the lower eyelid. Healthy surrounding skin.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'The pathology report confirms clear margins.' },
      { test: 'exam_focused', value: 'useful', result: 'Enough loose nearby skin for a local repair that will not pull the eyelid down.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'local_repair', label: 'A wound suited to a local skin repair' },
      { id: 'residual', label: 'Cancer still left behind' },
      { id: 'infection', label: 'An infected wound' },
    ],
    diagnosis: 'local_repair',
    needs: ['biopsy'],
    plans: [
      { id: 'flap', label: 'Explain the options and scars honestly, get consent, and close it with nearby skin, planned to protect the eyelid', quality: 'best', procedure: 'pl_reconstruction' },
      { id: 'leave', label: 'Leave it open to heal on its own', quality: 'ok' },
      { id: 'facelift', label: 'Suggest a facelift at the same time', quality: 'poor', procedure: 'pl_cosmetic' },
    ],
    outcomes: {
      good: "{patient} heals well, the scar fades, and the wedding photos look great.",
      fair: "{patient}'s scar is a little red for the wedding but settles.",
      poor: "{patient}'s lower eyelid is slightly pulled down and needs a small revision.",
    },
  }),
  C({
    id: 'pl_cleft_lip', specialty: ['plastic', 'plastic_integrated'], ages: [0, 1], minYear: 1990, guardian: true, household: true, tier: 'intermediate',
    label: 'A cleft lip',
    intro: "{patient}, {age}, was born with a cleft lip. The parents meet the cleft team for the first time.",
    history: "Feeding was hard at first but is going well with a special bottle. The parents feel guilty and worry about how others will react.",
    exam: "A cleft of the upper lip on one side, with an intact palate. Otherwise a healthy, growing baby.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Growing well and healthy enough to plan a repair.' },
      { test: 'developmental', value: 'neutral', result: 'Development on track.' },
      { test: 'ct', value: 'low', result: 'Radiation a baby does not need.' },
    ],
    differential: [
      { id: 'cleft', label: 'An isolated cleft lip' },
      { id: 'syndrome', label: 'Part of a wider syndrome' },
      { id: 'injury', label: 'A birth injury' },
    ],
    diagnosis: 'cleft',
    plans: [
      { id: 'team_plan', label: 'Reassure the parents it is no one\'s fault, explain the team plan and timing, get consent for repair at a few months old, and arrange feeding and speech support', quality: 'best', procedure: 'pl_reconstruction' },
      { id: 'now', label: 'Operate this week to get it done', quality: 'poor', procedure: 'pl_reconstruction' },
      { id: 'later', label: 'Wait until school age', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s lip repair heals beautifully, and the parents feel part of the team.",
      fair: "{patient} needs a small touch-up when older.",
      poor: "{patient}'s repair is delayed by a missed appointment and feeding struggles return.",
    },
  }),

  // ======================================================================================
  // MORE CASES: GASTROENTEROLOGY
  // ======================================================================================
  C({
    id: 'gi_upper_bleed', specialty: ['gi'], ages: [40, 85], minYear: 1975, tier: 'complex',
    label: 'Vomiting blood',
    intro: "{patient}, {age}, has vomited blood twice and passed black stools since yesterday.",
    history: "Has been taking anti-inflammatory pain pills for a sore knee for weeks. Drinks a little. Feels dizzy standing.",
    exam: "Pale, pulse fast, blood pressure a little low. Belly soft and slightly tender at the top.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Blood count has fallen; kidney tests show blood in the gut.' },
      { test: 'endoscopy', value: 'useful', result: 'A bleeding ulcer in the first part of the bowel.' },
      { test: 'mri', value: 'low', result: 'Too slow and not the right test.' },
    ],
    differential: [
      { id: 'ulcer', label: 'A bleeding ulcer' },
      { id: 'varices', label: 'Bleeding swollen veins from liver disease' },
      { id: 'tear', label: 'A small tear from vomiting' },
    ],
    diagnosis: 'ulcer',
    needs: ['endoscopy'],
    plans: [
      { id: 'resus_scope', label: 'Stabilize with fluids and blood as needed, then endoscopy within a day to stop the bleeding, and explain why the pain pills must stop', quality: 'best', procedure: 'gi_endoscopy' },
      { id: 'home', label: 'Send home with stomach medicine', quality: 'unsafe' },
      { id: 'surgery', label: 'Ask the surgeons to operate first', quality: 'poor', refer: 'gensurg' },
    ],
    decision: {
      text: "During the endoscopy, the bleeding briefly gets heavier and the nurse looks worried.",
      options: [
        { id: 'calm', label: 'Say what you see, ask for the backup equipment, and keep the team informed', quality: 'best' },
        { id: 'abandon', label: 'Stop and send the patient back to the ward', quality: 'poor' },
        { id: 'silent', label: 'Keep going without telling the team', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s bleeding stops at endoscopy, and the knee is managed without those pills.",
      fair: "{patient} needs a second endoscopy before the bleeding stops.",
      poor: "{patient} bleeds again and needs a longer stay.",
    },
  }),
  C({
    id: 'gi_celiac', specialty: ['gi'], ages: [18, 50], minYear: 1985,
    label: 'Bloating and tiredness',
    intro: "{patient}, {age}, has had bloating, loose stools and tiredness for a year.",
    history: "A sister has a gluten problem. Low iron despite supplements. Has cut out several foods on their own.",
    exam: "Thin, a little pale. Belly soft and mildly bloated.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'Antibody tests are strongly positive for celiac disease.' },
      { test: 'endoscopy', value: 'useful', result: 'Small bowel samples confirm the diagnosis.' },
      { test: 'ct', value: 'low', result: 'Radiation without an answer.' },
    ],
    differential: [
      { id: 'celiac', label: 'Celiac disease' },
      { id: 'ibs', label: 'Irritable bowel' },
      { id: 'ibd', label: 'Inflammatory bowel disease' },
    ],
    diagnosis: 'celiac',
    needs: ['blood_special'],
    plans: [
      { id: 'confirm_diet', label: 'Confirm with endoscopy before any diet change, then explain the condition, arrange a dietitian and plan follow-up', quality: 'best', procedure: 'gi_endoscopy' },
      { id: 'diet_now', label: 'Start a strict diet now without confirming', quality: 'ok' },
      { id: 'stress', label: 'Put it down to stress', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} feels better within months, and the iron recovers.",
      fair: "{patient} improves but finds the diet hard at first.",
      poor: "{patient} stays unwell without a clear answer.",
    },
  }),
  C({
    id: 'gi_colitis', specialty: ['gi'], ages: [18, 40], minYear: 1975, tier: 'intermediate',
    label: 'Bloody diarrhea',
    intro: "{patient}, {age}, has had bloody diarrhea six times a day for three weeks.",
    history: "No travel or sick contacts. Urgency, cramps and waking at night to use the bathroom. Missed a lot of work.",
    exam: "Tired, mild fever. Belly tender on the left side.",
    tests: [
      { test: 'culture', value: 'useful', result: 'No infection in the stool samples.' },
      { test: 'endoscopy', value: 'useful', result: 'Inflamed lining of the colon; samples confirm ulcerative colitis.' },
      { test: 'blood_basic', value: 'neutral', result: 'Mild anemia, raised inflammation markers.' },
    ],
    differential: [
      { id: 'uc', label: 'Ulcerative colitis' },
      { id: 'infection', label: 'A bowel infection' },
      { id: 'ibs', label: 'Irritable bowel' },
    ],
    diagnosis: 'uc',
    needs: ['endoscopy'],
    plans: [
      { id: 'scope_treat', label: 'Confirm with a scope and samples, start treatment to calm the inflammation, and explain the condition and the plan for flares', quality: 'best', procedure: 'gi_endoscopy' },
      { id: 'antibiotics', label: 'Treat as an infection only', quality: 'poor' },
      { id: 'colectomy', label: 'Refer for bowel removal now', quality: 'poor', refer: 'colorectal' },
    ],
    outcomes: {
      good: "{patient}'s symptoms settle within weeks and work resumes.",
      fair: "{patient} improves slowly after a change of treatment.",
      poor: "{patient} has a severe flare and needs a hospital stay.",
    },
  }),

  // ======================================================================================
  // MORE CASES: PULMONARY AND CRITICAL CARE, CRITICAL CARE MEDICINE
  // ======================================================================================
  C({
    id: 'icu_goals_meeting', specialty: ['critical_care', 'pulm_cc'], ages: [75, 95], minYear: 1975, tier: 'complex', household: true,
    label: 'A family meeting',
    intro: "{patient}, {age}, has been on a breathing machine in intensive care for ten days after a severe pneumonia, and is not improving.",
    history: "Before this, {patient} had advanced lung disease and was mostly housebound. Once told a daughter, 'never keep me on machines if I cannot get back home.'",
    exam: "Sedated and on a ventilator, needing high oxygen. Kidneys are starting to fail.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'The family confirms {patient}\'s wishes, and the outpatient notes record them too.' },
      { test: 'blood_basic', value: 'useful', result: 'Worsening kidney function and oxygen levels.' },
      { test: 'ct', value: 'low', result: 'A trip to the scanner that would not change the plan.' },
    ],
    differential: [
      { id: 'not_recovering', label: 'A critical illness unlikely to allow recovery to the life they valued' },
      { id: 'turning', label: 'About to turn the corner' },
      { id: 'new_infection', label: 'A simple new infection' },
    ],
    diagnosis: 'not_recovering',
    plans: [
      { id: 'meeting', label: 'Hold a family meeting, share the outlook honestly and kindly, and plan care around what {patient} wanted, with comfort as the priority', quality: 'best' },
      { id: 'everything', label: 'Keep escalating treatment without discussing it', quality: 'poor', procedure: 'icu_procedure' },
      { id: 'decide_alone', label: 'Decide alone and inform the family afterward', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s family feels heard, and care follows {patient}'s own wishes with the family gathered close.",
      fair: "{patient}'s family needs a second meeting before they feel ready, and the care then follows the wishes.",
      poor: "{patient}'s family feels blindsided and the team loses their trust.",
    },
  }),
  C({
    id: 'icu_weaning', specialty: ['critical_care', 'pulm_cc'], ages: [40, 80], minYear: 1985, tier: 'intermediate',
    label: 'Ready to come off?',
    intro: "{patient}, {age}, has been on a breathing machine for five days after a severe chest infection and is improving.",
    history: "The infection is responding to treatment. The night nurse says {patient} has been kept deeply asleep because they seemed restless.",
    exam: "Deeply sedated. Oxygen needs are much lower. Chest X-ray improving.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'With sedation lightened, {patient} wakes, follows commands and breathes well on low support.' },
      { test: 'xray', value: 'useful', result: 'The pneumonia is clearing.' },
      { test: 'ct', value: 'low', result: 'A risky trip to the scanner with no question to answer.' },
    ],
    differential: [
      { id: 'ready', label: 'Ready for a breathing trial and likely removal of the tube' },
      { id: 'not_ready', label: 'Still too sick to try' },
      { id: 'brain', label: 'A brain injury causing the deep sleep' },
    ],
    diagnosis: 'ready',
    plans: [
      { id: 'daily_trial', label: 'Lighten sedation each day, run a breathing trial, and remove the tube when it passes, with the physical therapists starting early movement', quality: 'best' },
      { id: 'keep_asleep', label: 'Keep deeply sedated a few more days to be safe', quality: 'poor' },
      { id: 'trach_now', label: 'Plan a long-term breathing tube now', quality: 'poor', procedure: 'icu_procedure' },
    ],
    outcomes: {
      good: "{patient} is off the machine the same day and walking in the hall within the week.",
      fair: "{patient} fails the first trial but succeeds the next day.",
      poor: "{patient} stays on the machine longer than needed and is weak for weeks.",
    },
  }),

  // ======================================================================================
  // MORE CASES: NEPHROLOGY
  // ======================================================================================
  C({
    id: 'neph_aki', specialty: ['nephrology', 'internal'], ages: [60, 90], minYear: 1960, tier: 'intermediate',
    label: 'Kidneys suddenly worse',
    intro: "{patient}, {age}, is admitted after a week of vomiting and diarrhea, and the blood tests show the kidneys have suddenly slowed down.",
    history: "Has kept taking a water pill and a blood pressure medicine throughout, plus anti-inflammatory pain pills for a sore back. Drinking very little.",
    exam: "Dry mouth, low blood pressure on standing, little urine. No swelling.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Kidney function is much worse than last month, with a raised potassium.' },
      { test: 'urine', value: 'useful', result: 'Concentrated urine with no blood or protein.' },
      { test: 'ultrasound', value: 'neutral', result: 'Normal-sized kidneys, no blockage.' },
      { test: 'biopsy', value: 'low', result: 'An invasive test with no reason behind it.' },
    ],
    differential: [
      { id: 'dehydration_aki', label: 'A kidney injury from dehydration and medicines' },
      { id: 'nephritis', label: 'Inflammation of the kidneys' },
      { id: 'blockage', label: 'A blocked urinary tract' },
    ],
    diagnosis: 'dehydration_aki',
    needs: ['blood_basic'],
    plans: [
      { id: 'fluids_pause', label: 'Give fluids, pause the medicines that strain the kidneys, recheck the blood daily, and explain a sick-day plan for the future', quality: 'best' },
      { id: 'dialysis', label: 'Start dialysis today', quality: 'poor' },
      { id: 'carry_on', label: 'Carry on all the usual medicines', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s kidneys recover within days, and the sick-day plan goes on the fridge.",
      fair: "{patient}'s kidneys recover more slowly but get there.",
      poor: "{patient}'s kidneys are left a little weaker than before.",
    },
  }),
  C({
    id: 'neph_nephrotic', specialty: ['nephrology'], ages: [20, 60], minYear: 1965, tier: 'intermediate',
    label: 'Swollen and frothy',
    intro: "{patient}, {age}, has swollen legs and a puffy face, and the urine has become frothy.",
    history: "Gained weight quickly over a month. No heart or liver disease. Otherwise feels fairly well.",
    exam: "Swelling to the knees and around the eyes. Normal heart and lungs.",
    tests: [
      { test: 'urine', value: 'useful', result: 'A very large amount of protein in the urine.' },
      { test: 'blood_basic', value: 'useful', result: 'Low blood protein, high cholesterol, normal kidney function.' },
      { test: 'biopsy', value: 'useful', result: 'A kidney sample shows the type of filter damage, which guides treatment.' },
    ],
    differential: [
      { id: 'nephrotic', label: 'A condition causing the kidneys to leak protein' },
      { id: 'heart', label: 'Heart failure' },
      { id: 'liver', label: 'Liver disease' },
    ],
    diagnosis: 'nephrotic',
    needs: ['urine'],
    plans: [
      { id: 'biopsy_plan', label: 'Explain the condition, arrange a kidney biopsy with consent, control the swelling, and plan treatment once the type is known', quality: 'best' },
      { id: 'water_pill', label: 'Treat the swelling only and review in a year', quality: 'poor' },
      { id: 'heart_refer', label: 'Refer to cardiology', quality: 'poor', refer: 'cardiology' },
    ],
    outcomes: {
      good: "{patient}'s protein leak comes under control and the swelling goes.",
      fair: "{patient} needs a second treatment before improving.",
      poor: "{patient} develops a clot in a leg vein while waiting for a plan.",
    },
  }),
  C({
    id: 'neph_potassium', specialty: ['nephrology'], ages: [50, 85], minYear: 1960, tier: 'complex',
    label: 'A dangerous blood result',
    intro: "The laboratory calls about {patient}, {age}: the potassium level on a routine test is very high.",
    history: "Known kidney disease. A new blood pressure medicine was started last month. Feels weak.",
    exam: "Slow pulse. Otherwise comfortable.",
    tests: [
      { test: 'ecg', value: 'useful', result: 'Peaked waves on the heart tracing, a sign the potassium is affecting the heart.' },
      { test: 'blood_basic', value: 'useful', result: 'A repeat sample confirms the high potassium; kidney function has dipped.' },
      { test: 'echo', value: 'low', result: 'A heart scan that does not help today.' },
    ],
    differential: [
      { id: 'hyperkalemia', label: 'A dangerously high potassium' },
      { id: 'lab_error', label: 'A laboratory error' },
      { id: 'heart_attack', label: 'A heart attack' },
    ],
    diagnosis: 'hyperkalemia',
    needs: ['ecg'],
    plans: [
      { id: 'urgent', label: 'Bring {patient} in now, protect the heart and lower the potassium with heart monitoring, stop the new medicine, and explain why', quality: 'best' },
      { id: 'repeat_week', label: 'Repeat the test next week', quality: 'unsafe' },
      { id: 'diet', label: 'Give a diet sheet only', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s potassium is back to safe levels by evening, and the medicine is switched.",
      fair: "{patient} needs an overnight stay but is fine.",
      poor: "{patient} has a frightening irregular heartbeat before treatment starts.",
    },
  }),
  C({
    id: 'neph_dialysis_planning', specialty: ['nephrology'], ages: [30, 60], minYear: 1975, tier: 'intermediate',
    label: 'Planning ahead',
    intro: "{patient}, {age}, has kidney disease from diabetes that is slowly worsening, and will probably need treatment for kidney failure within a year.",
    history: "Works full time and has two children. Has heard of dialysis but not of the other options. Scared.",
    exam: "Mild swelling. Healthy veins in both arms.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Kidney function is low and falling steadily.' },
      { test: 'history_detail', value: 'useful', result: '{patient} wants to keep working and be home for the children in the evenings.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'approaching', label: 'Kidney failure approaching, with time to plan' },
      { id: 'acute', label: 'A sudden, reversible injury' },
      { id: 'stable', label: 'Stable disease' },
    ],
    diagnosis: 'approaching',
    plans: [
      { id: 'all_options', label: 'Explain all the options, including home dialysis and transplant, refer for a transplant evaluation, and plan dialysis access early', quality: 'best', refer: 'transplant' },
      { id: 'wait_crisis', label: 'Wait until dialysis is needed and decide then', quality: 'poor' },
      { id: 'clinic_only', label: 'Book clinic dialysis without discussing other options', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient} starts home dialysis at night, keeps working, and is on the transplant list.",
      fair: "{patient} starts dialysis as planned but finds the schedule hard.",
      poor: "{patient} starts dialysis in an emergency with a temporary line.",
    },
  }),

  // ======================================================================================
  // MORE CASES: ENDOCRINOLOGY
  // ======================================================================================
  C({
    id: 'endo_osteoporosis', specialty: ['endocrinology'], ages: [60, 85], minYear: 1995, sex: 'female',
    label: 'A fracture from a small fall',
    intro: "{patient}, {age}, broke her wrist tripping on a curb and was sent for a bone health review.",
    history: "Went through menopause early. Smoked for years. Her mother had a hip fracture. Walks daily.",
    exam: "Slightly stooped. Height has dropped since her last record.",
    tests: [
      { test: 'dexa', value: 'useful', result: 'The bone density scan shows thin bones.' },
      { test: 'xray', value: 'useful', result: 'A spine film shows an old, silent fracture.' },
      { test: 'blood_basic', value: 'useful', result: 'Calcium, vitamin D and kidney function are checked before treatment; vitamin D is low.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'osteoporosis', label: 'Osteoporosis' },
      { id: 'cancer', label: 'Cancer in the bone' },
      { id: 'bad_luck', label: 'Just bad luck' },
    ],
    diagnosis: 'osteoporosis',
    plans: [
      { id: 'protect', label: 'Explain the fracture risk, start a medicine to strengthen bone, correct vitamin D, review falls at home, and plan follow-up', quality: 'best' },
      { id: 'calcium_only', label: 'Calcium tablets only', quality: 'ok' },
      { id: 'nothing', label: 'Nothing: the wrist has healed', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} has no further fractures over the next years and keeps walking daily.",
      fair: "{patient} stops the medicine after a while but stays well.",
      poor: "{patient} breaks a hip the following winter.",
    },
  }),
  C({
    id: 'endo_calcium', specialty: ['endocrinology'], ages: [45, 80], minYear: 1965,
    label: 'A high calcium',
    intro: "{patient}, {age}, had a high calcium found on routine blood tests.",
    history: "Kidney stones twice in five years. Some tiredness and low mood. No cancer history.",
    exam: "Well. No lumps in the neck.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'High calcium with a high parathyroid hormone.' },
      { test: 'ultrasound', value: 'useful', result: 'A small growth by one parathyroid gland.' },
      { test: 'ct', value: 'low', result: 'A body scan for cancer with no reason to suspect it.' },
    ],
    differential: [
      { id: 'hyperpara', label: 'An overactive parathyroid gland' },
      { id: 'cancer', label: 'Cancer raising the calcium' },
      { id: 'supplements', label: 'Too many supplements' },
    ],
    diagnosis: 'hyperpara',
    needs: ['blood_special'],
    plans: [
      { id: 'refer_op', label: 'Explain the cause, and since kidney stones have already happened, refer to a surgeon to remove the gland', quality: 'best', refer: 'gensurg' },
      { id: 'ignore', label: 'Recheck in five years', quality: 'poor' },
      { id: 'cancer_workup', label: 'Order scans for cancer', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s calcium is normal after surgery, and the energy returns.",
      fair: "{patient} waits a while for surgery but does well.",
      poor: "{patient} has another kidney stone while waiting.",
    },
  }),

  // ======================================================================================
  // MORE CASES: HEMATOLOGY AND ONCOLOGY
  // ======================================================================================
  C({
    id: 'onc_fever_low_counts', specialty: ['heme_onc'], ages: [30, 75], minYear: 1975, tier: 'complex',
    label: 'A fever during cancer treatment',
    intro: "{patient}, {age}, calls the oncology line with a fever a week after a cycle of cancer treatment.",
    history: "Feels shivery and weak. Was told to call with any fever. Wonders if it can wait until morning.",
    exam: "Feverish, pulse fast, blood pressure normal. A line in the chest looks clean.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Almost no infection-fighting white cells.' },
      { test: 'culture', value: 'useful', result: 'Blood cultures are taken before treatment starts.' },
      { test: 'mri', value: 'low', result: 'Delays treatment for no gain.' },
    ],
    differential: [
      { id: 'neutropenic', label: 'A fever with very low white cells' },
      { id: 'cold', label: 'A simple cold' },
      { id: 'tumor_fever', label: 'Fever from the cancer itself' },
    ],
    diagnosis: 'neutropenic',
    needs: ['blood_basic'],
    plans: [
      { id: 'admit_fast', label: 'Bring {patient} in now, take cultures and start strong medicines for infection within the hour, and thank them for calling', quality: 'best' },
      { id: 'morning', label: 'Advise rest and a call in the morning', quality: 'unsafe' },
      { id: 'wait_cultures', label: 'Wait for culture results before treating', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s fever settles within two days and the next cycle goes ahead on time.",
      fair: "{patient} needs a few extra days in the hospital.",
      poor: "{patient} becomes very unwell and needs intensive care.",
    },
  }),
  C({
    id: 'heme_sickle_pain', specialty: ['heme_onc'], ages: [16, 35], minYear: 1975, tier: 'intermediate',
    label: 'A pain crisis',
    intro: "{patient}, {age}, has sickle cell disease and arrives in severe pain in the back and legs.",
    history: "Knows these crises well. Says staff in the past treated {patient} as drug-seeking. Has a care plan on file that works.",
    exam: "In obvious pain. Mild fever. Chest clear, oxygen normal.",
    tests: [
      { test: 'history_detail', value: 'useful', result: 'The personal care plan on file sets out what has worked before.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood count close to usual for {patient}.' },
      { test: 'xray', value: 'neutral', result: 'Clear chest.' },
    ],
    differential: [
      { id: 'crisis', label: 'A sickle cell pain crisis' },
      { id: 'seeking', label: 'Drug-seeking' },
      { id: 'chest', label: 'A sickle chest crisis' },
    ],
    diagnosis: 'crisis',
    plans: [
      { id: 'prompt_relief', label: 'Believe the pain, give strong pain relief promptly following the care plan, keep {patient} warm and hydrated, and watch the chest closely', quality: 'best' },
      { id: 'delay', label: 'Wait to see if the pain is real', quality: 'poor' },
      { id: 'mild_only', label: 'Give only mild pain relief', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s pain is controlled within the hour and {patient} goes home in two days, feeling respected.",
      fair: "{patient}'s pain takes longer to control but settles.",
      poor: "{patient} leaves early in pain and returns sicker.",
    },
  }),
  C({
    id: 'onc_breast_adjuvant', specialty: ['heme_onc'], ages: [35, 75], minYear: 1985, sex: 'female', tier: 'intermediate',
    label: 'After the operation',
    intro: "{patient}, {age}, has had an early breast cancer removed and comes to discuss whether more treatment is needed.",
    history: "Recovered well from surgery. Runs a small business. Heard from friends that cancer treatment is unbearable.",
    exam: "Healing scar. Well.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'The pathology report shows a small tumor, clear margins, no spread to the glands, and a hormone-sensitive type.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
      { test: 'ct', value: 'low', result: 'Body scans are not recommended for an early cancer like this.' },
    ],
    differential: [
      { id: 'early_hormone', label: 'An early, hormone-sensitive breast cancer' },
      { id: 'spread', label: 'Cancer that has already spread' },
      { id: 'cured', label: 'Cured by surgery with nothing more to discuss' },
    ],
    diagnosis: 'early_hormone',
    needs: ['biopsy'],
    plans: [
      { id: 'shared', label: 'Explain the benefits and side effects of hormone-blocking treatment in plain numbers, and agree a plan that fits her life', quality: 'best' },
      { id: 'everything', label: 'Recommend the most intensive treatment to be safe', quality: 'poor' },
      { id: 'nothing', label: 'Say no more treatment is needed', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} takes the treatment she chose and keeps the business running.",
      fair: "{patient} struggles with side effects and needs a change of medicine.",
      poor: "{patient} stops treatment early because no one explained what to expect.",
    },
  }),
  C({
    id: 'onc_honest_talk', specialty: ['heme_onc'], ages: [45, 85], minYear: 1975, tier: 'complex', household: true,
    label: 'What happens now?',
    intro: "{patient}, {age}, has lung cancer that has grown despite two lines of treatment. A grown-up child asks for 'anything else you can try.'",
    history: "Tired, breathless with stairs, sleeping more. {patient} quietly says they mainly want to be at home and comfortable.",
    exam: "Thin and tired. Clear-thinking.",
    tests: [
      { test: 'ct', value: 'useful', result: 'The cancer has grown in several places.' },
      { test: 'history_detail', value: 'useful', result: 'Given time and privacy, {patient} is clear about wanting comfort and home.' },
      { test: 'biopsy', value: 'low', result: 'A new biopsy would not change what is possible.' },
    ],
    differential: [
      { id: 'progressive', label: 'Cancer progressing despite treatment' },
      { id: 'infection', label: 'A treatable infection explaining the change' },
      { id: 'stable', label: 'Stable disease' },
    ],
    diagnosis: 'progressive',
    plans: [
      { id: 'honest', label: 'Speak with {patient} first, then the family, share the situation honestly and gently, and introduce palliative and home care focused on comfort', quality: 'best' },
      { id: 'more_treatment', label: 'Start a third harsh treatment because the family asked', quality: 'poor' },
      { id: 'vague', label: 'Stay vague and book a scan in three months', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} spends the following months at home, comfortable, with the family understanding and close.",
      fair: "{patient}'s family takes time to accept the plan but comes around.",
      poor: "{patient} spends the following months in and out of the hospital with side effects.",
    },
  }),

  // ======================================================================================
  // MORE CASES: RHEUMATOLOGY
  // ======================================================================================
  C({
    id: 'rheum_gout', specialty: ['rheumatology', 'internal'], ages: [35, 75], minYear: 1960, sex: 'male',
    label: 'A red, hot toe',
    intro: "{patient}, {age}, woke with an agonizingly painful, red, swollen big toe joint. It is the third time this year.",
    history: "Enjoys beer and red meat. Takes a water pill for blood pressure. No injury.",
    exam: "The big toe joint is hot, red and too painful to touch. No fever.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'Fluid drawn from the joint shows needle-shaped crystals and no infection.' },
      { test: 'blood_basic', value: 'useful', result: 'A high uric acid level and normal kidneys.' },
      { test: 'mri', value: 'low', result: 'A scan that does not change anything.' },
    ],
    differential: [
      { id: 'gout', label: 'Gout' },
      { id: 'septic', label: 'An infected joint' },
      { id: 'bunion', label: 'A bunion' },
    ],
    diagnosis: 'gout',
    plans: [
      { id: 'treat_prevent', label: 'Treat the attack, then talk through diet, alcohol and the water pill, and start a medicine to prevent further attacks', quality: 'best' },
      { id: 'attack_only', label: 'Treat each attack as it comes', quality: 'ok' },
      { id: 'operate', label: 'Refer for surgery on the toe', quality: 'poor', refer: 'podiatry' },
    ],
    outcomes: {
      good: "{patient} has no attacks over the next year.",
      fair: "{patient} has one more attack while the prevention starts working.",
      poor: "{patient} keeps having attacks that damage the joint.",
    },
  }),
  C({
    id: 'rheum_gca', specialty: ['rheumatology'], ages: [60, 90], minYear: 1960, tier: 'complex',
    label: 'A new headache',
    intro: "{patient}, {age}, has a new headache on one side, pain in the jaw when chewing, and blurred vision in one eye this morning.",
    history: "Stiff shoulders for a month. Tired and losing weight. Never had headaches before.",
    exam: "A tender, thickened artery at the temple. Vision slightly reduced in one eye.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Very high inflammation markers.' },
      { test: 'biopsy', value: 'useful', result: 'A sample of the temple artery confirms inflammation.' },
      { test: 'mri', value: 'low', result: 'A brain scan that delays treatment.' },
    ],
    differential: [
      { id: 'gca', label: 'Inflamed arteries of the head (giant cell arteritis)' },
      { id: 'migraine', label: 'A migraine' },
      { id: 'tumor', label: 'A brain tumor' },
    ],
    diagnosis: 'gca',
    needs: ['blood_basic'],
    plans: [
      { id: 'treat_today', label: 'Start treatment to calm the inflammation today, arrange the artery biopsy and an eye review, and explain why the hurry matters', quality: 'best' },
      { id: 'wait_biopsy', label: 'Wait for the biopsy result before treating', quality: 'unsafe' },
      { id: 'pain_relief', label: 'Simple pain relief and review in a month', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s headache settles within days and the vision is saved.",
      fair: "{patient} keeps the vision but has a long course of treatment.",
      poor: "{patient} loses some vision in one eye.",
    },
  }),
  C({
    id: 'rheum_lupus', specialty: ['rheumatology'], ages: [18, 45], minYear: 1965, sex: 'female', tier: 'intermediate',
    label: 'Rash, joints and tiredness',
    intro: "{patient}, {age}, has aching joints, a rash on her cheeks that worsens in the sun, and is exhausted.",
    history: "Mouth ulcers come and go. Some hair thinning. Hopes to start a family in the next few years.",
    exam: "A red rash over the cheeks and nose. Mildly swollen finger joints.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'Antibody tests strongly support lupus.' },
      { test: 'urine', value: 'useful', result: 'A small amount of protein, so the kidneys need watching.' },
      { test: 'blood_basic', value: 'neutral', result: 'Slightly low white cells.' },
    ],
    differential: [
      { id: 'lupus', label: 'Lupus' },
      { id: 'ra', label: 'Rheumatoid arthritis' },
      { id: 'rosacea', label: 'Rosacea' },
    ],
    diagnosis: 'lupus',
    needs: ['blood_special'],
    plans: [
      { id: 'plan', label: 'Explain the condition, start treatment to calm the immune system, advise sun protection, check the kidneys regularly, and plan ahead for pregnancy', quality: 'best' },
      { id: 'creams', label: 'Treat the rash only', quality: 'poor' },
      { id: 'never_pregnant', label: 'Tell her she can never have children', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s symptoms settle and, years later, she has a well-planned pregnancy.",
      fair: "{patient} has occasional flares but manages well.",
      poor: "{patient}'s kidney involvement is missed until it worsens.",
    },
  }),
  C({
    id: 'rheum_spine_young', specialty: ['rheumatology'], ages: [18, 40], minYear: 1985,
    label: 'A stiff back in the morning',
    intro: "{patient}, {age}, has had low back pain for a year that is worst in the morning and better with exercise.",
    history: "Wakes in the second half of the night with stiffness. An eye became red and painful once last year. A father had a 'stiff spine.'",
    exam: "Reduced bending of the lower back. Tender over the joints at the base of the spine.",
    tests: [
      { test: 'mri', value: 'useful', result: 'Inflammation in the joints at the base of the spine.' },
      { test: 'blood_special', value: 'useful', result: 'A genetic marker linked to the condition is present.' },
      { test: 'ct', value: 'low', result: 'Radiation that adds nothing.' },
    ],
    differential: [
      { id: 'axial', label: 'Inflammatory arthritis of the spine' },
      { id: 'mechanical', label: 'Ordinary back strain' },
      { id: 'disc', label: 'A slipped disc' },
    ],
    diagnosis: 'axial',
    plans: [
      { id: 'treat_move', label: 'Explain the condition, start treatment to calm the inflammation, and build a daily exercise and posture plan with a physical therapist', quality: 'best' },
      { id: 'rest', label: 'Advise rest', quality: 'poor' },
      { id: 'spine_surgeon', label: 'Refer to a spine surgeon', quality: 'poor', refer: 'spine' },
    ],
    outcomes: {
      good: "{patient}'s mornings get easier and sport becomes part of the week again.",
      fair: "{patient} improves but has stiff spells.",
      poor: "{patient}'s spine stiffens over the years.",
    },
  }),

  // ======================================================================================
  // MORE CASES: INFECTIOUS DISEASE
  // ======================================================================================
  C({
    id: 'id_hiv_new', specialty: ['infectious'], ages: [18, 60], minYear: 1996, tier: 'intermediate',
    label: 'A positive result',
    intro: "{patient}, {age}, has come back for the result of a test done during a bout of flu-like illness, and the HIV test is positive.",
    history: "Scared and asks who will be told. Has a regular partner. Works in a restaurant and worries about losing the job.",
    exam: "Well. A few swollen glands in the neck.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'The confirmatory test is positive; immune cells are still at a healthy level.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal liver and kidney function.' },
      { test: 'ct', value: 'low', result: 'No reason to scan.' },
    ],
    differential: [
      { id: 'hiv', label: 'A new HIV infection, caught early' },
      { id: 'false', label: 'A false positive' },
      { id: 'flu', label: 'Flu only' },
    ],
    diagnosis: 'hiv',
    needs: ['blood_special'],
    plans: [
      { id: 'support', label: 'Give the result privately and calmly, explain that treatment now allows a long, healthy life, start treatment soon, and talk through partner testing and confidentiality', quality: 'best' },
      { id: 'tell_employer', label: 'Advise telling the employer', quality: 'poor' },
      { id: 'leaflet', label: 'Hand over a leaflet and book a review in three months', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} starts treatment, the virus becomes undetectable, and the partner is tested and protected.",
      fair: "{patient} takes some months to start treatment but stays well.",
      poor: "{patient} is lost to follow-up after the shock of the news.",
    },
  }),
  C({
    id: 'id_endocarditis', specialty: ['infectious', 'cardiology'], ages: [30, 80], minYear: 1975, tier: 'complex',
    label: 'A fever that keeps coming back',
    intro: "{patient}, {age}, has had fevers and night sweats for three weeks, despite two short courses of antibiotics from an urgent care clinic.",
    history: "Has a known heart murmur. Had dental work a month ago. Lost weight.",
    exam: "Feverish. A loud heart murmur. Small painful spots on the fingertips.",
    tests: [
      { test: 'culture', value: 'useful', result: 'Several blood cultures grow the same bacteria.' },
      { test: 'echo', value: 'useful', result: 'A growth of infection on a heart valve.' },
      { test: 'mri', value: 'low', result: 'Not the right test.' },
    ],
    differential: [
      { id: 'endocarditis', label: 'An infection of a heart valve' },
      { id: 'flu', label: 'A lingering virus' },
      { id: 'lymphoma', label: 'Lymphoma' },
    ],
    diagnosis: 'endocarditis',
    needs: ['culture'],
    plans: [
      { id: 'long_course', label: 'Take cultures first, then give a long course of targeted medicines for infection, and involve the heart surgeons early in case the valve needs repair', quality: 'best' },
      { id: 'short_course', label: 'Another short course of tablets', quality: 'poor' },
      { id: 'no_cultures', label: 'Start treatment before taking cultures', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} clears the infection, and the valve holds up well.",
      fair: "{patient} clears the infection but needs a valve operation months later.",
      poor: "{patient} has a small stroke from the infection before treatment works.",
    },
  }),
  C({
    id: 'id_tb', specialty: ['infectious', 'pulm_cc'], ages: [20, 70], minYear: 1955, tier: 'intermediate', household: true,
    label: 'A cough that will not go',
    intro: "{patient}, {age}, has had a cough for two months, night sweats and weight loss.",
    history: "Shares a small apartment with family, including a toddler. Recently arrived from a country where tuberculosis is common.",
    exam: "Thin. Crackles at the top of one lung.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A cavity at the top of one lung.' },
      { test: 'culture', value: 'useful', result: 'Sputum samples show the TB bacteria.' },
      { test: 'blood_basic', value: 'neutral', result: 'Mild anemia.' },
    ],
    differential: [
      { id: 'tb', label: 'Tuberculosis' },
      { id: 'cancer', label: 'Lung cancer' },
      { id: 'pneumonia', label: 'A simple pneumonia' },
    ],
    diagnosis: 'tb',
    needs: ['culture'],
    plans: [
      { id: 'treat_trace', label: 'Start a full course of TB treatment, support {patient} to finish it, and work with public health to check the family, especially the toddler', quality: 'best' },
      { id: 'short', label: 'Give a short course of ordinary antibiotics', quality: 'poor' },
      { id: 'no_family', label: 'Treat {patient} only and leave the family out', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} completes treatment, and the family is checked and protected.",
      fair: "{patient} misses some doses but finishes with extra support.",
      poor: "{patient}'s toddler falls ill with TB months later.",
    },
  }),

  // ======================================================================================
  // MORE CASES: NEONATOLOGY
  // ======================================================================================
  C({
    id: 'neo_jaundice', specialty: ['neonatology', 'pediatrics'], ages: [0, 0], minYear: 1975, guardian: true, household: true,
    label: 'A yellow baby',
    intro: "{patient}, three days old, has turned yellow and is sleepy at feeds. The parents were told newborns often look a bit yellow.",
    history: "Born at thirty-six weeks. Breastfeeding, but feeds are short and wet diapers are few. The parents have a different blood group from each other.",
    exam: "Yellow down to the legs. Sleepy but wakes and feeds when stimulated. Normal tone.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'The jaundice level is above the treatment line for age.' },
      { test: 'blood_special', value: 'useful', result: 'A blood group mismatch is breaking down some red cells.' },
      { test: 'ultrasound', value: 'low', result: 'A scan that does not answer the question.' },
    ],
    differential: [
      { id: 'jaundice_treat', label: 'Jaundice high enough to need treatment' },
      { id: 'normal', label: 'Normal newborn jaundice needing nothing' },
      { id: 'liver', label: 'A liver blockage' },
    ],
    diagnosis: 'jaundice_treat',
    needs: ['blood_basic'],
    plans: [
      { id: 'lights', label: 'Start light treatment, support feeding with the lactation team, recheck the level regularly, and keep the parents close and informed', quality: 'best' },
      { id: 'sunlight', label: 'Send home and advise placing the baby by a sunny window', quality: 'unsafe' },
      { id: 'stop_breast', label: 'Tell the mother to stop breastfeeding', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s jaundice falls within two days and feeding is going well at discharge.",
      fair: "{patient} needs an extra day of light treatment.",
      poor: "{patient}'s level climbs further and needs more intensive treatment.",
    },
  }),
  C({
    id: 'neo_sepsis', specialty: ['neonatology'], ages: [0, 0], minYear: 1975, guardian: true, tier: 'complex',
    label: 'A quiet baby',
    intro: "{patient}, two days old, is feeding poorly and the nurse says the baby 'just isn't right.'",
    history: "The mother had a fever during a long labor and her waters broke a day before delivery.",
    exam: "Floppy, mottled skin, a fast breathing rate and a temperature that is a little low.",
    tests: [
      { test: 'culture', value: 'useful', result: 'Blood cultures are taken before treatment; they later grow bacteria.' },
      { test: 'blood_basic', value: 'useful', result: 'Raised infection markers and a low blood sugar.' },
      { test: 'mri', value: 'low', result: 'A long scan for a sick baby who needs treatment now.' },
    ],
    differential: [
      { id: 'sepsis', label: 'A serious newborn infection' },
      { id: 'cold', label: 'Simply cold' },
      { id: 'hungry', label: 'A sleepy baby needing more feeds' },
    ],
    diagnosis: 'sepsis',
    needs: ['culture'],
    plans: [
      { id: 'treat_now', label: 'Take cultures, start medicines for infection at once, support breathing and sugar in the NICU, and explain everything to the parents', quality: 'best', procedure: 'icu_procedure' },
      { id: 'observe', label: 'Observe on the postnatal ward overnight', quality: 'unsafe' },
      { id: 'feed_more', label: 'Increase the feeds and review in the morning', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} perks up within two days and goes home after the course of treatment.",
      fair: "{patient} needs breathing support for a few days before recovering.",
      poor: "{patient} becomes very unwell and needs a long NICU stay.",
    },
  }),
  C({
    id: 'neo_breathing_birth', specialty: ['neonatology'], ages: [0, 0], minYear: 1975, guardian: true, tier: 'complex',
    label: 'Called to a delivery',
    intro: "The NICU team is called to a delivery: {patient} is being born at thirty weeks after early labor that could not be stopped.",
    history: "The mother received medicine before birth to help the baby's lungs mature. The parents are frightened.",
    exam: "Born pink but working hard to breathe, with grunting and pulling in between the ribs.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Breathing effort and oxygen levels show the lungs need support.' },
      { test: 'xray', value: 'useful', result: 'Lungs with the hazy look of immaturity.' },
      { test: 'ct', value: 'low', result: 'Not appropriate for a newborn in distress.' },
    ],
    differential: [
      { id: 'rds', label: 'Breathing trouble from immature lungs' },
      { id: 'pneumonia', label: 'Pneumonia' },
      { id: 'heart', label: 'A heart defect' },
    ],
    diagnosis: 'rds',
    plans: [
      { id: 'gentle_support', label: 'Give gentle breathing support, keep the baby warm, move to the NICU, and bring the parents in to see and touch the baby as soon as possible', quality: 'best', procedure: 'icu_procedure' },
      { id: 'no_support', label: 'Wait to see if the breathing improves on its own', quality: 'unsafe' },
      { id: 'parents_out', label: 'Keep the parents away until the baby is stable', quality: 'poor', procedure: 'icu_procedure' },
    ],
    decision: {
      text: "An hour later, the baby's oxygen levels suddenly drop and one side of the chest moves less.",
      options: [
        { id: 'check_call', label: 'Call for senior help, check the equipment, look for an air leak, and keep the team talking', quality: 'best' },
        { id: 'turn_up', label: 'Just turn up the oxygen and wait', quality: 'poor' },
        { id: 'leave', label: 'Leave it to the night nurse', quality: 'unsafe' },
      ],
    },
    outcomes: {
      good: "{patient} grows stronger week by week and goes home before the due date.",
      fair: "{patient} needs a longer stay on breathing support but does well.",
      poor: "{patient} has a rocky first month with setbacks before stabilizing.",
    },
  }),

  // ======================================================================================
  // MORE CASES: PEDIATRIC CARDIOLOGY
  // ======================================================================================
  C({
    id: 'pc_svt', specialty: ['peds_cardiology'], ages: [8, 15], minYear: 1975, guardian: true,
    label: 'A racing heart',
    intro: "{patient}, {age}, has had sudden spells where the heart races, lasting a few minutes and then stopping just as suddenly.",
    history: "Happens a few times a month, sometimes at rest. Never fainted. Plays basketball.",
    exam: "Normal heart sounds and a normal pulse today.",
    tests: [
      { test: 'ecg', value: 'useful', result: 'The resting tracing shows a small extra electrical pathway in the heart.' },
      { test: 'echo', value: 'useful', result: 'A structurally normal heart.' },
      { test: 'angiogram', value: 'low', result: 'An invasive test that does not help.' },
    ],
    differential: [
      { id: 'svt', label: 'An extra electrical pathway causing racing spells' },
      { id: 'anxiety', label: 'Anxiety' },
      { id: 'structural', label: 'A weak heart muscle' },
    ],
    diagnosis: 'svt',
    needs: ['ecg'],
    plans: [
      { id: 'teach_plan', label: 'Explain the extra pathway, teach {patient} simple ways to stop an episode, and discuss a later procedure to cure it if spells continue', quality: 'best' },
      { id: 'no_sport', label: 'Ban all sport', quality: 'poor' },
      { id: 'anxiety', label: 'Put it down to nerves', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} learns to stop the spells and keeps playing basketball.",
      fair: "{patient} has a few emergency visits before choosing a curative procedure.",
      poor: "{patient} gives up sports for no reason.",
    },
  }),
  C({
    id: 'pc_kawasaki', specialty: ['peds_cardiology', 'pediatrics'], ages: [1, 5], minYear: 1980, guardian: true, tier: 'intermediate',
    label: 'Five days of fever',
    intro: "{patient}, {age}, has had a high fever for five days, red eyes, cracked lips and a rash.",
    history: "Very irritable. Two different clinics said it was a virus. Hands and feet look puffy.",
    exam: "Red eyes without discharge, cracked red lips, a swollen gland in the neck, and red swollen hands.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'High inflammation markers and a high platelet count.' },
      { test: 'echo', value: 'useful', result: 'The heart arteries are slightly widened.' },
      { test: 'ct', value: 'low', result: 'Radiation a child does not need.' },
    ],
    differential: [
      { id: 'kawasaki', label: 'Kawasaki disease' },
      { id: 'virus', label: 'A viral illness' },
      { id: 'scarlet', label: 'Scarlet fever' },
    ],
    diagnosis: 'kawasaki',
    needs: ['echo'],
    plans: [
      { id: 'treat_follow', label: 'Admit and start treatment to calm the inflammation and protect the heart arteries, explain it to the family, and plan repeat heart scans', quality: 'best' },
      { id: 'virus', label: 'Treat as a virus and send home', quality: 'unsafe' },
      { id: 'antibiotics', label: 'Give antibiotics for scarlet fever', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s fever breaks within a day, and the heart arteries are normal at six weeks.",
      fair: "{patient} needs a second round of treatment, and the arteries settle.",
      poor: "{patient} is left with a widened heart artery that needs lifelong follow-up.",
    },
  }),
  C({
    id: 'pc_athlete_faint', specialty: ['peds_cardiology'], ages: [12, 17], minYear: 1985, guardian: true, tier: 'complex',
    label: 'Fainted on the field',
    intro: "{patient}, {age}, fainted during a soccer match while sprinting and came round quickly.",
    history: "Has felt chest tightness on hard runs. An uncle collapsed suddenly while jogging in his thirties. The coach wants {patient} back for the playoffs.",
    exam: "A murmur that gets louder on standing.",
    tests: [
      { test: 'ecg', value: 'useful', result: 'Signs of a thickened heart muscle.' },
      { test: 'echo', value: 'useful', result: 'Thickened heart muscle that partly blocks outflow.' },
      { test: 'eeg', value: 'low', result: 'This was not a seizure.' },
    ],
    differential: [
      { id: 'hcm', label: 'An inherited thick heart muscle condition' },
      { id: 'faint', label: 'A simple faint' },
      { id: 'seizure', label: 'A seizure' },
    ],
    diagnosis: 'hcm',
    needs: ['echo'],
    plans: [
      { id: 'honest_plan', label: 'Explain the condition honestly to {patient} and the family, pause competitive sport for now, arrange family screening, and plan ongoing care together', quality: 'best' },
      { id: 'playoffs', label: 'Clear {patient} for the playoffs', quality: 'unsafe' },
      { id: 'reassure', label: 'Call it a simple faint', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient} finds a new role on the team as an assistant coach, and two relatives are diagnosed early.",
      fair: "{patient} is upset for months but stays safe.",
      poor: "{patient} feels cut off from friends and stops coming to follow-up.",
    },
  }),
  C({
    id: 'pc_small_vsd', specialty: ['peds_cardiology'], ages: [0, 1], minYear: 1975, guardian: true, household: true,
    label: 'A hole in the heart',
    intro: "{patient}, {age}, has a loud murmur found at a well-baby check. The parents have heard what a heart murmur can mean and are terrified.",
    history: "Feeding and growing well. No sweating at feeds or fast breathing.",
    exam: "A loud, harsh murmur. Otherwise a thriving baby.",
    tests: [
      { test: 'echo', value: 'useful', result: 'A small hole between the lower heart chambers, with normal pressures.' },
      { test: 'ecg', value: 'neutral', result: 'Normal.' },
      { test: 'angiogram', value: 'low', result: 'An invasive test a baby does not need.' },
    ],
    differential: [
      { id: 'small_vsd', label: 'A small hole likely to close on its own' },
      { id: 'large_vsd', label: 'A large hole needing surgery' },
      { id: 'innocent', label: 'An innocent murmur' },
    ],
    diagnosis: 'small_vsd',
    needs: ['echo'],
    plans: [
      { id: 'explain_watch', label: 'Show the parents a drawing, explain that loud does not mean large, and plan a check-up scan as the baby grows', quality: 'best' },
      { id: 'surgery', label: 'Refer for heart surgery', quality: 'poor', refer: 'ctsurg' },
      { id: 'nothing', label: 'Discharge without follow-up', quality: 'ok' },
    ],
    outcomes: {
      good: "{patient}'s hole closes on its own by age two, and the parents relax.",
      fair: "{patient}'s hole stays small and needs only occasional checks.",
      poor: "{patient}'s parents stay anxious and keep the baby from normal activity.",
    },
  }),

  // ======================================================================================
  // MORE CASES: MATERNAL-FETAL MEDICINE
  // ======================================================================================
  C({
    id: 'mfm_twins', specialty: ['mfm'], ages: [20, 42], minYear: 1985, sex: 'female', tier: 'intermediate',
    label: 'Twins sharing a placenta',
    intro: "{patient}, {age}, is sixteen weeks pregnant with identical twins who share a placenta.",
    history: "First pregnancy. Feeling well. Has read that twins sharing a placenta need extra watching but does not know why.",
    exam: "Bump larger than dates, as expected for twins.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'Both twins are growing evenly with normal fluid around each.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
      { test: 'mri', value: 'low', result: 'Not needed now.' },
    ],
    differential: [
      { id: 'shared_twins', label: 'Healthy twins with a shared placenta needing close watching' },
      { id: 'imbalance', label: 'A blood flow imbalance between twins' },
      { id: 'singleton', label: 'A single pregnancy' },
    ],
    diagnosis: 'shared_twins',
    needs: ['ultrasound'],
    plans: [
      { id: 'surveillance', label: 'Explain what to watch for, arrange scans every two weeks, and plan the timing of birth together', quality: 'best' },
      { id: 'routine', label: 'Routine care with the usual scans', quality: 'poor' },
      { id: 'deliver_early', label: 'Plan a very early delivery now', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s twins grow steadily and arrive healthy at the planned time.",
      fair: "{patient}'s twins arrive a little early and spend a short time in the NICU.",
      poor: "{patient}'s twins develop an imbalance that is caught late.",
    },
  }),
  C({
    id: 'mfm_previa', specialty: ['mfm'], ages: [25, 45], minYear: 1985, sex: 'female', tier: 'complex',
    label: 'A low placenta',
    intro: "{patient}, {age}, is thirty-two weeks pregnant and the placenta lies over the opening of the womb. She has had two previous cesarean deliveries.",
    history: "A small painless bleed last week that stopped. Lives forty minutes from the hospital.",
    exam: "Comfortable. No bleeding today. Baby active.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'The placenta covers the opening and may be growing into the old scar.' },
      { test: 'mri', value: 'useful', result: 'Suggests the placenta is attached too deeply in one area.' },
      { test: 'blood_basic', value: 'useful', result: 'Mild anemia, which is treated before delivery.' },
    ],
    differential: [
      { id: 'accreta', label: 'A low placenta that may be abnormally attached' },
      { id: 'normal_low', label: 'A low placenta that will move up' },
      { id: 'abruption', label: 'A placenta separating early' },
    ],
    diagnosis: 'accreta',
    needs: ['ultrasound'],
    plans: [
      { id: 'planned', label: 'Plan a scheduled cesarean with a full team and blood ready, explain the risks honestly, including a possible hysterectomy, and agree what to do if she bleeds before then', quality: 'best', procedure: 'ob_cesarean' },
      { id: 'labor', label: 'Plan a normal labor', quality: 'unsafe' },
      { id: 'routine_cs', label: 'Book a routine cesarean with the usual team', quality: 'poor', procedure: 'ob_cesarean' },
    ],
    decision: {
      text: "During the planned cesarean, the placenta will not separate and bleeding increases.",
      options: [
        { id: 'team_plan', label: 'Follow the agreed plan, call in the extra surgeons, and keep the anesthesiologist informed', quality: 'best' },
        { id: 'pull', label: 'Keep trying to remove the placenta alone', quality: 'unsafe' },
        { id: 'quiet', label: 'Say nothing and hope it settles', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} and the baby are safe, and the team's preparation pays off.",
      fair: "{patient} needs a blood transfusion and a longer stay.",
      poor: "{patient} loses a lot of blood and needs intensive care.",
    },
  }),
  C({
    id: 'mfm_preterm_history', specialty: ['mfm'], ages: [20, 42], minYear: 1990, sex: 'female',
    label: 'After an early birth',
    intro: "{patient}, {age}, is fourteen weeks pregnant. Her last baby was born very early and spent months in the NICU.",
    history: "Anxious that it will happen again. No bleeding or pain now.",
    exam: "Well. Normal early pregnancy.",
    tests: [
      { test: 'ultrasound', value: 'useful', result: 'The cervix is a normal length today; a plan for regular checks is made.' },
      { test: 'urine', value: 'useful', result: 'A silent urine infection, which is treated.' },
      { test: 'ct', value: 'low', result: 'Radiation in pregnancy with no reason.' },
    ],
    differential: [
      { id: 'high_risk', label: 'A pregnancy at higher risk of preterm birth' },
      { id: 'low_risk', label: 'A low-risk pregnancy' },
      { id: 'miscarriage', label: 'A threatened miscarriage' },
    ],
    diagnosis: 'high_risk',
    plans: [
      { id: 'monitor_support', label: 'Plan regular cervix checks, discuss treatments that lower the risk, treat the infection, and give her a direct number to call', quality: 'best' },
      { id: 'bed_rest', label: 'Prescribe strict bed rest for the whole pregnancy', quality: 'poor' },
      { id: 'routine', label: 'Routine care; lightning rarely strikes twice', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} reaches thirty-seven weeks and takes her baby home from the hospital after two days.",
      fair: "{patient}'s baby comes a few weeks early but needs only a short stay.",
      poor: "{patient}'s baby comes early again, before the warning signs were caught.",
    },
  }),
  C({
    id: 'mfm_diabetes_pregnancy', specialty: ['mfm'], ages: [20, 40], minYear: 1985, sex: 'female', tier: 'intermediate',
    label: 'Diabetes and a pregnancy',
    intro: "{patient}, {age}, has had type 1 diabetes since childhood and is eight weeks pregnant, unplanned.",
    history: "Sugar control has been rough lately. Worried she has harmed the baby. Works shifts.",
    exam: "Well. Early pregnancy.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Sugar control over recent months is above target.' },
      { test: 'ultrasound', value: 'useful', result: 'A healthy early pregnancy with a heartbeat.' },
      { test: 'exam_focused', value: 'neutral', result: 'An eye check is booked, since eye disease can worsen in pregnancy.' },
    ],
    differential: [
      { id: 'pregestational', label: 'A pregnancy with pre-existing diabetes needing tight teamwork' },
      { id: 'gestational', label: 'Diabetes that started in pregnancy' },
      { id: 'routine', label: 'A routine pregnancy' },
    ],
    diagnosis: 'pregestational',
    plans: [
      { id: 'joint_clinic', label: 'Reassure without blame, set up a joint clinic with the diabetes team, tighten sugar control step by step, and plan extra scans', quality: 'best' },
      { id: 'blame', label: 'Explain sternly that she has put the baby at risk', quality: 'poor' },
      { id: 'routine', label: 'Routine pregnancy care', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s sugars come into range, and she has a healthy baby at term.",
      fair: "{patient}'s baby is large and needs a short stay for low sugars.",
      poor: "{patient} drifts from care and the pregnancy has avoidable complications.",
    },
  }),

  // ======================================================================================
  // MORE CASES: HEART TRANSPLANTATION
  // ======================================================================================
  C({
    id: 'htx_donor_offer', specialty: ['ct_heart_transplant'], ages: [30, 65], minYear: 1985, tier: 'high',
    label: 'A heart is offered',
    intro: "At two in the morning, a donor heart is offered for {patient}, {age}, who has waited on the transplant list for eight months.",
    history: "{patient} is stable at home. The donor heart is from an older donor and would travel a long distance, and its scan shows mild weakness.",
    exam: "{patient} is well enough to wait for a better match.",
    tests: [
      { test: 'echo', value: 'useful', result: 'The donor heart\'s pumping is mildly reduced on a repeat scan.' },
      { test: 'blood_special', value: 'useful', result: 'A good tissue match for {patient}.' },
      { test: 'angiogram', value: 'neutral', result: 'The donor\'s heart arteries are mostly clear.' },
    ],
    differential: [
      { id: 'marginal', label: 'A marginal donor heart for a stable recipient' },
      { id: 'ideal', label: 'An ideal donor heart' },
      { id: 'unusable', label: 'A heart that cannot be used' },
    ],
    diagnosis: 'marginal',
    plans: [
      { id: 'team_decline', label: 'Weigh it with the transplant team and decline this heart, since {patient} is stable, and explain the reasoning to {patient} in the morning', quality: 'best' },
      { id: 'accept_alone', label: 'Accept it without discussing it with the team', quality: 'poor', procedure: 'tx_heart' },
      { id: 'ignore', label: 'Let the offer time out without a decision', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} receives a well-matched heart six weeks later and recovers well.",
      fair: "{patient} waits longer than hoped but stays stable.",
      poor: "{patient} feels left out of the decision and loses trust in the team.",
    },
  }),
  C({
    id: 'htx_transplant', specialty: ['ct_heart_transplant'], ages: [25, 65], minYear: 1985, tier: 'high', household: true,
    label: 'Transplant night',
    intro: "A well-matched donor heart has been accepted for {patient}, {age}, whose heart is failing despite every treatment.",
    history: "Has been in the hospital for weeks, waiting. The family is frightened and hopeful. {patient} understands the risks and has signed consent.",
    exam: "Breathless at rest, swollen legs, but ready for surgery.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'A final cross-match confirms compatibility.' },
      { test: 'echo', value: 'useful', result: 'The donor heart is strong.' },
      { test: 'mri', value: 'low', result: 'Wastes precious time.' },
    ],
    differential: [
      { id: 'ready', label: 'A suitable recipient ready for transplant' },
      { id: 'too_sick', label: 'Too sick to survive the operation' },
      { id: 'mismatch', label: 'An incompatible heart' },
    ],
    diagnosis: 'ready',
    needs: ['blood_special'],
    plans: [
      { id: 'transplant', label: 'Coordinate the timing with the retrieval team, brief everyone, speak to the family, and proceed with the transplant', quality: 'best', procedure: 'tx_heart' },
      { id: 'no_brief', label: 'Proceed without a team briefing to save time', quality: 'poor', procedure: 'tx_heart' },
      { id: 'delay', label: 'Wait for a morning start', quality: 'poor' },
    ],
    decision: {
      text: "The new heart is slow to beat strongly at first and the anesthesiologist asks how you want to proceed.",
      options: [
        { id: 'support_time', label: 'Support the new heart and give it time, talking it through with the team', quality: 'best' },
        { id: 'rush', label: 'Push to finish quickly', quality: 'poor' },
        { id: 'blame', label: 'Blame the retrieval team aloud in the room', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} is walking within a week and goes home with a heart that works well.",
      fair: "{patient} has a slow start and a longer intensive care stay before recovering.",
      poor: "{patient} has a difficult recovery with an episode of rejection.",
    },
  }),
  C({
    id: 'htx_rejection', specialty: ['ct_heart_transplant'], ages: [25, 70], minYear: 1985, tier: 'complex',
    label: 'Tired after transplant',
    intro: "{patient}, {age}, had a heart transplant eight months ago and has felt tired and breathless for a week.",
    history: "Admits missing some doses of the anti-rejection medicines while traveling. No fever.",
    exam: "Mild swelling of the ankles and a faster pulse than usual.",
    tests: [
      { test: 'echo', value: 'useful', result: 'The new heart is pumping less well than three months ago.' },
      { test: 'biopsy', value: 'useful', result: 'A heart muscle sample shows moderate rejection.' },
      { test: 'blood_basic', value: 'neutral', result: 'Kidney function is stable.' },
    ],
    differential: [
      { id: 'rejection', label: 'Rejection of the transplanted heart' },
      { id: 'infection', label: 'An infection' },
      { id: 'deconditioning', label: 'Simply out of shape' },
    ],
    diagnosis: 'rejection',
    needs: ['biopsy'],
    plans: [
      { id: 'treat_support', label: 'Admit, treat the rejection with the transplant cardiologists, and talk openly and without blame about what makes the medicines hard to take', quality: 'best' },
      { id: 'scold', label: 'Warn {patient} sternly and send them home', quality: 'poor' },
      { id: 'exercise', label: 'Advise more exercise', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient}'s heart recovers fully, and a simpler medicine routine fits travel and work.",
      fair: "{patient} recovers, with some lasting reduction in the heart's strength.",
      poor: "{patient} has another episode of rejection months later.",
    },
  }),
  C({
    id: 'htx_not_yet', specialty: ['ct_heart_transplant'], ages: [30, 60], minYear: 1985, tier: 'complex',
    label: 'Not on the list yet',
    intro: "{patient}, {age}, has severe heart failure and asks to be placed on the heart transplant list.",
    history: "Still smokes and has missed many clinic appointments. Lives alone. Wants to change but has not managed to yet.",
    exam: "Breathless with modest effort. Otherwise stable.",
    tests: [
      { test: 'echo', value: 'useful', result: 'A severely weakened heart.' },
      { test: 'history_detail', value: 'useful', result: 'The social worker\'s assessment shows little support at home and ongoing smoking.' },
      { test: 'angiogram', value: 'neutral', result: 'No blockages to treat.' },
    ],
    differential: [
      { id: 'not_yet', label: 'A possible candidate who is not ready yet' },
      { id: 'ready', label: 'Ready to list now' },
      { id: 'never', label: 'Never a candidate' },
    ],
    diagnosis: 'not_yet',
    plans: [
      { id: 'honest_path', label: 'Explain honestly why listing is not safe yet, set clear steps together (stopping smoking, a support person, regular visits), and review in a few months', quality: 'best' },
      { id: 'list_anyway', label: 'List {patient} now to be kind', quality: 'poor' },
      { id: 'refuse', label: 'Say no and close the door for good', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} stops smoking, a sibling moves closer to help, and {patient} is listed within the year.",
      fair: "{patient} makes partial progress and stays under review.",
      poor: "{patient} feels judged and stops coming to clinic.",
    },
  }),

  // ======================================================================================
  // MORE CASES: TRAUMA AND PEDIATRIC SURGERY, TRANSPLANT SURGERY
  // ======================================================================================
  C({
    id: 'tr_child_handlebar', specialty: ['peds_surgery', 'trauma'], ages: [7, 14], minYear: 1985, guardian: true, tier: 'intermediate',
    label: 'A bicycle fall',
    intro: "{patient}, {age}, went over the handlebars of a bike and has pain in the upper left belly.",
    history: "No head injury. Wearing a helmet. Pain is worse on breathing in, and the left shoulder hurts too.",
    exam: "Alert, pulse a little fast but steady, blood pressure normal. A handlebar-shaped bruise on the belly, tender on the left.",
    tests: [
      { test: 'ct', value: 'useful', result: 'A torn spleen with some blood around it, no active bleeding seen, and no other injuries.' },
      { test: 'blood_basic', value: 'useful', result: 'Blood count slightly low and stable on a repeat.' },
      { test: 'mri', value: 'low', result: 'A long scan with no added value now.' },
    ],
    differential: [
      { id: 'spleen', label: 'A spleen injury in a stable child' },
      { id: 'bruise', label: 'Just a bruise' },
      { id: 'bowel', label: 'A bowel injury' },
    ],
    diagnosis: 'spleen',
    needs: ['ct'],
    plans: [
      { id: 'observe_close', label: 'Admit for close observation with bed rest and repeat checks, explain the plan and warning signs to the family, and have the operating room ready if needed', quality: 'best' },
      { id: 'operate', label: 'Remove the spleen today', quality: 'poor' },
      { id: 'home', label: 'Send home with pain relief', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient}'s spleen heals without surgery, and {patient} is back at school in a week, with no contact sports for a while.",
      fair: "{patient} needs a blood transfusion but still avoids an operation.",
      poor: "{patient} needs an urgent operation after bleeding again.",
    },
  }),
  C({
    id: 'tx_kidney_offer', specialty: ['transplant'], ages: [30, 70], minYear: 1970, tier: 'complex',
    label: 'A kidney at night',
    intro: "A deceased-donor kidney becomes available for {patient}, {age}, who has been on dialysis for four years.",
    history: "{patient} had dialysis yesterday and feels well. Had a cold last week. Has always said yes to a transplant.",
    exam: "Well. No fever. Fluid balance looks right.",
    tests: [
      { test: 'blood_special', value: 'useful', result: 'The final cross-match is compatible.' },
      { test: 'blood_basic', value: 'useful', result: 'Potassium is safe, so no extra dialysis is needed first.' },
      { test: 'xray', value: 'neutral', result: 'Clear chest; the cold has passed.' },
    ],
    differential: [
      { id: 'suitable', label: 'A suitable recipient for this kidney' },
      { id: 'infection', label: 'Too unwell from an infection' },
      { id: 'mismatch', label: 'An incompatible kidney' },
    ],
    diagnosis: 'suitable',
    needs: ['blood_special'],
    plans: [
      { id: 'transplant', label: 'Confirm consent and understanding with {patient}, brief the team, and proceed with the kidney transplant', quality: 'best', procedure: 'tx_kidney' },
      { id: 'skip_crossmatch', label: 'Start before the cross-match comes back to save time', quality: 'unsafe', procedure: 'tx_kidney' },
      { id: 'decline', label: 'Decline because of last week\'s cold', quality: 'poor' },
    ],
    decision: {
      text: "When the new kidney's blood supply is connected, it looks pale and slow to turn pink.",
      options: [
        { id: 'pause_check', label: 'Pause, check the connections with the team, and give it a few minutes with good blood pressure support', quality: 'best' },
        { id: 'remove', label: 'Remove the kidney at once', quality: 'poor' },
        { id: 'close', label: 'Close quickly and hope it recovers', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s new kidney starts working within days, and dialysis ends.",
      fair: "{patient} needs dialysis for a couple of weeks while the kidney wakes up.",
      poor: "{patient}'s kidney has an early rejection episode that needs treatment.",
    },
  }),
  C({
    id: 'tx_liver_failure', specialty: ['transplant'], ages: [18, 55], minYear: 1985, tier: 'high', household: true,
    label: 'A liver failing fast',
    intro: "{patient}, {age}, was healthy two weeks ago and now has a failing liver from a viral hepatitis, with growing confusion.",
    history: "No alcohol or drug use. The family is in shock and asks what can be done.",
    exam: "Deeply yellow, drowsy and confused. Bruises easily.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Clotting and liver tests are severely abnormal.' },
      { test: 'ultrasound', value: 'useful', result: 'A shrunken liver with open blood vessels.' },
      { test: 'biopsy', value: 'unsafe', result: 'A liver sample with this clotting risks serious bleeding.' },
    ],
    differential: [
      { id: 'acute_failure', label: 'Acute liver failure needing urgent transplant listing' },
      { id: 'alcohol', label: 'Alcohol-related liver disease' },
      { id: 'blockage', label: 'A blocked bile duct' },
    ],
    diagnosis: 'acute_failure',
    needs: ['blood_basic'],
    plans: [
      { id: 'urgent_list', label: 'List urgently with the transplant team, support {patient} in intensive care, explain things honestly to the family, and proceed when a liver is found', quality: 'best', procedure: 'tx_liver' },
      { id: 'wait', label: 'Wait to see if the liver recovers on its own', quality: 'poor' },
      { id: 'blame', label: 'Assume hidden drinking and decline', quality: 'unsafe' },
    ],
    decision: {
      text: "A liver becomes available, but it is from an older donor with some fat in it.",
      options: [
        { id: 'discuss_accept', label: 'Discuss quickly with the team and accept it, given how urgent {patient}\'s situation is', quality: 'best' },
        { id: 'decline_perfect', label: 'Decline and wait for a perfect liver', quality: 'poor' },
        { id: 'alone', label: 'Decide alone without telling anyone', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} receives the new liver, wakes up clear-headed, and goes home in weeks.",
      fair: "{patient} has a slow recovery with a long stay in intensive care.",
      poor: "{patient} has a complicated recovery and a return to the operating room.",
    },
  }),
  C({
    id: 'tx_kidney_rising', specialty: ['transplant', 'nephrology'], ages: [25, 70], minYear: 1975, tier: 'intermediate',
    label: 'A worrying blood test',
    intro: "{patient}, {age}, had a kidney transplant a year ago, and a routine blood test shows the kidney function has slipped.",
    history: "Feels well. Recently started a new herbal supplement for energy. No fever or pain.",
    exam: "Normal blood pressure. The transplanted kidney is not tender.",
    tests: [
      { test: 'blood_basic', value: 'useful', result: 'Kidney function is worse than last month, and the anti-rejection medicine level is low.' },
      { test: 'ultrasound', value: 'useful', result: 'Good blood flow and no blockage.' },
      { test: 'biopsy', value: 'useful', result: 'Mild rejection, caught early.' },
    ],
    differential: [
      { id: 'rejection', label: 'Early rejection from low medicine levels' },
      { id: 'blockage', label: 'A blocked tube from the kidney' },
      { id: 'infection', label: 'A urine infection' },
    ],
    diagnosis: 'rejection',
    needs: ['blood_basic'],
    plans: [
      { id: 'treat_explain', label: 'Treat the rejection, explain how the supplement lowers the medicine level, and agree to check any new remedy with the team first', quality: 'best' },
      { id: 'remove', label: 'Plan to remove the transplanted kidney', quality: 'unsafe' },
      { id: 'ignore', label: 'Recheck in three months', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s kidney function returns to normal within weeks.",
      fair: "{patient}'s kidney recovers most of its function.",
      poor: "{patient}'s kidney is left weaker for good.",
    },
  }),

  // ======================================================================================
  // MORE CASES: COLON AND RECTAL SURGERY
  // ======================================================================================
  C({
    id: 'cr_diverticulitis', specialty: ['colorectal', 'gensurg'], ages: [40, 80], minYear: 1980,
    label: 'Pain in the lower left belly',
    intro: "{patient}, {age}, has had pain in the lower left belly and a fever for two days.",
    history: "A similar but milder episode last year. Eating and drinking. No bleeding.",
    exam: "Tender in the lower left belly, without signs of the whole belly being inflamed.",
    tests: [
      { test: 'ct', value: 'useful', result: 'Inflamed pouches in the colon with no abscess or hole.' },
      { test: 'blood_basic', value: 'useful', result: 'Mildly raised infection markers.' },
      { test: 'endoscopy', value: 'unsafe', result: 'A scope into an inflamed bowel now risks a tear; it is for later.' },
    ],
    differential: [
      { id: 'diverticulitis', label: 'Uncomplicated diverticulitis' },
      { id: 'cancer', label: 'Bowel cancer' },
      { id: 'perforation', label: 'A burst bowel' },
    ],
    diagnosis: 'diverticulitis',
    needs: ['ct'],
    plans: [
      { id: 'conservative', label: 'Treat without surgery, with rest of the bowel and medicines if needed, explain warning signs, and plan a colonoscopy once it has settled', quality: 'best' },
      { id: 'resect', label: 'Remove the affected bowel now', quality: 'poor', procedure: 'gs_abdominal' },
      { id: 'home_nothing', label: 'Send home without a plan', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} settles within days, and the later colonoscopy is clear.",
      fair: "{patient} has one more mild episode in the following year.",
      poor: "{patient} returns with an abscess that needs drainage.",
    },
  }),
  C({
    id: 'cr_hemorrhoids', specialty: ['colorectal'], ages: [30, 70], minYear: 1975,
    label: 'Bleeding after the bathroom',
    intro: "{patient}, {age}, has noticed bright red blood on the toilet paper for two months and is embarrassed to talk about it.",
    history: "Strains with hard stools. No weight loss or change in bowel habit. No family history of bowel cancer.",
    exam: "An examination, done with consent and a chaperone, shows enlarged hemorrhoids and nothing else.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Enlarged hemorrhoids that bleed easily, and no other finding.' },
      { test: 'endoscopy', value: 'neutral', result: 'A short scope confirms nothing else is bleeding.' },
      { test: 'ct', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'hemorrhoids', label: 'Bleeding hemorrhoids' },
      { id: 'cancer', label: 'Bowel cancer' },
      { id: 'fissure', label: 'A small tear' },
    ],
    diagnosis: 'hemorrhoids',
    plans: [
      { id: 'office_band', label: 'Put {patient} at ease, advise fiber and fluids, and offer a simple office treatment if bleeding continues', quality: 'best', procedure: 'office_minor' },
      { id: 'big_op', label: 'Book an operation under general anesthesia', quality: 'poor', procedure: 'gs_colorectal' },
      { id: 'no_exam', label: 'Prescribe a cream without examining', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s bleeding stops within weeks, and {patient} is glad to have asked.",
      fair: "{patient} needs a second office treatment.",
      poor: "{patient} stays embarrassed and stops coming in.",
    },
  }),
  C({
    id: 'cr_rectal_cancer', specialty: ['colorectal'], ages: [45, 80], minYear: 1985, tier: 'complex',
    label: 'A rectal cancer',
    intro: "{patient}, {age}, has a cancer in the lower rectum found on a colonoscopy, and has come to talk about surgery.",
    history: "Fit and active. Afraid of having a bag. Wants to know all the options.",
    exam: "Fit. The tumor can be felt on examination.",
    tests: [
      { test: 'mri', value: 'useful', result: 'The tumor is close to the muscle but has not spread through the wall.' },
      { test: 'ct', value: 'useful', result: 'No spread to the liver or lungs.' },
      { test: 'biopsy', value: 'neutral', result: 'Confirms the cancer type.' },
    ],
    differential: [
      { id: 'local', label: 'A rectal cancer that has not spread' },
      { id: 'metastatic', label: 'A cancer that has spread' },
      { id: 'polyp', label: 'A harmless polyp' },
    ],
    diagnosis: 'local',
    needs: ['mri'],
    plans: [
      { id: 'mdt_then_op', label: 'Discuss at the cancer team meeting, offer treatment to shrink it first, then plan surgery with honest talk about a temporary bag and consent', quality: 'best', procedure: 'gs_colorectal' },
      { id: 'op_now', label: 'Operate next week without the team review', quality: 'ok', procedure: 'gs_colorectal' },
      { id: 'promise', label: 'Promise there will never be a bag', quality: 'poor', procedure: 'gs_colorectal' },
    ],
    decision: {
      text: "During the operation, the join in the bowel looks a little short of blood supply.",
      options: [
        { id: 'protect', label: 'Discuss with the assistant, and protect the join with a temporary bag as {patient} consented to', quality: 'best' },
        { id: 'hope', label: 'Leave it and hope', quality: 'poor' },
        { id: 'permanent', label: 'Create a permanent bag without consent', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient} recovers well, the temporary bag is reversed months later, and checkups stay clear.",
      fair: "{patient} has a slow recovery but the cancer is fully removed.",
      poor: "{patient} has a leak at the join and a long hospital stay.",
    },
  }),
  C({
    id: 'cr_colitis_surgery', specialty: ['colorectal'], ages: [20, 50], minYear: 1985, tier: 'complex',
    label: 'Colitis not responding',
    intro: "{patient}, {age}, has severe ulcerative colitis that has not improved after five days of strong hospital treatment.",
    history: "Twelve bloody stools a day. Exhausted. The gastroenterologist asks for a surgical opinion. {patient} dreads the idea of a bag.",
    exam: "Fast pulse, tender belly, but not rigid.",
    tests: [
      { test: 'xray', value: 'useful', result: 'The colon is not dangerously swollen.' },
      { test: 'blood_basic', value: 'useful', result: 'Inflammation markers are still high; low blood protein.' },
      { test: 'endoscopy', value: 'unsafe', result: 'A full scope in a bowel this inflamed risks a tear.' },
    ],
    differential: [
      { id: 'refractory', label: 'Severe colitis failing medical treatment' },
      { id: 'infection', label: 'A superimposed infection only' },
      { id: 'improving', label: 'About to improve' },
    ],
    diagnosis: 'refractory',
    plans: [
      { id: 'joint_plan', label: 'See {patient} with the gastroenterologist, explain the choices honestly, introduce the stoma nurse, and with consent plan surgery if a final medical option fails', quality: 'best', procedure: 'gs_colorectal' },
      { id: 'operate_tonight', label: 'Operate tonight without the GI team', quality: 'poor', procedure: 'gs_colorectal' },
      { id: 'wait_weeks', label: 'Keep the same treatment for another two weeks', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} has surgery at the right time, recovers well, and later has the bag reversed.",
      fair: "{patient} has a slower recovery but is well by the summer.",
      poor: "{patient} becomes sicker before surgery and recovery is long.",
    },
  }),

  // ======================================================================================
  // MORE CASES: SURGICAL ONCOLOGY
  // ======================================================================================
  C({
    id: 'so_sarcoma', specialty: ['surg_onc'], ages: [25, 75], minYear: 1985, tier: 'complex',
    label: 'A lump in the thigh',
    intro: "{patient}, {age}, has a lump deep in the thigh, larger than a golf ball and growing over three months.",
    history: "Painless. Another doctor offered to 'just cut it out' in the office.",
    exam: "A firm, deep lump that does not move freely.",
    tests: [
      { test: 'mri', value: 'useful', result: 'A deep growth within the muscle.' },
      { test: 'biopsy', value: 'useful', result: 'A needle sample confirms a soft tissue cancer.' },
      { test: 'ct', value: 'useful', result: 'No spread to the lungs.' },
    ],
    differential: [
      { id: 'sarcoma', label: 'A soft tissue cancer (sarcoma)' },
      { id: 'lipoma', label: 'A harmless fatty lump' },
      { id: 'hematoma', label: 'An old bruise' },
    ],
    diagnosis: 'sarcoma',
    needs: ['mri'],
    plans: [
      { id: 'planned', label: 'Plan with the sarcoma team, explain the operation and recovery honestly, get consent, and remove it with a cuff of healthy tissue', quality: 'best', procedure: 'so_resection' },
      { id: 'office_cut', label: 'Shell it out in the office', quality: 'unsafe' },
      { id: 'watch', label: 'Watch it for six months', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s cancer is removed completely and {patient} is walking normally within weeks.",
      fair: "{patient} needs extra treatment after surgery but does well.",
      poor: "{patient}'s wound heals slowly and needs extra care.",
    },
  }),
  C({
    id: 'so_breast_lump', specialty: ['surg_onc'], ages: [35, 75], minYear: 1985, sex: 'female', tier: 'intermediate',
    label: 'A breast cancer',
    intro: "{patient}, {age}, has a small breast cancer found on a screening mammogram, confirmed by biopsy.",
    history: "Wants to keep her breast if possible. Scared and has many questions.",
    exam: "A small lump in one breast. No lumps in the armpit.",
    tests: [
      { test: 'biopsy', value: 'useful', result: 'An early cancer of a common type.' },
      { test: 'ultrasound', value: 'useful', result: 'The armpit glands look normal.' },
      { test: 'ct', value: 'low', result: 'Body scans are not recommended for an early cancer like this.' },
    ],
    differential: [
      { id: 'early', label: 'An early breast cancer suited to breast-conserving surgery' },
      { id: 'advanced', label: 'Advanced cancer' },
      { id: 'cyst', label: 'A cyst' },
    ],
    diagnosis: 'early',
    needs: ['biopsy'],
    plans: [
      { id: 'conserve', label: 'Explain the options honestly, offer surgery that keeps the breast with a check of the nearest gland, and get consent', quality: 'best', procedure: 'so_resection' },
      { id: 'mastectomy', label: 'Recommend removing the whole breast without discussing options', quality: 'poor', procedure: 'so_resection' },
      { id: 'delay', label: 'Wait until she feels ready, with no follow-up booked', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} recovers quickly, keeps her breast, and the cancer is fully removed.",
      fair: "{patient} needs a second small operation to clear the edges.",
      poor: "{patient} feels rushed and unhappy with the decision.",
    },
  }),
  C({
    id: 'so_stomach', specialty: ['surg_onc'], ages: [50, 80], minYear: 1980, tier: 'complex',
    label: 'A stomach cancer',
    intro: "{patient}, {age}, has a stomach cancer found after months of indigestion and weight loss.",
    history: "Lives alone. Eats little. Wants to know if an operation is worth it.",
    exam: "Thin. No lumps in the belly or neck.",
    tests: [
      { test: 'endoscopy', value: 'useful', result: 'A tumor in the lower stomach, confirmed on samples.' },
      { test: 'ct', value: 'useful', result: 'No spread to the liver or beyond.' },
      { test: 'blood_basic', value: 'useful', result: 'Mild anemia and low protein from poor eating.' },
    ],
    differential: [
      { id: 'resectable', label: 'A stomach cancer that can be removed' },
      { id: 'spread', label: 'A cancer that has spread' },
      { id: 'ulcer', label: 'A simple ulcer' },
    ],
    diagnosis: 'resectable',
    needs: ['ct'],
    plans: [
      { id: 'prepare_op', label: 'Plan with the cancer team, improve nutrition first with a dietitian, explain the operation and recovery, and with consent remove the tumor', quality: 'best', procedure: 'so_resection' },
      { id: 'op_tomorrow', label: 'Operate tomorrow without building up strength', quality: 'ok', procedure: 'so_resection' },
      { id: 'too_old', label: 'Say {patient} is too old for surgery', quality: 'poor' },
    ],
    decision: {
      text: "During the operation, a small spot is seen on the liver that was not on the scan.",
      options: [
        { id: 'sample', label: 'Take a sample for a quick look by pathology and decide with that answer', quality: 'best' },
        { id: 'ignore', label: 'Ignore it and carry on', quality: 'poor' },
        { id: 'abandon', label: 'Abandon the operation without checking', quality: 'poor' },
      ],
    },
    outcomes: {
      good: "{patient}'s spot proves harmless, the cancer is removed, and {patient} eats well again.",
      fair: "{patient} has a slow recovery with feeding difficulties at first.",
      poor: "{patient} has a leak after surgery and a long stay.",
    },
  }),
  C({
    id: 'so_not_operable', specialty: ['surg_onc'], ages: [50, 85], minYear: 1985, tier: 'complex',
    label: 'When surgery will not help',
    intro: "{patient}, {age}, has bowel cancer with spread to many places in the liver and lungs, and has been told 'the surgeon will fix it.'",
    history: "Feels fairly well. The family is hoping for an operation.",
    exam: "Well. Slightly enlarged liver.",
    tests: [
      { test: 'ct', value: 'useful', result: 'Many deposits in both sides of the liver and both lungs.' },
      { test: 'blood_basic', value: 'neutral', result: 'Mildly abnormal liver tests.' },
      { test: 'biopsy', value: 'low', result: 'The diagnosis is already confirmed.' },
    ],
    differential: [
      { id: 'widespread', label: 'Widespread cancer that surgery cannot remove' },
      { id: 'single', label: 'A single deposit suitable for surgery' },
      { id: 'cysts', label: 'Harmless liver cysts' },
    ],
    diagnosis: 'widespread',
    needs: ['ct'],
    plans: [
      { id: 'honest_refer', label: 'Explain honestly and kindly why an operation would not help, and refer to the oncologist for treatment that can, with time for questions', quality: 'best', refer: 'heme_onc' },
      { id: 'operate', label: 'Operate anyway because the family wants it', quality: 'unsafe', procedure: 'so_resection' },
      { id: 'vague', label: 'Say you will think about it and send a letter', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} understands the situation and starts treatment that keeps them well for a good while.",
      fair: "{patient} takes time to accept the news but engages with treatment.",
      poor: "{patient} feels confused and loses months seeking an operation elsewhere.",
    },
  }),

  // ======================================================================================
  // MORE CASES: ORTHOPEDIC SPORTS MEDICINE, HAND, SPINE, FOOT AND ANKLE
  // ======================================================================================
  C({
    id: 'sports_meniscus_older', specialty: ['ortho_sports'], ages: [45, 65], minYear: 1990,
    label: 'A torn cartilage?',
    intro: "{patient}, {age}, has a sore knee for two months and an MRI elsewhere showed a 'tear,' so {patient} wants keyhole surgery.",
    history: "No injury. Aching on stairs. No locking or giving way. Keen hiker.",
    exam: "Mild swelling, full range of movement, tender along the inner joint line.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Early wear-and-tear arthritis in the inner knee.' },
      { test: 'exam_focused', value: 'useful', result: 'No mechanical locking; the knee is stable.' },
      { test: 'mri', value: 'neutral', result: 'The old scan already shows a frayed, age-related tear.' },
    ],
    differential: [
      { id: 'degenerative', label: 'An age-related tear with early arthritis' },
      { id: 'acute_tear', label: 'A fresh tear that locks the knee' },
      { id: 'infection', label: 'A joint infection' },
    ],
    diagnosis: 'degenerative',
    plans: [
      { id: 'rehab', label: 'Explain that this kind of tear is common and that surgery does not help it, and build a strengthening plan with a physical therapist', quality: 'best' },
      { id: 'scope', label: 'Book keyhole surgery as requested', quality: 'poor', procedure: 'or_arthroscopy' },
      { id: 'rest', label: 'Advise stopping hiking for good', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s knee settles with exercise and the hiking season goes ahead.",
      fair: "{patient} has occasional flare-ups but manages well.",
      poor: "{patient}'s knee stiffens from inactivity.",
    },
  }),
  C({
    id: 'hand_flexor_tendon', specialty: ['hand'], ages: [18, 60], minYear: 1960, tier: 'intermediate',
    label: 'A cut finger',
    intro: "{patient}, {age}, cut a finger on a broken glass while washing dishes and cannot bend the fingertip.",
    history: "Right-handed, works as a guitar teacher. Cut happened last night.",
    exam: "A small cut over the finger. The fingertip will not bend on its own. Feeling at the tip is reduced on one side.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The bending tendon and one finger nerve are cut.' },
      { test: 'xray', value: 'neutral', result: 'No glass left in the finger.' },
      { test: 'mri', value: 'low', result: 'Delays a repair that the examination has already shown is needed.' },
    ],
    differential: [
      { id: 'tendon_cut', label: 'A cut tendon and finger nerve' },
      { id: 'bruise', label: 'A painful bruise only' },
      { id: 'sprain', label: 'A sprained joint' },
    ],
    diagnosis: 'tendon_cut',
    needs: ['exam_focused'],
    plans: [
      { id: 'repair', label: 'Explain the injury and the long rehabilitation, get consent, and repair the tendon and nerve within days, with hand therapy arranged', quality: 'best', procedure: 'or_hand' },
      { id: 'stitches', label: 'Close the skin and send home', quality: 'unsafe' },
      { id: 'wait_months', label: 'Put on the routine waiting list', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} plays the guitar again after months of careful hand therapy.",
      fair: "{patient}'s finger bends well but stays a little stiff.",
      poor: "{patient}'s repair stretches when therapy is skipped, and the finger stays weak.",
    },
  }),
  C({
    id: 'hand_trigger', specialty: ['hand'], ages: [40, 75], minYear: 1965,
    label: 'A finger that catches',
    intro: "{patient}, {age}, has a ring finger that catches and clicks when straightened, worst in the mornings.",
    history: "Diabetic. Has had it for two months. Has never had any treatment for it.",
    exam: "A tender nodule at the base of the finger and a catch on straightening.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'Classic signs of a trigger finger.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
      { test: 'blood_basic', value: 'neutral', result: 'Sugar control is fair.' },
    ],
    differential: [
      { id: 'trigger', label: 'A trigger finger' },
      { id: 'arthritis', label: 'Arthritis of the finger' },
      { id: 'tumor', label: 'A tumor of the tendon' },
    ],
    diagnosis: 'trigger',
    plans: [
      { id: 'injection_first', label: 'Explain the condition, offer an injection to calm the swelling first, and keep surgery for if it comes back', quality: 'best' },
      { id: 'operate', label: 'Operate straight away', quality: 'ok', procedure: 'or_hand' },
      { id: 'force', label: 'Tell {patient} to force the finger straight', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s finger moves freely after one injection.",
      fair: "{patient} needs a small operation later when it returns.",
      poor: "{patient}'s finger gets stuck bent.",
    },
  }),
  C({
    id: 'hand_scaphoid', specialty: ['hand'], ages: [18, 40], minYear: 1985, tier: 'intermediate',
    label: 'A wrist fracture that matters',
    intro: "{patient}, {age}, fell while skateboarding and has pain at the base of the thumb. An earlier clinic called it a sprain.",
    history: "Right-handed, works as a carpenter. Still painful after two weeks.",
    exam: "Tender in the hollow at the base of the thumb. Grip is weak.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A fracture of a small wrist bone, with the pieces slightly apart.' },
      { test: 'ct', value: 'useful', result: 'Confirms that the pieces have moved.' },
      { test: 'blood_basic', value: 'low', result: 'Not relevant.' },
    ],
    differential: [
      { id: 'displaced', label: 'A displaced fracture of a small wrist bone' },
      { id: 'sprain', label: 'A wrist sprain' },
      { id: 'arthritis', label: 'Arthritis' },
    ],
    diagnosis: 'displaced',
    needs: ['xray'],
    plans: [
      { id: 'fix', label: 'Explain why this bone heals poorly when the pieces have moved, get consent, and fix it surgically with follow-up imaging', quality: 'best', procedure: 'or_hand' },
      { id: 'cast_only', label: 'Put it in a cast and review in three months', quality: 'poor' },
      { id: 'sprain', label: 'Agree it is a sprain', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient}'s bone heals and {patient} is back to work within three months.",
      fair: "{patient}'s bone heals slowly with a stiff wrist for a while.",
      poor: "{patient}'s bone does not heal and needs a second operation.",
    },
  }),
  C({
    id: 'hand_dupuytren', specialty: ['hand'], ages: [50, 85], minYear: 1960,
    label: 'Fingers pulling in',
    intro: "{patient}, {age}, has two fingers that are slowly being pulled down into the palm.",
    history: "Cannot lay the hand flat on a table or put on gloves. A brother has the same. No pain.",
    exam: "Thick cords in the palm pulling two fingers into a bent position.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'The hand cannot lie flat; the bend at the knuckle is significant.' },
      { test: 'xray', value: 'low', result: 'The cords do not show on an X-ray.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
    ],
    differential: [
      { id: 'dupuytren', label: 'Thickening of the tissue in the palm (Dupuytren disease)' },
      { id: 'trigger', label: 'Trigger finger' },
      { id: 'arthritis', label: 'Arthritis' },
    ],
    diagnosis: 'dupuytren',
    plans: [
      { id: 'release', label: 'Explain the options and the chance it may come back, get consent, and release the cords with hand therapy after', quality: 'best', procedure: 'or_hand' },
      { id: 'wait_years', label: 'Wait until the fingers touch the palm', quality: 'poor' },
      { id: 'stretch', label: 'Advise forcible stretching at home', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient}'s fingers straighten, and the gloves fit again.",
      fair: "{patient}'s fingers improve but one stays slightly bent.",
      poor: "{patient}'s cords return within a couple of years.",
    },
  }),
  C({
    id: 'spine_cauda_equina', specialty: ['spine', 'neurosurg'], ages: [25, 60], minYear: 1985, tier: 'complex',
    label: 'Back pain with warning signs',
    intro: "{patient}, {age}, has severe back pain with pain down both legs and new numbness in the saddle area.",
    history: "Has noticed difficulty passing urine since this morning. Back pain on and off for years.",
    exam: "Reduced feeling around the bottom and inner thighs, weak ankle movements on both sides.",
    tests: [
      { test: 'mri', value: 'useful', result: 'A large disc pressing on the bundle of nerves at the bottom of the spine.' },
      { test: 'exam_focused', value: 'useful', result: 'The bladder is not emptying fully.' },
      { test: 'xray', value: 'low', result: 'Cannot show the nerves.' },
    ],
    differential: [
      { id: 'cauda', label: 'Severe compression of the lowest spinal nerves' },
      { id: 'sciatica', label: 'Ordinary sciatica' },
      { id: 'uti', label: 'A urinary infection' },
    ],
    diagnosis: 'cauda',
    needs: ['mri'],
    plans: [
      { id: 'urgent_op', label: 'Explain the urgency and the risks honestly, get consent, and relieve the pressure on the nerves today', quality: 'best', procedure: 'ns_spine' },
      { id: 'list', label: 'Book for the next routine list', quality: 'unsafe', procedure: 'ns_spine' },
      { id: 'physio', label: 'Refer for physical therapy', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient}'s bladder and leg strength recover well over the following months.",
      fair: "{patient} recovers most function, with some numbness that lingers.",
      poor: "{patient} is left with lasting bladder problems.",
    },
  }),
  C({
    id: 'spine_no_fusion', specialty: ['spine'], ages: [35, 65], minYear: 1990,
    label: 'Asking for a fusion',
    intro: "{patient}, {age}, has had low back pain for three years and asks for a fusion operation after reading about it.",
    history: "No leg pain, numbness or weakness. Out of work. Little exercise. Poor sleep and low mood.",
    exam: "Tender lower back. Normal strength, feeling and reflexes in the legs.",
    tests: [
      { test: 'mri', value: 'neutral', result: 'Wear-and-tear changes common at this age, with no nerve squeezed.' },
      { test: 'screening_tool', value: 'useful', result: 'A questionnaire shows high fear of movement and low mood.' },
      { test: 'blood_basic', value: 'low', result: 'Not relevant.' },
    ],
    differential: [
      { id: 'chronic_back', label: 'Chronic back pain without a surgical target' },
      { id: 'instability', label: 'A slipped vertebra needing fusion' },
      { id: 'tumor', label: 'A spinal tumor' },
    ],
    diagnosis: 'chronic_back',
    plans: [
      { id: 'honest_rehab', label: 'Explain honestly that a fusion is unlikely to help, and arrange an active rehabilitation program with support for mood and return to work', quality: 'best' },
      { id: 'fuse', label: 'Offer a fusion as asked', quality: 'poor', procedure: 'ns_spine' },
      { id: 'dismiss', label: 'Say there is nothing wrong', quality: 'poor' },
    ],
    outcomes: {
      good: "{patient} returns to work gradually and the pain becomes manageable.",
      fair: "{patient} improves slowly with some bad weeks.",
      poor: "{patient} feels unheard and finds a surgeon elsewhere.",
    },
  }),
  C({
    id: 'fa_achilles', specialty: ['foot_ankle'], ages: [30, 60], minYear: 1985,
    label: 'A pop at the back of the ankle',
    intro: "{patient}, {age}, felt a pop at the back of the ankle while playing tennis, as if kicked.",
    history: "Weekend player. Can walk but with a flat-footed limp. Wants to play again next season.",
    exam: "A gap in the tendon above the heel; squeezing the calf does not move the foot.",
    tests: [
      { test: 'exam_focused', value: 'useful', result: 'A complete tear of the Achilles tendon.' },
      { test: 'ultrasound', value: 'useful', result: 'The tendon ends come together when the foot is pointed down.' },
      { test: 'ct', value: 'low', result: 'Not helpful for tendons.' },
    ],
    differential: [
      { id: 'achilles', label: 'A torn Achilles tendon' },
      { id: 'calf', label: 'A calf strain' },
      { id: 'dvt', label: 'A clot in the leg' },
    ],
    diagnosis: 'achilles',
    needs: ['exam_focused'],
    plans: [
      { id: 'shared', label: 'Explain that a boot with a structured rehab plan or an operation can both work well, weigh the trade-offs together, and agree on a boot and close follow-up', quality: 'best' },
      { id: 'operate', label: 'Recommend surgery without discussing the other option', quality: 'ok', procedure: 'or_foot' },
      { id: 'walk_off', label: 'Say it is a strain and to walk it off', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient} follows the rehab plan and is back on court the next season.",
      fair: "{patient}'s recovery is slower but steady.",
      poor: "{patient}'s tendon heals long and the push-off stays weak.",
    },
  }),
  C({
    id: 'fa_ankle_fracture', specialty: ['foot_ankle'], ages: [20, 70], minYear: 1960, tier: 'intermediate',
    label: 'A twisted ankle that is broken',
    intro: "{patient}, {age}, twisted an ankle stepping off a curb and cannot bear weight.",
    history: "Smoker. No diabetes. Works on their feet.",
    exam: "Swollen ankle, tender on both sides. Foot pink with good pulses.",
    tests: [
      { test: 'xray', value: 'useful', result: 'A fracture on both sides of the ankle; the joint has shifted.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal.' },
      { test: 'mri', value: 'low', result: 'Not needed.' },
    ],
    differential: [
      { id: 'unstable', label: 'An unstable ankle fracture' },
      { id: 'sprain', label: 'A bad sprain' },
      { id: 'stable', label: 'A stable fracture' },
    ],
    diagnosis: 'unstable',
    needs: ['xray'],
    plans: [
      { id: 'fix', label: 'Line up the ankle, explain why surgery is needed, get consent, fix it once the swelling allows, and encourage stopping smoking to help healing', quality: 'best', procedure: 'or_foot' },
      { id: 'cast', label: 'A cast and review in six weeks', quality: 'poor' },
      { id: 'bandage', label: 'Bandage it as a sprain', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient}'s ankle heals in good position, and {patient} is back at work in three months.",
      fair: "{patient}'s wound is slow to heal but the bone mends.",
      poor: "{patient} has a stiff ankle for many months.",
    },
  }),
  C({
    id: 'fa_charcot', specialty: ['foot_ankle'], ages: [45, 75], minYear: 1985, tier: 'intermediate',
    label: 'A hot, swollen foot',
    intro: "{patient}, {age}, has a warm, swollen foot with little pain. A clinic thought it was an infection.",
    history: "Diabetes for twenty years with numb feet. No wound. No fever. Remembers a small stumble a few weeks ago.",
    exam: "The foot is warmer than the other, swollen and red, with no break in the skin. Little feeling in both feet.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Early collapse of bones in the middle of the foot.' },
      { test: 'mri', value: 'useful', result: 'Bone swelling without infection.' },
      { test: 'blood_basic', value: 'neutral', result: 'Normal infection markers.' },
    ],
    differential: [
      { id: 'charcot', label: 'A Charcot foot (bones collapsing in a numb foot)' },
      { id: 'cellulitis', label: 'Skin infection' },
      { id: 'gout', label: 'Gout' },
    ],
    diagnosis: 'charcot',
    plans: [
      { id: 'offload', label: 'Explain the condition, take all weight off the foot in a special cast, check it often, and work with the diabetes team', quality: 'best' },
      { id: 'antibiotics', label: 'Treat for infection and keep walking', quality: 'poor' },
      { id: 'reconstruct', label: 'Reconstruct the foot now', quality: 'poor', procedure: 'or_foot' },
    ],
    outcomes: {
      good: "{patient}'s foot settles in a good shape and fits a special shoe.",
      fair: "{patient}'s foot settles with a mild change in shape.",
      poor: "{patient}'s foot collapses further and an ulcer develops.",
    },
  }),
  C({
    id: 'fa_ankle_arthritis', specialty: ['foot_ankle'], ages: [50, 80], minYear: 1985, tier: 'intermediate',
    label: 'A worn-out ankle',
    intro: "{patient}, {age}, has a painful, stiff ankle years after a bad fracture, and can barely walk a block.",
    history: "Has tried a brace, special shoes, physical therapy and injections over three years. Wants to walk the dog again.",
    exam: "A stiff, swollen ankle. Good circulation and skin.",
    tests: [
      { test: 'xray', value: 'useful', result: 'Severe arthritis of the ankle joint.' },
      { test: 'vascular_doppler', value: 'neutral', result: 'Good blood flow for healing.' },
      { test: 'mri', value: 'low', result: 'The X-ray already answers the question.' },
    ],
    differential: [
      { id: 'end_stage', label: 'End-stage ankle arthritis' },
      { id: 'tendon', label: 'A tendon problem' },
      { id: 'gout', label: 'Gout' },
    ],
    diagnosis: 'end_stage',
    needs: ['xray'],
    plans: [
      { id: 'reconstruct', label: 'Since other treatments have failed, explain the options honestly, get consent, and reconstruct the ankle', quality: 'best', procedure: 'or_foot' },
      { id: 'more_injections', label: 'Keep repeating injections', quality: 'poor' },
      { id: 'amputate', label: 'Suggest amputation', quality: 'unsafe' },
    ],
    outcomes: {
      good: "{patient} is walking the dog around the park within six months.",
      fair: "{patient} walks better but with some swelling at the end of the day.",
      poor: "{patient}'s ankle is slow to heal and needs a longer recovery.",
    },
  }),
];

export const CASE_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));
