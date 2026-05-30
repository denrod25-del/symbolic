import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SYMBOLIC_ORIGIN } from './config';
import { theme } from './theme';

type NewTabProps = {
  onNavigate: (url: string) => void;
};

type Shortcut = { label: string; letter: string; color: string; url: string };

const SHORTCUTS: Shortcut[] = [
  { label: 'Symbolic', letter: 'S', color: theme.accent, url: SYMBOLIC_ORIGIN },
  {
    label: 'Wikipedia',
    letter: 'W',
    color: theme.border,
    url: 'https://www.wikipedia.org',
  },
  {
    label: 'GitHub',
    letter: 'G',
    color: theme.border,
    url: 'https://github.com',
  },
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
    url: 'https://m.youtube.com',
  },
  {
    label: 'MDN',
    letter: 'M',
    color: '#a78bfa',
    url: 'https://developer.mozilla.org',
  },
];

export function NewTab(props: NewTabProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.wordmark}>
        symbolic<Text style={styles.dot}>.</Text>
      </Text>
      <Text style={styles.tagline}>Search without compromise</Text>

      <View style={styles.grid}>
        {SHORTCUTS.map((s) => (
          <Pressable
            key={s.label}
            style={styles.shortcut}
            onPress={() => {
              if (s.url.startsWith(SYMBOLIC_ORIGIN)) {
                props.onNavigate(s.url);
              } else {
                props.onNavigate(s.url);
              }
            }}
            onLongPress={() => Linking.openURL(s.url)}
          >
            <View style={[styles.tile, { backgroundColor: s.color }]}>
              <Text style={styles.tileLetter}>{s.letter}</Text>
            </View>
            <Text style={styles.shortcutLabel} numberOfLines={1}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.badge}>
        Default search: <Text style={styles.badgeAccent}>Symbolic</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.bg,
  },
  wordmark: {
    color: theme.text,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  dot: { color: theme.accent },
  tagline: { color: theme.muted, fontSize: 13, marginTop: 4 },
  grid: {
    marginTop: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    maxWidth: 320,
  },
  shortcut: { width: 80, alignItems: 'center', gap: 6 },
  tile: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLetter: { color: theme.text, fontSize: 18, fontWeight: '700' },
  shortcutLabel: { color: theme.muted, fontSize: 11 },
  badge: {
    marginTop: 32,
    color: theme.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeAccent: { color: theme.accent, fontWeight: '700' },
});
