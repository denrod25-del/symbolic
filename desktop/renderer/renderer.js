'use strict';

const SYMBOLIC_ORIGIN = 'https://symbolic-bsymbolic.vercel.app';
const NEW_TAB_URL = 'newtab.html';
const HISTORY_URL = 'history.html';
const BOOKMARKS_KEY = 'symbolic_bookmarks';
const RECENT_KEY = 'symbolic_recent';
const HISTORY_KEY = 'symbolic_history';
const SESSION_KEY = 'symbolic_session';
const RECENT_LIMIT = 10;
const HISTORY_LIMIT = 500;
const ZOOM_MIN = -6;
const ZOOM_MAX = 8;

const tabsEl = document.querySelector('#tabs');
const viewsEl = document.querySelector('#views');
const omnibox = document.querySelector('#omnibox');
const omniboxForm = document.querySelector('#omnibox-form');
const privateBadge = document.querySelector('#private-badge');
const backBtn = document.querySelector('#back');
const forwardBtn = document.querySelector('#forward');
const reloadBtn = document.querySelector('#reload');
const homeBtn = document.querySelector('#home');
const newTabBtn = document.querySelector('#new-tab');
const newPrivateTabBtn = document.querySelector('#new-private-tab');
const addBookmarkBtn = document.querySelector('#add-bookmark');
const downloadsBtn = document.querySelector('#downloads-btn');
const paletteBtn = document.querySelector('#palette-btn');
const openExternalBtn = document.querySelector('#open-external');
const bookmarksListEl = document.querySelector('#bookmarks-list');
const findbar = document.querySelector('#findbar');
const findInput = document.querySelector('#find-input');
const findCount = document.querySelector('#find-count');
const downloadsPanel = document.querySelector('#downloads-panel');
const downloadsList = document.querySelector('#downloads-list');
const palette = document.querySelector('#palette');
const paletteInput = document.querySelector('#palette-input');
const paletteList = document.querySelector('#palette-list');
const reader = document.querySelector('#reader');
const readerTitle = document.querySelector('#reader-title');
const readerBody = document.querySelector('#reader-body');

const tabs = [];
const downloads = new Map();
let activeId = null;
let seq = 0;
let paletteSelection = 0;
let restoring = true;

const isUrlLike = (input) => {
  if (/^https?:\/\//i.test(input)) {
    return true;
  }
  if (/\s/.test(input)) {
    return false;
  }
  const host = input.split(/[/?#]/)[0] ?? '';
  return host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
};

const resolveInput = (input) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return NEW_TAB_URL;
  }
  if (isUrlLike(trimmed)) {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  return `${SYMBOLIC_ORIGIN}/search?q=${encodeURIComponent(trimmed)}`;
};

const isNewTabUrl = (url) =>
  !url || (url.startsWith('file://') && url.includes('newtab.html'));

const isInternalUrl = (url) => !url || url.startsWith('file://');

const activeTab = () => tabs.find((tab) => tab.id === activeId);

const safeJsonParse = (raw, fallback) => {
  try {
    return JSON.parse(raw ?? '') ?? fallback;
  } catch {
    return fallback;
  }
};

const loadBookmarks = () =>
  safeJsonParse(localStorage.getItem(BOOKMARKS_KEY), []);

const saveBookmarks = (list) => {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
};

const loadRecent = () => safeJsonParse(localStorage.getItem(RECENT_KEY), []);

const recordSearch = (query) => {
  const trimmed = query.trim();
  if (!trimmed) {
    return;
  }
  const next = [trimmed, ...loadRecent().filter((q) => q !== trimmed)].slice(
    0,
    RECENT_LIMIT
  );
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
};

const loadHistory = () => safeJsonParse(localStorage.getItem(HISTORY_KEY), []);

const recordHistory = (url, title) => {
  if (isInternalUrl(url)) {
    return;
  }
  const list = loadHistory();
  list.unshift({ url, title, visitedAt: Date.now() });
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(list.slice(0, HISTORY_LIMIT))
  );
};

