/**
 * WakaTime CLI binary management — locate and execute wakatime-cli.
 */

const { Subprocess } = ChromeUtils.importESModule(
  "resource://gre/modules/Subprocess.sys.mjs",
);

function getCliPath(): string {
  const homeDir = Services.dirsvc.get("Home", Ci.nsIFile).path;

  let platform: string;
  if (Zotero.isWin) {
    platform = "windows";
  } else if (Zotero.isMac) {
    platform = "darwin";
  } else {
    platform = "linux";
  }

  // Zotero.arch is the supported platform API in current Zotero versions.
  const abi = String(
    (Zotero as any).arch || Services.appinfo.XPCOMABI || "",
  ).toLowerCase();
  let arch: string;
  if (abi.startsWith("aarch64") || abi.startsWith("arm64")) {
    arch = "arm64";
  } else if (abi.startsWith("x86_64") || abi.startsWith("x86-64")) {
    arch = "amd64";
  } else if (abi.startsWith("arm")) {
    arch = "arm";
  } else {
    // Default to amd64 for unknown or 32-bit x86
    arch = "amd64";
  }

  const binaryName = Zotero.isWin
    ? `wakatime-cli-${platform}-${arch}.exe`
    : `wakatime-cli-${platform}-${arch}`;

  return PathUtils.join(homeDir, ".wakatime", binaryName);
}

async function cliExists(): Promise<boolean> {
  try {
    return await IOUtils.exists(getCliPath());
  } catch {
    return false;
  }
}

async function runCli(args: string[]): Promise<{ exitCode: number }> {
  const cliPath = getCliPath();
  Zotero.debug(
    `[zotero-wakatime] runCli: path=${cliPath} args=${JSON.stringify(args)}`,
  );

  try {
    const proc = await Subprocess.call({
      command: cliPath,
      arguments: args,
    });

    Zotero.debug("[zotero-wakatime] runCli: process started");
    const { exitCode } = await proc.wait();
    Zotero.debug(
      `[zotero-wakatime] runCli: process finished, exitCode=${exitCode}`,
    );
    return { exitCode };
  } catch (e) {
    Zotero.debug(`[zotero-wakatime] runCli: EXCEPTION ${e}`);
    throw e;
  }
}

async function getCliVersion(): Promise<string> {
  const result = await runCli(["--version"]);
  if (result.exitCode === 0) {
    return "installed";
  }
  throw new Error(`wakatime-cli exited with code ${result.exitCode}`);
}

export { getCliPath, cliExists, runCli, getCliVersion };
