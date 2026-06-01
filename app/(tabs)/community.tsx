import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Users, Trophy } from 'lucide-react-native';
import { Colors } from '@/src/constants/colors';
import { Spacing, Radius } from '@/src/constants/spacing';
import { supabase } from '@/src/lib/supabase';
import {
  LeaderboardEntry, Team,
  getLeaderboard, getMyTeam, joinTeamByCode,
  leaveTeam, getActivityFeed,
} from '@/src/lib/community';

type Scope = 'global' | 'city';
type Mode = 'leaderboard' | 'teams';

const rankBadge = (i: number) => {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return `#${i + 1}`;
};

export default function CommunityScreen() {
  const [mode, setMode] = useState<Mode>('leaderboard');
  const [scope, setScope] = useState<Scope>('global');
  const [myTeam, setMyTeam] = useState<(Team & { role: string }) | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userCity, setUserCity] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const loadAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('city')
        .eq('id', session.user.id)
        .single();
      if (profile?.city) setUserCity(profile.city);
    }

    const [teamRes, boardRes, feedRes] = await Promise.all([
      getMyTeam(),
      getLeaderboard(),
      getActivityFeed(),
    ]);

    setMyTeam(
      teamRes.data
        ? { ...(teamRes.data.teams as unknown as Team), role: teamRes.data.role }
        : null
    );
    if (boardRes.data) setLeaderboard(boardRes.data);
    if (feedRes.data) setActivity(feedRes.data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel('community_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contributions' },
        () => loadAll()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (scope === 'city' && userCity) {
      getLeaderboard(userCity).then(({ data }) => { if (data) setLeaderboard(data); });
    } else {
      getLeaderboard().then(({ data }) => { if (data) setLeaderboard(data); });
    }
  }, [scope, userCity]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [scope, userCity]);

  const handleJoin = async () => {
    if (!joinCode.trim() || joinCode.length < 6) {
      Alert.alert('Error', 'Please enter a 6-character invite code');
      return;
    }

    const doJoin = async () => {
      setJoining(true);
      const { error, teamName } = await joinTeamByCode(joinCode);
      setJoining(false);
      if (error) {
        Alert.alert('Could not join', error.message);
      } else {
        Alert.alert('Joined! 🎉', `You are now a member of ${teamName}.`);
        setJoinCode('');
        loadAll();
      }
    };

    if (myTeam) {
      Alert.alert(
        'Switch Team?',
        `You're currently in ${myTeam.name}. Joining a new team will remove you from it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch Team',
            style: 'destructive',
            onPress: async () => {
              await leaveTeam(myTeam.id);
              await doJoin();
            },
          },
        ]
      );
    } else {
      await doJoin();
    }
  };

  const handleLeave = () => {
    if (!myTeam) return;
    Alert.alert('Leave team', `Leave ${myTeam.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const { error } = await leaveTeam(myTeam.id);
          if (error) { Alert.alert('Error', error.message); return; }
          setMyTeam(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/(team)/create')}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'leaderboard' && styles.modeBtnOn]}
          onPress={() => setMode('leaderboard')}
        >
          <Trophy size={14} color={mode === 'leaderboard' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.modeText, mode === 'leaderboard' && styles.modeTextOn]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'teams' && styles.modeBtnOn]}
          onPress={() => setMode('teams')}
        >
          <Users size={14} color={mode === 'teams' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.modeText, mode === 'teams' && styles.modeTextOn]}>Teams</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.scroll}
      >
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />

        ) : mode === 'leaderboard' ? (
          <>
            {/* My Team card */}
            {myTeam && (
              <View style={styles.myTeamCard}>
                <View style={styles.myTeamRow}>
                  <View style={styles.myTeamIcon}>
                    <Text style={styles.myTeamEmoji}>🌿</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.myTeamName}>{myTeam.name}</Text>
                    <Text style={styles.myTeamCity}>{myTeam.city} · {myTeam.role}</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push(`/(team)/${myTeam.id}`)}>
                    <Text style={styles.viewTeamLink}>View →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Global / City scope toggle */}
            <View style={styles.scopeRow}>
              <TouchableOpacity
                style={[styles.scopeBtn, scope === 'global' && styles.scopeBtnOn]}
                onPress={() => setScope('global')}
              >
                <Text style={[styles.scopeText, scope === 'global' && styles.scopeTextOn]}>
                  Global
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scopeBtn, scope === 'city' && styles.scopeBtnOn]}
                onPress={() => setScope('city')}
              >
                <Text style={[styles.scopeText, scope === 'city' && styles.scopeTextOn]}>
                  {userCity || 'City'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ranked team list */}
            {leaderboard.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No teams yet</Text>
                <Text style={styles.emptySub}>Create the first one and claim #1</Text>
              </View>
            ) : (
              leaderboard.map((entry, i) => (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.rankCard, i < 3 && styles.rankCardTop]}
                  onPress={() => router.push(`/(team)/${entry.id}`)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.rankBadge, i < 3 && styles.rankBadgeTop]}>
                    {rankBadge(i)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rankName}>{entry.name}</Text>
                    <Text style={styles.rankMeta}>
                      {entry.city} · {entry.member_count} member{entry.member_count !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.rankStats}>
                      {entry.total_kg.toFixed(0)}kg · {entry.events_attended} events
                    </Text>
                  </View>
                  <View style={styles.scoreWrap}>
                    <Text style={styles.scoreValue}>{Math.round(entry.impact_score)}</Text>
                    <Text style={styles.scoreLabel}>pts</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Recent activity feed */}
            {activity.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {activity.slice(0, 5).map((a, i) => (
                  <View key={i} style={styles.activityRow}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityName}>
                        {a.profiles?.display_name ?? 'Someone'}
                      </Text>
                      {' cleaned '}
                      <Text style={styles.activityBold}>
                        {a.bags_collected} bag{a.bags_collected !== 1 ? 's' : ''}
                      </Text>
                      {a.cleanup_events?.title ? ` at ${a.cleanup_events.title}` : ''}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>

        ) : (
          <>
            {/* Current team card + leave (only if in a team) */}
            {myTeam && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your team</Text>
                <TouchableOpacity
                  style={styles.myTeamCard}
                  onPress={() => router.push(`/(team)/${myTeam.id}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.myTeamRow}>
                    <Text style={styles.myTeamEmoji}>🌿</Text>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={styles.myTeamName}>{myTeam.name}</Text>
                      <Text style={styles.myTeamCity}>{myTeam.city} · {myTeam.role}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
                  <Text style={styles.leaveBtnText}>Leave team</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Join by invite code — always visible */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Join a team</Text>
              <View style={styles.joinRow}>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Enter invite code"
                  placeholderTextColor={Colors.textMuted}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <TouchableOpacity
                  style={[styles.joinBtn, (!joinCode.trim() || joining) && styles.joinBtnOff]}
                  onPress={handleJoin}
                  disabled={!joinCode.trim() || joining}
                  activeOpacity={0.8}
                >
                  {joining
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.joinBtnText}>Join</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {/* Create team — only shown when not in a team */}
            {!myTeam && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Or start your own</Text>
                <TouchableOpacity
                  style={styles.createTeamCard}
                  onPress={() => router.push('/(team)/create')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.createTeamEmoji}>🌱</Text>
                  <View>
                    <Text style={styles.createTeamTitle}>Create a team</Text>
                    <Text style={styles.createTeamSub}>Invite friends with a code</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  createBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  modeBar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md, gap: Spacing.md,
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  modeBtnOn: { borderBottomColor: Colors.primary },
  modeText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
  modeTextOn: { color: Colors.primary, fontWeight: '700' },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  myTeamCard: {
    backgroundColor: Colors.primaryLight, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder,
  },
  myTeamRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  myTeamIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  myTeamEmoji: { fontSize: 20 },
  myTeamName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  myTeamCity: { fontSize: 12, color: Colors.textSecondary, marginTop: 1, textTransform: 'capitalize' },
  viewTeamLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  scopeRow: { flexDirection: 'row', gap: Spacing.sm },
  scopeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: Radius.md,
    alignItems: 'center', backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  scopeBtnOn: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  scopeText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  scopeTextOn: { color: Colors.primary, fontWeight: '700' },
  rankCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  rankCardTop: { borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryLight },
  rankBadge: { fontSize: 18, minWidth: 32, textAlign: 'center', color: Colors.textMuted, fontWeight: '700' },
  rankBadgeTop: { fontSize: 22 },
  rankName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  rankMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  rankStats: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  scoreWrap: { alignItems: 'center' },
  scoreValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  scoreLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.sm,
  },
  activityRow: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  activityText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  activityName: { fontWeight: '700', color: Colors.textPrimary },
  activityBold: { fontWeight: '700', color: Colors.primary },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  emptySub: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  section: { gap: Spacing.sm },
  joinRow: { flexDirection: 'row', gap: Spacing.sm },
  codeInput: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border,
    letterSpacing: 2, fontWeight: '700',
  },
  joinBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center',
  },
  joinBtnOff: { opacity: 0.45 },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  createTeamCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  createTeamEmoji: { fontSize: 28 },
  createTeamTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  createTeamSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  leaveBtn: {
    borderWidth: 1.5, borderColor: Colors.danger, borderRadius: Radius.md,
    paddingVertical: 10, alignItems: 'center',
  },
  leaveBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
});