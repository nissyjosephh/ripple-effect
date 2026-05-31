import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { signIn, getProfile } from '@/src/lib/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    const { data, error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);

    if (error) {
      Alert.alert('Sign in failed', error.message);
      return;
    }

    if (!data.session?.user) return;

    const { data: profile } = await getProfile(data.session.user.id);
    if (!profile?.onboarding_complete) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(tabs)/map');
    }
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
          {/* App header with logo image */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/justlogo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Ripple Effect</Text>
            <Text style={styles.tagline}>From concern to certified action</Text>
          </View>

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnOff]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.btnText}>Sign in</Text>}
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Create one</Text>
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
  logoImg: { width: 80, height: 80, marginBottom: Spacing.sm },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: { fontSize: 14, color: Colors.textMuted, marginTop: Spacing.xs },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
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
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnOff: { opacity: 0.55 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: { color: Colors.textMuted, fontSize: 14 },
  link: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});