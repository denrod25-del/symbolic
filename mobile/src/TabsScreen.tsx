import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';
import { displayHost } from './url';

type Tab = { id: string; url: string; title: string };

type TabsScreenProps = {
  tabs: Tab[];
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
};

export function TabsScreen(props: TabsScreenProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Tabs ({props.tabs.length})</Text>
        <Pressable onPress={props.onClose} hitSlop={8}>
          <Text style={styles.close}>Done</Text>
        </Pressable>
      </View>
      <FlatList
        data={props.tabs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isActive = item.id === props.activeId;
          return (
            <Pressable
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => props.onSelect(item.id)}
            >
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title || displayHost(item.url) || 'New Tab'}
                </Text>
                <Text style={styles.cardUrl} numberOfLines={1}>
                  {item.url || 'symbolic://newtab'}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => props.onCloseTab(item.id)}
                style={styles.cardClose}
              >
                <Text style={styles.cardCloseText}>✕</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
      <Pressable style={styles.newBtn} onPress={props.onNewTab}>
        <Text style={styles.newBtnText}>+ New Tab</Text>
      </Pressable>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    marginBottom: 8,
  },
  cardActive: { borderColor: theme.accent },
  cardBody: { flex: 1, marginRight: 8 },
  cardTitle: { color: theme.text, fontSize: 14, fontWeight: '600' },
  cardUrl: { color: theme.muted, fontSize: 11, marginTop: 2 },
  cardClose: { padding: 4 },
  cardCloseText: { color: theme.muted, fontSize: 16 },
  newBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 999,
    backgroundColor: theme.accent,
    alignItems: 'center',
  },
  newBtnText: { color: theme.text, fontWeight: '700' },
});
