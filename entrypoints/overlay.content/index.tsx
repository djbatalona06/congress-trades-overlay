import './style.css';
import './hud.css';
import '@/components/trades.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContentScriptContext } from '#imports';
import { useTrades } from '@/components/useTrades';
import { setCurrentTicker } from '@/lib/settings';
import { CONTENT_SCRIPT_MATCHES, type Detection, detect } from '@/lib/platforms';
import { Hud } from './Hud';
import { Overlay } from './Overlay';

const RECHECK_DELAY_MS = 400;

function detectNow(): Detection | null {
  return detect(new URL(window.location.href), document);
}

/**
 * Tracks the symbol on screen. These sites change symbol without a page load:
 * the URL watcher covers route changes, and the <head> observer covers
 * TradingView, where switching symbol in a chart only changes the title.
 */
function useDetection(ctx: ContentScriptContext): Detection | null {
  const [detection, setDetection] = useState(detectNow);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      timer = undefined;
      const next = detectNow();
      setDetection((current) =>
        current?.ticker === next?.ticker && current?.bond === next?.bond ? current : next,
      );
    };
    // The chart title ticks with every price update, so checks are throttled, not debounced.
    const schedule = () => {
      timer ??= setTimeout(check, RECHECK_DELAY_MS);
    };

    ctx.addEventListener(window, 'wxt:locationchange', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ctx]);

  return detection;
}

/**
 * Publishes the symbol on screen so the pop-out window can follow it. Only the
 * tab the user is looking at writes, and a tab that becomes visible writes again.
 */
function usePublishTicker(detection: Detection | null) {
  useEffect(() => {
    if (!detection) return;
    const publish = () => {
      if (document.visibilityState !== 'visible') return;
      void setCurrentTicker({
        ticker: detection.ticker,
        bond: detection.bond,
        platform: detection.platform,
        at: Date.now(),
      });
    };
    publish();
    document.addEventListener('visibilitychange', publish);
    return () => document.removeEventListener('visibilitychange', publish);
  }, [detection]);
}

function App({ ctx }: { ctx: ContentScriptContext }) {
  const detection = useDetection(ctx);
  usePublishTicker(detection);
  const response = useTrades(detection?.ticker ?? null);
  if (!detection || !response) return null;
  return (
    <>
      <Overlay key={detection.ticker} detection={detection} response={response} />
      <Hud key={detection.ticker} ticker={detection.ticker} response={response} />
    </>
  );
}

export default defineContentScript({
  matches: CONTENT_SCRIPT_MATCHES,
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'congress-trades-overlay',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const root = createRoot(container);
        root.render(<App ctx={ctx} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
