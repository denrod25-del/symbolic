'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const { SEED_HOSTS, loadBlockedHosts } = require('./adblock');

const PARTITION = 'persist:symbolic';
const PRIVATE_PARTITION = 'symbolic-private';

app.setName('Symbolic');

ipcMain.on('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});

ipcMain.on('save-screenshot', (_event, dataUrl) => {
  if (
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:image/png;base64,')
  ) {
    return;
  }
  const base64 = dataUrl.slice('data:image/png;base64,'.length);
  const file = path.join(
    app.getPath('downloads'),
    `symbolic-screenshot-${Date.now()}.png`
  );
  try {
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
    shell.showItemInFolder(file);
  } catch {
    // Best-effort; nothing to surface if the disk write fails.
  }
});

ipcMain.on('open-download', (_event, filePath) => {
  if (typeof filePath === 'string' && filePath) {
    shell.openPath(filePath);
  }
});

ipcMain.on('show-download', (_event, filePath) => {
  if (typeof filePath === 'string' && filePath) {
    shell.showItemInFolder(filePath);
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

const uniqueSavePath = (filename) => {
  const dir = app.getPath('downloads');
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${stem} (${counter})${ext}`);
    counter += 1;
  }
  return candidate;
};

let downloadSeq = 0;

const wireDownloads = (ses) => {
  ses.on('will-download', (_event, item) => {
    downloadSeq += 1;
    const id = `dl-${downloadSeq}`;
    item.setSavePath(uniqueSavePath(item.getFilename()));

    const send = (state) => {
      const [win] = BrowserWindow.getAllWindows();
      if (win) {
        win.webContents.send('download', {
          id,
          filename: item.getFilename(),
          path: item.getSavePath(),
          received: item.getReceivedBytes(),
          total: item.getTotalBytes(),
          state,
        });
      }
    };

    send('progressing');
    item.on('updated', (_ev, state) => send(state));
    item.once('done', (_ev, state) => send(state));
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
    icon: path.join(
      __dirname,
      'build',
      process.platform === 'win32' ? 'icon.ico' : 'icon.png'
    ),
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
  const normal = session.fromPartition(PARTITION);
  const priv = session.fromPartition(PRIVATE_PARTITION);
  setupAdblock(normal);
  setupAdblock(priv);
  wireDownloads(normal);
  wireDownloads(priv);
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

// Browser-level shortcuts, forwarded to the chrome renderer even when a page
// (webview) holds keyboard focus. Single-character keys are stored lowercase.
const HOST_SHORTCUTS = new Set([
  't',
  'w',
  'l',
  'r',
  'd',
  'h',
  'f',
  'j',
  'k',
  'e',
  'n',
  'p',
  's',
  '=',
  '+',
  '-',
  '0',
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

const normalizeKey = (key) => (key.length === 1 ? key.toLowerCase() : key);

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      const [win] = BrowserWindow.getAllWindows();
      if (win) {
        win.webContents.send('open-tab', url);
      }
      return { action: 'deny' };
    });

    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') {
        return;
      }
      const ctrl = input.control || input.meta;
      const key = normalizeKey(input.key);
      const isShortcut =
        (ctrl && HOST_SHORTCUTS.has(key)) ||
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
