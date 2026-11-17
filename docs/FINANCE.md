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
canceled and the balance becomes a loan. Cash can be taken out on a card for a 3% fee. The limit and rate
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

`engine/retirement.js`. A plan of the player's own, on top of any pension an employer builds for them (that
is `pensionPot` in `engine/worklife.js`, and is paid as part of the work pension). The plan is a ledger
account, paid into from the year's pay at a rate the player chooses. The pot is invested, more in shares when
young, and follows the game's market up and down. It is locked until 60; taking it early costs a quarter.
The projection shown is three scenarios and says so.

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
- **Allowance** for the player's children costs money and teaches them a little.

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

## Businesses and animals

Owning a business is `engine/business.js` (staff, partners, loans, profit tax, heirs), and the family's
animals, their costs, the vet and pet insurance are `engine/animalCare.js`. The money side here connects to
them rather than repeating them:

- what a business pays its owner arrives through the year's payroll (`engine/worklife.js`) and is booked
  once, under "Profits taken from your business"; money put into a business is not income;
- a business is not part of net worth or of the estate: it passes to an heir whole. My Money lists the
  player's businesses at roughly what their share would sell for, and opens the business screens from there;
- a divorce counts the value of the player's business stakes when dividing what the couple has, and if
  everyday money and the pension plan do not cover what is owed, the former spouse is given a share of a
  business as a partner;
- what the animals cost each year is filed under "Pets" in the budget.

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
- Card terms, insurers and premiums, pension plan rules and trust rules.
- Which countries fall under which rules for insolvency, divorce and reserved shares.
  These groupings are simplifications for play and do not describe the law of any country.
- Tax, estate tax and pensions are the game's simplified rules (`engine/systems.js`, `engine/death.js`,
  `engine/career.js`). Bank interest and investment payouts are taxed at half the income-tax rate,
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

## Added in the third round

- **Car finance** (`engine/vehicles.js`, `engine/loans.js`). A vehicle bought on finance has its loan secured
  on it, at a lower rate than an ordinary loan. Selling it pays the loan off first; a vehicle worth less than
  its loan can be sold only with the money to make up the difference. If it is taken back, the lender is
  paid first and the owner gets what is left. If it is written off, the loan is still owed.
- **Winding up an estate** (`engine/death.js`, `PROBATE`). What passes under a will costs 3% of itself to
  wind up, paid from the cash; naming an executor halves that. What passes outside the will costs nothing.
- **The finances of the people closest to the player** (`engine/npcMoney.js`). A spouse or partner, grown
  children and brothers and sisters keep fuller books: a home bought with a deposit they saved and a mortgage
  their income supports, debts when money runs out, a home sold if they sink too far, and a temperament
  that shapes how they go about it. A spouse shares the player's home and does not buy one of their own.
  Everyone further away keeps the single savings figure they always had.
- **Portraits**: people in My Money (a partner, family, heirs, the executor) appear with
  their portraits, and tapping one opens their profile.
- **A net-worth chart** in the overview, from a figure recorded at the end of every year. A move to another
  currency starts a new line, so two currencies are never drawn on one scale. Hover or tap for a year's
  value; there is also a table.

## Added in the fourth round

- **Inheriting from family** (`engine/relationships.js`). A parent's savings go to the other parent if they
  are alive, and otherwise are shared between the player and their brothers and sisters after estate tax.
  A grandparent's go to their own child, the player's parent, if living. A spouse's savings come to the
  player without estate tax. Each is recorded once, as an inheritance.
- **Payouts from investments** (`engine/market.js`, `YIELD`). Funds and steady companies pay out a share
  of their value each year; their prices grow by that much less, so the return is the same, partly as
  money. Payouts are income, taxed as they are paid, and can be reinvested instead of paid out.
- **Spreading investments** across a cautious, balanced or adventurous mix. Everything held is sold (gains
  taxed as usual) and put into the mix; no new money is put in.
- **Price lines** for each holding, from the prices the market keeps.
- **Moving a mortgage** to a cheaper rate (`remortgage`), on the record and the state of the economy, for a fee.
- **Divorce, continued** (`engine/family.js`). What is owed is paid from everyday money, then from the
  pension plan, then as a share of a business. Where what a couple has is shared equally and the marriage
  lasted five years or more, the higher earner pays the lower a share of the difference for half as many
  years as the marriage lasted. The children stay with the player, and the other parent pays toward them
  until the youngest is grown. Support ends early if either of them dies.
- **A state pension** (`engine/retirement.js`, `STATE_PENSION`) from 67, paid by the country the player
  lives in at a share of an ordinary wage there: in full after 35 years of work, less for fewer, never
  nothing. Worked out again after a move abroad.
