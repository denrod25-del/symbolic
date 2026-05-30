'use strict';

const SYMBOLIC_ORIGIN = 'http://localhost:3000';
const NEW_TAB_URL = 'newtab.html';
const HISTORY_URL = 'history.html';
const BOOKMARKS_KEY = 'symbolic_bookmarks';
const RECENT_KEY = 'symbolic_recent';
const HISTORY_KEY = 'symbolic_history';
const RECENT_LIMIT = 10;
const HISTORY_LIMIT = 500;

const tabsEl = document.querySelector('#tabs');
const viewsEl = document.querySelector('#views');
const omnibox = document.querySelector('#omnibox');
const omniboxForm = document.querySelector('#omnibox-form');
const backBtn = document.querySelector('#back');
const forwardBtn = document.querySelector('#forward');
const reloadBtn = document.querySelector('#reload');
const homeBtn = document.querySelector('#home');
const newTabBtn = document.querySelector('#new-tab');
const addBookmarkBtn = document.querySelector('#add-bookmark');
const openExternalBtn = document.querySelector('#open-external');
const bookmarksListEl = document.querySelector('#bookmarks-list');

const tabs = [];
let activeId = null;
let seq = 0;

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

const syncActive = () => {
  const tab = activeTab();
  if (!tab) {
    return;
  }
  if (document.activeElement !== omnibox) {
    omnibox.value = isNewTabUrl(tab.url) ? '' : tab.url;
  }
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
    el.className = tab.id === activeId ? 'tab active' : 'tab';
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
  activeId = id;
  for (const tab of tabs) {
    tab.view.style.display = tab.id === id ? 'flex' : 'none';
  }
  renderTabs();
  syncActive();
}

function wireWebview(tab) {
  const { view } = tab;

  view.addEventListener('dom-ready', () => {
    tab.ready = true;
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

  const onNavigate = (event) => {
    if (event.isMainFrame === false) {
      return;
    }
    tab.url = event.url;
    if (isNewTabUrl(event.url)) {
      tab.title = 'New Tab';
      tab.favicon = '';
    } else {
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

function createTab(url) {
  seq += 1;
  const id = `t${seq}`;
  const view = document.createElement('webview');
  view.className = 'webview';
  view.setAttribute('partition', 'persist:symbolic');
  view.setAttribute('allowpopups', '');
  view.src = url ?? NEW_TAB_URL;
  viewsEl.append(view);

  const tab = {
    id,
    view,
    title: 'New Tab',
    url: url ?? '',
    favicon: '',
    loading: false,
    ready: false,
  };
  tabs.push(tab);
  wireWebview(tab);
  setActive(id);

  if (!url) {
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

omniboxForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const raw = omnibox.value;
  const trimmed = raw.trim();
  const tab = activeTab();
  if (!tab) {
    return;
  }
  if (trimmed && !isUrlLike(trimmed)) {
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

addBookmarkBtn.addEventListener('click', () => addCurrentBookmark());

openExternalBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab && !isNewTabUrl(tab.url)) {
    window.symbolic.openExternal(tab.url);
  }
});

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

const handleShortcut = (event) => {
  const ctrl = event.ctrl ?? (event.ctrlKey || event.metaKey);
  const shift = event.shift ?? event.shiftKey;
  const alt = event.alt ?? event.altKey;
  const key = event.key;
  const stop = () => {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };

  if (ctrl && key === 't') {
    stop();
    createTab();
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
window.symbolic.onOpenTab((url) => createTab(url));

renderBookmarks();
createTab();
