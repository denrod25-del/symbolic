import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from './config';
import { theme } from './theme';

type HistoryScreenProps = {
  history: HistoryEntry[];
  onClose: () => void;
  onOpen: (url: string) => void;
  onClear: () => void;
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function HistoryScreen(props: HistoryScreenProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={props.onClear} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
          <Pressable onPress={props.onClose} hitSlop={8}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>
      </View>
      {props.history.length === 0 ? (
        <Text style={styles.empty}>No history yet.</Text>
      ) : (
        <FlatList
          data={props.history}
          keyExtractor={(item) => `${item.url}-${item.visitedAt}`}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => props.onOpen(item.url)}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title || item.url}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {formatTime(item.visitedAt)} · {item.url}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: { flexDirection: 'row', gap: 16 },
  title: { color: theme.text, fontSize: 20, fontWeight: '700' },
  clear: { color: theme.muted, fontSize: 15 },
  close: { color: theme.accent, fontSize: 15 },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 32 },
  row: {
    paddingVertical: 10,
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
  },
  rowTitle: { color: theme.text, fontSize: 14 },
  rowMeta: { color: theme.muted, fontSize: 11, marginTop: 2 },
});
