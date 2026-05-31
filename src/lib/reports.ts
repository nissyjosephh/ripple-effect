import { supabase } from './supabase';
import { db } from './database';
import * as FileSystem from 'expo-file-system';
export type PollutionType =
  'plastic' | 'fly_tipping' | 'sewage' | 'oil_chemical' | 'general_litter' | 'other';

export interface PollutionReport {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  pollution_type: PollutionType;
  severity: 1 | 2 | 3;
  photo_url: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  is_resolved: boolean;
  created_at: string;
}

// Haversine distance in metres between two GPS points
export const distanceMetres = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Fetch unresolved reports within ~5km bounding box
export const getNearbyReports = async (lat: number, lng: number) => {
  const delta = 0.045;
  const { data, error } = await supabase
    .from('pollution_reports')
    .select('*')
    .eq('is_resolved', false)
    .gte('lat', lat - delta)
    .lte('lat', lat + delta)
    .gte('lng', lng - delta)
    .lte('lng', lng + delta)
    .order('created_at', { ascending: false })
    .limit(100);
  return { data, error };
};

// Submit a new report to Supabase
export const submitReport = async (report: {
  lat: number;
  lng: number;
  pollution_type: PollutionType;
  severity: 1 | 2 | 3;
  photo_url?: string;
}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { data: null, error: new Error('Not signed in') };

  const { data, error } = await supabase
    .from('pollution_reports')
    .insert({ ...report, user_id: session.user.id })
    .select()
    .single();
  return { data, error };
};

// Upload photo to the report-photos storage bucket
export const uploadReportPhoto = async (
  uri: string,
  photoId: string
): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Read file as base64 — reliable for local URIs in React Native
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array for Supabase upload
    const byteArray = Uint8Array.from(
      atob(base64).split('').map(c => c.charCodeAt(0))
    );

    const path = `${session.user.id}/${photoId}.jpg`;

    const { error } = await supabase.storage
      .from('report-photos')
      .upload(path, byteArray, { contentType: 'image/jpeg', upsert: true });

    if (error) { console.error('Upload error:', error.message); return null; }

    const { data: { publicUrl } } = supabase.storage
      .from('report-photos')
      .getPublicUrl(path);
    return publicUrl;
  } catch (err) {
    console.error('uploadReportPhoto failed:', err);
    return null;
  }
};

// Cache reports in SQLite for offline use
export const cacheReports = (reports: PollutionReport[]) => {
  try {
    const now = Date.now();
    reports.forEach(r => {
      db.runSync(
        'INSERT OR REPLACE INTO cached_reports (id, data, fetched_at) VALUES (?, ?, ?)',
        [r.id, JSON.stringify(r), now]
      );
    });
  } catch (e) { console.error('cacheReports:', e); }
};

// Return SQLite-cached reports for offline fallback
export const getCachedReports = (): PollutionReport[] => {
  try {
    const rows = db.getAllSync<{ data: string }>(
      'SELECT data FROM cached_reports ORDER BY fetched_at DESC LIMIT 100'
    );
    return rows.map(r => JSON.parse(r.data));
  } catch { return []; }
};