# Money in Pathways

How the player's money is recorded, what My Money shows, what is invented, and what is not built yet.

## One book

The game keeps each balance in one place:

| What | Where it lives |
|---|---|
| Everyday money, in the currency of the country the player lives in | `player.finance.cash` |
| Money held in other currencies | `player.finance.accounts` (`engine/currency.js`) |
| Loans | `player.finance.loans` (`engine/loans.js`) |
| Mortgages | `asset.mortgage` on each property (`engine/realEstate.js`) |
| Property, vehicles, investments | `player.assets` |
| Bank accounts | the ledger, and nowhere else |

Dozens of modules change cash and debts directly, and they still do. The ledger (`state.ledger`,
`engine/ledger.js`) does not hold a second copy that could disagree. It **mirrors** them: `book()` compares the
game's balances with the ledger's and writes one balanced transaction for the difference, filed under what
caused it. It is called after each part of the year, after each thing the player does, and before every save.
Bank accounts are the other way round: their balance *is* the ledger balance.

So there is one money system. The ledger is the record of it, not a rival to it.

## The rules of the book

- **Whole numbers.** Amounts are integers in the currency's smallest unit: cents for dollars, yen for yen
  (no decimals), fils for Kuwaiti dinars (three). See `decimalsOf` in `data/money.js`. Interest is worked out
  with exact integer arithmetic.
- **Every transaction balances** in each currency. A transaction that does not is refused and changes nothing.
- **Signs.** An entry is a signed change to one account. What you hold (`wallet`, `bank`) is positive. What you
  owe (`debt`) is a negative balance. Where money came from or went (`nominal`) is negative for income and
  positive for spending. Because of this, all the accounts in a currency always add up to nothing.
- **Currencies never mix.** `Money.add` and `Money.cmp` throw if the currencies differ. An exchange goes
  through a clearing account in each currency, so both amounts (and so the rate) are kept with the transaction.
- **Once only.** A transaction with a key (`pay:2031`, `interest:bank:2:2031`) can be posted once. A closed
  year cannot be written in.
- **Transfers are not income.** Categories (`data/money.js`) are `income`, `expense` or `transfer`. Moving
  money between accounts, borrowing, repaying principal, exchanging, and buying things that are still owned are
  transfers, and are left out of money in and money out.

`audit()` checks all of this, and that the ledger agrees with the game's cash and debts. `tests/money.mjs`
runs it every year of whole lives in six countries.

### What a few things look like

| Event | Entries |
|---|---|
| A year's pay | everyday money + net · tax + tax · salary − gross |
| Borrowing 10,000 | everyday money + 10,000 · the loan − 10,000 (net worth unchanged) |
| A loan repayment | everyday money − payment · the loan + what came off it · interest + the rest |
| Moving 500 to savings | everyday money − 500 · savings + 500 |
| Buying shares | everyday money − cost · investments + cost (a transfer, not spending) |
| A rise in a share price | nothing: a gain on paper is not in the ledger |

### How long it is kept

Saves live in the browser's storage, which is small. Individual transactions are kept for five years
(`KEEP_YEARS`). Older ones are dropped, but every balance and every year's totals by category stay for the
whole life.

## Banking

`engine/banking.js`. An account is opened at a bank with a branch where the player lives, in local money, and
keeps that currency for good. If the player moves abroad the account is still there; money taken out arrives
in that currency.

- Kinds: current, savings, young saver (ages 7 to 17, with a parent or guardian as custodian, who is not an
  owner), student, high-interest savings, and two- and five-year fixed deposits.
- Interest is added month by month and posted once a year. Breaking a fixed deposit early costs a year of
  interest.
- If everyday money falls below nothing at the end of a year, money in the bank covers it before overdraft
  interest is charged or anything is sold.
- At death every account is closed into the estate, once, before the estate is counted.
- Each kind of account has a first year (`since`), so a life set before it existed is not offered it.

**Goals.** A goal is tied to one account and is reached only when that account really holds the money.
One goal to an account, so nothing is counted twice. A goal can be paused, changed or given up; a goal that
was reached stays reached.

**Budget.** The budget shows what was actually earned and spent this year, by category, from the ledger. The
player can set a yearly limit on a category and is told at the end of each year how they did. Limits do not
stop spending.

## Standing with lenders

`engine/credit.js`. Built only from things that happened: years of paying on time, going overdrawn, having
possessions sold to cover debts, bankruptcy. Countries are grouped three ways:

- **file**: a shared record, shown as a Pathways standing from 0 to 100;
- **registry**: only serious trouble is written down, and there is no number;
- **bank**: no shared record, so no standing is shown at all.

Where a record is kept, a recent forced sale or bankruptcy stops banks lending for five years.

## Credit cards

`engine/cards.js`. A card has a limit, a balance and a rate. Once a year there is a statement: interest on
what was carried over, the year's everyday spending (if the card is used for it), anything everyday money
could not cover, and then the payment, in full or the minimum, as the player has chosen. Paid in full, a card
costs nothing and returns 1%. A missed minimum costs a fee and leaves a mark; two in a row and the card is
cancelled and the balance becomes a loan. Cash can be taken out on a card for a 3% fee. The limit and rate
offered follow income and the standing with lenders. Card borrowing is never income and never adds to net
worth.

## When debts cannot be paid

`engine/loans.js`. Lenders can be asked for more time (granted once per loan, to someone who really is
struggling) and loans can be moved to a cheaper rate when the record allows. When there is nothing left,
what happens depends on the country, in three models:

- **discharge**: most debts are written off (not student loans) and no bank lends for some years;
- **plan**: a court writes off part and sets a six-year plan, without interest, for the rest;
- **none**: nothing is written off, and what could not be paid becomes arrears.