const saveSession = () => {
  if (restoring) {
    return;
  }
  const persisted = tabs.filter((tab) => !tab.isPrivate);
  const activeIndex = persisted.findIndex((tab) => tab.id === activeId);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      urls: persisted.map((tab) => tab.url || NEW_TAB_URL),
      active: Math.max(0, activeIndex),
    })
  );
};

const syncActive = () => {
  const tab = activeTab();
  if (!tab) {
    return;
  }
  if (document.activeElement !== omnibox) {
    omnibox.value = isNewTabUrl(tab.url) ? '' : tab.url;
  }
  privateBadge.hidden = !tab.isPrivate;
  backBtn.disabled = !(tab.ready && tab.view.canGoBack());
  forwardBtn.disabled = !(tab.ready && tab.view.canGoForward());
  reloadBtn.classList.toggle('loading', tab.loading);
  openExternalBtn.disabled = isNewTabUrl(tab.url);
  addBookmarkBtn.disabled = isNewTabUrl(tab.url);
};

const renderTabs = () => {
  tabsEl.innerHTML = '';
  for (const tab of tabs) {
    const el = document.createElement('div');
    let className = tab.id === activeId ? 'tab active' : 'tab';
    if (tab.isPrivate) {
      className += ' private';
    }
    el.className = className;
    el.addEventListener('click', () => {
      setActive(tab.id);
    });

    if (tab.favicon) {
      const icon = document.createElement('img');
      icon.className = 'tab-icon';
      icon.src = tab.favicon;
      el.append(icon);
    }

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title ?? 'New Tab';
    el.append(title);

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close tab');
    close.textContent = '✕';
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });
    el.append(close);

    tabsEl.append(el);
  }
  saveSession();
};

const renderBookmarks = () => {
  const list = loadBookmarks();
  bookmarksListEl.innerHTML = '';
  for (const bm of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bookmark';
    btn.title = bm.url;
    let label = bm.title?.trim() || '';
    if (!label) {
      try {
        label = new URL(bm.url).hostname.replace(/^www\./, '');
      } catch {
        label = bm.url;
      }
    }
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const tab = activeTab();
      if (tab) {
        tab.view.src = bm.url;
      }
    });
    btn.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      saveBookmarks(loadBookmarks().filter((b) => b.url !== bm.url));
      renderBookmarks();
    });
    bookmarksListEl.append(btn);
  }
};

const addCurrentBookmark = () => {
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url)) {
    return;
  }
  const list = loadBookmarks();
  if (list.some((b) => b.url === tab.url)) {
    return;
  }
  list.push({ url: tab.url, title: tab.title });
  saveBookmarks(list);
  renderBookmarks();
};

function setActive(id) {
  const previous = activeTab();
  if (previous && previous.id !== id) {
    closeFindBar();
    closeReader();
  }
  activeId = id;
  for (const tab of tabs) {
    tab.view.style.display = tab.id === id ? 'flex' : 'none';
  }
  renderTabs();
  syncActive();
}

function applyZoom(tab) {
  if (tab.ready) {
    tab.view.setZoomLevel(tab.zoom);
  }
}

function wireWebview(tab) {
  const { view } = tab;

  view.addEventListener('dom-ready', () => {
    tab.ready = true;
    applyZoom(tab);
    if (tab.id === activeId) {
      syncActive();
    }
  });
  view.addEventListener('page-title-updated', (event) => {
    tab.title = event.title;
    renderTabs();
  });
  view.addEventListener('page-favicon-updated', (event) => {
    tab.favicon = event.favicons[0] ?? '';
    renderTabs();
  });
  view.addEventListener('did-start-loading', () => {
    tab.loading = true;
    if (tab.id === activeId) {
      syncActive();
    }
  });
  view.addEventListener('did-stop-loading', () => {
    tab.loading = false;
    if (tab.id === activeId) {
      syncActive();
    }
  });
  view.addEventListener('found-in-page', (event) => {
    if (tab.id !== activeId) {
      return;
    }
    const { activeMatchOrdinal, matches } = event.result;
    findCount.textContent =
      matches > 0 ? `${activeMatchOrdinal}/${matches}` : 'No matches';
  });

  const onNavigate = (event) => {
    if (event.isMainFrame === false) {
      return;
    }
    tab.url = event.url;
    if (isNewTabUrl(event.url)) {
      tab.title = 'New Tab';
      tab.favicon = '';
    } else if (!tab.isPrivate) {
      recordHistory(event.url, tab.title);
    }
    if (tab.id === activeId) {
      syncActive();
    }
    renderTabs();
  };
  view.addEventListener('did-navigate', onNavigate);
  view.addEventListener('did-navigate-in-page', onNavigate);
}

