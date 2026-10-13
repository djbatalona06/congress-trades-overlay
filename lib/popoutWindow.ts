import { browser } from 'wxt/browser';
import { POPOUT_PAGE, popoutOptions } from './popout';
import { getPopoutBounds, getPopoutWindowId, setPopoutWindowId } from './settings';

/** Opens the pop-out window, or focuses it if it is already open (one window only). */
export async function openPopout(): Promise<void> {
  const url = browser.runtime.getURL(POPOUT_PAGE);
  const id = await getPopoutWindowId();
  if (id !== null) {
    try {
      // Window ids can repeat after a restart, so check it really is our page.
      const existing = await browser.windows.get(id, { populate: true });
      if (existing.tabs?.some((tab) => tab.url === url)) {
        await browser.windows.update(id, { focused: true });
        return;
      }
    } catch {
      // The window was closed; open a new one.
    }
  }
  const created = await browser.windows.create(popoutOptions(url, await getPopoutBounds()));
  if (created?.id !== undefined) await setPopoutWindowId(created.id);
}
