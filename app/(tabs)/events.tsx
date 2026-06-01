import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Plus, Calendar, MapPin, Users } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import {
  CleanupEvent, getUpcomingEvents, getCachedEvents, cacheEvents,
} from '@/src/lib/events';

const FILTERS = ['All', 'Beach', 'River', 'Park', 'Urban', 'Other'] as const;
type Filter = typeof FILTERS[number];

const weatherIcon = (icon: string) =>
  ({ Clear: '☀️', Clouds: '☁️', Rain: '🌧️', Drizzle: '🌦️', Snow: '❄️', Thunderstorm: '⛈️' }[icon] ?? '🌤️');

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const fmtDist = (m?: number) => {
  if (m === undefined) return '';
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
};

export default function EventsScreen() {
  const [events, setEvents] = useState<CleanupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [userLoc, setUserLoc] = useState({ lat: 52.4862, lng: -1.8904 });

  useEffect(() => { init(); }, []);

  const init = async () => {
    const cached = getCachedEvents();
    if (cached.length > 0) setEvents(cached);

    let lat = 52.4862, lng = -1.8904;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setUserLoc({ lat, lng });
      } catch { /* default */ }
    }
    await fetchEvents(lat, lng);
  };

  const fetchEvents = async (lat: number, lng: number) => {
    const { data } = await getUpcomingEvents(lat, lng);
    setLoading(false);
    setRefreshing(false);
    if (data) { setEvents(data); cacheEvents(data); }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents(userLoc.lat, userLoc.lng);
  }, [userLoc]);

  const filtered = filter === 'All'
    ? events
    : events.filter(e => e.environment_type === filter.toLowerCase());

  const renderItem = ({ item }: { item: CleanupEvent }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(event)/${item.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <View style={styles.badges}>
          <Text style={styles.envBadge}>{item.environment_type}</Text>
          {item.weather_data && (
            <Text style={styles.weatherBadge}>
              {weatherIcon(item.weather_data.icon)} {item.weather_data.temp}°C
            </Text>
          )}
          {item.status === 'active' && (
            <Text style={styles.liveBadge}>● LIVE</Text>
          )}
        </View>
        <Text style={styles.distText}>{fmtDist(item.distance)}</Text>
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>

      <View style={styles.row}>
        <Calendar size={12} color={Colors.textMuted} />
        <Text style={styles.metaText}>{fmtDate(item.start_time)} · {fmtTime(item.start_time)}</Text>
      </View>
      <View style={styles.row}>
        <MapPin size={12} color={Colors.textMuted} />
        <Text style={styles.metaText} numberOfLines={1}>{item.location_name}</Text>
      </View>
      <View style={styles.row}>
        <Users size={12} color={Colors.textMuted} />
        <Text style={styles.metaText}>
          {item.rsvp_count ?? 0} going
          {item.max_participants ? ` · max ${item.max_participants}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(event)/create')}
          activeOpacity={0.8}
        >
          <Plus size={18} color={Colors.white} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterLabel, filter === f && styles.filterLabelOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No events nearby</Text>
              <Text style={styles.emptySub}>Tap + to organise the first one</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  fab: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    gap: Spacing.xs, backgroundColor: Colors.surface,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  filterPill: {
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: Radius.full, backgroundColor: Colors.background,
  },
  filterPillOn: { backgroundColor: Colors.primaryLight },
  filterLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  filterLabelOn: { color: Colors.primary, fontWeight: '700' },
  list: { padding: Spacing.md, gap: Spacing.md },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: Spacing.xs },
  envBadge: {
    fontSize: 11, color: Colors.primary, backgroundColor: Colors.primaryLight,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full,
    textTransform: 'capitalize', fontWeight: '600',
  },
  weatherBadge: {
    fontSize: 11, color: Colors.textSecondary, backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full,
  },
  liveBadge: {
    fontSize: 11, color: Colors.danger, backgroundColor: Colors.dangerLight,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, fontWeight: '700',
  },
  distText: { fontSize: 12, color: Colors.textMuted },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  emptySub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
});