function createTab(options = {}) {
  seq += 1;
  const id = `t${seq}`;
  const view = document.createElement('webview');
  view.className = 'webview';
  view.setAttribute(
    'partition',
    options.isPrivate ? 'symbolic-private' : 'persist:symbolic'
  );
  view.setAttribute('allowpopups', '');
  view.setAttribute('plugins', '');
  view.src = options.url || NEW_TAB_URL;
  viewsEl.append(view);

  const tab = {
    id,
    view,
    title: options.isPrivate ? 'Private Tab' : 'New Tab',
    url: options.url || '',
    favicon: '',
    loading: false,
    ready: false,
    zoom: 0,
    isPrivate: !!options.isPrivate,
  };
  tabs.push(tab);
  wireWebview(tab);
  setActive(id);

  if (!options.url) {
    omnibox.focus();
  }
  return tab;
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) {
    return;
  }
  const [removed] = tabs.splice(index, 1);
  removed.view.remove();

  if (tabs.length === 0) {
    createTab();
    return;
  }
  if (activeId === id) {
    const next = tabs[Math.max(0, index - 1)];
    setActive(next.id);
  } else {
    renderTabs();
  }
}

const cycleTab = (delta) => {
  if (tabs.length === 0) {
    return;
  }
  const index = tabs.findIndex((tab) => tab.id === activeId);
  const next = tabs[(index + delta + tabs.length) % tabs.length];
  if (next) {
    setActive(next.id);
  }
};

/* ---------- Find in page ---------- */

let lastFindText = '';

function openFindBar() {
  const tab = activeTab();
  if (!tab || isInternalUrl(tab.url)) {
    return;
  }
  findbar.hidden = false;
  findCount.textContent = '';
  findInput.focus();
  findInput.select();
}

function closeFindBar() {
  if (findbar.hidden) {
    return;
  }
  findbar.hidden = true;
  lastFindText = '';
  const tab = activeTab();
  if (tab?.ready) {
    tab.view.stopFindInPage('clearSelection');
  }
}

function doFind(forward) {
  const tab = activeTab();
  const text = findInput.value;
  if (!(tab?.ready && text)) {
    findCount.textContent = '';
    return;
  }
  const findNext = text === lastFindText;
  lastFindText = text;
  tab.view.findInPage(text, { forward, findNext });
}

/* ---------- Zoom ---------- */

function zoomBy(delta) {
  const tab = activeTab();
  if (!tab) {
    return;
  }
  tab.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, tab.zoom + delta));
  applyZoom(tab);
}

function zoomReset() {
  const tab = activeTab();
  if (!tab) {
    return;
  }
  tab.zoom = 0;
  applyZoom(tab);
}

/* ---------- Reader mode ---------- */

const READER_EXTRACT = `(() => {
  const root =
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.body;
  const blocks = [...root.querySelectorAll('h1, h2, h3, p, li, blockquote')]
    .map((el) => ({ t: el.tagName.toLowerCase(), x: el.innerText.trim() }))
    .filter((b) => b.x.length > 0)
    .slice(0, 500);
  return JSON.stringify({ title: document.title, blocks });
})()`;

function openReader() {
  const tab = activeTab();
  if (!tab?.ready || isInternalUrl(tab.url)) {
    return;
  }
  tab.view
    .executeJavaScript(READER_EXTRACT)
    .then((json) => {
      const data = safeJsonParse(json, null);
      if (!data || data.blocks.length === 0) {
        return;
      }
      readerTitle.textContent = data.title || tab.title;
      readerBody.innerHTML = '';
      for (const block of data.blocks) {
        const el = document.createElement(block.t === 'li' ? 'p' : block.t);
        el.textContent = block.t === 'li' ? `• ${block.x}` : block.x;
        readerBody.append(el);
      }
      reader.hidden = false;
    })
    .catch(() => {
      // Page blocked script execution; nothing to show.
    });
}

