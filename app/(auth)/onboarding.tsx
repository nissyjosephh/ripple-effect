import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { supabase } from '@/src/lib/supabase';
import { completeOnboarding } from '@/src/lib/auth';

export default function OnboardingScreen() {
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim() || !city.trim()) {
      Alert.alert('Missing details', 'Please enter your name and city.');
      return;
    }

    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.replace('/(auth)/login');
      return;
    }

    const { error } = await completeOnboarding(
      session.user.id,
      displayName.trim(),
      city.trim()
    );

    setLoading(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }

    router.replace('/(tabs)/map');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>Almost there</Text>
            <Text style={styles.subtitle}>Tell us a little about yourself</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alex"
                placeholderTextColor={Colors.textMuted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoComplete="given-name"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Your city</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Birmingham"
                placeholderTextColor={Colors.textMuted}
                value={city}
                onChangeText={setCity}
                autoCapitalize="words"
              />
              <Text style={styles.hint}>Used to show events near you</Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnOff]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.btnText}>Get started</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  header: { alignItems: 'center', marginBottom: Spacing.xxl },
  emoji: { fontSize: 48, marginBottom: Spacing.sm },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: Spacing.xs },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  field: { gap: Spacing.xs },
  label: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hint: { fontSize: 12, color: Colors.textMuted },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnOff: { opacity: 0.55 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});