import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { LEGISLATORS_URL, fetchIeSpend, fetchOfficialIssueCodes, fetchRecentFilings, toMemberLinks } from '../../worker/src/ingest';
import { ALL_ISSUE_CODES } from '../../worker/src/sectors';
import { type VerifyReport, reportIsClean, verifyInfluence } from '../../worker/src/verify';

/**
 * Checks every id and code against the official sites and writes the result to
 * docs/influence-verification-<date>.md. It only reads; it changes nothing.
 *
 *   FEC_API_KEY=... npm run verify:influence      (VERIFY_MEMBERS=40 sets the member sample)
 */
const key = process.env.FEC_API_KEY;
const sample = Number(process.env.VERIFY_MEMBERS ?? 40);

const row = (check: VerifyReport['members']) =>
  `${check.matched}/${check.checked} matched, ${check.mismatched.length} wrong name, ${check.unreachable.length} not found`;

it('verifies FEC ids, committee ids and lobbying issue codes against the official sites', async () => {
  if (!key) throw new Error('Set FEC_API_KEY (a free api.data.gov key) first. The shared DEMO_KEY is too small for this.');
  const now = Date.now();

  const legislators = await (await fetch(LEGISLATORS_URL)).json();
  const links = toMemberLinks(legislators);
  expect(links.length, 'no member links built from the legislators list').toBeGreaterThan(0);

  // An even spread across the list, so the sample is not just the A's.
  const step = Math.max(1, Math.floor(links.length / sample));
  const chosen = links.filter((_, i) => i % step === 0).slice(0, sample);

  const committees = new Map<string, string>();
  let received = 0;
  let parsed = 0;
  for (const link of chosen) {
    const result = await fetchIeSpend(link, key, now);
    received += result.received;
    parsed += result.rows.length;
    for (const r of result.rows) committees.set(r.committee_id, r.committee_name);
  }

  const officialIssueCodes = await fetchOfficialIssueCodes(process.env.LDA_API_TOKEN);
  const wanted = new Set(ALL_ISSUE_CODES.filter((c) => officialIssueCodes.includes(c)));
  const filings = await fetchRecentFilings(new Date(now - 30 * 864e5).toISOString().slice(0, 19) + 'Z', wanted, 1, now, process.env.LDA_API_TOKEN);

  const report = await verifyInfluence(
    {
      members: chosen.map((l) => ({ id: l.fec_candidate_id, name: l.member_slug })),
      committees: [...committees].map(([id, name]) => ({ id, name })),
      officialIssueCodes,
      tradeMembers: [],
      linkedMembers: [],
    },
    key,
  );

  const day = new Date(now).toISOString().slice(0, 10);
  const lines = [
    `# Influence verification, ${day}`,
    '',
    'Evidence for Phase 0. Produced by `npm run verify:influence`, which only reads the official sites.',
    '',
    `- Member FEC ids (sample of ${chosen.length} of ${links.length}): ${row(report.members)}`,
    `- Committee ids seen in their spending: ${row(report.committees)}`,
    `- Spending rows: ${received} received, ${parsed} kept (${received - parsed} dropped as unusable)`,
    `- Lobbying issue codes: ${report.issueCodes.official} official, ${report.issueCodes.proposed} proposed, missing: ${report.issueCodes.missing.join(', ') || 'none'}`,
    `- Lobbying filings read on the first page: ${filings.received} received, ${filings.rows.length} kept`,
    `- Result: **${reportIsClean(report) ? 'clean' : 'NOT clean, a person must read the list below'}**`,
    '',
    '## Wrong names',
    ...[...report.members.mismatched, ...report.committees.mismatched].map((m) => `- ${m.id}: expected "${m.expected}", official source says "${m.found}"`),
    '',
    '## Not found',
    ...[...report.members.unreachable, ...report.committees.unreachable].map((id) => `- ${id}`),
    '',
    'Reminder: the Bargo permission, counsel on 5 U.S.C. 13107 and the Senate eFD terms are still open. Do not ship this data to the store until they are answered.',
    '',
  ];
  mkdirSync('docs', { recursive: true });
  writeFileSync(`docs/influence-verification-${day}.md`, lines.join('\n'));

  expect(received, 'the FEC returned no spending rows at all, so the field names are unchecked').toBeGreaterThan(0);
  expect(parsed / Math.max(received, 1), 'most rows were dropped: the parser field names probably do not match').toBeGreaterThan(0.5);
  expect(reportIsClean(report), `see docs/influence-verification-${day}.md`).toBe(true);
});
