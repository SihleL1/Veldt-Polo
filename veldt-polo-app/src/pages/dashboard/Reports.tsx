import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmptyState, LoadingState, SectionHeader } from "@/components/shared/States";
import { MatchRow } from "@/components/shared/MatchBits";
import { useAuth } from "@/lib/auth";
import { categoryLabel } from "@/lib/domain/types";
import { computeTeamStats } from "@/lib/domain/stats";
import { useMatches, useSeasons, useTeams } from "@/lib/hooks/useData";

/**
 * Private reports: season match log with CSV export of the signed-in school's
 * team data. Export is generated client-side from data the account can read —
 * no elevated access is implied by the download.
 */
export default function DashboardReports() {
  const { user } = useAuth();
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: teams, isLoading } = useTeams(user?.school_id ? { schoolId: user.school_id } : undefined);
  const { data: matches } = useMatches({ seasonId: season?.id });

  if (isLoading) return <DashboardShell title="Reports & export"><LoadingState /></DashboardShell>;
  const view = (teams ?? [])[0];
  if (!view) {
    return (
      <DashboardShell title="Reports & export">
        <EmptyState dark title="No team linked to your account" hint="Ask an administrator to link your account to a school." />
      </DashboardShell>
    );
  }

  const { team, school } = view;
  const teamMatches = (matches ?? [])
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const stats = computeTeamStats(teamMatches, team.id);

  function exportCsv() {
    const header = ["date", "competition", "venue", "home", "away", "home_score", "away_score", "status", "verification"];
    const rows = teamMatches.map((m) => [
      m.scheduled_at.slice(0, 10),
      csv(m.tournament_name),
      csv(m.venue || ""),
      csv(m.home_school.name),
      csv(m.away_school.name),
      `${m.home_score}`,
      `${m.away_score}`,
      m.status,
      m.verification,
    ]);
    const summary = [
      [],
      ["# season summary"],
      ["games_played", `${stats.games_played}`],
      ["wins", `${stats.wins}`],
      ["draws", `${stats.draws}`],
      ["losses", `${stats.losses}`],
      ["goals_for", `${stats.goals_for}`],
      ["goals_against", `${stats.goals_against}`],
      ["gf_per_game", stats.gf_per_game.toFixed(3)],
      ["ga_per_game", stats.ga_per_game.toFixed(3)],
    ];
    const csvText = [header, ...rows, ...summary].map((r) => r.join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${school.slug}-${team.category}-${season?.name ?? "season"}.csv`.toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell title="Reports & export" sub={`${school.name} · ${categoryLabel(team.category)} · ${season?.name ?? ""}`}>
      <section className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeader
            title="Season match log"
            sub={`${teamMatches.length} matches · ${stats.games_played} completed. Export includes the season summary below the rows.`}
            light
          />
          <Button
            onClick={exportCsv}
            disabled={teamMatches.length === 0}
            className="bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden /> Export CSV
          </Button>
        </div>
        {teamMatches.length === 0 ? (
          <EmptyState dark title="No matches this season" />
        ) : (
          <div className="mt-2 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/15 bg-black/20 text-left text-[11px] uppercase tracking-wider text-cream/50">
                  <th scope="col" className="px-3 py-2 font-semibold">Date</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Home</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">Score</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Away</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Competition</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {teamMatches.map((m) => (
                  <MatchRow key={m.id} match={m} showCompetition dark />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Games played" value={`${stats.games_played}`} />
        <Stat label="Record (W-D-L)" value={`${stats.wins} - ${stats.draws} - ${stats.losses}`} />
        <Stat label="Goals for / against" value={`${stats.goals_for} / ${stats.goals_against}`} />
      </section>

      <p className="mt-6 text-xs leading-relaxed text-cream/50">
        Every exported figure comes from finalised and in-progress season data your account can read.
        Verified-only official results live on the public{" "}
        <Link to="/results" className="text-ochre-400 hover:underline">results page</Link>.
      </p>
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="font-data text-2xl font-bold text-cream">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-cream/60">{label}</p>
    </div>
  );
}

const csv = (s: string): string => (s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s);
