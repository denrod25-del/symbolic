'use strict';

// Where searches go. Point this at your Symbolic deployment (e.g.
// https://your-symbolic-domain). Defaults to the local Next.js dev server.
const SYMBOLIC_ORIGIN = 'http://localhost:3000';

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

const shortcuts = document.querySelector('#shortcuts');
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
  shortcuts.append(link);
}

document.querySelector('#search').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = document.querySelector('#q').value.trim();
  if (value) {
    window.location.href = resolve(value);
  }
});
