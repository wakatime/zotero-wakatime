/**
 * WakaTime config file management (~/.wakatime.cfg).
 * Provides minimal INI parsing for reading/writing the API key.
 */

import { getString } from "../utils/locale";

function getConfigFilePath(): string {
  const homeDir = Services.dirsvc.get("Home", Ci.nsIFile).path;
  return PathUtils.join(homeDir, ".wakatime.cfg");
}

async function readConfig(): Promise<Map<string, Map<string, string>>> {
  const configPath = getConfigFilePath();
  const config = new Map<string, Map<string, string>>();

  try {
    const content = await IOUtils.readUTF8(configPath);
    let currentSection = "";

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        currentSection = trimmed.slice(1, -1);
        if (!config.has(currentSection)) {
          config.set(currentSection, new Map());
        }
      } else if (
        trimmed &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith(";") &&
        trimmed.includes("=")
      ) {
        const eqIndex = trimmed.indexOf("=");
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        if (!config.has(currentSection)) {
          config.set(currentSection, new Map());
        }
        config.get(currentSection)!.set(key, value);
      }
    }
  } catch {
    // File doesn't exist yet — return empty config
  }

  return config;
}

function serializeConfig(config: Map<string, Map<string, string>>): string {
  const lines: string[] = [];

  for (const [section, entries] of config) {
    if (section) {
      lines.push(`[${section}]`);
    }
    for (const [key, value] of entries) {
      lines.push(`${key} = ${value}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function getApiKey(): Promise<string | null> {
  const config = await readConfig();
  const settings = config.get("settings");
  if (settings) {
    const key = settings.get("api_key");
    if (key) return key;
  }
  return null;
}

async function setApiKey(apiKey: string): Promise<void> {
  const config = await readConfig();

  if (!config.has("settings")) {
    config.set("settings", new Map());
  }
  config.get("settings")!.set("api_key", apiKey);

  const configPath = getConfigFilePath();
  await IOUtils.writeUTF8(configPath, serializeConfig(config));
}

/**
 * Whether nobody can answer a modal dialog (CI, Zotero's automated tests).
 * `Services.prompt.prompt` blocks the main thread until the dialog is
 * dismissed, which used to leave headless CI runs hanging until the job hit
 * GitHub's 6 hour limit.
 */
function isUnattendedEnvironment(): boolean {
  if ((Zotero as unknown as { automatedTest?: boolean }).automatedTest) {
    return true;
  }
  try {
    return Services.env.get("CI") === "true";
  } catch {
    // `Services.env` is unavailable on older Zotero builds.
    return false;
  }
}

async function promptForApiKeyIfNeeded(): Promise<void> {
  if (isUnattendedEnvironment()) return;

  const apiKey = await getApiKey();
  if (apiKey) return;

  const win = Zotero.getMainWindow();
  if (!win) return;

  const ps = Services.prompt;
  const input = { value: "" };
  const result = ps.prompt(
    win as unknown as mozIDOMWindowProxy,
    getString("apikey-prompt-title"),
    getString("apikey-prompt-message"),
    input,
    null as unknown as string,
    { value: false },
  );

  if (result && input.value) {
    await setApiKey(input.value.trim());
    new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: true,
      closeTime: 3000,
    })
      .createLine({
        text: getString("apikey-saved"),
        type: "success",
        progress: 100,
      })
      .show();
  }
}

export {
  getConfigFilePath,
  readConfig,
  getApiKey,
  setApiKey,
  promptForApiKeyIfNeeded,
};
