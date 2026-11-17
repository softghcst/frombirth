// What a person's criminal record says, for anything that needs to ask.
// A record entry is the outcome of one case: see engine/cases.js.
//
// Kept free of imports so any engine can use it.

/**
 * Convictions that count against someone.
 * @param {{legal:{record:Array}}} p
 * @param {{sealed?:boolean, juvenile?:boolean}} [o]
 *   sealed: include records sealed by a court (immigration and some licensing still see them)
 *   juvenile: include juvenile records
 */
export const convictionsOf = (p, o = {}) => (p.legal?.record ?? []).filter((r) => r.convicted && !r.exonerated && !r.pardoned
  && (o.juvenile || !r.juvenile) && (o.sealed || !r.sealed));

/** Whether someone has an unspent adult conviction. */
export const hasRecord = (p, o) => convictionsOf(p, o).length > 0;
