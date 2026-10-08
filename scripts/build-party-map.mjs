// Builds assets/party-map.json from the public-domain unitedstates/congress-legislators
// dataset. Bargo has no party field, so the overlay's party badge comes from here.
// Re-run after elections or special elections: `npm run party-map`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'party-map.json');

const PARTY = { Democrat: 'D', Republican: 'R' };

// Must stay in sync with normalizeName() in lib/party.ts.
function normalizeName(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE} returned ${response.status}`);
const legislators = await response.json();

const house = {};
const senate = {};
for (const legislator of legislators) {
  const term = legislator.terms.at(-1);
  const entry = { last: normalizeName(legislator.name.last), party: PARTY[term.party] ?? 'I' };
  if (term.type === 'sen') {
    (senate[term.state] ??= []).push(entry);
    continue;
  }
  const district = String(term.district ?? 0).padStart(2, '0');
  house[term.state + district] = entry;
  // At-large seats are district 0 in the dataset; sources disagree on 00 vs 01.
  if (district === '00') house[term.state + '01'] = entry;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), house, senate }));
console.log(
  `wrote ${OUT}: ${Object.keys(house).length} house keys, ${Object.values(senate).flat().length} senators`,
);
