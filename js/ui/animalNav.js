// Where the player is among the family's animals, and how they got there.
//
// Each screen they open is a step: which screen, what it is showing (which
// animal, which house), and how they left it (the tab, the filters, the
// memory they had open, how far down they had scrolled). Going back returns
// the step before exactly as it was left. Nothing here touches the page, so
// the same rules can be checked without one (tests/animals.mjs).

/**
 * @typedef {{screen:string, params:object, ui:object}} Step
 *   screen  'archive' | 'album' | 'profile' | 'chronicle' | 'story'
 *   params  what it shows: { animalId } | { key } | { gen }
 *   ui      how it was left: { tab, show, species, type, animal, open, scroll }
 */
export function createNav() {
  /** @type {Step[]} */
  const steps = [];
  return {
    /** Opens a screen on top of the one showing. */
    open(screen, params = {}, ui = {}) {
      const step = { screen, params: { ...params }, ui: { ...ui } };
      steps.push(step);
      return step;
    },
    /** The screen showing, or null when everything is closed. */
    top: () => steps[steps.length - 1] ?? null,
    /** Notes how the screen showing is being left: merged into what was already noted. */
    remember(patch) {
      const step = steps[steps.length - 1];
      if (step) Object.assign(step.ui, patch);
      return step ?? null;
    },
    /** Closes the screen showing. Returns the one beneath it, as it was left, or null. */
    back() {
      steps.pop();
      return steps[steps.length - 1] ?? null;
    },
    /** The screen beneath the one showing: where "back" leads. */
    under: () => steps[steps.length - 2] ?? null,
    depth: () => steps.length,
    /** The road here, for a "back to ..." label. */
    trail: () => steps.map((s) => s.screen),
    clear() { steps.length = 0; },
  };
}

/** What the screen beneath is called, on the button that returns to it. */
export function backLabel(step, nameOf = () => '') {
  if (!step) return 'Close';
  return { archive: 'Back to the family archive', album: 'Back to Our Animal Family', chronicle: 'Back to the house chronicle', story: 'Back to the life story',
    profile: `Back to ${nameOf(step.params.animalId) || 'the profile'}` }[step.screen] ?? 'Back';
}
