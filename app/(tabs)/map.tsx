import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { Spacing } from '@/src/constants/spacing';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.appName}>Ripple Effect</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Pollution Heatmap</Text>
        <Text style={styles.sub}>Live map coming in Phase 2</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  appName: { fontSize: 18, fontWeight: '500', color: Colors.primary, letterSpacing: -0.3 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  title: { fontSize: 16, fontWeight: '500', color: Colors.textSecondary },
  sub: { fontSize: 13, color: Colors.textMuted },
});