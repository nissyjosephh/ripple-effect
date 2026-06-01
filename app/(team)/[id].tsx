import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { supabase } from '@/src/lib/supabase';
import { getTeamById, getTeamStats, leaveTeam, LeaderboardEntry } from '@/src/lib/community';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [team, setTeam] = useState<any>(null);
  const [stats, setStats] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (id) load(id);
  }, [id]);

  const load = async (teamId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id ?? null);

    const [teamRes, statsRes] = await Promise.all([
      getTeamById(teamId),
      getTeamStats(teamId),
    ]);

    setTeam(teamRes.data);
    setStats(statsRes.data);
    setLoading(false);

    if (teamRes.data && session?.user) {
      const member = teamRes.data.team_members?.find(
        (m: any) => m.profiles && session.user.id
      );
      // Check membership by querying separately
      const { data } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      setIsMember(!!data);
    }
  };

  const copyInviteCode = async () => {
    if (!team?.invite_code) return;
    await Clipboard.setStringAsync(team.invite_code);
    Alert.alert('Copied!', `Invite code ${team.invite_code} copied to clipboard.`);
  };

  const handleLeave = () => {
    if (!team) return;
    Alert.alert('Leave team', `Leave ${team.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          const { error } = await leaveTeam(team.id);
          if (error) { Alert.alert('Error', error.message); return; }
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!team) {
  return (
    <SafeAreaView style={[styles.safe, styles.center]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg }}
      >
        <ChevronLeft size={20} color={Colors.primary} />
        <Text style={{ color: Colors.primary, fontSize: 15, fontWeight: '600' }}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.errorText}>Team not found</Text>
    </SafeAreaView>
    );
  }

  const isCaptain = currentUserId === team.captain_id;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.barTitle} numberOfLines={1}>{team.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Team header */}
        <View style={styles.teamHeader}>
          <Text style={styles.teamEmoji}>🌿</Text>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamCity}>{team.city}</Text>
          {team.description && (
            <Text style={styles.teamDesc}>{team.description}</Text>
          )}
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{Math.round(stats.impact_score)}</Text>
              <Text style={styles.statLabel}>Impact pts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.total_kg.toFixed(0)}</Text>
              <Text style={styles.statLabel}>kg cleaned</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.events_attended}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.member_count}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
          </View>
        )}

        {/* Invite code (captain only) */}
        {isCaptain && (
          <View style={styles.inviteCard}>
            <View>
              <Text style={styles.inviteLabel}>Your invite code</Text>
              <Text style={styles.inviteCode}>{team.invite_code}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={copyInviteCode} activeOpacity={0.7}>
              <Copy size={16} color={Colors.primary} />
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Members */}
        <Text style={styles.sectionTitle}>Members</Text>
        {(team.team_members ?? []).map((m: any, i: number) => (
          <View key={i} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {(m.profiles?.display_name ?? '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.profiles?.display_name ?? 'Unknown'}</Text>
              <Text style={styles.memberCity}>{m.profiles?.city || ''}</Text>
            </View>
            {m.role === 'captain' && (
              <Text style={styles.captainBadge}>Captain</Text>
            )}
          </View>
        ))}

        {/* Leave button */}
        {isMember && !isCaptain && (
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} activeOpacity={0.8}>
            <Text style={styles.leaveBtnText}>Leave team</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  backBtn: { padding: Spacing.xs },
  barTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center', marginHorizontal: 4 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  teamHeader: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  teamEmoji: { fontSize: 48 },
  teamName: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  teamCity: { fontSize: 14, color: Colors.textMuted },
  teamDesc: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  statsRow: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  inviteLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  inviteCode: { fontSize: 24, fontWeight: '800', color: Colors.primary, letterSpacing: 4, marginTop: 2 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  memberName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  memberCity: { fontSize: 12, color: Colors.textMuted },
  captainBadge: {
    fontSize: 11, color: Colors.primary, backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, fontWeight: '700',
  },
  leaveBtn: {
    borderWidth: 1.5, borderColor: Colors.danger, borderRadius: Radius.md,
    paddingVertical: 12, alignItems: 'center', marginTop: Spacing.sm,
  },
  leaveBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  errorText: { color: Colors.textMuted, fontSize: 14 },
});