import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Bookmark } from './config';
import { theme } from './theme';
import { displayHost } from './url';

type BookmarksScreenProps = {
  bookmarks: Bookmark[];
  onClose: () => void;
  onOpen: (url: string) => void;
  onRemove: (url: string) => void;
};

export function BookmarksScreen(props: BookmarksScreenProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookmarks</Text>
        <Pressable onPress={props.onClose} hitSlop={8}>
          <Text style={styles.close}>Done</Text>
        </Pressable>
      </View>
      {props.bookmarks.length === 0 ? (
        <Text style={styles.empty}>No bookmarks yet.</Text>
      ) : (
        <FlatList
          data={props.bookmarks}
          keyExtractor={(item) => item.url}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => props.onOpen(item.url)}
              onLongPress={() => props.onRemove(item.url)}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title || displayHost(item.url)}
              </Text>
              <Text style={styles.rowUrl} numberOfLines={1}>
                {item.url}
              </Text>
            </Pressable>
          )}
        />
      )}
      <Text style={styles.hint}>Long-press to remove</Text>
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
  title: { color: theme.text, fontSize: 20, fontWeight: '700' },
  close: { color: theme.accent, fontSize: 15 },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 32 },
  row: {
    paddingVertical: 12,
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
  },
  rowTitle: { color: theme.text, fontSize: 14 },
  rowUrl: { color: theme.muted, fontSize: 11, marginTop: 2 },
  hint: {
    color: theme.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});
