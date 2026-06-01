import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin, Calendar, Users, Navigation } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { supabase } from '@/src/lib/supabase';
import {
  CleanupEvent, PickupPoint,
  getEventById, getUserRsvp, rsvpToEvent, cancelRsvp,
  checkInToEvent, getWeather, startEvent,
} from '@/src/lib/events';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<CleanupEvent & { pickup_points?: PickupPoint[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<'none' | 'rsvp' | 'checked_in' | 'completed'>('none');
  const [weather, setWeather] = useState<{ temp: number; description: string; icon: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rsvpCount, setRsvpCount] = useState(0);

  useEffect(() => {
    if (id) loadAll(id);
  }, [id]);

  const loadAll = async (eventId: string) => {
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id ?? null);

    const [eventRes, rsvp, w] = await Promise.all([
      getEventById(eventId),
      getUserRsvp(eventId),
      (async () => null)(), // weather loaded after we have coords
    ]);

    setLoading(false);

    if (!eventRes.data) return;
    const ev = eventRes.data as any;
    setEvent(ev);
    setRsvpCount(ev.event_attendees?.[0]?.count ?? 0);

    if (rsvp.data) setRsvpStatus(rsvp.data.status);

    // Fetch weather with coords
    const wData = await getWeather(ev.lat, ev.lng);
    if (wData) setWeather(wData);
  };

  const handleRsvp = async () => {
    if (!event) return;
    setActionLoading(true);
    if (rsvpStatus === 'none') {
      const { error } = await rsvpToEvent(event.id);
      if (!error) {
        setRsvpStatus('rsvp');
        setRsvpCount(c => c + 1);
      } else Alert.alert('Error', error.message);
    } else {
      Alert.alert('Cancel RSVP', 'Remove yourself from this event?', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel RSVP', style: 'destructive',
          onPress: async () => {
            const { error } = await cancelRsvp(event.id);
            if (!error) { setRsvpStatus('none'); setRsvpCount(c => Math.max(0, c - 1)); }
          },
        },
      ]);
    }
    setActionLoading(false);
  };

  const handleCheckIn = async () => {
    if (!event) return;
    setActionLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Allow location to check in.');
      setActionLoading(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { error } = await checkInToEvent(
      event.id, event.lat, event.lng,
      loc.coords.latitude, loc.coords.longitude
    );
    setActionLoading(false);
    if (error) { Alert.alert('Check-in failed', error.message); return; }
    setRsvpStatus('checked_in');
    Alert.alert('Checked in ✓', 'You can now log your bags.', [
      { text: 'Start collecting', onPress: () => router.push(`/(event)/active?eventId=${event.id}`) },
    ]);
  };

  const handleStartEvent = async () => {
    if (!event) return;
    Alert.alert('Start event?', 'This marks it as live so attendees can check in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start now', onPress: async () => {
          setActionLoading(true);
          const { error } = await startEvent(event.id);
          setActionLoading(false);
          if (error) { Alert.alert('Error', error.message); return; }
          setEvent(prev => prev ? { ...prev, status: 'active' } : prev);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.errorText}>Event not found</Text>
      </SafeAreaView>
    );
  }

  const isOrganiser = currentUserId === event.organiser_id;
  const canCheckIn = rsvpStatus === 'rsvp' && event.status === 'active';
  const isCheckedIn = rsvpStatus === 'checked_in';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.barTitle} numberOfLines={1}>{event.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Live banner */}
        {event.status === 'active' && (
          <View style={styles.liveBanner}>
            <Text style={styles.liveBannerText}>● This event is happening now</Text>
          </View>
        )}

        <Text style={styles.title}>{event.title}</Text>
        {event.description && (
          <Text style={styles.description}>{event.description}</Text>
        )}

        <View style={styles.section}>
          <View style={styles.metaRow}>
            <Calendar size={16} color={Colors.primary} />
            <View>
              <Text style={styles.metaLabel}>{fmtDate(event.start_time)}</Text>
              <Text style={styles.metaMuted}>{fmtTime(event.start_time)}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.metaLabel}>{event.location_name}</Text>
          </View>
          <View style={styles.metaRow}>
            <Users size={16} color={Colors.primary} />
            <Text style={styles.metaLabel}>
              {rsvpCount} attending
              {event.max_participants ? ` · ${event.max_participants} max` : ''}
            </Text>
          </View>
          {weather && (
            <View style={styles.metaRow}>
              <Text style={styles.weatherText}>
                🌤 {weather.temp}°C · {weather.description}
              </Text>
            </View>
          )}
        </View>

        {/* Pickup points */}
        {(event.pickup_points?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup Points</Text>
            {event.pickup_points!.map((p, i) => (
              <View key={p.id} style={styles.pickupRow}>
                <Navigation size={14} color={Colors.primary} />
                <View>
                  <Text style={styles.pickupLabel}>{p.label || `Point ${i + 1}`}</Text>
                  {p.what3words && (
                    <Text style={styles.w3w}>{p.what3words}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {/* Organiser: Start event */}
          {isOrganiser && event.status === 'upcoming' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleStartEvent}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.actionBtnText}>Start event now</Text>}
            </TouchableOpacity>
          )}
          {/* RSVP — works for both upcoming and active events */}
          {!isOrganiser && (event.status === 'upcoming' || event.status === 'active') && (
            <TouchableOpacity
                style={[styles.actionBtn, rsvpStatus !== 'none' ? styles.actionBtnSecondary : styles.actionBtnPrimary]}
                onPress={handleRsvp}
                disabled={actionLoading || rsvpStatus === 'checked_in' || rsvpStatus === 'completed'}
                activeOpacity={0.8}
            >
                {actionLoading
                ? <ActivityIndicator color={rsvpStatus !== 'none' ? Colors.primary : Colors.white} />
                : <Text style={[styles.actionBtnText, rsvpStatus !== 'none' && styles.actionBtnTextSecondary]}>
                    {rsvpStatus === 'none' ? 'RSVP to this event'
                    : rsvpStatus === 'checked_in' ? 'Checked in ✓'
                    : rsvpStatus === 'completed' ? 'Contribution logged ✓'
                    : "You're going ✓"}
                    </Text>}
            </TouchableOpacity>
        )}
          {/* Check-in (live event, user has RSVP'd) */}
          {canCheckIn && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={handleCheckIn}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>GPS Check-in</Text>
            </TouchableOpacity>
          )}

          {/* Go to active event screen */}
          {(isCheckedIn || (isOrganiser && event.status === 'active')) && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => router.push(`/(event)/active?eventId=${event.id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>Open active event →</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  barTitle: {
    flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
    textAlign: 'center', marginHorizontal: 4,
  },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  liveBanner: {
    backgroundColor: Colors.dangerLight, borderRadius: Radius.md,
    padding: Spacing.sm, alignItems: 'center',
  },
  liveBannerText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  metaLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  metaMuted: { fontSize: 13, color: Colors.textMuted },
  weatherText: { fontSize: 14, color: Colors.textSecondary },
  pickupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  pickupLabel: { fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  w3w: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: {
    borderRadius: Radius.md, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnSecondary: {
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.primary,
  },
  actionBtnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  actionBtnTextSecondary: { color: Colors.primary },
  errorText: { color: Colors.textMuted, fontSize: 14 },
});