function closeReader() {
  reader.hidden = true;
}

/* ---------- Screenshot ---------- */

function takeScreenshot() {
  const tab = activeTab();
  if (!tab?.ready) {
    return;
  }
  tab.view
    .capturePage()
    .then((image) => {
      window.symbolic.saveScreenshot(image.toDataURL());
    })
    .catch(() => {
      // Capture unavailable for this view.
    });
}

/* ---------- Downloads ---------- */

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) {
    return '';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

function renderDownloads() {
  downloadsList.innerHTML = '';
  const items = [...downloads.values()].reverse();
  for (const item of items) {
    const wrap = document.createElement('div');
    wrap.className = 'download-item';

    const name = document.createElement('div');
    name.className = 'download-name';
    name.textContent = item.filename;
    wrap.append(name);

    const meta = document.createElement('div');
    meta.className = 'download-meta';

    const status = document.createElement('span');
    if (item.state === 'completed') {
      status.textContent = formatBytes(item.total) || 'Done';
    } else if (item.state === 'progressing') {
      status.textContent = `${formatBytes(item.received)} / ${formatBytes(item.total) || '?'}`;
    } else {
      status.textContent = item.state;
    }
    meta.append(status);

    if (item.state === 'completed') {
      const actions = document.createElement('div');
      actions.className = 'download-actions';

      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = 'Open';
      open.addEventListener('click', () => {
        window.symbolic.openDownload(item.path);
      });
      actions.append(open);

      const show = document.createElement('button');
      show.type = 'button';
      show.textContent = 'Show in folder';
      show.addEventListener('click', () => {
        window.symbolic.showDownload(item.path);
      });
      actions.append(show);

      meta.append(actions);
    }
    wrap.append(meta);

    if (item.state === 'progressing' && item.total > 0) {
      const bar = document.createElement('div');
      bar.className = 'download-progress';
      const fill = document.createElement('div');
      fill.className = 'download-progress-fill';
      fill.style.width = `${Math.round((item.received / item.total) * 100)}%`;
      bar.append(fill);
      wrap.append(bar);
    }

    downloadsList.append(wrap);
  }
}

function toggleDownloads(force) {
  const show = force ?? downloadsPanel.hidden;
  downloadsPanel.hidden = !show;
  if (show) {
    renderDownloads();
  }
}

/* ---------- Command palette ---------- */

const COMMANDS = [
  { name: 'New tab', hint: 'Ctrl+T', run: () => createTab() },
  {
    name: 'New private tab',
    hint: 'Ctrl+Shift+N',
    run: () => createTab({ isPrivate: true }),
  },
  {
    name: 'Close tab',
    hint: 'Ctrl+W',
    run: () => {
      if (activeId) {
        closeTab(activeId);
      }
    },
  },
  { name: 'Reload page', hint: 'Ctrl+R', run: () => reloadBtn.click() },
  { name: 'Go back', hint: 'Alt+Left', run: () => backBtn.click() },
  { name: 'Go forward', hint: 'Alt+Right', run: () => forwardBtn.click() },
  { name: 'Home / new tab page', hint: '', run: () => homeBtn.click() },
  { name: 'Find in page', hint: 'Ctrl+F', run: () => openFindBar() },
  {
    name: 'Bookmark this page',
    hint: 'Ctrl+D',
    run: () => addCurrentBookmark(),
  },
  {
    name: 'Open history',
    hint: 'Ctrl+H',
    run: () => {
      const tab = activeTab();
      if (tab) {
        tab.view.src = HISTORY_URL;
      }
    },
  },
  { name: 'Downloads', hint: 'Ctrl+J', run: () => toggleDownloads(true) },
  { name: 'Reader mode', hint: 'Ctrl+E', run: () => openReader() },
  {
    name: 'Screenshot page',
    hint: 'Ctrl+Shift+S',
    run: () => takeScreenshot(),
  },
  { name: 'Zoom in', hint: 'Ctrl+=', run: () => zoomBy(0.5) },
  { name: 'Zoom out', hint: 'Ctrl+-', run: () => zoomBy(-0.5) },
  { name: 'Reset zoom', hint: 'Ctrl+0', run: () => zoomReset() },
  { name: 'Next tab', hint: 'Ctrl+Tab', run: () => cycleTab(1) },
  { name: 'Previous tab', hint: 'Ctrl+Shift+Tab', run: () => cycleTab(-1) },
  {
    name: 'Open in system browser',
    hint: '',
    run: () => openExternalBtn.click(),
  },
];

const filteredCommands = () => {
  const query = paletteInput.value.trim().toLowerCase();
  if (!query) {
    return COMMANDS;
  }
  return COMMANDS.filter((cmd) => cmd.name.toLowerCase().includes(query));
};

function renderPalette() {
  const commands = filteredCommands();
  paletteSelection = Math.min(
    paletteSelection,
    Math.max(0, commands.length - 1)
  );
  paletteList.innerHTML = '';
  commands.forEach((cmd, index) => {
    const li = document.createElement('li');
    if (index === paletteSelection) {
      li.className = 'selected';
    }
    const name = document.createElement('span');
    name.textContent = cmd.name;
    li.append(name);
    if (cmd.hint) {
      const hint = document.createElement('span');
      hint.className = 'cmd-hint';
      hint.textContent = cmd.hint;
      li.append(hint);
    }
    li.addEventListener('click', () => {
      closePalette();
      cmd.run();
    });
    paletteList.append(li);
  });
}

function openPalette() {
  palette.hidden = false;
  paletteInput.value = '';
  paletteSelection = 0;
  renderPalette();
  paletteInput.focus();
}

function closePalette() {
  palette.hidden = true;
}

paletteInput.addEventListener('input', () => {
  paletteSelection = 0;
  renderPalette();
});

paletteInput.addEventListener('keydown', (event) => {
  const commands = filteredCommands();
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    paletteSelection = Math.min(paletteSelection + 1, commands.length - 1);
    renderPalette();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    paletteSelection = Math.max(paletteSelection - 1, 0);
    renderPalette();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const cmd = commands[paletteSelection];
    if (cmd) {
      closePalette();
      cmd.run();
    }
  } else if (event.key === 'Escape') {
    closePalette();
  }
});

