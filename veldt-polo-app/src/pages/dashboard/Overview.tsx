import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EligibilityBadge } from "@/components/shared/RankingsTable";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { LiveMatchCard, formatKickoff } from "@/components/shared/MatchBits";
import { useAuth } from "@/lib/auth";
import { categoryLabel } from "@/lib/domain/types";
import { computeTeamStats } from "@/lib/domain/stats";
import { useMatches, usePublishedRanking, useSeasons, useTeams } from "@/lib/hooks/useData";

export default function DashboardOverview() {
  const { user, hasRole } = useAuth();
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: teams, isLoading: teamsLoading } = useTeams(user?.school_id ? { schoolId: user.school_id } : undefined);
  const { data: matches } = useMatches({ seasonId: season?.id });
  const { data: rankingBoys } = usePublishedRanking(season?.id, "first_team_boys");
  const { data: rankingGirls } = usePublishedRanking(season?.id, "first_team_girls");

  const schoolTeams = teams ?? [];
  const matchesFor = (teamId: string) => (matches ?? []).filter((m) => m.home_team_id === teamId || m.away_team_id === teamId);
  const rankingFor = (category: string) => (category === "first_team_boys" ? rankingBoys : rankingGirls);

  return (
    <DashboardShell
      title={`Welcome, ${user?.name.split(" ")[0] ?? "guest"}`}
      sub={season ? `Private dashboard · ${season.name}` : "Private dashboard"}
    >
      {/* Role-aware quick links */}
      <div className="flex flex-wrap gap-3">
        {hasRole("scorekeeper", "tournament_admin", "admin") && (
          <QuickLink to="/score" label="Live scoring console" hint="Score assigned matches" />
        )}
        {hasRole("admin", "tournament_admin") && (
          <QuickLink to="/admin" label="Admin console" hint="Manage competitions & users" />
        )}
        <QuickLink to="/dashboard/reports" label="Reports & export" hint="Download your team's data" />
      </div>

      {hasRole("admin", "tournament_admin") && !user?.school_id ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-cream">Administrator account</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream/70">
            This dashboard shows private team data for coaches and analysts linked to a school.
            Your account administers the competition instead — open the admin console to manage
            schools, teams, fixtures, users and ranking publication.
          </p>
          <Link to="/admin" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ochre-400 hover:underline">
            Open admin console <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : teamsLoading ? (
        <LoadingState label="Loading your teams" />
      ) : schoolTeams.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            dark
            title="No team linked to your account"
            hint="Private dashboards are scoped to your school's teams. Ask an administrator to link your account to a school."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {schoolTeams.map((v) => {
            const teamMatches = matchesFor(v.team.id);
            const stats = computeTeamStats(teamMatches, v.team.id);
            const row = rankingFor(v.team.category)?.current.rows.find((r) => r.team_id === v.team.id);
            const upcoming = teamMatches
              .filter((m) => m.status === "scheduled" || m.status === "live")
              .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
            return (
              <section key={v.team.id} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-cream">{v.school.name}</h2>
                    <p className="text-xs text-cream/60">{categoryLabel(v.team.category)} · {season?.name}</p>
                  </div>
                  {row ? <EligibilityBadge e={row.eligibility} /> : <span className="text-xs text-cream/50">Not ranked</span>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Metric label="National rank" value={row ? `${row.rank}` : "—"} />
                  <Metric label="Record" value={`${stats.wins}-${stats.draws}-${stats.losses}`} />
                  <Metric label="GF / GA per game" value={`${stats.gf_per_game.toFixed(1)} / ${stats.ga_per_game.toFixed(1)}`} />
                  <Metric label="Games played" value={`${stats.games_played}`} />
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-cream/50">Next fixtures</p>
                  {upcoming.length === 0 ? (
                    <p className="mt-1 text-sm text-cream/60">No upcoming fixtures scheduled.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm text-cream/85">
                      {upcoming.slice(0, 3).map((m) => {
                        const k = formatKickoff(m.scheduled_at);
                        const home = m.home_team_id === v.team.id;
                        return (
                          <li key={m.id} className="flex flex-wrap items-center gap-2">
                            <span className="font-data text-xs text-cream/60">{k.date} {k.time}</span>
                            <span>{home ? "vs" : "at"}</span>
                            <span className="font-medium">{home ? m.away_school.name : m.home_school.name}</span>
                            <span className="text-xs text-cream/50">{m.tournament_name}</span>
                            {m.status === "live" && <span className="rounded bg-ochre-500 px-1.5 py-0.5 font-data text-[10px] font-bold text-forest-950">LIVE</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <Link to={`/teams/${v.team.id}`} className="mt-4 inline-flex items-center gap-1.5 text-sm text-ochre-400 hover:underline">
                  Public team page <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </section>
            );
          })}
          {(matches ?? []).some((m) => m.status === "live") && (
            <section>
              <h2 className="text-lg font-semibold text-cream">Live right now</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {(matches ?? []).filter((m) => m.status === "live").slice(0, 4).map((m) => (
                  <LiveMatchCard key={m.id} match={m} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

function QuickLink({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <Link
      to={to}
      className="group flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-ochre-500/50 hover:bg-white/10"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-cream">
        {label}
        <ArrowRight className="h-3.5 w-3.5 text-cream/50 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </p>
      <p className="mt-0.5 text-xs text-cream/55">{hint}</p>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2.5">
      <p className="font-data text-xl font-bold text-cream">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-cream/50">{label}</p>
    </div>
  );
}
