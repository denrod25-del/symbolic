'use strict';

const HISTORY_KEY = 'symbolic_history';

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw ?? '') ?? fallback;
  } catch {
    return fallback;
  }
};

const loadHistory = () => safeParse(localStorage.getItem(HISTORY_KEY), []);

const groupByDay = (entries) => {
  const groups = new Map();
  for (const entry of entries) {
    const date = new Date(entry.visitedAt);
    const key = date.toDateString();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  }
  return groups;
};

const fmtTime = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const render = () => {
  const list = document.querySelector('#list');
  list.innerHTML = '';

  const entries = loadHistory();
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No history yet.';
    list.append(empty);
    return;
  }

  for (const [day, rows] of groupByDay(entries)) {
    const heading = document.createElement('div');
    heading.className = 'day';
    heading.textContent = day;
    list.append(heading);

    for (const row of rows) {
      const wrap = document.createElement('div');
      wrap.className = 'row';

      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = fmtTime(row.visitedAt);
      wrap.append(time);

      const link = document.createElement('a');
      link.className = 'link';
      link.href = row.url;
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = row.title || row.url;
      const url = document.createElement('div');
      url.className = 'url';
      url.textContent = row.url;
      link.append(title, url);
      wrap.append(link);

      list.append(wrap);
    }
  }
};

document.querySelector('#clear').addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  render();
});

render();
