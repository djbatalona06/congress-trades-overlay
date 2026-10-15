# How the signal box works

Written in plain words. The code is in `lib/signals.ts`, and `tests/signals.test.ts` checks every rule below.

## The idea

Capitol Tape already knows the forms Congress members filed for a stock. The signal box looks at those forms and asks a few simple questions. Each "yes" lights a tag and adds points. The points add up to **Quiet**, **Watch** or **Hot**.

Nothing here uses the internet. It is only counting and comparing dates on your own computer.

## Which forms count

Only forms that were made public in the **last 90 days**. A form with no usable date is skipped. We never guess a date.

## The questions

| Tag | Question it asks | Points |
|---|---|---|
| Cluster buy | Did 3 or more **different** members buy within 30 days of each other? | 3 |
| Cluster sell | Same question, for selling. | 3 |
| Both parties buying | Did a Democrat and a Republican both buy within 30 days of each other? | 2 |
| Big trade | Did a form's range go **above** $250,000? | 1 |
| Fresh filing | Was a form made public in the last 7 days? | 1 |
| Policy nearby | Did a related bill or presidential order move within 30 days of a trade? (needs the extra data from the optional Worker) | 1 |
| Filed late | Did a form arrive more than 45 days after the trade? | 0 (information only) |

One member filing three times still counts as **one** member for a cluster.

## From points to a level

| Points | Level |
|---|---|
| 0 or 1 | Quiet |
| 2 to 4 | Watch |
| 5 or more | Hot |

## What it cannot tell you

- Forms can arrive up to 45 days after a trade, so "Hot" can be old news by the time you see it.
- Forms give a **range** (like $15,001 - $50,000), not an exact amount.
- Members of Congress, or their families, trade for many reasons. A busy stock does not mean it is a good or bad buy.
- This is **not** advice about money. Ask a grown-up you trust before you spend money on stocks.

## Pro alerts

Pro users get a message when a stock on their watchlist **turns Hot**. The check runs inside the hourly watchlist check that already exists, so it adds no extra look-ups. The first time a stock is checked it only sets a starting point: a stock that is already Hot is not news.

## Changing the rules

All the numbers (30 days, 3 members, $250,000, 7 days, 45 days, 90 days, 2 and 5 points) are named constants at the top of `lib/signals.ts`. Change one, run `npm test`, and the test that fails shows you what you changed.
