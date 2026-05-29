'use strict';

const SYMBOLIC_ORIGIN = 'http://localhost:3000';
const RECENT_KEY = 'symbolic_recent';
const RECENT_LIMIT = 6;

const SHORTCUTS = [
  { label: 'Symbolic', letter: 'S', color: '#7c6ff7', url: SYMBOLIC_ORIGIN },
  {
    label: 'Wikipedia',
    letter: 'W',
    color: '#1e1e2e',
    url: 'https://www.wikipedia.org',
  },
  { label: 'GitHub', letter: 'G', color: '#1e1e2e', url: 'https://github.com' },
  {
    label: 'Hacker News',
    letter: 'Y',
    color: '#ff6600',
    url: 'https://news.ycombinator.com',
  },
  {
    label: 'YouTube',
    letter: '▶',
    color: '#ff0000',
    url: 'https://www.youtube.com',
  },
  {
    label: 'MDN',
    letter: 'M',
    color: '#a78bfa',
    url: 'https://developer.mozilla.org',
  },
];

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

const resolve = (input) => {
  const trimmed = input.trim();
  if (isUrlLike(trimmed)) {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  return `${SYMBOLIC_ORIGIN}/search?q=${encodeURIComponent(trimmed)}`;
};

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw ?? '') ?? fallback;
  } catch {
    return fallback;
  }
};

const loadLocalRecent = () =>
  safeParse(localStorage.getItem(RECENT_KEY), []).slice(0, RECENT_LIMIT);

const fetchServerRecent = async () => {
  try {
    const res = await fetch(`${SYMBOLIC_ORIGIN}/api/recent-searches`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return Array.isArray(data.recent)
      ? data.recent.filter((q) => typeof q === 'string').slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
};

const renderRecent = (items) => {
  const el = document.querySelector('#recent');
  el.innerHTML = '';
  if (items.length === 0) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const heading = document.createElement('div');
  heading.className = 'recent-heading';
  heading.textContent = 'Recent searches';
  el.append(heading);

  const chips = document.createElement('div');
  chips.className = 'recent-chips';
  for (const query of items) {
    const chip = document.createElement('a');
    chip.className = 'recent-chip';
    chip.href = `${SYMBOLIC_ORIGIN}/search?q=${encodeURIComponent(query)}`;
    chip.textContent = query;
    chips.append(chip);
  }
  el.append(chips);
};

const populateRecent = async () => {
  const local = loadLocalRecent();
  if (local.length > 0) {
    renderRecent(local);
    return;
  }
  renderRecent(await fetchServerRecent());
};

const shortcutsEl = document.querySelector('#shortcuts');
for (const item of SHORTCUTS) {
  const link = document.createElement('a');
  link.className = 'shortcut';
  link.href = item.url;

  const tile = document.createElement('span');
  tile.className = 'tile';
  tile.style.background = item.color;
  tile.textContent = item.letter;

  const label = document.createElement('span');
  label.textContent = item.label;

  link.append(tile, label);
  shortcutsEl.append(link);
}

document.querySelector('#search').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = document.querySelector('#q').value.trim();
  if (value) {
    window.location.href = resolve(value);
  }
});

populateRecent();
