// The graduation card: shown once, after the turn the player finishes high school, university, graduate school or
// any other course (engine/education.js graduate sets player.flags.gradCard). A keepsake on fine paper, in the
// spirit of the birth tag and the wedding cards: confetti, the player in a graduation cap, a little diploma with a gold seal.
// Under it, what comes next: university (the planner and its applications), more study, a job (the Work hub), or
// some time off, which just closes it.
import { esc, cap } from '../util.js';
import { player } from '../state.js';
import { openModal } from './modals.js';
import { avatarSvg, dressOfPlayer } from './avatar.js';
import { stageLabel, programOptions } from '../engine/education.js';
import * as uni from '../engine/university.js';
import { openUniversity } from './university.js';
import { applyFlow, chooseFunding, chooseHousing } from './tabs/work.js';
import { careerHandlers } from './tabs/workCareer.js';

/** Each stage's colors, its words, and the little picture on its seal. */
const STYLE = {
  high: { shade: 'pink', seal: '🎓' },
  equivalency: { shade: 'pink', seal: '🎓' },
  community: { shade: 'mint', seal: '📘' },
  university: { shade: 'blue', seal: '🏛️' },
  graduate: { shade: 'lilac', seal: '📜' },
  doctorate: { shade: 'lilac', seal: '🔬' },
  medical: { shade: 'mint', seal: '🩺' },
  podiatric: { shade: 'mint', seal: '🩺' },
  law: { shade: 'lilac', seal: '⚖️' },
  cosmetology: { shade: 'pink', seal: '💇' },
  apprenticeship: { shade: 'gold', seal: '🛠️' },
  technical: { shade: 'gold', seal: '🛠️' },
  certificate: { shade: 'gold', seal: '📜' },
};

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const usStyle = () => ['us', 'ca'].includes(player().countryId);

/** The big words at the top: "Graduated High School!" */
export function headline(card) {
  const s = card.stage;
  if (s === 'high') return `Graduated ${titleCase(stageLabel('high'))}!`;
  if (s === 'equivalency') return 'Graduated!';
  if (s === 'university') return usStyle() ? 'Graduated College!' : 'Graduated University!';
  if (s === 'community') return 'Graduated Community College!';
  if (s === 'graduate') return 'Graduated Grad School!';
  if (s === 'doctorate') return 'Doctor of Philosophy!';
  if (s === 'medical' || s === 'podiatric') return 'Graduated Medical School!';
  if (s === 'law') return 'Graduated Law School!';
  if (['apprenticeship', 'technical'].includes(s)) return 'Fully Qualified!';
  return 'Graduated!';
}

/** What the diploma says was earned. */
function awardLine(card) {
  const s = card.stage;
  const sub = card.subject ? ` in ${card.subject}` : '';
  if (s === 'high') return cap(card.award ?? 'diploma');
  if (s === 'equivalency') return 'School-leaving qualification';
  if (s === 'university') return `Bachelor's degree${sub}`;
  if (s === 'community') return `Associate degree${sub}`;
  if (s === 'graduate') return `Master's degree${sub}`;
  if (s === 'doctorate') return 'Doctorate';
  if (s === 'medical') return 'Doctor of Medicine';
  if (s === 'podiatric') return 'Doctor of Podiatric Medicine';
  if (s === 'law') return 'Law degree';
  if (s === 'cosmetology') return 'License in hair and makeup';
  if (['apprenticeship', 'technical'].includes(s)) return card.subject ?? 'Trade qualification';
  if (s === 'certificate') return `Certificate${sub}`;
  return stageLabel(s);
}

