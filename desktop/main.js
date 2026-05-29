'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 480,
    backgroundColor: '#0a0a0f',
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

app.on('web-contents-created', (_event, contents) => {
  // Route popups (target=_blank, window.open) from a page into a new tab
  // instead of spawning a native Chromium window.
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      const [win] = BrowserWindow.getAllWindows();
      if (win) {
        win.webContents.send('open-tab', url);
      }
      return { action: 'deny' };
    });
    return;
  }

  // The host renderer is the app shell; only <webview> guests load remote
  // content, so any other navigation opens in the system browser.
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});
