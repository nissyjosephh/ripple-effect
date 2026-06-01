import { supabase } from './supabase';
import { db } from './database';
import { distanceMetres } from './reports';

export type EnvironmentType = 'beach' | 'river' | 'park' | 'urban' | 'other';

export interface CleanupEvent {
  id: string;
  organiser_id: string;
  title: string;
  description: string | null;
  location_name: string;
  lat: number;
  lng: number;
  environment_type: EnvironmentType;
  start_time: string;
  max_participants: number | null;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  weather_data: { temp: number; description: string; icon: string } | null;
  created_at: string;
  distance?: number;
  rsvp_count?: number;
}

export interface PickupPoint {
  id: string;
  event_id: string;
  label: string;
  lat: number;
  lng: number;
  what3words: string | null;
}

// Fetch upcoming events, sorted by distance client-side
export const getUpcomingEvents = async (lat: number, lng: number) => {
  const { data, error } = await supabase
    .from('cleanup_events')
    .select('*, event_attendees(count)')
    .in('status', ['upcoming', 'active'])
    .gte('start_time', new Date(Date.now() - 86400000).toISOString())
    .order('start_time', { ascending: true })
    .limit(50);

  if (error) return { data: null, error };

  const sorted = (data ?? [])
    .map(e => ({
      ...e,
      distance: distanceMetres(lat, lng, e.lat, e.lng),
      rsvp_count: e.event_attendees?.[0]?.count ?? 0,
    }))
    .sort((a, b) => a.distance - b.distance);

  return { data: sorted as CleanupEvent[], error: null };
};

// Get a single event with its pickup points
export const getEventById = async (id: string) => {
  const { data, error } = await supabase
    .from('cleanup_events')
    .select('*, pickup_points(*), event_attendees(count)')
    .eq('id', id)
    .single();
  return { data, error };
};

// Check if the current user has RSVP'd to an event
export const getUserRsvp = async (eventId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { data: null };
  const { data } = await supabase
    .from('event_attendees')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', session.user.id)
    .maybeSingle();
  return { data };
};

// RSVP to an event
export const rsvpToEvent = async (eventId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: new Error('Not signed in') };
  const { error } = await supabase
    .from('event_attendees')
    .insert({ event_id: eventId, user_id: session.user.id });
  return { error };
};

// Cancel an existing RSVP
export const cancelRsvp = async (eventId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: new Error('Not signed in') };
  const { error } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', session.user.id);
  return { error };
};

// GPS check-in — validates user is within 200m of event
export const checkInToEvent = async (
  eventId: string,
  eventLat: number,
  eventLng: number,
  userLat: number,
  userLng: number
) => {
  const dist = distanceMetres(userLat, userLng, eventLat, eventLng);
  if (dist > 200) {
    return {
      error: new Error(
        `You need to be within 200m. You are ${Math.round(dist)}m away.`
      ),
    };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: new Error('Not signed in') };

  const { error } = await supabase
    .from('event_attendees')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('user_id', session.user.id);
  return { error };
};

// Create a new cleanup event
export const createEvent = async (event: {
  title: string;
  description?: string;
  location_name: string;
  lat: number;
  lng: number;
  environment_type: EnvironmentType;
  start_time: string;
  max_participants?: number;
}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { data: null, error: new Error('Not signed in') };

  const { data, error } = await supabase
    .from('cleanup_events')
    .insert({ ...event, organiser_id: session.user.id })
    .select()
    .single();
  return { data, error };
};

// Add a pickup point — auto-generates What3Words address if key is set
export const addPickupPoint = async (
  eventId: string,
  label: string,
  lat: number,
  lng: number
) => {
  let what3words: string | null = null;
  const w3wKey = process.env.EXPO_PUBLIC_WHAT3WORDS_KEY;

  if (w3wKey && !w3wKey.includes('your_')) {
    try {
      const res = await fetch(
        `https://api.what3words.com/v3/convert-to-3wa?coordinates=${lat},${lng}&key=${w3wKey}`
      );
      const json = await res.json();
      if (json.words) what3words = `///${json.words}`;
    } catch { /* skip if unavailable */ }
  }

  const { error } = await supabase
    .from('pickup_points')
    .insert({ event_id: eventId, label, lat, lng, what3words });

  return { error, what3words };
};

// Submit or update a contribution for an event
export const submitContribution = async (
  eventId: string,
  bags: number,
  kg: number,
  notes?: string
) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: new Error('Not signed in') };

  const { error } = await supabase
    .from('contributions')
    .upsert({
      event_id: eventId,
      user_id: session.user.id,
      bags_collected: bags,
      kg_collected: kg,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id,user_id' });
    
  if (!error) {
    await supabase
      .from('event_attendees')
      .update({ status: 'completed' })
      .eq('event_id', eventId)
      .eq('user_id', session.user.id);
  }
  return { error };
};

// Get all contributions for an event (live team feed)
export const getEventContributions = async (eventId: string) => {
  const { data, error } = await supabase
    .from('contributions')
    .select('*, profiles(display_name)')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false });
  return { data, error };
};

// Fetch current weather from OpenWeatherMap
export const getWeather = async (lat: number, lng: number) => {
  const key = process.env.EXPO_PUBLIC_OPENWEATHER_KEY;
  if (!key || key.includes('your_')) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric`
    );
    const d = await res.json();
    return {
      temp: Math.round(d.main?.temp ?? 0),
      description: d.weather?.[0]?.description ?? '',
      icon: d.weather?.[0]?.main ?? 'Clear',
    };
  } catch { return null; }
};

// Cache events in SQLite for offline use
export const cacheEvents = (events: CleanupEvent[]) => {
  try {
    const now = Date.now();
    events.forEach(e => {
      db.runSync(
        'INSERT OR REPLACE INTO cached_events (id, data, fetched_at) VALUES (?, ?, ?)',
        [e.id, JSON.stringify(e), now]
      );
    });
  } catch { /* ignore */ }
};

export const getCachedEvents = (): CleanupEvent[] => {
  try {
    const rows = db.getAllSync<{ data: string }>(
      'SELECT data FROM cached_events ORDER BY fetched_at DESC LIMIT 50'
    );
    return rows.map(r => JSON.parse(r.data));
  } catch { return []; }
};

// Organiser marks event as active (starts it)
export const startEvent = async (eventId: string) => {
  const { error } = await supabase
    .from('cleanup_events')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', eventId);
  return { error };
};