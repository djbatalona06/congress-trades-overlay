# How the Influence list works

Written in plain words. The code is in `lib/signals.ts`, `components/InfluenceBody.tsx` and `worker/src/routes.ts`.

## What it is

A short list under the trades. It is **off** until you tick "Show tax breaks and outside money" in the Capitol Tape popup. It also needs the optional Worker (the extra data service) to be on.

## What it shows

| Part | What it means | Where it comes from |
|---|---|---|
| Tax provisions in recent laws | A person checked that a law tied to this kind of company has a tax rule in it | Congress.gov bills, checked by a person first |
| Outside spending | Money groups reported spending for or against a member who traded this stock. Every group in the race is stored, none picked by name | FEC filings |
| Lobbying on related issues | Who hired whom to lobby on issues tied to this kind of company | Senate lobbying disclosures |

Every line links to the real filing. Every group is shown with the same facts, in the same order, so no group is treated differently.

## What it never does

- It never changes Quiet, Watch or Hot. Both tags are worth 0 points.
- It never says why money was spent, how anyone voted, or what will happen.
- It never shows a tax rule nobody has checked.
- It is **not** advice about money.

## Not built yet

Checking the nightly jobs against the real sites (run `npm run verify:influence`, which needs a free FEC key), tax-flag filling and review, and the side-by-side "official record vs Bargo" view. See the status table in `2026-10-15-influence-layer-spec.md`.

## Before any of this ships

The list of IDs and codes is only trusted after `npm run verify:influence` says "clean". Even then, do not put it in the store until Bargo's written permission, a lawyer's view on 5 U.S.C. 13107, and the Senate eFD terms are all answered.
