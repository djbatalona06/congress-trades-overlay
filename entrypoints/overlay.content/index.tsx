import './style.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ContentScriptContext } from '#imports';
import { requestTrades } from '@/lib/messaging';
import { CONTENT_SCRIPT_MATCHES, type Detection, detect } from '@/lib/platforms';
import type { TradesResponse } from '@/lib/types';
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

function useTrades(ticker: string | null): TradesResponse | null {
  const [response, setResponse] = useState<TradesResponse | null>(null);

  useEffect(() => {
    setResponse(null);
    if (!ticker) return;
    let cancelled = false;
    // Rejects when the extension was reloaded under an open tab; the panel just stays hidden.
    requestTrades(ticker).then(
      (result) => !cancelled && setResponse(result),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return response?.ticker === ticker ? response : null;
}

function App({ ctx }: { ctx: ContentScriptContext }) {
  const detection = useDetection(ctx);
  const response = useTrades(detection?.ticker ?? null);
  if (!detection || !response) return null;
  return <Overlay key={detection.ticker} detection={detection} response={response} />;
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
