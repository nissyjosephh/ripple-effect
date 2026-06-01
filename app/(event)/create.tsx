import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { EnvironmentType, createEvent, addPickupPoint, getWeather } from '@/src/lib/events';

const ENV_TYPES: EnvironmentType[] = ['beach', 'river', 'park', 'urban', 'other'];

export default function CreateEventScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [envType, setEnvType] = useState<EnvironmentType>('park');
  const [date, setDate] = useState(''); // YYYY-MM-DD
  const [time, setTime] = useState(''); // HH:MM
  const [maxParticipants, setMaxParticipants] = useState('');
  const [pickupLabel, setPickupLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  const captureLocation = async () => {
    setLocLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Allow location to pin the event.');
      setLocLoading(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const geo = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    if (geo.length > 0) {
      const g = geo[0];
      setLocationName([g.street, g.district, g.city].filter(Boolean).join(', '));
    }
    setLocLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    if (!locationName.trim()) { Alert.alert('Location required'); return; }
    if (!coords) { Alert.alert('Pin location', 'Tap "Use my location" to set the event pin.'); return; }
    if (!date.trim() || !time.trim()) { Alert.alert('Date & time required', 'Enter date as YYYY-MM-DD and time as HH:MM'); return; }

    // Parse date and time into ISO string
    const startTime = new Date(`${date.trim()}T${time.trim()}:00`);
    if (isNaN(startTime.getTime())) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DD for date and HH:MM for time.');
      return;
    }

    setLoading(true);

    // Fetch weather for the location
    const weather = await getWeather(coords.lat, coords.lng);

    const { data: newEvent, error } = await createEvent({
      title: title.trim(),
      description: description.trim() || undefined,
      location_name: locationName.trim(),
      lat: coords.lat,
      lng: coords.lng,
      environment_type: envType,
      start_time: startTime.toISOString(),
      max_participants: maxParticipants ? parseInt(maxParticipants) : undefined,
      ...(weather ? { weather_data: weather } : {}),
    } as any);

    if (error || !newEvent) {
      Alert.alert('Failed to create event', error?.message ?? 'Unknown error');
      setLoading(false);
      return;
    }

    // Add pickup point if label provided
    if (pickupLabel.trim()) {
      await addPickupPoint(newEvent.id, pickupLabel.trim(), coords.lat, coords.lng);
    }

    setLoading(false);
    Alert.alert('Event created ✓', 'Your event is now live.', [
      { text: 'View it', onPress: () => router.replace(`/(event)/${newEvent.id}`) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>Create event</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Event title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Canal cleanup — Brindleyplace"
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="What to expect, what to bring…"
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Location *</Text>
          <TextInput
            style={styles.input}
            placeholder="Location name"
            placeholderTextColor={Colors.textMuted}
            value={locationName}
            onChangeText={setLocationName}
          />
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={captureLocation}
            disabled={locLoading}
            activeOpacity={0.8}
          >
            {locLoading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <>
                  <MapPin size={14} color={Colors.primary} />
                  <Text style={styles.locationBtnText}>
                    {coords ? 'Location pinned ✓' : 'Use my current location'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Environment type */}
        <View style={styles.field}>
          <Text style={styles.label}>Environment type *</Text>
          <View style={styles.typeRow}>
            {ENV_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typePill, envType === t && styles.typePillOn]}
                onPress={() => setEnvType(t)}
                activeOpacity={0.7}
              >
                <Text style={[styles.typeText, envType === t && styles.typeTextOn]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date & time */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-06-20"
              placeholderTextColor={Colors.textMuted}
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Time * (HH:MM)</Text>
            <TextInput
              style={styles.input}
              placeholder="10:00"
              placeholderTextColor={Colors.textMuted}
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* Max participants */}
        <View style={styles.field}>
          <Text style={styles.label}>Max participants (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Leave blank for unlimited"
            placeholderTextColor={Colors.textMuted}
            value={maxParticipants}
            onChangeText={setMaxParticipants}
            keyboardType="number-pad"
          />
        </View>

        {/* Pickup point */}
        <View style={styles.field}>
          <Text style={styles.label}>First pickup point label (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Main entrance"
            placeholderTextColor={Colors.textMuted}
            value={pickupLabel}
            onChangeText={setPickupLabel}
          />
          <Text style={styles.hint}>
            What3Words address auto-generated from event location
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnOff]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.submitText}>Create event</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  barTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  field: { gap: Spacing.xs },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    fontSize: 15, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  multiline: { height: 80, textAlignVertical: 'top' },
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  locationBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  typePill: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  typePillOn: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  typeText: { fontSize: 13, color: Colors.textSecondary, textTransform: 'capitalize', fontWeight: '500' },
  typeTextOn: { color: Colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  hint: { fontSize: 12, color: Colors.textMuted },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
  },
  submitBtnOff: { opacity: 0.45 },
  submitText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});