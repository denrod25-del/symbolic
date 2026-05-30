# Symbolic Mobile

The Symbolic browser for iOS and Android. Built with Expo + React Native
+ `react-native-webview`.

## Run on your phone (fastest path)

You don't need Xcode or Android Studio for development — Expo Go on your
phone runs the JS bundle live over Wi-Fi.

1. Install [Expo Go](https://expo.dev/client) on your iPhone or Android.
2. From this folder:
   ```
   npm install
   npm start
   ```
3. Scan the QR code in the terminal with your phone camera (iOS) or with
   Expo Go (Android).

Edits to `App.tsx` reload on the phone within seconds.

## Build native binaries

The cloud build service (no Mac required for iOS):

```
npm install -g eas-cli
eas login
npm run build:android   # → .aab and .apk
npm run build:ios       # → .ipa (requires an Apple Developer account)
```

Or build locally if you have the SDKs installed:

```
npm run android
npm run ios
```

## Configuration

Edit `src/config.ts`:

```ts
export const SYMBOLIC_ORIGIN = 'https://your-symbolic-domain.com';
```

This is where omnibox searches go and what the "Symbolic" shortcut opens.

## Architecture

- `App.tsx` — tabs, omnibox, WebView container, the bottom navigation, the
  three modal sheets.
- `src/NewTab.tsx` — the symbolic://newtab start page.
- `src/TabsScreen.tsx`, `BookmarksScreen.tsx`, `HistoryScreen.tsx` — modals.
- `src/storage.ts` — bookmarks + history persisted via AsyncStorage.
- `src/url.ts` — URL/search-query detection (shared logic with the desktop
  build).

## Known limitations

- iOS WebView uses Apple's WKWebView; Android uses Chromium. Both load real
  web pages, but you can't intercept network requests like on desktop, so
  there's **no ad-blocker on mobile**. Adding one requires either a custom
  native module or a proxy in your JS.
- No incognito / private browsing yet.
- No tab restoration on app relaunch (tabs are in-memory).
