// Scenes of a legal career (engine/lawPractice.js queues them, once each when their moment comes, and decides what each
// choice does). The cases themselves, with their filings and days in court, have their own screens.
const l = (value) => ({ type: 'law', value });
const scene = (id, ages, text, choices) => ({ id, category: 'Law', ageRange: ages, queuedOnly: true, text,
  choices: choices.map(([label, value, line, tone = 'neutral']) => ({ label, outcomes: [{ on: 'always', text: line, tone, effects: [l(value)] }] })) });

export default [
  scene('law_first_client', [21, 90], 'Your First Client. {client} sits across the desk, holding a folder of papers too tightly. They want to know what is going to happen.', [
    ['Listen to the whole story first', 'first:listen', 'You put your pen down and listen.'],
    ['Explain how a case like this goes', 'first:explain', 'You walk them through it, step by step.'],
    ['Promise them you will win', 'first:promise', 'You tell them not to worry.', 'bad'],
  ]),
  scene('law_partnership', [28, 90], 'The Partnership Vote. The partners meet next week. Your name is on the list of associates they will consider.', [
    ['Make your case to the partners', 'partner:ask', 'You put your record in front of them.'],
    ['Wait another year', 'partner:wait', 'You decide your record will be stronger next year.'],
  ]),
  scene('law_vacancy', [35, 90], 'The Judicial Vacancy. A judge in {place} is retiring, and the seat is open to experienced lawyers.', [
    ['Apply for the seat', 'vacancy:apply', 'You put your name forward.'],
    ['Not now', 'vacancy:pass', 'You let it go by.'],
  ]),
  scene('law_burnout', [22, 90], 'More Cases Than Hours. Your desk is covered in files, and every one of them is someone\'s worst year.', [
    ['Hand one of the big cases to a colleague', 'burnout:refer', 'You ask for help.'],
    ['Take some time off', 'burnout:leave', 'You book two weeks away.'],
    ['Push through', 'burnout:push', 'You make another pot of coffee.', 'bad'],
  ]),
];
