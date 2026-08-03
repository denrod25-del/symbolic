import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bookmark, HistoryEntry } from './config';

const BOOKMARKS_KEY = 'symbolic_bookmarks';
const HISTORY_KEY = 'symbolic_history';
const HISTORY_LIMIT = 500;

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const loadBookmarks = () => load<Bookmark[]>(BOOKMARKS_KEY, []);

export async function saveBookmark(bm: Bookmark): Promise<Bookmark[]> {
  const list = await loadBookmarks();
  if (list.some((b) => b.url === bm.url)) {
    return list;
  }
  const next = [...list, bm];
  await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  return next;
}

export async function removeBookmark(url: string): Promise<Bookmark[]> {
  const next = (await loadBookmarks()).filter((b) => b.url !== url);
  await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
  return next;
}

export const loadHistory = () => load<HistoryEntry[]>(HISTORY_KEY, []);

export async function recordHistory(url: string, title: string): Promise<void> {
  const list = await loadHistory();
  const next = [
    { url, title, visitedAt: Date.now() },
    ...list.filter((e) => e.url !== url),
  ].slice(0, HISTORY_LIMIT);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

const TABS_KEY = 'symbolic_tabs';

type SavedTabs = { urls: string[]; active: number };

export const loadTabs = () => load<SavedTabs | null>(TABS_KEY, null);

export async function saveTabs(urls: string[], active: number): Promise<void> {
  await AsyncStorage.setItem(TABS_KEY, JSON.stringify({ urls, active }));
}
