import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SecureStore has a 2048-byte limit — split large tokens into chunks
const CHUNK = 1900;

const ChunkedStore = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const count = await SecureStore.getItemAsync(`${key}_n`);
      if (!count) return SecureStore.getItemAsync(key);
      const parts: string[] = [];
      for (let i = 0; i < parseInt(count, 10); i++) {
        const p = await SecureStore.getItemAsync(`${key}_${i}`);
        if (p === null) return null;
        parts.push(p);
      }
      return parts.join('');
    } catch { return null; }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK) {
      chunks.push(value.slice(i, i + CHUNK));
    }
    await SecureStore.setItemAsync(`${key}_n`, String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const count = await SecureStore.getItemAsync(`${key}_n`);
      if (count) {
        for (let i = 0; i < parseInt(count, 10); i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_n`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch { /* ignore */ }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});