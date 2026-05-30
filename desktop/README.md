# Symbolic Browser

A native Chromium-based desktop browser. Built on Electron.

## Run

```
npm install
npm start
```

## Build the Windows installer

```
npm install
npm run dist:win
```

The signed-but-unsigned `Symbolic Setup <version>.exe` lands in `desktop/dist/`.
Double-click it to install — users get a desktop shortcut and a Start menu
entry. The installer is NSIS-based and lets users choose an install location.

You can build on macOS or Linux instead of Windows: `electron-builder` cross-
builds the NSIS installer for Windows from either platform.

## Build other platforms

- `npm run dist:mac` → `.dmg` for macOS
- `npm run dist:linux` → `.AppImage` for Linux
- `npm run dist` → all targets supported by the host OS

All output lands in `desktop/dist/`.

## Code-signing (optional)

For Windows code-signing, set `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`
environment variables to a `.pfx` certificate and its password. Without
signing, Windows SmartScreen will warn end-users on first launch.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+L` | Focus address bar |
| `Ctrl+R` / `F5` | Reload |
| `Ctrl+D` | Bookmark current page |
| `Ctrl+H` | History page |
| `Alt+←` / `Alt+→` | Back / Forward |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Cycle tabs |
| `Ctrl+1`..`8` | Jump to tab N |
| `Ctrl+9` | Jump to last tab |

## Configuration

Edit the top of `renderer/renderer.js` and `renderer/newtab.js`:

```js
const SYMBOLIC_ORIGIN = 'http://localhost:3000';
```

Point this at your Symbolic deployment URL.

## Ad-blocker

The blocklist starts as a small seed list and is augmented with
`StevenBlack/hosts` (MIT) fetched on first run and cached in the Electron
`userData` directory. Cache refreshes weekly.
