import { Slot } from 'expo-router';

// No header or navigation bar on auth screens
export default function AuthLayout() {
  return <Slot />;
}