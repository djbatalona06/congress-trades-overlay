import { type KeyboardEvent, useRef } from 'react';

export interface TabDef<Id extends string> {
  id: Id;
  label: string;
}

export const tabId = (id: string) => `tab-${id}`;
export const PANEL_ID = 'popup-panel';

interface TabsProps<Id extends string> {
  tabs: readonly TabDef<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
}

/**
 * Accessible tab bar (WAI-ARIA tabs pattern, automatic activation): Left/Right
 * move and select, Home/End jump to the ends, Tab leaves the bar. Only the
 * selected tab is in the tab order (roving tabIndex).
 */
export function Tabs<Id extends string>({ tabs, selected, onSelect }: TabsProps<Id>) {
  const refs = useRef(new Map<Id, HTMLButtonElement>());

  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (next === null) return;
    const target = tabs[next];
    if (!target) return;
    event.preventDefault();
    onSelect(target.id);
    refs.current.get(target.id)?.focus();
  };

  return (
    <nav aria-label="Popup sections">
      <div role="tablist" className="tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) refs.current.set(tab.id, element);
              else refs.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            className="tab"
            aria-selected={tab.id === selected}
            aria-controls={PANEL_ID}
            tabIndex={tab.id === selected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => move(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
