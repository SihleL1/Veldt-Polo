import { useQuery } from "@tanstack/react-query";
import { repo } from "@/lib/data";
import type { MatchFilter } from "@/lib/data/repo";
import type { MatchView } from "@/lib/domain/types";

/** Shared react-query hooks over the repository boundary. */

export const qk = {
  schools: ["schools"] as const,
  teams: ["teams"] as const,
  seasons: ["seasons"] as const,
  tournaments: (f?: object) => ["tournaments", f ?? {}] as const,
  matches: (f?: object) => ["matches", f ?? {}] as const,
  match: (id: string) => ["match", id] as const,
  events: (matchId: string) => ["events", matchId] as const,
  players: (schoolId?: string) => ["players", schoolId ?? "all"] as const,
  roster: (teamId: string, seasonId: string) => ["roster", teamId, seasonId] as const,
  rankingConfigs: ["ranking-configs"] as const,
  snapshots: (f?: object) => ["snapshots", f ?? {}] as const,
  users: ["users"] as const,
  audit: ["audit"] as const,
  entries: (tid: string) => ["entries", tid] as const,
};

export const useSchools = () => useQuery({ queryKey: qk.schools, queryFn: () => repo.listSchools() });
export const useTeams = (filter?: { schoolId?: string; category?: string }) =>
  useQuery({ queryKey: qk.teams, queryFn: () => repo.listTeams(filter) });
export const useSeasons = () => useQuery({ queryKey: qk.seasons, queryFn: () => repo.listSeasons() });
export const useTournaments = (filter?: { seasonId?: string; publishedOnly?: boolean }) =>
  useQuery({ queryKey: qk.tournaments(filter), queryFn: () => repo.listTournaments(filter) });
export const useMatches = (filter?: MatchFilter) =>
  useQuery({ queryKey: qk.matches(filter), queryFn: () => repo.listMatches(filter) });
export const useMatch = (id: string) =>
  useQuery({ queryKey: qk.match(id), queryFn: () => repo.getMatch(id), enabled: !!id });
export const useRankingConfigs = () => useQuery({ queryKey: qk.rankingConfigs, queryFn: () => repo.listRankingConfigs() });
export const useSnapshots = (filter?: { publishedOnly?: boolean; seasonId?: string; category?: string }) =>
  useQuery({ queryKey: qk.snapshots(filter), queryFn: () => repo.listRankingSnapshots(filter) });
export const useUsers = () => useQuery({ queryKey: qk.users, queryFn: () => repo.listUsers() });
export const useAuditLogs = (limit?: number) => useQuery({ queryKey: qk.audit, queryFn: () => repo.listAuditLogs(limit) });
export const useEntries = (tournamentId: string) =>
  useQuery({ queryKey: qk.entries(tournamentId), queryFn: () => repo.listEntries(tournamentId), enabled: !!tournamentId });

export const useTournamentByParam = (slugOrId?: string) =>
  useQuery({
    queryKey: ["tournament", slugOrId],
    queryFn: () => repo.getTournament(slugOrId!),
    enabled: !!slugOrId,
  });

/** Latest published snapshot rows for a category (with the previous snapshot for movement). */
export function usePublishedRanking(seasonId: string | undefined, category: string) {
  return useQuery({
    queryKey: ["published-ranking", seasonId, category],
    queryFn: async () => {
      if (!seasonId) return null;
      const snaps = await repo.listRankingSnapshots({ publishedOnly: true, seasonId, category });
      if (snaps.length === 0) return null;
      const sorted = [...snaps].sort((a, b) => Date.parse(b.calculated_at) - Date.parse(a.calculated_at));
      return { current: sorted[0], previous: sorted[1] ?? null };
    },
    enabled: !!seasonId,
  });
}

export const splitMatches = (matches: MatchView[]) => ({
  live: matches.filter((m) => m.status === "live" || m.status === "paused"),
  upcoming: matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)),
  completed: matches.filter((m) => m.status === "completed"),
});
