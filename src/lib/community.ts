import { supabase } from './supabase';

export interface Team {
  id: string;
  name: string;
  city: string;
  description: string | null;
  captain_id: string;
  invite_code: string;
  is_private: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  city: string;
  member_count: number;
  total_kg: number;
  total_bags: number;
  events_attended: number;
  impact_score: number;
}

// Get ranked leaderboard (global or filtered by city)
export const getLeaderboard = async (city?: string) => {
  let query = supabase
    .from('team_leaderboard')
    .select('*')
    .gt('impact_score', 0)
    .order('impact_score', { ascending: false })
    .limit(20);

  if (city?.trim()) {
    query = query.ilike('city', `%${city.trim()}%`);
  }

  const { data, error } = await query;
  return { data: data as LeaderboardEntry[] | null, error };
};

// Check if the current user is in any team
export const getMyTeam = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { data: null };

  const { data } = await supabase
    .from('team_members')
    .select('role, teams(*)')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return { data };
};

// Get team detail with members
export const getTeamById = async (teamId: string) => {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      team_members(
        id, role, joined_at,
        profiles(display_name, city)
      )
    `)
    .eq('id', teamId)
    .single();
  return { data, error };
};

// Get a team's leaderboard stats
export const getTeamStats = async (teamId: string) => {
  const { data } = await supabase
    .from('team_leaderboard')
    .select('*')
    .eq('id', teamId)
    .single();
  return { data: data as LeaderboardEntry | null };
};

// Create a new team — creator becomes captain
export const createTeam = async (
  name: string,
  city: string,
  description?: string,
  isPrivate = false
) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { data: null, error: new Error('Not signed in') };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name: name.trim(),
      city: city.trim(),
      description: description?.trim() || null,
      captain_id: session.user.id,
      is_private: isPrivate,
    })
    .select()
    .single();

  if (teamError || !team) return { data: null, error: teamError };

  // Add creator as captain in members table
  await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: session.user.id,
    role: 'captain',
  });

  return { data: team as Team, error: null };
};

// Join a team using its invite code
export const joinTeamByCode = async (code: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: new Error('Not signed in') };

  // Check user isn't already in a team
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existing) return { error: new Error('Leave your current team before joining another.') };

  // Find team by invite code
  const { data: team, error: findErr } = await supabase
    .from('teams')
    .select('id, name')
    .eq('invite_code', code.trim().toUpperCase())
    .single();

  if (findErr || !team) return { error: new Error('Invalid invite code. Check and try again.') };

  const { error } = await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: session.user.id,
    role: 'member',
  });

  return { error, teamName: team.name };
};

// Leave a team
export const leaveTeam = async (teamId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { error: new Error('Not signed in') };

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', session.user.id);

  return { error };
};

// Browse public teams with optional search
export const browseTeams = async (search?: string) => {
  let query = supabase
    .from('teams')
    .select('id, name, city, description, is_private, team_members(count)')
    .eq('is_private', false)
    .order('created_at', { ascending: false })
    .limit(30);

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  const { data, error } = await query;
  return { data, error };
};

// Recent activity feed — last contributions across all teams
export const getActivityFeed = async () => {
  const { data } = await supabase
    .from('contributions')
    .select(`
      id, bags_collected, kg_collected, created_at,
      profiles(display_name),
      cleanup_events(title)
    `)
    .order('created_at', { ascending: false })
    .limit(10);
  return { data };
};