- **Learning about money**: a book, an evening course or a financial adviser, each at a cost; a term of
  money lessons at school at 15; and a small start from the parents a child grows up with.
- **Six more money scenes**: the wedding budget (possibly on a card), saving for a baby, a partner who
  wants to retrain, a parent who needs help with bills, a child going to university, a grandparent's gift.
- **Investments for close family**: the spouse, grown children and siblings put spare money into the same
  market, more or less depending on their temperament, and sell before they borrow.
- **Payslips**: the year's pay shown as twelve monthly payslips, with tax and pension contributions taken
  off, adding up to exactly the year. The year is still booked as one transaction.
- **Ancestors' life stories** open from the Family legacy section.

## Fuller books for close family

`engine/npcMoney.js`. The spouse or partner, grown children and brothers and sisters now keep:

- **a savings account** at a bank where they live. Money beyond what they keep to hand goes in, up to what
  they like to have put by (the careful keep twice as much). It earns interest, after tax. In a hard year it
  is drawn on before investments are sold, and only then do they borrow. A house deposit can come from it.
- **a credit card**, for some of them. Whether to have one is a choice made every ten years or so, weighted
  by temperament (most of the easy-going, few of the careful) and by how lenders keep records where they
  live. Some of their spending goes on it; the careful and sensible pay it off, the easy-going pay the
  minimum and carry the rest, with interest. Two missed years and it is canceled, the balance becomes their
  debt, and no new card is offered for six years.
- **early retirement**, from 58, if what they have put by would carry them, on a pension from their years
  of work.

When the player is in trouble (overdrawn, or living on benefits), someone close who is fond of them,
generous, and able to spare three times what is needed may send money. It comes out of their own money,
and each person helps at most once every four years.

When a spouse, parent or grandparent dies, what they leave is everything they had to hand, in the bank and
invested, less their own debts and card. It is emptied as it passes, so it can pass only once.

Everyone further away still has the single savings figure they always had.

## Balance

`scripts/money-playtest.mjs` lives many lives with a simple auto-player and prints distributions, in years of
an ordinary local wage. From a run of 72 lives in 12 countries, three seeds:

| | Plain player | Careless player |
|---|---|---|
| Net worth at 40, median | about 5 years of wage | about 3 |
| Net worth at 55, median | about 14 to 15 | about 10 |
| Ever insolvent | 1 to 8% | about a third |
| Years carrying a card balance, median | 0 | 12 |

The player's careers pay a median of about 2.3 times an ordinary wage, which is why these look high in
"years of wage"; measured against their own pay, players and their relatives end up with similar wealth
(about six or seven years of their own salary by their mid-fifties). Insolvency for a plain player is no more
common than before the money systems were added, and pets make no measurable difference to it.

Fixed as a result of the playtest:

- the minimum card payment did not cover the interest, so a card paid at the minimum grew for ever; it is now
  the year's interest plus 3% of the balance (for the player and for relatives);
- relatives missed card payments while holding investments; they now sell investments first;
- relatives retired early far too easily; it now needs enough to live on until the state pension, and to make
  up a smaller early pension for twenty years;
- "Became free of debt" was recorded as a milestone every time a debt was cleared; it is now once per life.

Not money, but noticed: an auto-player that never sees a doctor dies at a median age of about 60, the same
as before these changes.

## Merged with main

When this work met main, main already had its own business system, animal care with pet insurance, a
workplace pension, a payroll for every source of income, mortgages in their own currency, and American
English. Those were kept, and the money engine was connected to them: my earlier business engine, pet costs,
pet and business insurance, and the employer share of the pension plan were removed so that nothing exists
twice. The state pension is one more line in main's payroll.

## Not built

These were in the brief and are **not** in the game:

- **A shared household ledger.** Each person close to the player keeps their own books; the household's
  combined money is not one ledger, and relatives' transactions are not itemized the way the player's are.
- **Beneficiary rules by country** beyond the reserved share for children; **deposit protection and bank failure.**
- **Pay by pay period.** Payslips show the year month by month, but pay, bills and statements are still
  posted once a year. A year in Pathways is lived as one step: something bought during a year is paid for from the next tick on, so a mortgage taken out is never
  charged for months before it existed, and nothing is pro-rated within a year either.
- **Historical eras.** The game has no lives set in the past. Banking products, cards and insurance each have
  a first year and refuse to exist before it, but period currencies, merchant banking and the like are not
  there.
- Money that changes in a scene or a screen outside the money engines is filed by the words of the journal
  line that came with it. That is a guess, and some lines end up under "Other".
