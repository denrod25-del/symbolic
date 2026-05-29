'use strict';

// Where omnibox searches go. Point this at your Symbolic deployment.
const SYMBOLIC_ORIGIN = 'http://localhost:3000';
const NEW_TAB_URL = 'newtab.html';

const tabsEl = document.querySelector('#tabs');
const viewsEl = document.querySelector('#views');
const omnibox = document.querySelector('#omnibox');
const omniboxForm = document.querySelector('#omnibox-form');
const backBtn = document.querySelector('#back');
const forwardBtn = document.querySelector('#forward');
const reloadBtn = document.querySelector('#reload');
const homeBtn = document.querySelector('#home');
const newTabBtn = document.querySelector('#new-tab');
const openExternalBtn = document.querySelector('#open-external');

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

const activeTab = () => tabs.find((tab) => tab.id === activeId);

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
};

const render = () => {
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

function setActive(id) {
  activeId = id;
  for (const tab of tabs) {
    tab.view.style.display = tab.id === id ? 'flex' : 'none';
  }
  render();
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
    render();
  });
  view.addEventListener('page-favicon-updated', (event) => {
    tab.favicon = event.favicons[0] ?? '';
    render();
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
    }
    if (tab.id === activeId) {
      syncActive();
    }
    render();
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
    render();
  }
}

omniboxForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const tab = activeTab();
  if (tab) {
    tab.view.src = resolveInput(omnibox.value);
    omnibox.blur();
  }
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

openExternalBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab && !isNewTabUrl(tab.url)) {
    window.symbolic.openExternal(tab.url);
  }
});

window.symbolic.onOpenTab((url) => createTab(url));

createTab();