## Insurance

`engine/insurance.js`. Home, vehicle and life policies, alongside the existing health cover. When an insured
property or vehicle is damaged, the engine that did the damage records the loss. A claim can be made only
for a recorded loss on a policy that was in force, pays the loss less the excess up to the cover, and is paid
once. Premiums follow the value insured and rise after a claim; a policy that cannot be paid for lapses.
Life cover pays once: to the person named, outside the estate, or else into the estate.

## Pension plans

`engine/retirement.js`. A plan is a ledger account, paid into from the year's pay at a rate the player
chooses. Where there are workplace plans, an employer adds half as much on the first 6% while the player
holds a full-time job. The pot is invested, more in shares when young, and follows the game's market up and
down. It is locked until 60; taking it early costs a quarter. The projection shown is three scenarios and
says so. The pension earned by years of work (`engine/career.js`) is separate and unchanged.

## Money between people

`engine/family.js`.

- **Bills.** A couple can agree to pay their own way (the default, and what the game always charged), to
  split evenly, or to share by income. The partner can refuse an arrangement that is unfair to them.
- **Joint accounts.** Two owners. Where family law shares things equally, half of the balance is the
  player's; elsewhere each owns what they put in. The partner pays in from their own savings. On divorce it
  is divided by that rule; on death it passes to the other owner, outside the will.
- **Divorce.** Countries are grouped two ways: everything shared equally (the original rule), or each keeps
  their own and only joint money is divided.
- **Gifts and loans.** A gift is gone. A loan is owed back, without interest, and is counted as something
  the player is owed. People can refuse either, pay back if they are able and willing, and a loan can be
  forgiven (it becomes a gift) or lost (if they die).
- **Pocket money** for the player's children costs money and teaches them a little.

Other people's own finances are still the simple savings and job they had (`engine/npcLives.js`); what is
new is that money moving between them and the player really leaves one and reaches the other.

## Wills, trusts and what passes outside a will

- An account, a pension plan or a life policy can have a person named on it. At death it goes straight to
  them and is listed with the estate as having passed outside the will.
- `engine/trusts.js`. Money put into a trust has left the player for good and is not in their net worth. A
  trustee holds it, it grows slowly, and it is paid to the beneficiary at the age set, whether or not the
  player is alive. If the beneficiary dies first it comes back. A trust still being held when an heir takes
  over stays held in the heir's books until they reach the age.
- Where the law reserves a share for children, a will cannot leave them out: half the estate is theirs.

## Businesses

`engine/business.js`. A business is an asset with its own money (its till). Takings go into the till. The
owner receives only what they choose to take out of profit, and that is taxed as income when they do. Their
net worth counts the value of their stake, not the takings. Part of a business can be sold to an investor;
the whole can be sold; a business that runs out of money closes and costs the owner what they put in and
nothing more. An heir inherits the stake with a manager in place, and has to learn the business before they
can run it.

## Milestones, money sense and scenes

`engine/achievements.js` works out ten money milestones from what has happened in the life; none depends on
a balance alone. Money sense (0 to 100) grows from earning, budgeting, saving and getting into trouble, and
helps in scenes about bad offers and bank mistakes. `data/events/finance.js` has seven scenes; their choices
move real money through the same engines as the money screens (`engine/moneyEffects.js`).

## What is invented

- The banks, their accounts and their rates.
- The standing with lenders. It is a game measure, not a credit score, and the grouping of countries is a
  simplification for play, not a description of any country's system.
- Exchange rates, share prices and companies (as before: `engine/currency.js`, `engine/market.js`).
- Card terms, insurers and premiums, pension plan rules, trust rules, business types and their figures.
- Which countries fall under which rules for insolvency, divorce, reserved shares and workplace pensions.
  These groupings are simplifications for play and do not describe the law of any country.
- Tax, estate tax and pensions are the game's simplified rules (`engine/systems.js`, `engine/death.js`,
  `engine/career.js`). Bank interest and profit taken from a business are taxed at half the income-tax rate,
  as gains on investments already were. None of this is financial, tax or legal advice.

No real bank details are ever asked for, and nothing about a life's money leaves the device except as part
of the player's own saves.

## Old saves

A life saved before the ledger existed opens with a single entry, marked as carried over: the cash, foreign
money and debts it has today. No past income or bills are invented, and no money appears or disappears.

## The next generation

When an heir carries on, they get a new ledger that opens with their own savings and, named as such, their
share of the estate. `state.familyMoney` keeps a summary of each ancestor: what they left, what they earned,
their money milestones, their property, and who got what. Their transactions are not passed on.

## Not built

These were in the brief and are **not** in the game:

- **Historical eras.** The game has no lives set in the past. Banking products, cards and insurance each have
  a first year and refuse to exist before it, but period currencies, merchant banking and the like are not
  there.
- **Detailed finances for other people.** Family and friends keep one savings figure and a job. They do not
  have accounts, cards, loans or investments of their own, and there is no shared household ledger.
- **Pay by pay period.** Pay, bills and statements are posted once a year for the year.
- **Executors, probate costs and beneficiary rules by country** beyond the reserved share for children.
- **Pet and business insurance; deposit protection and bank failure.**
- **Secured car finance.** Buying a vehicle on finance is the existing unsecured bank loan.
- **Partners in a business as people.** An investor who buys a stake is not a character.
- **Portraits in the money screens.** People are chosen from the player's existing relationships by name;
  tapping through to their profile from My Money is not there.
- **Charts.** Bars only.
- Money that changes in a scene or a screen outside the money engines is filed by the words of the journal
  line that came with it. That is a guess, and some lines end up under "Other".