palette.addEventListener('click', (event) => {
  if (event.target === palette) {
    closePalette();
  }
});

/* ---------- Toolbar events ---------- */

omniboxForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const raw = omnibox.value;
  const trimmed = raw.trim();
  const tab = activeTab();
  if (!tab) {
    return;
  }
  if (trimmed && !isUrlLike(trimmed) && !tab.isPrivate) {
    recordSearch(trimmed);
  }
  tab.view.src = resolveInput(raw);
  omnibox.blur();
});

backBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab?.ready && tab.view.canGoBack()) {
    tab.view.goBack();
  }
});

forwardBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab?.ready && tab.view.canGoForward()) {
    tab.view.goForward();
  }
});

reloadBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (!tab?.ready) {
    return;
  }
  if (tab.loading) {
    tab.view.stop();
  } else {
    tab.view.reload();
  }
});

homeBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab) {
    tab.view.src = NEW_TAB_URL;
  }
});

newTabBtn.addEventListener('click', () => createTab());
newPrivateTabBtn.addEventListener('click', () =>
  createTab({ isPrivate: true })
);
addBookmarkBtn.addEventListener('click', () => addCurrentBookmark());
downloadsBtn.addEventListener('click', () => toggleDownloads());
paletteBtn.addEventListener('click', () => openPalette());

document.querySelector('#downloads-close').addEventListener('click', () => {
  toggleDownloads(false);
});

openExternalBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab && !isNewTabUrl(tab.url)) {
    window.symbolic.openExternal(tab.url);
  }
});

/* ---------- Find bar events ---------- */

findInput.addEventListener('input', () => {
  doFind(true);
});

findInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    doFind(!event.shiftKey);
  } else if (event.key === 'Escape') {
    closeFindBar();
  }
});

document.querySelector('#find-prev').addEventListener('click', () => {
  doFind(false);
});
document.querySelector('#find-next').addEventListener('click', () => {
  doFind(true);
});
document.querySelector('#find-close').addEventListener('click', () => {
  closeFindBar();
});

