# Living moments

Birthdays, school dances, family occasions, holidays, traditions, invitations and evenings with friends, lived
the Pathways way: a year at a time. There is no calendar, no dates and no scheduling.

## How a year works

**People → My Moments → This Year** lists what the year being lived holds:

| Group | What appears |
|---|---|
| Birthdays | The player's own, every year; round birthdays (1, 10, 13, 16, 18, 21, 30, 40 … 100) of a spouse, partner, child, parent, sibling or grandparent |
| School | The dance and, where it is the custom, prom, the formal or the leavers' prom; a party in the year the player graduates |
| Family occasions | A wedding anniversary; visiting grandparents; a family reunion (with four or more relatives) |
| Holidays | The ones kept where the player lives (New Year everywhere; Christmas, Eid, Diwali, Lunar New Year, Thanksgiving, Hanukkah, Day of the Dead, Carnival, Nowruz, Halloween by country) |
| Family traditions | Each active tradition: keep it, skip it, or offer to host |
| Invitations | What people in the player's life ask them to this year |
| With friends | A sleepover, a games night, a dinner party, by age |

Choosing one is: **occasion → guests → style → confirm**, and it is resolved at once:

- the cost is spent once (a child's own occasions are paid for by the family) and written in the ledger;
- each guest grows closer;
- the player's mood lifts;
- what is worth remembering (round birthdays, proms, named anniversaries, weddings, a new tradition) goes in
  the life story and in the guests' memories of the player;
- it is marked done for this character and this year.

Guests are always people already in the player's life. Nobody is made up for a party.

## Limits

- Everything on the list can be done once a year.
- Evenings with friends: each kind once a year, and at most four in all.
- Nobody can grow more than 12 points closer to the player from occasions in a year, however many they come to.

## Age Up

When the player ages up, before the age changes (`finishYear` in `engine/moments.js`):

1. each active tradition not kept by hand this year happens by itself, once, paid for by its host;
2. an unanswered invitation from someone close is gone to (with a present); others are missed, and noticed a little;
3. a round wedding anniversary that went unmarked is felt by the spouse;
4. a summary of the year is kept (My Moments → Past years);
5. a host of 78 or more may raise who should take their tradition on (a scene).

Then the world moves on as always, and the new year's invitations are dealt (`startYear`). Anything already done
by hand is never done again by Age Up.

### Shorter turns

With six- or three-month turns (Settings → Time per turn), "this year" is still the calendar year: something
marked in its first quarter stays done for the rest of it, and the year is finished once, at the turn of the year,
by the same Age Up code (`engine/turns.js` calls `advanceYear` then).

## Traditions

A holiday, a family reunion or visits to the grandparents can be made a family tradition (the player must be an
adult). Each records its id, founding year, founder, current host, the family who take part, the last year it was
kept, how many times, the years it was skipped, its history, and whether it is active, faded or ended.

- It is kept every year, by hand or by itself at Age Up, and never twice in a year.
- Skipped three years running, it fades; it can be brought back.
- If its host dies it passes to the player (if they take part) or to the eldest who does.
- When the player dies, the family's traditions pass to whoever carries the family on, with their history.

## Time and place

Every occasion has a first year and, where it is not universal, the countries it belongs to (`data/occasions.js`):
no prom before 1930 or outside the United States and Canada, no leavers' prom in Britain before 2000,
invitations by card before 2007 and by message after. Pathways has no historical eras yet; when it does, they
narrow these same fields rather than adding rules of their own.

## Where it lives

| What | Where |
|---|---|
| Occasions, styles, holidays, invitations, limits | `js/data/occasions.js` |
| This year, celebrating, invitations, traditions, Age Up | `js/engine/moments.js` |
| The tradition handover scene | `js/data/events/moments.js` |
| My Moments screen | `js/ui/moments.js` |
| Tests | `tests/moments.mjs` |
