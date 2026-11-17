// Keyboard-only playthrough: Tab, Enter and Escape only. Reports where focus goes after each step.
// A developer tool: needs playwright and the game served on port 8765 (see scripts/a11y-audit.cjs). See docs/ACCESSIBILITY.md.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const focus = () => p.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''} "${(e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"` : 'none'; });
  const tabTo = async (pred, max = 40) => { for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(pred)) return true; } return false; };
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  console.log('start:', await focus());
  console.log('reach "Begin a random life":', await tabTo(() => document.activeElement?.matches('[data-random]')));
  await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  // Any scene at birth: focus should already be on its first choice.
  for (let k = 0; k < 3; k++) {
    const modal = await p.$('.scrim .modal');
    if (!modal) break;
    console.log('dialog open, focus on:', await focus(), '| named:', await p.evaluate(() => { const m = document.querySelector('.scrim:last-child .modal'); const id = m.getAttribute('aria-labelledby'); return id ? document.getElementById(id)?.innerText.slice(0, 40) : m.getAttribute('aria-label'); }));
    await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  }
  console.log('reach the age-up button:', await tabTo(() => document.activeElement?.matches('[data-year]')));
  let scenes = 0;
  for (let y = 0; y < 8; y++) {
    await p.keyboard.press('Enter'); await p.waitForTimeout(350);
    for (let k = 0; k < 15 && await p.$(".scrim .modal"); k++) {
      const inside = await p.evaluate(() => !!document.activeElement?.closest('.modal'));
      if (!inside) { console.log('FOCUS NOT IN DIALOG:', await focus()); break; }
      scenes += 1; await p.keyboard.press('Enter'); await p.waitForTimeout(350);
    }
    const back = await p.evaluate(() => document.activeElement?.matches('[data-year]'));
    if (!back) { console.log('after the year, focus is on:', await focus()); await tabTo(() => document.activeElement?.matches('[data-year]')); }
  }
  console.log('scenes answered by keyboard:', scenes, '| age now:', await p.$eval('[data-line1]', (e) => e.innerText));
  console.log('journal focusable:', await p.evaluate(() => document.querySelector('[data-journal]').tabIndex === 0));
  // Open a tab, then a dismissable dialog, then Escape.
  console.log('reach the Self tab:', await tabTo(() => document.activeElement?.matches('[data-tab="self"]')));
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  console.log('reach Passport:', await tabTo(() => document.activeElement?.matches('[data-passport]'), 80));
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  console.log('passport open, focus in it:', await p.evaluate(() => !!document.activeElement?.closest('.modal')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('after Escape: dialog closed', !(await p.$('.scrim .modal')), '| focus back on:', await focus());
  console.log('ERRORS:', errs.join(' | ') || 'none');
  await b.close();
})();
