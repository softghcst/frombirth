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

## What is invented

- The banks, their accounts and their rates.
- The standing with lenders. It is a game measure, not a credit score, and the grouping of countries is a
  simplification for play, not a description of any country's system.
- Exchange rates, share prices and companies (as before: `engine/currency.js`, `engine/market.js`).
- Tax, estate tax and pensions are the game's simplified rules (`engine/systems.js`, `engine/death.js`,
  `engine/career.js`). None of this is financial, tax or legal advice.

No real bank details are ever asked for, and nothing about a life's money leaves the device except as part
of the player's own saves.

## Old saves

A life saved before the ledger existed opens with a single entry, marked as carried over: the cash, foreign
money and debts it has today. No past income or bills are invented, and no money appears or disappears.

## The next generation

When an heir carries on, they get a new ledger that opens with their own savings and, named as such, their
share of the estate. `state.familyMoney` keeps a summary of each ancestor: what they left, what they earned,
their money milestones, their property, and who got what. Their transactions are not passed on.

## Not built yet

These were in the brief for this work and are **not** in the game:

- Credit cards, statements and minimum payments.
- Refinancing, negotiated repayment plans, and jurisdiction-specific insolvency (bankruptcy is the existing
  single rule in `engine/loans.js`).
- Joint accounts, shared household budgets, and financial arrangements on marriage and divorce.
- Separate finances for family members and other people. They keep the simple savings figure they had.
- Insurance other than the existing health cover; claims.
- Retirement accounts and contributions (pensions are the existing rule based on years worked).
- Trusts, executors, and beneficiary designations on accounts. Wills and estate tax are the existing system.
- Business ownership.
- Tax on bank interest; capital gains tax beyond the existing rule on selling investments.
- Banking before 1820, and period money for historical lives (accounts have first years, but the game has no
  historical eras yet).
- Story scenes written for money (a first paycheck is a milestone and a journal line, not a scene with
  choices), fraud and consumer-protection events, financial literacy.
- Pay is posted once a year for the year, not paycheck by paycheck.
- A change made by a scene or a button outside the money screens is filed by the words of the journal line
  that came with it. That is a guess, and some lines end up under "Other".
