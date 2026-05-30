'use strict';

const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const { SEED_HOSTS, loadBlockedHosts } = require('./adblock');

const PARTITION = 'persist:symbolic';

app.setName('Symbolic');

ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});

let blockedSet = new Set(SEED_HOSTS);

const isBlockedHost = (hostname) => {
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (blockedSet.has(parts.slice(i).join('.'))) {
      return true;
    }
  }
  return false;
};

const setupAdblock = (ses) => {
  ses.webRequest.onBeforeRequest(
    { urls: ['<all_urls>'] },
    (details, callback) => {
      try {
        if (isBlockedHost(new URL(details.url).hostname)) {
          callback({ cancel: true });
          return;
        }
      } catch {
        // fall through
      }
      callback({});
    }
  );
};

const refreshBlocklistAsync = () => {
  loadBlockedHosts(app.getPath('userData'))
    .then((next) => {
      blockedSet = next;
    })
    .catch(() => {
      // Keep the seed list.
    });
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: '#0a0a0f',
    title: 'Symbolic',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
};

app.whenReady().then(() => {
  setupAdblock(session.fromPartition(PARTITION));
  refreshBlocklistAsync();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const HOST_SHORTCUTS = new Set([
  't',
  'w',
  'l',
  'r',
  'd',
  'h',
  'Tab',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
]);

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      const [win] = BrowserWindow.getAllWindows();
      if (win) {
        win.webContents.send('open-tab', url);
      }
      return { action: 'deny' };
    });

    // Forward browser-level shortcuts back to the host renderer so they
    // still fire when a page (not the chrome) has keyboard focus.
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') {
        return;
      }
      const ctrl = input.control || input.meta;
      const isShortcut =
        (ctrl && HOST_SHORTCUTS.has(input.key)) ||
        (input.alt &&
          (input.key === 'ArrowLeft' || input.key === 'ArrowRight')) ||
        input.key === 'F5';
      if (!isShortcut) {
        return;
      }
      event.preventDefault();
      const [win] = BrowserWindow.getAllWindows();
      if (win) {
        win.webContents.send('shortcut', {
          key: input.key,
          ctrl: !!ctrl,
          shift: !!input.shift,
          alt: !!input.alt,
        });
      }
    });
    return;
  }

  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});