document.querySelector('#reader-close').addEventListener('click', () => {
  closeReader();
});

/* ---------- Keyboard shortcuts ---------- */

const normalizeKey = (key) => (key.length === 1 ? key.toLowerCase() : key);

const handleShortcut = (event) => {
  const ctrl = event.ctrl ?? (event.ctrlKey || event.metaKey);
  const shift = event.shift ?? event.shiftKey;
  const alt = event.alt ?? event.altKey;
  const key = normalizeKey(event.key);
  const stop = () => {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };

  if (key === 'Escape') {
    closePalette();
    closeFindBar();
    closeReader();
    toggleDownloads(false);
    return;
  }
  if (ctrl && key === 't') {
    stop();
    createTab();
    return;
  }
  if (ctrl && shift && key === 'n') {
    stop();
    createTab({ isPrivate: true });
    return;
  }
  if (ctrl && key === 'w') {
    stop();
    if (activeId) {
      closeTab(activeId);
    }
    return;
  }
  if (ctrl && key === 'l') {
    stop();
    omnibox.focus();
    omnibox.select();
    return;
  }
  if ((ctrl && key === 'r') || key === 'F5') {
    stop();
    reloadBtn.click();
    return;
  }
  if (ctrl && key === 'd') {
    stop();
    addCurrentBookmark();
    return;
  }
  if (ctrl && key === 'h') {
    stop();
    const tab = activeTab();
    if (tab) {
      tab.view.src = HISTORY_URL;
    }
    return;
  }
  if (ctrl && key === 'f') {
    stop();
    openFindBar();
    return;
  }
  if (ctrl && key === 'j') {
    stop();
    toggleDownloads();
    return;
  }
  if ((ctrl && key === 'k') || (ctrl && shift && key === 'p')) {
    stop();
    openPalette();
    return;
  }
  if (ctrl && key === 'e') {
    stop();
    if (reader.hidden) {
      openReader();
    } else {
      closeReader();
    }
    return;
  }
  if (ctrl && shift && key === 's') {
    stop();
    takeScreenshot();
    return;
  }
  if (ctrl && (key === '=' || key === '+')) {
    stop();
    zoomBy(0.5);
    return;
  }
  if (ctrl && key === '-') {
    stop();
    zoomBy(-0.5);
    return;
  }
  if (ctrl && key === '0') {
    stop();
    zoomReset();
    return;
  }
  if (alt && key === 'ArrowLeft') {
    stop();
    backBtn.click();
    return;
  }
  if (alt && key === 'ArrowRight') {
    stop();
    forwardBtn.click();
    return;
  }
  if (ctrl && key === 'Tab') {
    stop();
    cycleTab(shift ? -1 : 1);
    return;
  }
  if (ctrl && /^[1-9]$/.test(key)) {
    stop();
    const n = Number(key);
    const target = n === 9 ? tabs.at(-1) : tabs[n - 1];
    if (target) {
      setActive(target.id);
    }
  }
};

window.addEventListener('keydown', handleShortcut);
window.symbolic.onShortcut(handleShortcut);
window.symbolic.onOpenTab((url) => {
  const current = activeTab();
  createTab({ url, isPrivate: current?.isPrivate });
});

window.symbolic.onDownload((item) => {
  downloads.set(item.id, item);
  if (!downloadsPanel.hidden) {
    renderDownloads();
  }
  if (item.state === 'progressing' && downloads.size === 1) {
    toggleDownloads(true);
  }
});

/* ---------- Session restore ---------- */

const restoreSession = () => {
  const saved = safeJsonParse(localStorage.getItem(SESSION_KEY), null);
  if (saved && Array.isArray(saved.urls) && saved.urls.length > 0) {
    for (const url of saved.urls) {
      createTab({ url: isNewTabUrl(url) ? '' : url });
    }
    const target = tabs[Math.min(saved.active ?? 0, tabs.length - 1)];
    if (target) {
      setActive(target.id);
    }
  } else {
    createTab();
  }
  restoring = false;
  saveSession();
};

renderBookmarks();
restoreSession();
