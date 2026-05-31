import { useEffect, useRef } from 'react';
import { View, Animated, Image, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/src/constants/colors';
import { supabase } from '@/src/lib/supabase';
import { getProfile } from '@/src/lib/auth';

const { width } = Dimensions.get('window');
const LOGO_SIZE = width * 0.65;

export default function SplashScreen() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // Run animation and auth check in parallel
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();

    // Wait for splash to show, then check session and route accordingly
    const timer = setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // No session — send to login
        router.replace('/(auth)/login');
        return;
      }

      // Session exists — check if onboarding is done
      const { data: profile } = await getProfile(session.user.id);

      if (!profile?.onboarding_complete) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(tabs)/map');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});