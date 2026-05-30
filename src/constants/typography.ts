import { StyleSheet } from 'react-native';
import { Colors } from './colors';

export const Typography = StyleSheet.create({
  display: {
    fontSize: 48,
    fontWeight: '500',
    letterSpacing: -1.5,
    color: Colors.textPrimary,
    lineHeight: 52,
  },
  heading: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    lineHeight: 16,
  },
});