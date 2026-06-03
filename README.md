# Zotero WakaTime

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

[WakaTime](https://wakatime.com) time tracking integration for [Zotero](https://www.zotero.org/). Automatically sends heartbeats while you read, annotate, and manage references so your research time appears on your WakaTime dashboard.

Note: This plugin is in early beta. Please report any issues or feedback when using it.

## Supported Versions

| Dependency   | Required version                           |
| ------------ | ------------------------------------------ |
| Zotero       | **7.x - 9.x**                              |
| wakatime-cli | latest (auto-detected from `~/.wakatime/`) |

> Zotero 6 and earlier are **not** supported.

### Platform support

| OS      | Architectures      | Status                    |
| ------- | ------------------ | ------------------------- |
| Windows | x86-64, arm64      | Supported                 |
| macOS   | x86-64, arm64      | Supported                 |
| Linux   | x86-64, arm64, arm | Supported, but not tested |

## Build and Installation

### Install from release (recommended)

1. Download the latest `.xpi` file from the [Releases](https://github.com/Rosayxy/zotero-wakatime/releases) page.
2. In Zotero, open **Tools → Add-ons**.
3. Click the gear icon (⚙) → **Install Add-on From File…** and select the `.xpi` file. Or just drag and drop the `.xpi` onto the Add-ons page. Then it should install and activate immediately.

### Build from source

**Prerequisites:** Node.js ≥ 18 and npm.

```bash
git clone https://github.com/Rosayxy/zotero-wakatime.git
cd zotero-wakatime
npm install
npm run build
```

This produces the zotero-waka-time.xpi file in .scaffold/build/. This is the Add-on package you can install in Zotero.

## Usage

### 1. Install wakatime-cli

The plugin delegates all API communication to the official [wakatime-cli](https://github.com/wakatime/wakatime-cli) binary. Place the appropriate binary for your platform under `~/.wakatime/`:

```
~/.wakatime/wakatime-cli-linux-amd64      # Linux x86-64
~/.wakatime/wakatime-cli-linux-arm64      # Linux arm64
~/.wakatime/wakatime-cli-darwin-amd64     # macOS Intel
~/.wakatime/wakatime-cli-darwin-arm64     # macOS Apple Silicon
~/.wakatime/wakatime-cli-windows-amd64.exe  # Windows x86-64
~/.wakatime/wakatime-cli-windows-arm64.exe  # Windows arm64
```

The easiest way to get the binary is to install any other WakaTime plugin (e.g., the VS Code extension) which will download it automatically.

### 2. Configure your API key

On first launch Zotero will prompt you for your WakaTime API key. You can also set or update it at any time in **Zotero → Settings → WakaTime**. The key is stored in `~/.wakatime.cfg` (the standard WakaTime config file shared with other editors).

### 3. Tracked activities

The plugin sends a heartbeat to WakaTime whenever you:

- **Select a library item** — the item's title becomes the entity; its first collection (or library name) becomes the project.
- **Open a PDF or EPUB** in the reader — sends a heartbeat immediately on open.
- **Interact with the PDF/EPUB reader** (click, scroll, keyboard) — throttled to at most one heartbeat every 2 seconds.
- **Add or annotate an item** (highlight, note, tag, metadata edit) — recorded as a write heartbeat.

### 4. Preferences

Open **Zotero → Settings → WakaTime** to configure:

| Setting                           | Description                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Enable WakaTime time tracking** | Master on/off switch                                                                                  |
| **API Key**                       | Your WakaTime secret API key                                                                          |
| **Default Category**              | WakaTime category reported for each heartbeat (`researching`, `learning`, `writing docs`, `browsing`) |
| **Enable debug logging**          | Writes verbose logs to `~/.wakatime/zotero-wakatime.log` and Zotero's debug console                   |

## Troubleshooting

### No time tracked on WakaTime dashboard

1. Make sure the plugin is enabled (**Settings → WakaTime → Enable WakaTime time tracking**).
2. Verify the wakatime-cli binary exists and is executable:
   ```bash
   ~/.wakatime/wakatime-cli-linux-amd64 --version   # adjust for your platform
   ```
3. Check that your API key is correct at <https://wakatime.com/settings/account>.

### "wakatime-cli not found" or no heartbeats in Zotero debug output

- Ensure the binary name matches the pattern `wakatime-cli-{platform}-{arch}[.exe]` exactly (all lowercase).
- On macOS/Linux, confirm the binary is executable: `chmod +x ~/.wakatime/wakatime-cli-*`.
- Enable debug logging and check `~/.wakatime/zotero-wakatime.log` for errors when the plugin tries to send a heartbeat. Also check the Zotero debug console (**Help → Debug Output Logging**) for related messages.

### Enabling debug logs

Turn on **Enable debug logging** in preferences. Heartbeat attempts and CLI exit codes are written to:

- `~/.wakatime/zotero-wakatime.log`
- Zotero's built-in debug console (**Help → Debug Output Logging**)

### Filing a bug report

Please open an issue at <https://github.com/Rosayxy/zotero-wakatime/issues> and include:

- Zotero version (`Help → About Zotero`)
- Operating system and architecture
- Contents of `~/.wakatime/zotero-wakatime.log` (with debug logging enabled)

## License

[GNU Affero General Public License v3.0](LICENSE)
