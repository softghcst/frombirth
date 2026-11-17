# Accessibility

What was checked, what was fixed, and how to check again.

## The audit

[axe-core](https://github.com/dequelabs/axe-core) 4.10 (WCAG 2.1 A and AA rules, plus best practice) was run at phone size
(390×844) in both the light and dark themes on: the title screen, the life screen, each of the six tabs, the passport, the
World Explorer, World news, the doctor, and a choice dialog. A keyboard-only playthrough then started a life, lived eight
years answering every scene with Tab and Enter, opened a tab and a dialog, and closed it with Escape.

| Found | Fixed |
|---|---|
| Pinch-zoom was disabled (`user-scalable=no`) | Zoom is allowed; buttons use `touch-action: manipulation` so taps stay quick |
| Muted text was 4.19:1 on the light background | `--muted` is now `#6b6254`: 5.2:1 on paper, at least 4.5:1 on every light surface |
| The journal could not be reached or scrolled by keyboard | It is a labelled `role="log"`, focusable |
| Dialogs had no accessible name | Each takes its heading (or first line) as its name |
| Focus stayed behind dialogs and was lost after them | Focus moves into a dialog, returns where it came from (also through chains of dialogs), and returns to the age-up button after each year |
| Escape did nothing | Escape closes dialogs that can be dismissed (scenes still need an answer) |
| Content outside landmarks; no `<main>` on the title screen | Each full screen is a `<main>`; the game has one `<main>`, a labelled `<nav>` and a named panel region |

After the fixes axe reports no violations on any of those screens, in either theme, and the keyboard playthrough completes
with focus always where it should be. The audit also turned up an unrelated crash (an NPC's job pointing past the top of a
career ladder), fixed in `js/engine/npcLives.js`.

## What this does not cover

- No screen reader has been used (VoiceOver, TalkBack, NVDA). Names, roles and live regions are set as the specifications
  say, but how they read aloud has not been heard.
- Nothing has been tested on a real phone, including iOS Safari's handling of zoom and focus.
- Only the screens listed above were audited; rarely seen screens (the court, the cabinet, campaigns) were not opened.
- The avatar art has no text alternative beyond the character's name beside it.

## Checking again

`node tests/a11y.mjs` runs with the other checks and needs nothing installed: zoom, theme contrast in both modes, dialog
names and focus, landmarks and reduced motion. The browser audit and the keyboard playthrough are `scripts/a11y-audit.cjs`
and `scripts/a11y-keyboard.cjs`; how to run them is at the top of each.
