import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import {
  PARTY_KEYS,
  RANGES,
  type RangeDays,
  SIZE_BANDS,
  SIZE_LABEL,
  type TradeStats,
  computeStats,
  describeChange,
  splitPeriods,
} from '@/lib/stats';
import type { CongressTrade } from '@/lib/types';

const PARTY_LABEL = { D: 'Democrat', R: 'Republican', I: 'Independent', unknown: 'Unknown' } as const;

const W = 300;
const H = 110;
const PAD_TOP = 6;
const PAD_BOTTOM = 4;

interface Row {
  key: string;
  label: string;
  count: number;
  tone: string;
}

/** Horizontal bars with the number written out, so colour is never the only signal. */
function Breakdown({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <section className="graph-block" aria-label={title}>
      <h3>{title}</h3>
      <ul className="bars">
        {rows.map((row) => (
          <li key={row.key}>
            <span className="bar-label">{row.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span
                className={`bar-fill ${row.tone}`}
                style={{ width: `${total === 0 ? 0 : (row.count / total) * 100}%` }}
              />
            </span>
            <span className="bar-count">{row.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WeeklyChart({ stats }: { stats: TradeStats }) {
  const { weekly } = stats;
  if (weekly.length === 0) {
    return <p className="graph-empty">No buys or sells dated in this range.</p>;
  }
  const max = Math.max(1, ...weekly.map((week) => Math.max(week.buys, week.sells)));
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const slot = W / weekly.length;
  const barW = Math.max(2, Math.min(14, slot / 2 - 2));
  const summary = weekly
    .map((week) => `week of ${week.weekStart}: ${week.buys} buys, ${week.sells} sells`)
    .join('; ');

  return (
    <>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Buys and sells per week. ${summary}`}
        preserveAspectRatio="none"
      >
        <line className="axis" x1="0" x2={W} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} />
        {weekly.map((week, index) => {
          const x = index * slot + slot / 2;
          const buyH = (week.buys / max) * plotH;
          const sellH = (week.sells / max) * plotH;
          return (
            <g key={week.weekStart}>
              <rect
                className="bar-buy"
                x={x - barW - 1}
                y={H - PAD_BOTTOM - buyH}
                width={barW}
                height={buyH}
              />
              <rect
                className="bar-sell"
                x={x + 1}
                y={H - PAD_BOTTOM - sellH}
                width={barW}
                height={sellH}
              />
            </g>
          );
        })}
      </svg>
      <p className="axis-labels" aria-hidden="true">
        <span>{formatDate(weekly[0]?.weekStart ?? null)}</span>
        <span>{formatDate(weekly[weekly.length - 1]?.weekStart ?? null)}</span>
      </p>
      <p className="legend">
        <span className="swatch swatch-buy" aria-hidden="true" /> Buys{' '}
        <span className="swatch swatch-sell" aria-hidden="true" /> Sells · most trades in a week: {max}
      </p>
      <details className="as-table">
        <summary>View as a table</summary>
        <table>
          <caption className="sr-only">Buys and sells per week</caption>
          <thead>
            <tr>
              <th scope="col">Week of</th>
              <th scope="col">Buys</th>
              <th scope="col">Sells</th>
            </tr>
          </thead>
          <tbody>
            {weekly.map((week) => (
              <tr key={week.weekStart}>
                <th scope="row">{formatDate(week.weekStart)}</th>
                <td>{week.buys}</td>
                <td>{week.sells}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

interface GraphPanelProps {
  ticker: string;
  trades: readonly CongressTrade[];
  /** Fixed clock for tests. */
  now?: number;
}

/**
 * Summary numbers and small charts for one stock, drawn only from the trades
 * already loaded. It adds no lookups and records nothing about the viewer.
 */
export function GraphPanel({ ticker, trades, now }: GraphPanelProps) {
  const [days, setDays] = useState<RangeDays>(90);
  const clock = now ?? Date.now();

  const { stats, previousTotal } = useMemo(() => {
    const { current, previous } = splitPeriods(trades, clock, days);
    return { stats: computeStats(current), previousTotal: previous.length };
  }, [trades, clock, days]);

  const partyRows: Row[] = PARTY_KEYS.map((key) => ({
    key,
    label: PARTY_LABEL[key],
    count: stats.byParty[key],
    tone: `tone-party-${key}`,
  }));
  const sizeRows: Row[] = SIZE_BANDS.map((key) => ({
    key,
    label: SIZE_LABEL[key],
    count: stats.bySize[key],
    tone: 'tone-size',
  }));

  return (
    <section className="graphs" aria-labelledby="graphs-title">
      <div className="graphs-head">
        <h2 id="graphs-title">Graphs for {ticker}</h2>
        <div role="group" aria-label="Date range" className="ranges">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              className="range"
              aria-pressed={days === range}
              onClick={() => setDays(range)}
            >
              {range} days
            </button>
          ))}
        </div>
      </div>

      <dl className="scorecards">
        <div>
          <dt>Trades</dt>
          <dd>{stats.total}</dd>
          <dd className="change">
            {describeChange(stats.total, previousTotal)} vs the {days} days before
          </dd>
        </div>
        <div>
          <dt>Buys / sells</dt>
          <dd>
            {stats.buys} / {stats.sells}
          </dd>
        </div>
        <div>
          <dt>Members</dt>
          <dd>{stats.members}</dd>
        </div>
      </dl>

      <section className="graph-block" aria-label="Trades per week">
        <h3>Trades per week</h3>
        <WeeklyChart stats={stats} />
      </section>
      <Breakdown title="By party" rows={partyRows} total={stats.total} />
      <Breakdown title="By size" rows={sizeRows} total={stats.total} />

      <p className="graph-note">
        Based on the {trades.length} most recent disclosures loaded for {ticker}, not the full
        history. Public STOCK Act data, filed up to 45 days after a trade.
      </p>
    </section>
  );
}