/** A graduation cap with a gold tassel, as decoration on the card (where it goes is up to the stylesheet). */
const capSvg = (cls) => `<svg class="${cls}" viewBox="0 0 120 80" aria-hidden="true">
  <path d="M34 34v16c0 8 12 13 26 13s26-5 26-13V34Z" fill="#3a3644"/>
  <path d="M60 6 114 28 60 48 6 28Z" fill="#26232e" stroke="#15131a" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M60 27 96 34v22" stroke="#f2c14e" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="60" cy="27" r="3.2" fill="#f2c14e"/><path d="M92 54h8l3 16H89Z" fill="#f2c14e"/></svg>`;

/** Confetti pieces scattered over the card. Fixed spots, so the card looks the same every time it is opened. */
const CONFETTI = [[5, 6, -20, 'a'], [10, 24, 30, 'b'], [90, 5, 15, 'c'], [93, 24, -35, 'a'], [8, 42, 50, 'c'], [91, 40, -10, 'b'],
  [4, 60, 25, 'b'], [95, 58, 40, 'a'], [20, 34, 60, 'c'], [80, 32, -45, 'b'], [26, 26, 10, 'a'], [72, 24, 20, 'c'], [3, 80, -30, 'a']];
const confettiHtml = () => `<div class="grad-confetti" aria-hidden="true">${CONFETTI.map(([x, y, r, k], i) =>
  `<i class="c${k}" style="left:${x}%;top:${y}%;--r:${r}deg;--d:${(i % 5) * 0.12}s"></i>`).join('')}</div>`;

/** Where the cap goes on the card: tossed in the air, perched on the photo, or on the diploma. */
export let CAP_SPOT = 'photo';
export const setCapSpot = (v) => { CAP_SPOT = v; };

/** The card. */
export function graduationCardHtml(p, card) {
  const st = STYLE[card.stage] ?? { shade: 'blue', seal: '🎓' };
  const face = avatarSvg({ age: p.age, gender: p.gender, appearance: p.appearance, seed: p.id, mood: 92, size: 104, ...dressOfPlayer(p) });
  const where = card.school ?? (card.stage === 'high' ? 'School' : stageLabel(card.stage));
  return `<div class="grad grad-${st.shade} cap-${CAP_SPOT}">
    ${confettiHtml()}
    ${capSvg('grad-cap grad-cap-toss t1')}${capSvg('grad-cap grad-cap-toss t2')}
    <div class="grad-class">Class of ${esc(String(card.year ?? ''))}</div>
    <div class="grad-word">${esc(headline(card))}</div>
    <svg class="grad-flourish" viewBox="0 0 200 14" aria-hidden="true"><path d="M4 8c30-8 60 6 96 0s66-8 96 0"/></svg>
    <div class="grad-photo"><div class="grad-face">${face}</div>${capSvg('grad-cap grad-cap-photo')}</div>
    <div class="grad-diploma">
      <span class="grad-ribbon" aria-hidden="true"></span>
      ${capSvg('grad-cap grad-cap-diploma')}
      <div class="grad-certify">This certifies that</div>
      <div class="grad-name">${esc(`${p.firstName} ${p.lastName}`)}</div>
      <div class="grad-certify">has completed</div>
      <div class="grad-award">${esc(awardLine(card))}</div>
      <div class="grad-school">${esc(where)}</div>
      ${card.mark || card.honors ? `<div class="grad-marks">${card.mark ? `<span>${esc(card.mark)}</span>` : ''}${card.honors ? `<span class="grad-honors">✨ ${esc(cap(card.honors))}</span>` : ''}</div>` : ''}
      <div class="grad-seal" aria-hidden="true"><span>${st.seal}</span></div>
    </div>
  </div>`;
}

