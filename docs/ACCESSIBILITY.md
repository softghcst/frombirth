# Accessibility

What was checked, what was fixed, and how to check again.

## The audit

[ax-core](https://github.com/dequelabs/ax-core) 4.10 (WCAG 2.1 A and AA rules, plus best practice) was run at phone size
(390×844) in both the light and dark themes on: the title screen, the life screen, each of the six tabs, the passport, the
World Explorer, World news, the doctor, and a choice dialog. A keyboard-only playthrough then started a life, lived eight
years answering every scene with Tab and Enter, opened a tab and a dialog, and closed it with Escape.

| Found | Fixed |
|---|---|
| Pinch-zoom was disabled (`user-scalable=no`) | Zoom is allowed; buttons use `touch-action: manipulation` so taps stay quick |
| Muted text was 4.19:1 on the light background | `--muted` is now `#6b6254`: 5.2:1 on paper, at least 4.5:1 on every light surface |
| The journal could not be reached or scrolled by keyboard | It is a labeled `role="log"`, focusable |
| Dialogs had no accessible name | Each takes its heading (or first line) as its name |
| Focus stayed behind dialogs and was lost after them | Focus moves into a dialog, returns where it came from (also through chains of dialogs), and returns to the age-up button after each year |
| Escape did nothing | Escape closes dialogs that can be dismissed (scenes still need an answer) |
| Content outside landmarks; no `<main>` on the title screen | Each full screen is a `<main>`; the game has one `<main>`, a labeled `<nav>` and a named panel region |

After the fixes ax reports no violations on any of those screens, in either theme, and the keyboard playthrough completes
with focus always where it should be. The audit also turned up an unrelated crash (an NPC's job pointing past the top of a
career ladder), fixed in `js/engine/npcLives.js`.

## Explore the World

The travel hub (`js/ui/globalLife.js`) was audited the same way with `scripts/a11y-explore.cjs`: axe-core 4.10.2 on all 31 of
its screens (Discover, a destination, a full trip plan, My Trips and a trip, every Passport & Documents tab, Immigration with an
approved move and its checklist, Places I've Lived and a residence, Languages & Culture, every Travel Memories tab, Our Global
Story with a marker open, a life event and a House Chronicle), at 390×844 in the light and the dark theme, then a keyboard pass.

| Found | Fixed |
|---|---|
| The family map was marked as an image while its markers could take focus | The map is a labeled group; its text alternative is the timeline beneath it |
| Map markers took focus but did nothing from the keyboard | Enter or Space opens a marker, with a visible focus ring |
| The Passport & Documents screen failed to open (a field renamed during a merge) | Fixed; the audit now opens every tab |

After the fixes axe reports no violations on any of the 31 screens in either theme. Focus moves into the hub when it opens,
Tab reaches every control in order (39 in the first screen), and Escape closes it.

## What this does not cover

- No screen reader has been used (VoiceOver, TalkBack, NVDA). Names, roles and live regions are set as the specifications
  say, but how they read aloud has not been heard.
- Nothing has been tested on a real phone, including iOS Safari's handling of zoom and focus.
- Only the screens listed above were audited (the Explore the World screens are listed in their own section); rarely seen screens (the court, the cabinet, campaigns) were not opened.
- The avatar art has no text alternative beyond the character's name beside it.

## Checking again

`node tests/a11y.mjs` runs with the other checks and needs nothing installed: zoom, theme contrast in both modes, dialog
names and focus, landmarks and reduced motion. The browser audit and the keyboard playthrough are `scripts/a11y-audit.cjs`
and `scripts/a11y-keyboard.cjs`; how to run them is at the top of each.
