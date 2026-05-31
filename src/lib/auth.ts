import { supabase } from './supabase';

// Register a new user with email + password
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
};

// Sign in an existing user
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

// Sign out the current user
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

// Fetch profile to check if onboarding is done
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, city, onboarding_complete')
    .eq('id', userId)
    .single();
  return { data, error };
};

// Save name + city and mark onboarding complete
export const completeOnboarding = async (
  userId: string,
  displayName: string,
  city: string
) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      city,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  return { error };
};