/** The choices under the card, for this stage and this player. */
export function nextSteps(card) {
  const p = player();
  const opts = programOptions();
  const open = (id) => opts.find((o) => o.id === id)?.eligible;
  // After a degree, the next degrees come first: graduate school, law, medicine.
  const FIRST = ['graduate', 'doctorate', 'law', 'medical', 'podiatric'];
  const rank = (o) => { const i = FIRST.indexOf(o.id); return i < 0 ? FIRST.length : i; };
  const anyStudy = opts.filter((o) => o.eligible && o.id !== 'university').sort((a, b) => rank(a) - rank(b));
  const steps = [];
  const plan = uni.plan();
  const answered = plan?.sent && plan.list?.some((a) => a.outcome === 'accepted');
  const schoolLeaver = ['high', 'equivalency', 'community'].includes(card.stage);
  if (schoolLeaver && (answered || plan || open('university'))) {
    steps.push({ id: 'uni', emoji: '🏛️', label: card.stage === 'community' ? 'Transfer to University' : usStyle() ? 'Go to College' : 'Go to University',
      sub: answered ? 'Pick Your School' : plan?.sent ? 'See Your Answers' : 'Apply to Schools' });
  }
  if (anyStudy.length) {
    steps.push({ id: 'study', emoji: '📚', label: card.stage === 'university' && open('graduate') ? 'Go to Grad School' : schoolLeaver ? 'Other Schooling' : 'Keep Studying',
      sub: schoolLeaver ? 'Trade School & More' : `${anyStudy.slice(0, 2).map((o) => titleCase(o.label.replace(/ school$/i, ''))).join(', ')}${anyStudy.length > 2 ? ' & More' : ''}` });
  }
  if (!p.legal.incarceration) {
    steps.push({ id: 'work', emoji: '💼', label: p.career.careerId ? 'Back to Work' : 'Get a Job', sub: p.career.careerId ? 'Your Career' : 'Find Work Now' });
  }
  steps.push({ id: 'rest', emoji: '🌴', label: 'Take Time Off', sub: 'Decide Later' });
  return steps;
}

/** Opens the card. Resolves the step chosen ('uni', 'study', 'work' or 'rest'). */
export function openGraduationCard(p, card, steps = nextSteps(card)) {
  return new Promise((resolve) => {
    const m = openModal(`
      ${graduationCardHtml(p, card)}
      <div class="grad-next">
        <div class="section-label">What's next?</div>
        ${steps.map((s) => `<button class="choice-btn grad-step" data-step="${s.id}"><span class="grad-step-emoji" aria-hidden="true">${s.emoji}</span><span>${esc(s.label)}<small>${esc(s.sub)}</small></span></button>`).join('')}
      </div>`, { tone: 'good', dismissable: true, back: false, onDismiss: () => resolve('rest') });
    m.el.classList.add('grad-modal');
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (!b) return;
      m.close();
      resolve(b.dataset.step);
    });
  });
}

/**
 * If the player has just graduated, shows the card once and follows the choice into the university planner, the
 * other courses, or the Work hub. api: the tab api ({ changed }).
 */
export async function graduationNotice(api) {
  const p = player();
  const card = p?.alive ? p.flags.gradCard : null;
  if (!card) return;
  delete p.flags.gradCard;
  api.changed();
  // Only a fresh graduation: years lived without the card being seen (a life played on by the engine alone) let it go.
  if (p.age - (card.age ?? p.age) > 1) return;
  const step = await openGraduationCard(p, card);
  if (!player().alive) return;
  // The turn waits until the planner or the job hunt is closed, so nothing else pops up over it.
  if (step === 'uni') { openUniversity(api, { funding: chooseFunding, housing: chooseHousing }); return untilClosed(); }
  if (step === 'study') return applyFlow(api);
  if (step === 'work') { const r = careerHandlers(api).findwork(); return r?.then ? r : untilClosed(); }
  return undefined;
}

/** Resolves when the top pop-up, just opened, has been closed (and anything opened from it). */
function untilClosed() {
  const scrim = document.querySelector('#modal-root .scrim:last-child');
  if (!scrim) return Promise.resolve();
  return new Promise((resolve) => {
    const watch = new MutationObserver(() => { if (!scrim.isConnected) { watch.disconnect(); resolve(); } });
    watch.observe(scrim.parentNode, { childList: true });
  });
}

