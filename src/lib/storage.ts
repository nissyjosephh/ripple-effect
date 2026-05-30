import * as SecureStore from 'expo-secure-store';

export const STORAGE_KEYS = {
  AUTH_SESSION: 'ripple_auth_session',
  USER_ID: 'ripple_user_id',
  USER_DISPLAY_NAME: 'ripple_user_display_name',
  USER_CITY: 'ripple_user_city',
} as const;

export async function saveSecure(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`SecureStore write failed for key ${key}:`, error);
  }
}

export async function getSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error(`SecureStore read failed for key ${key}:`, error);
    return null;
  }
}

export async function deleteSecure(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error(`SecureStore delete failed for key ${key}:`, error);
  }
}