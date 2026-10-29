import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Trophy } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { LiveMatchCard, MatchRow, formatKickoff } from "@/components/shared/MatchBits";
import { RankingsTable } from "@/components/shared/RankingsTable";
import { EmptyState, LoadingState, ModeBanner, SectionHeader } from "@/components/shared/States";
import { rankMovement } from "@/lib/domain/rankings";
import { sortLeaders } from "@/lib/domain/stats";
import { useMatches, usePublishedRanking, useSeasons, useTeams, useTournaments } from "@/lib/hooks/useData";
import { DEMO_TAG, isDemoMode } from "@/lib/data";

export default function Home() {
  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main>
        <Hero />
        <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6">
          <LiveStrip />
          <FixturesAndResults />
          <FeaturedCompetitions />
          <RankingsAndLeaders />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  return (
    <section className="relative overflow-hidden bg-forest-800 text-cream">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(60% 90% at 85% 10%, rgba(53,104,58,0.9) 0%, rgba(16,45,25,0) 60%), radial-gradient(40% 60% at 15% 90%, rgba(216,145,59,0.25) 0%, rgba(7,17,11,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[28px] border-forest-400/20"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-ochre-300">
          South African Schools Water Polo
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          The home of South African school water polo
        </h1>
        <p className="mt-4 flex flex-wrap items-center gap-3 text-cream/70">
          <span>{season ? `${season.name} · fixtures, results and national rankings` : "Fixtures, results and national rankings"}</span>
          {isDemoMode() && DEMO_TAG}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/rankings"
            className="inline-flex items-center gap-2 rounded bg-ochre-400 px-5 py-2.5 text-sm font-semibold text-forest-950 transition-colors hover:bg-ochre-300"
          >
            View national rankings <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/live"
            className="inline-flex items-center gap-2 rounded border border-cream/30 px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-cream/10"
          >
            Live matches
          </Link>
        </div>
      </div>
    </section>
  );
}

function LiveStrip() {
  const { data: matches, isLoading } = useMatches({ status: "live" });
  const { data: paused } = useMatches({ status: "paused" });
  const live = [...(matches ?? []), ...(paused ?? [])].slice(0, 4);
  if (isLoading) return <LoadingState label="Checking for live matches" />;
  return (
    <section aria-labelledby="live-heading">
      <SectionHeader
        title={<span id="live-heading">Live now</span>}
        sub={live.length === 0 ? "No matches in progress — check the fixture list for start times." : undefined}
        action={<Link to="/live" className="text-sm font-medium text-forest-600 hover:underline">All live matches →</Link>}
      />
      {live.length === 0 ? (
        <EmptyState title="No matches are live right now" hint="Live scoreboards appear here while scorekeepers are running matches." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {live.map((m) => <LiveMatchCard key={m.id} match={m} />)}
        </div>
      )}
    </section>
  );
}

function FixturesAndResults() {
  const { data: upcoming, isLoading: l1 } = useMatches({ status: "scheduled", limit: 5 });
  const { data: results, isLoading: l2 } = useMatches({ status: "completed", limit: 5 });
  return (
    <section className="grid gap-6 lg:grid-cols-2" aria-label="Fixtures and results">
      <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
        <SectionHeader title="Upcoming fixtures" action={<Link to="/fixtures" className="text-sm font-medium text-forest-600 hover:underline">All fixtures →</Link>} />
        {l1 ? <LoadingState /> : upcoming && upcoming.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-deep text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Date</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Home</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Away</th>
                <th scope="col" className="hidden py-1.5 pr-3 font-semibold md:table-cell">Competition</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((m) => {
                const k = formatKickoff(m.scheduled_at);
                return (
                  <tr key={m.id} className="border-b border-cream-deep last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 font-data text-xs">{k.date}</td>
                    <td className="py-2 pr-3 text-sm font-medium">{m.home_school.name}</td>
                    <td className="py-2 pr-3 text-sm font-medium">{m.away_school.name}</td>
                    <td className="hidden py-2 pr-3 text-xs text-muted-foreground md:table-cell">{m.tournament_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No upcoming fixtures scheduled" hint="Administrators can add fixtures from the admin console." />
        )}
      </div>
      <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
        <SectionHeader title="Recent results" action={<Link to="/results" className="text-sm font-medium text-forest-600 hover:underline">All results →</Link>} />
        {l2 ? <LoadingState /> : results && results.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cream-deep text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Date</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Result</th>
                <th scope="col" className="hidden py-1.5 pr-3 font-semibold md:table-cell">Competition</th>
              </tr>
            </thead>
            <tbody>
              {results.map((m) => {
                const k = formatKickoff(m.scheduled_at);
                return (
                  <tr key={m.id} className="border-b border-cream-deep last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 font-data text-xs">{k.date}</td>
                    <td className="py-2 pr-3 text-sm">
                      <Link to={`/matches/${m.id}`} className="font-data font-medium hover:underline">
                        {m.home_school.name} {m.home_score} – {m.away_score} {m.away_school.name}
                      </Link>
                    </td>
                    <td className="hidden py-2 pr-3 text-xs text-muted-foreground md:table-cell">{m.tournament_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No results yet" hint="Results appear once matches are finalised." />
        )}
      </div>
    </section>
  );
}

function FeaturedCompetitions() {
  const { data: tournaments, isLoading } = useTournaments({ publishedOnly: true });
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const featured = (tournaments ?? []).slice(0, 3);
  return (
    <section aria-labelledby="comp-heading">
      <SectionHeader
        title={<span id="comp-heading">Featured competitions</span>}
        action={<Link to="/competitions" className="text-sm font-medium text-forest-600 hover:underline">All competitions →</Link>}
      />
      {isLoading ? (
        <LoadingState />
      ) : featured.length === 0 ? (
        <EmptyState title="No published competitions yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {featured.map((t) => (
            <Link
              key={t.id}
              to={`/competitions/${t.slug}`}
              className="group rounded-lg border border-forest-600/15 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="rounded bg-forest-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-forest-600">
                {t.province || "South Africa"}
              </span>
              <div className="mt-3 flex items-start justify-between gap-2">
                <h3 className="font-bold text-forest-950">{t.name}</h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-forest-300 group-hover:text-forest-600" />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trophy className="h-3.5 w-3.5" /> {t.entry_count} teams · {season?.name}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function RankingsAndLeaders() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: ranking } = usePublishedRanking(season?.id, "first_team_boys");
  const { data: teams } = useTeams({ category: "first_team_boys" });
  const { data: matches } = useMatches({ seasonId: season?.id });

  const teamNames = new Map((teams ?? []).map((v) => [v.team.id, { name: v.school.name, teamId: v.team.id }]));
  const moves = ranking ? rankMovement(ranking.current.rows, ranking.previous?.rows ?? null) : new Map();

  const teamIds = (teams ?? []).map((v) => v.team.id);
  const bestAttack = matches ? sortLeaders(matches, teamIds, (s) => Math.round(s.gf_per_game * 10) / 10, "desc", 3).slice(0, 3) : [];
  const bestDefence = matches ? sortLeaders(matches, teamIds, (s) => Math.round(s.ga_per_game * 10) / 10, "asc", 3).slice(0, 3) : [];
  const bestDiff = matches ? sortLeaders(matches, teamIds, (s) => s.goal_difference, "desc", 3).slice(0, 3) : [];
  const nameOf = (id: string) => teamNames.get(id)?.name ?? id;

  return (
    <section className="grid gap-6 lg:grid-cols-2" aria-label="Rankings and leaders">
      <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
        <SectionHeader
          title="National rankings — First Team Boys"
          action={<Link to="/rankings" className="text-sm font-medium text-forest-600 hover:underline">Full rankings →</Link>}
        />
        {!season ? <LoadingState /> : ranking ? (
          <RankingsTable rows={ranking.current.rows.slice(0, 5)} teamNames={teamNames} movement={moves} />
        ) : (
          <EmptyState title="No rankings published yet" hint="Rankings appear once an administrator calculates and publishes a snapshot." />
        )}
      </div>
      <div className="min-w-0 rounded-xl border border-forest-600/15 bg-white p-6 shadow-sm">
        <SectionHeader
          title="Statistical leaders — First Team Boys"
          sub="Team-level leaders, per game with match counts shown."
          action={<Link to="/statistics" className="text-sm font-medium text-forest-600 hover:underline">All statistics →</Link>}
        />
        {matches ? (
          <div className="grid gap-6 sm:grid-cols-3">
            <LeaderList title="Best attack" subtitle="Goals scored per game" entries={bestAttack} nameOf={nameOf} format={(v) => `${v}`} />
            <LeaderList title="Best defence" subtitle="Goals conceded per game" entries={bestDefence} nameOf={nameOf} format={(v) => `${v}`} />
            <LeaderList title="Goal difference" subtitle="Total, season to date" entries={bestDiff} nameOf={nameOf} format={(v) => (v > 0 ? `+${v}` : `${v}`)} />
          </div>
        ) : (
          <LoadingState />
        )}
      </div>
    </section>
  );
}

function LeaderList<T extends number>({
  title, subtitle, entries, nameOf, format,
}: {
  title: string;
  subtitle: string;
  entries: { teamId: string; value: T; gamesPlayed: number }[];
  nameOf: (id: string) => string;
  format: (v: T) => string;
}) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Not enough completed matches yet.</p>;
  return (
    <div>
      <p className="text-sm font-bold text-forest-950">{title}</p>
      <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>
      <ol className="space-y-1.5">
        {entries.map((e, i) => (
          <li key={e.teamId} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="font-data mr-1.5 text-muted-foreground">{i + 1}.</span>
              <span className="font-medium">{nameOf(e.teamId)}</span>
            </span>
            <span className="font-data shrink-0 font-semibold">
              {format(e.value)}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">({e.gamesPlayed} GP)</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

