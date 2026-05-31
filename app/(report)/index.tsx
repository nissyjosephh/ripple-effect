import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { PollutionType, submitReport, uploadReportPhoto } from '@/src/lib/reports';

const TYPES: { key: PollutionType; label: string; emoji: string }[] = [
  { key: 'plastic',       label: 'Plastic',     emoji: '🧴' },
  { key: 'fly_tipping',   label: 'Fly-tipping', emoji: '🗑️' },
  { key: 'sewage',        label: 'Sewage',       emoji: '💧' },
  { key: 'oil_chemical',  label: 'Oil/Chemical', emoji: '🛢️' },
  { key: 'general_litter',label: 'Litter',       emoji: '🍂' },
  { key: 'other',         label: 'Other',        emoji: '⚠️' },
];

export default function ReportScreen() {
  const [step, setStep] = useState<'loading' | 'tag'>('loading');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pollutionType, setPollutionType] = useState<PollutionType | null>(null);
  const [severity, setSeverity] = useState<1 | 2 | 3>(2);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Getting location…');
  const [submitting, setSubmitting] = useState(false);

  // Open camera immediately when screen loads
  useEffect(() => {
    openCamera();
  }, []);

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera needed', 'Allow camera access to report pollution.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsEditing: false,
    });

    if (result.canceled) { router.back(); return; }

    setPhotoUri(result.assets[0].uri);
    setStep('tag');

    // Capture GPS in parallel while user selects type
    captureLocation();
  };

  const captureLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationLabel('Location unavailable'); return; }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      // Readable address from coordinates
      const geo = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geo.length > 0) {
        const g = geo[0];
        setLocationLabel(
          [g.street, g.district, g.city].filter(Boolean).join(', ') || 'Current location'
        );
      } else {
        setLocationLabel('Current location');
      }
    } catch {
      setLocationLabel('Location unavailable');
    }
  };

  const handleSubmit = async () => {
    if (!pollutionType) {
      Alert.alert('Select a type', 'Please choose the type of pollution.');
      return;
    }
    if (!location) {
      Alert.alert('No location', 'Location is still loading. Please wait a moment.');
      return;
    }

    setSubmitting(true);

    // Generate a unique ID for this photo
    const photoId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const photoUrl = photoUri ? await uploadReportPhoto(photoUri, photoId) : null;

    const { error } = await submitReport({
      lat: location.lat,
      lng: location.lng,
      pollution_type: pollutionType,
      severity,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Submission failed', error.message);
      return;
    }

    Alert.alert(
      'Report submitted ✓',
      'Your report helps build the community map.',
      [{ text: 'Done', onPress: () => router.replace('/(tabs)/map') }]
    );
  };

  // Tag step — type + severity + submit
  if (step === 'tag') {
    return (
      <SafeAreaView style={styles.safe}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.barTitle}>Report pollution</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo preview */}
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
          )}

          {/* Pollution type grid */}
          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.typeGrid}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeCard, pollutionType === t.key && styles.typeCardOn]}
                onPress={() => setPollutionType(t.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, pollutionType === t.key && styles.typeLabelOn]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Severity selector */}
          <Text style={styles.sectionLabel}>Severity</Text>
          <View style={styles.severityRow}>
            {([1, 2, 3] as const).map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.severityBtn, severity === level && styles.severityBtnOn]}
                onPress={() => setSeverity(level)}
                activeOpacity={0.7}
              >
                <Text style={[styles.severityText, severity === level && styles.severityTextOn]}>
                  {level === 1 ? 'Minor' : level === 2 ? 'Moderate' : 'Severe'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* GPS location */}
          <View style={styles.locationRow}>
            <Text style={styles.locationPin}>📍</Text>
            <Text style={styles.locationText} numberOfLines={2}>{locationLabel}</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (!pollutionType || submitting) && styles.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!pollutionType || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.submitText}>Submit report</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Initial loading state while camera opens
  return (
    <SafeAreaView style={[styles.safe, styles.centered]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Opening camera…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  barTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  content: { padding: Spacing.lg, gap: Spacing.md },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.sm,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeCard: {
    width: '30.5%',
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  typeCardOn: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeEmoji: { fontSize: 26 },
  typeLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  typeLabelOn: { color: Colors.primary, fontWeight: '600' },
  severityRow: { flexDirection: 'row', gap: Spacing.sm },
  severityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  severityBtnOn: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  severityText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  severityTextOn: { color: Colors.primary, fontWeight: '700' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationPin: { fontSize: 16 },
  locationText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  submitBtnOff: { opacity: 0.45 },
  submitText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  loadingText: { color: Colors.textMuted, marginTop: Spacing.md, fontSize: 14 },
});