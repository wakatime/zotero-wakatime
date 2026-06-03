/**
 * Reader DOM event tracking — listens to mouse, keyboard, and scroll events
 * inside PDF reader iframes and triggers WakaTime heartbeats.
 */

import { getPref } from "../utils/prefs";
import { isWindowAlive } from "../utils/window";
import { sendHeartbeat } from "./heartbeat";
import { getItemCollectionName } from "./activity";

const DOM_THROTTLE_MS = 2000; // 2 seconds
let lastDomEventTime = 0;
let notifierID: string | null = null;

interface ListenerEntry {
  iframeWin: Window;
  handler: EventListener;
}

const activeListeners = new Map<string, ListenerEntry>();

const DOC_EVENTS = ["click", "mouseup", "keydown"];
const WIN_EVENTS = ["scroll"];
const LISTENER_OPTS: AddEventListenerOptions = { capture: true, passive: true };

function registerReaderEventListeners(): void {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: (string | number)[],
      extraData: Record<string, any>,
    ) => {
      if (!addon?.data.alive) return;
      if (type === "tab" && event === "select") {
        const tabId = String(ids[0]);
        const tabData = extraData[tabId];
        if (tabData?.type === "reader") {
          await attachListenersToReader(tabId);
        }
      } else if (type === "tab" && event === "close") {
        const tabId = String(ids[0]);
        detachListenersFromReader(tabId);
      }
    },
  };

  notifierID = Zotero.Notifier.registerObserver(callback, ["tab"]);
  Zotero.debug(
    `[zotero-wakatime] reader-events: registered notifier, id=${notifierID}`,
  );

  // Attach to any already-open readers
  for (const reader of getOpenReaders()) {
    if ((reader as any).tabID) {
      attachListenersToReader((reader as any).tabID as string);
    }
  }
}

function unregisterReaderEventListeners(): void {
  if (notifierID) {
    Zotero.Notifier.unregisterObserver(notifierID);
    notifierID = null;
  }
  for (const tabId of activeListeners.keys()) {
    detachListenersFromReader(tabId);
  }
}

async function attachListenersToReader(tabId: string): Promise<void> {
  const reader = Zotero.Reader.getByTabID(tabId);
  if (!reader) return;

  // If listeners already attached and iframe is still alive, skip
  const existing = activeListeners.get(tabId);
  if (existing) {
    try {
      if (isWindowAlive(existing.iframeWin)) {
        return;
      }
    } catch {
      // Dead wrapper — fall through to cleanup
    }
    detachListenersFromReader(tabId);
  }

  // Wait for reader initialization
  try {
    await reader._initPromise;
  } catch {
    Zotero.debug(
      `[zotero-wakatime] reader-events: reader init failed for tab ${tabId}`,
    );
    return;
  }

  const innerWin = getReaderIframeWindow(reader);
  if (!innerWin || !isWindowAlive(innerWin)) {
    Zotero.debug(
      `[zotero-wakatime] reader-events: inner iframeWindow not available for tab ${tabId}`,
    );
    return;
  }

  const handler = handleReaderDomEvent as EventListener;

  for (const eventType of DOC_EVENTS) {
    innerWin.document.addEventListener(eventType, handler, LISTENER_OPTS);
  }
  for (const eventType of WIN_EVENTS) {
    innerWin.addEventListener(eventType, handler, LISTENER_OPTS);
  }

  activeListeners.set(tabId, { iframeWin: innerWin, handler });
  Zotero.debug(
    `[zotero-wakatime] reader-events: attached listeners to inner iframe for tab ${tabId}`,
  );
}

function getOpenReaders(): any[] {
  const readers = (Zotero.Reader as any)._readers;
  if (!readers) return [];
  return Array.isArray(readers) ? readers : Object.values(readers);
}

function getReaderIframeWindow(reader: any): Window | undefined {
  return (
    reader._internalReader?._primaryView?._iframeWindow ||
    reader._internalReader?._iframeWindow ||
    reader._iframeWindow
  );
}

function detachListenersFromReader(tabId: string): void {
  const entry = activeListeners.get(tabId);
  if (!entry) return;

  activeListeners.delete(tabId);

  try {
    if (!isWindowAlive(entry.iframeWin)) return;
  } catch {
    return; // Dead wrapper — nothing to remove
  }

  for (const eventType of DOC_EVENTS) {
    entry.iframeWin.document.removeEventListener(
      eventType,
      entry.handler,
      LISTENER_OPTS,
    );
  }
  for (const eventType of WIN_EVENTS) {
    entry.iframeWin.removeEventListener(
      eventType,
      entry.handler,
      LISTENER_OPTS,
    );
  }

  Zotero.debug(
    `[zotero-wakatime] reader-events: detached listeners for tab ${tabId}`,
  );
}

function handleReaderDomEvent(): void {
  // Front-end throttle
  const now = Date.now();
  if (now - lastDomEventTime < DOM_THROTTLE_MS) return;
  lastDomEventTime = now;

  if (!addon?.data.alive) return;
  if (!getPref("enable")) return;

  const win = Zotero.getMainWindow();
  if (!win) return;
  const zoteroTabs = (win as any).Zotero_Tabs as _ZoteroTypes.Zotero_Tabs;
  if (!zoteroTabs) return;

  const tabId = zoteroTabs.selectedID;
  const tabType = zoteroTabs.selectedType;
  if (tabType !== "reader") return;

  const reader = Zotero.Reader.getByTabID(tabId);
  if (!reader?.itemID) return;

  const item = Zotero.Items.get(reader.itemID as number);
  if (!item) return;

  const parentItem = item.parentItem || item;
  const title = parentItem.getField("title") as string;
  const collection = getItemCollectionName(parentItem);

  Zotero.debug(
    `[zotero-wakatime] reader-events: DOM activity, entity="${title}"`,
  );

  const category = getPref("category") || "researching";

  sendHeartbeat({
    entity: title || `item-${parentItem.id}`,
    entityType: "app",
    category,
    project: collection,
    isWrite: false,
  }).catch((e) => {
    Zotero.debug(`[zotero-wakatime] reader-events: heartbeat error: ${e}`);
  });
}

export { registerReaderEventListeners, unregisterReaderEventListeners };
