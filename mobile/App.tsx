import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewRef } from 'react-native-webview';
import { BookmarksScreen } from './src/BookmarksScreen';
import type { Bookmark, HistoryEntry } from './src/config';
import { NEW_TAB } from './src/config';
import { HistoryScreen } from './src/HistoryScreen';
import { NewTab } from './src/NewTab';
import {
  clearHistory,
  loadBookmarks,
  loadHistory,
  recordHistory,
  removeBookmark,
  saveBookmark,
} from './src/storage';
import { TabsScreen } from './src/TabsScreen';
import { theme } from './src/theme';
import { displayHost, isUrlLike, resolveInput } from './src/url';

type Tab = {
  id: string;
  url: string;
  title: string;
};

let tabSeq = 0;
const makeTab = (url: string = NEW_TAB): Tab => {
  tabSeq += 1;
  return { id: `t${tabSeq}`, url, title: 'New Tab' };
};

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0]?.id ?? '');
  const [omniText, setOmniText] = useState('');
  const [omniFocused, setOmniFocused] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [modal, setModal] = useState<'tabs' | 'bookmarks' | 'history' | null>(
    null
  );
  const webviewRefs = useRef<Map<string, WebViewRef>>(new Map());

  useEffect(() => {
    loadBookmarks().then(setBookmarks);
    loadHistory().then(setHistory);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const activeRef = activeTab
    ? webviewRefs.current.get(activeTab.id)
    : undefined;

  const updateTab = (id: string, patch: Partial<Tab>) => {
    setTabs((current) =>
      current.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  const openInActive = (url: string) => {
    if (!activeTab) {
      return;
    }
    updateTab(activeTab.id, { url, title: 'Loading…' });
  };

  const newTab = (url: string = NEW_TAB) => {
    const tab = makeTab(url);
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  };

  const closeTab = (id: string) => {
    setTabs((current) => {
      const remaining = current.filter((t) => t.id !== id);
      webviewRefs.current.delete(id);
      if (remaining.length === 0) {
        const fresh = makeTab();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) {
        const closedAt = current.findIndex((t) => t.id === id);
        const next = remaining[Math.max(0, closedAt - 1)];
        if (next) {
          setActiveId(next.id);
        }
      }
      return remaining;
    });
  };

  const submitOmnibox = () => {
    const url = resolveInput(omniText);
    openInActive(url);
    setOmniFocused(false);
  };

  const toggleBookmark = async () => {
    if (!activeTab || activeTab.url === NEW_TAB) {
      return;
    }
    const exists = bookmarks.some((b) => b.url === activeTab.url);
    const next = exists
      ? await removeBookmark(activeTab.url)
      : await saveBookmark({ url: activeTab.url, title: activeTab.title });
    setBookmarks(next);
  };

  const isBookmarked =
    activeTab && bookmarks.some((b) => b.url === activeTab.url);

  const displayUrl = activeTab
    ? activeTab.url === NEW_TAB
      ? ''
      : activeTab.url
    : '';

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeId;
            if (tab.url === NEW_TAB) {
              return (
                <View
                  key={tab.id}
                  style={[styles.tabContent, !isActive && styles.hidden]}
                  pointerEvents={isActive ? 'auto' : 'none'}
                >
                  <NewTab
                    onNavigate={(url) => {
                      updateTab(tab.id, { url, title: 'Loading…' });
                    }}
                  />
                </View>
              );
            }
            return (
              <View
                key={tab.id}
                style={[styles.tabContent, !isActive && styles.hidden]}
                pointerEvents={isActive ? 'auto' : 'none'}
              >
                <WebView
                  ref={(ref) => {
                    if (ref) {
                      webviewRefs.current.set(tab.id, ref);
                    }
                  }}
                  source={{ uri: tab.url }}
                  onNavigationStateChange={(state) => {
                    if (!state.url) {
                      return;
                    }
                    updateTab(tab.id, {
                      url: state.url,
                      title: state.title || displayHost(state.url),
                    });
                    if (!state.loading && state.url !== NEW_TAB) {
                      void recordHistory(
                        state.url,
                        state.title || displayHost(state.url)
                      );
                      loadHistory().then(setHistory);
                    }
                  }}
                  allowsBackForwardNavigationGestures
                  decelerationRate="normal"
                />
              </View>
            );
          })}
        </View>

        <View style={styles.toolbar}>
          <Pressable
            hitSlop={8}
            onPress={() => activeRef?.goBack()}
            style={styles.iconBtn}
          >
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => activeRef?.goForward()}
            style={styles.iconBtn}
          >
            <Text style={styles.iconText}>›</Text>
          </Pressable>

          <View style={styles.omniWrap}>
            <TextInput
              style={styles.omni}
              value={omniFocused ? omniText : displayUrl}
              onFocus={() => {
                setOmniText(displayUrl);
                setOmniFocused(true);
              }}
              onBlur={() => setOmniFocused(false)}
              onChangeText={setOmniText}
              onSubmitEditing={submitOmnibox}
              placeholder="Search Symbolic or type a URL"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={isUrlLike(omniText) ? 'url' : 'default'}
              returnKeyType="go"
              selectTextOnFocus
            />
          </View>

          <Pressable
            hitSlop={8}
            onPress={toggleBookmark}
            style={styles.iconBtn}
          >
            <Text
              style={[styles.iconText, isBookmarked ? styles.bookmarked : null]}
            >
              ★
            </Text>
          </Pressable>
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            style={styles.bottomBtn}
            onPress={() => setModal('tabs')}
            hitSlop={6}
          >
            <Text style={styles.bottomBtnText}>{tabs.length}</Text>
            <Text style={styles.bottomLabel}>Tabs</Text>
          </Pressable>
          <Pressable
            style={styles.bottomBtn}
            onPress={() => setModal('bookmarks')}
            hitSlop={6}
          >
            <Text style={styles.bottomIcon}>☆</Text>
            <Text style={styles.bottomLabel}>Saved</Text>
          </Pressable>
          <Pressable
            style={styles.bottomBtn}
            onPress={() => setModal('history')}
            hitSlop={6}
          >
            <Text style={styles.bottomIcon}>⟲</Text>
            <Text style={styles.bottomLabel}>History</Text>
          </Pressable>
          <Pressable
            style={styles.bottomBtn}
            onPress={() => newTab()}
            hitSlop={6}
          >
            <Text style={styles.bottomIcon}>+</Text>
            <Text style={styles.bottomLabel}>New</Text>
          </Pressable>
        </View>

        <Modal
          visible={modal === 'tabs'}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModal(null)}
        >
          <TabsScreen
            tabs={tabs}
            activeId={activeId}
            onClose={() => setModal(null)}
            onSelect={(id) => {
              setActiveId(id);
              setModal(null);
            }}
            onCloseTab={closeTab}
            onNewTab={() => {
              newTab();
              setModal(null);
            }}
          />
        </Modal>

        <Modal
          visible={modal === 'bookmarks'}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModal(null)}
        >
          <BookmarksScreen
            bookmarks={bookmarks}
            onClose={() => setModal(null)}
            onOpen={(url) => {
              openInActive(url);
              setModal(null);
            }}
            onRemove={async (url) => {
              setBookmarks(await removeBookmark(url));
            }}
          />
        </Modal>

        <Modal
          visible={modal === 'history'}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModal(null)}
        >
          <HistoryScreen
            history={history}
            onClose={() => setModal(null)}
            onOpen={(url) => {
              openInActive(url);
              setModal(null);
            }}
            onClear={async () => {
              await clearHistory();
              setHistory([]);
            }}
          />
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { flex: 1 },
  tabContent: { position: 'absolute', inset: 0 },
  hidden: { opacity: 0 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    backgroundColor: theme.surface,
    borderTopColor: theme.border,
    borderTopWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  iconText: { color: theme.text, fontSize: 22 },
  bookmarked: { color: theme.accent },
  omniWrap: {
    flex: 1,
    borderRadius: 999,
    borderColor: theme.border,
    borderWidth: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 12,
    height: 36,
    justifyContent: 'center',
  },
  omni: { color: theme.text, fontSize: 14 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    backgroundColor: theme.surface,
    borderTopColor: theme.border,
    borderTopWidth: 1,
  },
  bottomBtn: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  bottomBtnText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  bottomIcon: { color: theme.text, fontSize: 18 },
  bottomLabel: { color: theme.muted, fontSize: 10, marginTop: 2 },
});
