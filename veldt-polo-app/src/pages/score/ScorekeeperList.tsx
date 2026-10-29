import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, formatKickoff } from "@/components/shared/MatchBits";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { useMatches, useSeasons } from "@/lib/hooks/useData";
import { useAuth } from "@/lib/auth";

/** Scorekeeper landing: the matches they can open in the console. */
export default function ScorekeeperList() {
  const { user, loading, hasRole } = useAuth();
  if (loading) return <div className="console-dark min-h-screen" />;
  if (!user || !hasRole("scorekeeper", "tournament_admin", "admin")) {
    return <Navigate to="/login" state={{ from: "/score" }} replace />;
  }
  return <ScorekeeperListInner />;
}

function ScorekeeperListInner() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { data: matches, isLoading } = useMatches({ seasonId: season?.id, status: (statusFilter === "all" ? "all" : statusFilter) as "all" });
  const queryClient = useQueryClient();
  void queryClient;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (matches ?? [])
      .filter((m) => (q ? m.home_school.name.toLowerCase().includes(q) || m.away_school.name.toLowerCase().includes(q) || m.tournament_name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const order: Record<string, number> = { live: 0, paused: 1, scheduled: 2, completed: 3, abandoned: 4, postponed: 5 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9) || Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at);
      });
  }, [matches, search]);

  return (
    <div className="console-dark min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ochre-400">Live scoring</p>
            <h1 className="mt-1 text-2xl font-bold text-cream">Assigned matches</h1>
          </div>
          <Button asChild variant="outline" className="border-white/20 bg-transparent text-cream hover:bg-white/10 hover:text-cream">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams or competition…"
            className="w-72 border-white/20 bg-black/30 text-cream placeholder:text-cream/40"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 border-white/20 bg-black/30 text-cream">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/20 bg-forest-950 text-cream">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingState label="Loading matches" />
        ) : filtered.length === 0 ? (
          <div className="mt-6"><EmptyState dark title="No matches found" hint="Adjust the filters, or ask an administrator to schedule matches." /></div>
        ) : (
          <ul className="mt-6 space-y-3">
            {filtered.map((m) => {
              const k = formatKickoff(m.scheduled_at);
              return (
                <li key={m.id}>
                  <Link
                    to={`/score/${m.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4 transition-colors hover:border-ochre-500/50 hover:bg-white/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-cream">
                        {m.home_school.name} <span className="text-cream/50">vs</span> {m.away_school.name}
                      </p>
                      <p className="mt-0.5 text-xs text-cream/55">{m.tournament_name} · {k.date} {k.time} · {m.venue || "Venue TBC"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {m.status === "live" && m.home_score + m.away_score > 0 && (
                        <span className="font-data text-lg font-bold text-cream">{m.home_score}–{m.away_score}</span>
                      )}
                      <StatusBadge status={m.status} verification={m.verification} />
                      <span className="font-data text-xs uppercase tracking-wider text-ochre-400">Open console →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
