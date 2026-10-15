import type { SignalChip, SignalId } from '@/lib/signals';

/**
 * The lit signals as small toggle buttons. Pressing one marks it so the HUD can
 * show its one-sentence reason; pressing it again clears it.
 */
export function SignalChips({
  chips,
  selected,
  onSelect,
}: {
  chips: readonly SignalChip[];
  selected: SignalId | null;
  onSelect: (id: SignalId | null) => void;
}) {
  return (
    <ul className="chips" aria-label="Signals">
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            className={`chip${chip.points === 0 ? ' chip-info' : ''}`}
            aria-pressed={selected === chip.id}
            onClick={() => onSelect(selected === chip.id ? null : chip.id)}
          >
            {/* The button is the 44px target; the pill inside is what you see. */}
            <span className="chip-face">
              {chip.label}
              {chip.tradeIds.length > 1 && <span className="chip-count">{chip.tradeIds.length}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
