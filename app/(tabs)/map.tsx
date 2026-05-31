import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { supabase } from '@/src/lib/supabase';
import {
  PollutionReport, getNearbyReports, getCachedReports, cacheReports,
} from '@/src/lib/reports';

const severityColour = (s: number) => {
  if (s === 3) return Colors.danger;
  if (s === 2) return Colors.warning;
  return Colors.water;
};

const DEFAULT_REGION: Region = {
  latitude: 52.4862,
  longitude: -1.8904,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [reports, setReports] = useState<PollutionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationGranted, setLocationGranted] = useState(false);
  const [selectedReport, setSelectedReport] = useState<PollutionReport | null>(null);

  useEffect(() => {
    setupAndLoad();

    const channel = supabase
      .channel('map_reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pollution_reports' },
        (payload) => setReports(prev => [payload.new as PollutionReport, ...prev])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const setupAndLoad = async () => {
    const cached = getCachedReports();
    if (cached.length > 0) setReports(cached);

    let lat = DEFAULT_REGION.latitude;
    let lng = DEFAULT_REGION.longitude;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationGranted(true);
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        const r: Region = { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
        mapRef.current?.animateToRegion(r, 800);
      } catch { /* fall back to default region */ }
    }

    const { data } = await getNearbyReports(lat, lng);
    setLoading(false);
    if (data) {
      setReports(data);
      cacheReports(data);
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
      >
        {reports.map(report => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.lat, longitude: report.lng }}
            pinColor={severityColour(report.severity)}
            onPress={() => setSelectedReport(report)}
          />
        ))}
      </MapView>

      {/* Floating header */}
      <SafeAreaView edges={['top']} style={styles.headerWrap}>
        <View style={styles.header}>
          <Text style={styles.appName}>Ripple Effect</Text>
          {reports.length > 0 && (
            <Text style={styles.reportCount}>{reports.length} reports nearby</Text>
          )}
        </View>
      </SafeAreaView>

      {/* Loading spinner */}
      {loading && (
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      )}

      {/* FAB — report pollution */}
      <SafeAreaView edges={['bottom']} style={styles.fabWrap}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(report)')}
          activeOpacity={0.85}
        >
          <Plus size={24} color={Colors.white} strokeWidth={2.5} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Detail panel — tap a marker to open, tap map to close */}
      {selectedReport && (
        <View style={styles.detailPanel}>
          {selectedReport.photo_url ? (
            <Image
              source={{ uri: selectedReport.photo_url }}
              style={styles.detailPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.detailPhoto, styles.noPhoto]}>
              <Text style={styles.noPhotoText}>No photo</Text>
            </View>
          )}
          <View style={styles.detailInfo}>
            <Text style={styles.detailType}>
              {selectedReport.pollution_type.replace(/_/g, ' ')}
            </Text>
            <Text style={styles.detailMeta}>
              Severity {selectedReport.severity}/3 · {new Date(selectedReport.created_at).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.detailClose}
            onPress={() => setSelectedReport(null)}
          >
            <Text style={styles.detailCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  appName: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  reportCount: { fontSize: 12, color: Colors.textMuted },
  spinnerWrap: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    marginTop: -12,
  },
  fabWrap: { position: 'absolute', bottom: 0, right: 0 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  detailPanel: {
    position: 'absolute',
    bottom: 90,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  detailPhoto: { width: '100%', height: 160 },
  noPhoto: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: { color: Colors.textMuted, fontSize: 13 },
  detailInfo: { padding: Spacing.md },
  detailType: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  detailMeta: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  detailClose: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCloseText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
});