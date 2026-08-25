/**
 * Where omnibox searches and the new-tab "Symbolic" shortcut point. Change
 * this to your deployed Symbolic origin (e.g. https://symbolic.example.com).
 */
export const SYMBOLIC_ORIGIN = 'https://www.bsymbolic.com';

export const NEW_TAB = 'symbolic://newtab';

export type Bookmark = { url: string; title: string };
export type HistoryEntry = { url: string; title: string; visitedAt: number };
