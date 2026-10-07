import {
  registerActivityListener,
  unregisterActivityListener,
  handleNotify,
} from "./modules/activity";
import { promptForApiKeyIfNeeded } from "./modules/config-file";
import { cliExists, getCliPath } from "./modules/wakatime-cli";
import { resetState as resetHeartbeatState } from "./modules/heartbeat";
import { initLocale, getString } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import {
  registerReaderEventListeners,
  unregisterReaderEventListeners,
} from "./modules/reader-events";

async function onStartup() {
  ztoolkit.log("onStartup() begin — waiting for Zotero promises...");
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);
  ztoolkit.log("onStartup() Zotero ready");

  initLocale();
  ztoolkit.log("onStartup() locale initialized");

  registerPrefs();
  ztoolkit.log("onStartup() prefs pane registered");

  registerActivityListener();
  ztoolkit.log("onStartup() activity listener registered");

  registerReaderEventListeners();
  ztoolkit.log("onStartup() reader event listeners registered");

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );
  ztoolkit.log("onStartup() main windows processed");

  addon.data.initialized = true;
  ztoolkit.log("onStartup() completed, initialized = true");
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  ztoolkit.log("onMainWindowLoad() begin");
  addon.data.ztoolkit = createZToolkit();

  const cliPath = getCliPath();
  ztoolkit.log("onMainWindowLoad() CLI path:", cliPath);

  const hasCli = await cliExists();
  ztoolkit.log("onMainWindowLoad() cliExists =", hasCli);

  if (!hasCli) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: true,
    })
      .createLine({
        text: getString("cli-not-found"),
        type: "error",
        progress: 100,
      })
      .show();
    ztoolkit.log("onMainWindowLoad() CLI not found, aborting window setup");
    return;
  }

  ztoolkit.log("onMainWindowLoad() prompting for API key if needed...");
  await promptForApiKeyIfNeeded();

  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: 3000,
  })
    .createLine({
      text: getString("startup-finish"),
      type: "success",
      progress: 100,
    })
    .show();
  ztoolkit.log("onMainWindowLoad() completed OK");
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  ztoolkit.log("onShutdown() begin");
  ztoolkit.unregisterAll();
  unregisterPrefs();
  unregisterReaderEventListeners();
  unregisterActivityListener();
  resetHeartbeatState();
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);
  await handleNotify(event, type, ids, extraData);
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

// Stable ID for the preferences pane. Using a fixed ID (instead of letting
// Zotero generate a random one) lets us unregister it reliably and keeps the
// registration idempotent.
const PREFS_PANE_ID = "zotero-wakatime-prefpane";

function registerPrefs() {
  // If a pane from a previous install is still registered (e.g. the user
  // reinstalled from file, which doesn't always run the plugin shutdown path),
  // remove it first — otherwise the preferences sidebar ends up with multiple
  // "WakaTime" entries.
  unregisterPrefs();
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    id: PREFS_PANE_ID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

function unregisterPrefs() {
  try {
    Zotero.PreferencePanes.unregister(PREFS_PANE_ID);
  } catch (error) {
    ztoolkit.log("unregisterPrefs() failed:", error);
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};
