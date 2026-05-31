import { enableScreens } from 'react-native-screens';
enableScreens(false);

// import '../global.css';
import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '@/src/lib/database';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 2 } },
});

export default function RootLayout() {
  useEffect(() => { initDatabase(); }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Slot />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}