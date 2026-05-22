'use client';

import { useRef, useState } from 'react';
import { BrowserNewTab } from './BrowserNewTab';

const NEW_TAB = 'symbolic://newtab';

let tabSeq = 0;

type Tab = {
  id: string;
  entries: string[];
  index: number;
};

type ChromeBrowserProps = {
  locale: string;
};

function createTab(): Tab {
  tabSeq += 1;
  return { id: `tab-${tabSeq}`, entries: [NEW_TAB], index: 0 };
}

function isUrlLike(input: string): boolean {
  if (/^https?:\/\//i.test(input)) {
    return true;
  }
  if (/\s/.test(input)) {
    return false;
  }
  const host = input.split(/[/?#]/)[0] ?? '';
  return host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
}

function resolveInput(input: string, locale: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return NEW_TAB;
  }
  if (isUrlLike(trimmed)) {
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  return `/${locale}/search?q=${encodeURIComponent(trimmed)}`;
}

function searchQuery(entry: string): string | null {
  const [, queryString] = entry.split('?');
  if (!entry.includes('/search?') || !queryString) {
    return null;
  }
  return new URLSearchParams(queryString).get('q');
}

function tabTitle(entry: string): string {
  if (entry === NEW_TAB) {
    return 'New Tab';
  }
  const query = searchQuery(entry);
  if (query) {
    return query;
  }
  const host = entry.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  return host ? host.replace(/^www\./, '') : entry;
}

function displayAddress(entry: string): string {
  if (entry === NEW_TAB) {
    return '';
  }
  return searchQuery(entry) ?? entry;
}

type ToolbarButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton(props: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="shrink-0 rounded-full p-2 text-symbolic-text transition-colors hover:bg-symbolic-bg disabled:cursor-not-allowed disabled:text-symbolic-border disabled:hover:bg-transparent"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {props.children}
      </svg>
    </button>
  );
}

export function ChromeBrowser(props: ChromeBrowserProps) {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0]?.id ?? '');
  const [nonce, setNonce] = useState(0);
  const addressRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  if (!activeTab) {
    return null;
  }
  const activeEntry = activeTab.entries[activeTab.index] ?? NEW_TAB;
  const canGoBack = activeTab.index > 0;
  const canGoForward = activeTab.index < activeTab.entries.length - 1;

  function updateActive(updater: (tab: Tab) => Tab) {
    setTabs((current) =>
      current.map((tab) => (tab.id === activeId ? updater(tab) : tab))
    );
  }

  function navigate(entry: string) {
    if (entry === activeEntry) {
      setNonce((value) => value + 1);
      return;
    }
    updateActive((tab) => {
      const entries = [...tab.entries.slice(0, tab.index + 1), entry];
      return { ...tab, entries, index: entries.length - 1 };
    });
  }

  function submitInput(input: string) {
    navigate(resolveInput(input, props.locale));
  }

  function openTab() {
    const tab = createTab();
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  }

  function closeTab(id: string) {
    setTabs((current) => {
      const remaining = current.filter((tab) => tab.id !== id);
      if (remaining.length === 0) {
        const fresh = createTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        const closedAt = current.findIndex((tab) => tab.id === id);
        const next = remaining[Math.max(0, closedAt - 1)];
        if (next) {
          setActiveId(next.id);
        }
      }
      return remaining;
    });
  }

  return (
    <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-symbolic-border bg-symbolic-surface shadow-2xl">
      <div className="flex items-center gap-1 bg-symbolic-bg px-3 pt-2">
        <div className="mr-2 flex shrink-0 gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const title = tabTitle(tab.entries[tab.index] ?? NEW_TAB);
            const isActive = tab.id === activeId;
            return (
              <div
                key={tab.id}
                className={`flex max-w-44 min-w-32 shrink-0 items-center gap-2 rounded-t-lg px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-symbolic-surface text-symbolic-text'
                    : 'bg-transparent text-symbolic-muted hover:bg-symbolic-surface/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(tab.id);
                  }}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  {title}
                </button>
                <button
                  type="button"
                  aria-label="Close tab"
                  onClick={() => {
                    closeTab(tab.id);
                  }}
                  className="shrink-0 rounded p-0.5 text-symbolic-muted transition-colors hover:bg-symbolic-border hover:text-symbolic-text"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
          <button
            type="button"
            aria-label="New tab"
            onClick={openTab}
            className="mb-1 shrink-0 rounded-full p-1.5 text-symbolic-muted transition-colors hover:bg-symbolic-surface hover:text-symbolic-text"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-symbolic-border bg-symbolic-surface px-3 py-2">
        <ToolbarButton
          label="Back"
          disabled={!canGoBack}
          onClick={() => {
            updateActive((tab) => ({ ...tab, index: tab.index - 1 }));
          }}
        >
          <path d="m15 18-6-6 6-6" />
        </ToolbarButton>
        <ToolbarButton
          label="Forward"
          disabled={!canGoForward}
          onClick={() => {
            updateActive((tab) => ({ ...tab, index: tab.index + 1 }));
          }}
        >
          <path d="m9 18 6-6-6-6" />
        </ToolbarButton>
        <ToolbarButton
          label="Reload"
          onClick={() => {
            setNonce((value) => value + 1);
          }}
        >
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        </ToolbarButton>
        <ToolbarButton
          label="Home"
          onClick={() => {
            navigate(NEW_TAB);
          }}
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </ToolbarButton>

        <form
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-symbolic-border bg-symbolic-bg px-4 py-1.5"
          onSubmit={(event: React.SubmitEvent<HTMLFormElement>) => {
            event.preventDefault();
            submitInput(addressRef.current?.value ?? '');
            addressRef.current?.blur();
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-symbolic-url"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input
            key={`${activeTab.id}:${activeTab.index}`}
            ref={addressRef}
            type="text"
            defaultValue={displayAddress(activeEntry)}
            placeholder="Search Symbolic or type a URL"
            className="min-w-0 flex-1 bg-transparent text-sm text-symbolic-text placeholder-symbolic-muted focus:outline-none"
          />
        </form>

        <ToolbarButton
          label="Open in real tab"
          disabled={activeEntry === NEW_TAB}
          onClick={() => {
            window.open(activeEntry, '_blank', 'noopener,noreferrer');
          }}
        >
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </ToolbarButton>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {activeEntry === NEW_TAB ? (
          <BrowserNewTab
            locale={props.locale}
            onSearch={submitInput}
            onOpen={navigate}
          />
        ) : (
          <iframe
            key={`${activeTab.id}:${activeTab.index}:${nonce}`}
            src={activeEntry}
            title={tabTitle(activeEntry)}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            className="size-full border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}
