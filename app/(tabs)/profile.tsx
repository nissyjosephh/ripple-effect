import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { signOut } from '@/src/lib/auth';
import { supabase } from '@/src/lib/supabase';

export default function ProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setEmail(session.user.email ?? '');
      const { data } = await supabase
        .from('profiles')
        .select('display_name, city')
        .eq('id', session.user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name);
        setCity(data.city);
      }
    };
    load();
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.appName}>Ripple Effect</Text>
      </View>
      <View style={styles.body}>
        {/* Initials avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName ? displayName[0].toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.city}>{city}</Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.divider} />
        <Text style={styles.note}>Full profile coming in Phase 5</Text>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  appName: { fontSize: 18, fontWeight: '500', color: Colors.primary, letterSpacing: -0.3 },
  body: { flex: 1, alignItems: 'center', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xl },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  name: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  city: { fontSize: 14, color: Colors.textSecondary, marginTop: Spacing.xs },
  email: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  divider: { width: '100%', height: 0.5, backgroundColor: Colors.border, marginVertical: Spacing.xl },
  note: { fontSize: 13, color: Colors.textMuted, marginBottom: Spacing.xxl },
  signOutBtn: {
    width: '100%', borderWidth: 1.5, borderColor: Colors.danger,
    borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center',
  },
  signOutText: { color: Colors.danger, fontSize: 15, fontWeight: '600' },
});