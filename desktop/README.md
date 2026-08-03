# Symbolic Browser

A native Chromium-based desktop browser. Built on Electron.

## Run

```
npm install
npm start
```

## Features

- Tabs with per-tab history, favicons, and session restore on relaunch
- Private tabs (in-memory session, no history recorded) — `Ctrl+Shift+N`
- Omnibox: URLs load directly, anything else searches Symbolic
- Find in page with match counter — `Ctrl+F`
- Downloads panel with progress, Open, and Show-in-folder — `Ctrl+J`
- Command palette with every browser action — `Ctrl+K`
- Reader mode (distraction-free article view) — `Ctrl+E`
- Full-page screenshot saved to Downloads — `Ctrl+Shift+S`
- Per-tab zoom — `Ctrl+=` / `Ctrl+-` / `Ctrl+0`
- Bookmarks bar (star button or `Ctrl+D`; right-click to remove)
- History page — `Ctrl+H`
- Ad/tracker blocking: seed list + StevenBlack/hosts (~150k domains),
  cached weekly, applied to normal and private sessions
- Built-in PDF viewing

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+T` | New tab |
| `Ctrl+Shift+N` | New private tab |
| `Ctrl+W` | Close tab |
| `Ctrl+L` | Focus address bar |
| `Ctrl+R` / `F5` | Reload |
| `Ctrl+F` | Find in page |
| `Ctrl+D` | Bookmark current page |
| `Ctrl+H` | History page |
| `Ctrl+J` | Downloads panel |
| `Ctrl+K` / `Ctrl+Shift+P` | Command palette |
| `Ctrl+E` | Reader mode |
| `Ctrl+Shift+S` | Screenshot page |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `Alt+←` / `Alt+→` | Back / Forward |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle tabs |
| `Ctrl+1`..`8` | Jump to tab N |
| `Ctrl+9` | Jump to last tab |
| `Esc` | Close find bar / palette / reader / downloads |

## Build the Windows installer

```
npm install
npm run dist:win
```

The `Symbolic Setup <version>.exe` lands in `desktop/dist/`. The installer is
NSIS-based, shows Symbolic-branded wizard art, and lets users choose an
install location. `npm run dist:mac` and `npm run dist:linux` produce `.dmg`
and `.AppImage`.

For Windows code-signing, set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` to a
`.pfx` certificate and its password. Without signing, Windows SmartScreen
warns end-users on first launch.

## Configuration

Edit the top of `renderer/renderer.js` and `renderer/newtab.js`:

```js
const SYMBOLIC_ORIGIN = 'http://localhost:3000';
```

Point this at your Symbolic deployment URL.

## Auto-update

Installed builds check GitHub Releases on `denrod25-del/symbolic` at every
launch, download updates in the background, and install them on quit.

To ship an update:

1. Bump `version` in this `package.json` (e.g. `0.2.0` → `0.2.1`).
2. Create a GitHub personal access token with `repo` scope, then:
   ```powershell
   $env:GH_TOKEN = "<your token>"
   npm run release
   ```
   This builds the Windows installer and uploads it (plus `latest.yml`) to a
   draft GitHub release tagged `v<version>`.
3. Publish the draft release on GitHub.

Every installed copy picks up the new version on its next launch — no manual
reinstall. Notes:

- The repository must be public (or you must host releases elsewhere) for
  installed apps to reach the update feed without credentials.
- Dev mode (`npm start`) never self-updates.

## Not built yet (deliberately)

- Password/form autofill (needs OS keychain integration)
- Cross-device sync (needs account auth on the Symbolic backend)
- Chromium extension support (multi-year effort; out of scope)
