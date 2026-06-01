import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Minus } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { submitContribution, getEventContributions } from '@/src/lib/events';
import { supabase } from '@/src/lib/supabase';

interface ContributionRow {
  user_id: string;
  bags_collected: number;
  kg_collected: number;
  profiles: { display_name: string } | null;
}

export default function ActiveEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [bags, setBags] = useState(0);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const startTime = useRef(Date.now());

  // ← defined BEFORE useEffect so it can be referenced inside it
  const loadContributions = async () => {
    if (!eventId) return;
    const { data } = await getEventContributions(eventId);
    if (data) setContributions(data as ContributionRow[]);
  };

  useEffect(() => {
    if (!eventId) return;

    loadContributions();

    const channel = supabase
      .channel(`contributions_${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions', filter: `event_id=eq.${eventId}` },
        () => loadContributions()
      )
      .subscribe();

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [eventId]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleSubmit = () => {
    if (bags === 0) {
      Alert.alert('No bags logged', 'Add at least one bag before submitting.');
      return;
    }
    Alert.alert(
      'Submit contribution',
      `Log ${bags} bags (${(bags * 4).toFixed(0)}kg) for this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            if (!eventId) return;
            setSubmitting(true);
            const { error } = await submitContribution(eventId, bags, bags * 4);
            setSubmitting(false);
            if (error) { Alert.alert('Failed', error.message); return; }
            Alert.alert('Contribution logged ✓', `${bags} bags submitted. Thank you!`, [
              { text: 'Back to map', onPress: () => router.replace('/(tabs)/map') },
            ]);
          },
        },
      ]
    );
  };

  const kg = (bags * 4).toFixed(1);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.timerBar}>
        <Text style={styles.timerLabel}>Time elapsed</Text>
        <Text style={styles.timerValue}>{formatTime(elapsed)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.counterCard}>
          <Text style={styles.counterLabel}>Bags filled</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setBags(b => Math.max(0, b - 1))}
              activeOpacity={0.7}
            >
              <Minus size={24} color={Colors.primary} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{bags}</Text>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setBags(b => b + 1)}
              activeOpacity={0.7}
            >
              <Plus size={24} color={Colors.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <Text style={styles.kgLabel}>≈ {kg} kg collected</Text>
        </View>

        {contributions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team so far</Text>
            {contributions.map((c, i) => (
              <View key={i} style={styles.feedRow}>
                <View style={styles.feedAvatar}>
                  <Text style={styles.feedAvatarText}>
                    {(c.profiles?.display_name ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.feedName}>{c.profiles?.display_name ?? 'Someone'}</Text>
                <Text style={styles.feedBags}>{c.bags_collected} bags</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnOff]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Submit my contribution</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Back to event details</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  timerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  timerLabel: { fontSize: 13, color: Colors.textMuted },
  timerValue: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  counterCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  counterLabel: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxl },
  counterBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  counterValue: { fontSize: 64, fontWeight: '800', color: Colors.textPrimary, minWidth: 80, textAlign: 'center' },
  kgLabel: { fontSize: 16, color: Colors.textSecondary, fontWeight: '500' },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm,
  },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  feedAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  feedAvatarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  feedName: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  feedBags: { fontSize: 13, color: Colors.textMuted },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  submitBtnOff: { opacity: 0.45 },
  submitText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelText: { fontSize: 14, color: Colors.textMuted },
});