// Scenes of a life in the armed forces (engine/military.js queues them and decides what each choice does).
const m = (value) => ({ type: 'military', value });
const scene = (id, ages, text, choices) => ({ id, category: 'Service', ageRange: ages, queuedOnly: true, text,
  choices: choices.map(([label, value, line, tone = 'neutral']) => ({ label, outcomes: [{ on: 'always', text: line, tone, effects: [m(value)] }] })) });

export default [
  scene('mil_ns_idol', [18, 40], 'You are {age}, and your enlistment cannot be put off any longer. The fans have been counting down; {group} has been planning around it for a year.', [
    ['Enlist quietly, with a letter to the fans', 'nsi:quiet', 'You write it by hand.'],
    ['A farewell for the fans first', 'nsi:farewell', 'One last meeting before you go.'],
    ['Ask for the state culture medal deferral', 'nsi:medal', 'Your agency puts the request in.'],
    ['Ask the medical board about public service', 'nsi:public', 'You go for the medical.'],
    ['Refuse', 'nsi:refuse', 'You say you will not go.', 'bad'],
  ]),
  scene('mil_ns_athlete', [20, 40], 'Military service is due before you turn {by}: about eighteen months. The armed forces have an athletic team that takes the best and keeps them competing in your sport, {sport}.', [
    ['Apply to the athletic team', 'nsa:team', 'You send in your record.'],
    ['Serve like anyone else', 'nsa:regular', 'You enlist.'],
    ['Not yet', 'nsa:later', 'One more season first.'],
  ]),
  scene('mil_basic_training', [16, 60], 'The first morning of {kind} with the {branch} starts at five, with shouting. Weeks of this lie ahead.', [
    ['Push to the front', 'basic:push', 'You decide to be the one they remember.'],
    ['Help a recruit who is struggling', 'basic:help', 'There is one who will not make it alone.'],
    ['Keep your head down', 'basic:steady', 'Do what is asked, no more, and get through it.'],
    ['Ask to leave', 'basic:quit', 'You go to the office and say it is not for you.', 'bad'],
  ]),
  scene('mil_deployment', [17, 70], 'Your unit is sent to {place}. Most days are long and dull. Some are not.', [
    ['Volunteer for the dangerous job', 'deploy:volunteer', 'Somebody has to. You put your hand up.'],
    ['Look after the people in your unit', 'deploy:unit', 'You make sure everyone eats, sleeps and writes home.'],
    ['Keep your head down', 'deploy:steady', 'You do your job and count the days.'],
  ]),
  scene('mil_contract_end', [20, 70], 'Your contract with the {branch} is up after {years} years. A form on the desk asks what happens next.', [
    ['Sign again', 'contract:reenlist', 'You sign for another term.'],
    ['Go on to officer training', 'contract:officer', 'You apply to become an officer.'],
    ['Leave with an honorable discharge', 'contract:leave', 'You hand in your kit and go home.'],
  ]),
  scene('mil_national_service', [17, 35], 'Your call-up papers have come: {months} months of national service, as everyone your age in {place} must do.', [
    ['Report for duty', 'ns:serve', 'You pack a bag.'],
    ['Ask to defer while you study', 'ns:defer', 'You send in your enrollment papers.'],
    ['Do civilian service instead', 'ns:civil', 'You ask for the civilian alternative.'],
    ['Refuse', 'ns:refuse', 'You do not go.', 'bad'],
  ]),
];
