import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPage, DarkField, DarkTable, Td, inputCls } from "./shared";
import { EligibilityBadge } from "@/components/shared/RankingsTable";
import { EmptyState, LoadingState } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { repo } from "@/lib/data";
import { qk, useMatches, useRankingConfigs, useSeasons, useTeams } from "@/lib/hooks/useData";
import { TEAM_CATEGORIES, categoryLabel } from "@/lib/domain/types";
import { computeRankings, DEFAULT_RANKING_CONFIG, normalisedWeights } from "@/lib/domain/rankings";

/**
 * Rankings config & publication. Preview is always computed client-side with
 * the exact engine that produced the shipped snapshots — the same code is
 * unit-tested, so the preview can never drift from the published maths.
 */
export default function RankingsAdmin() {
  const { data: seasons } = useSeasons();
  const season = seasons?.[0];
  const { data: teams } = useTeams();
  const { data: matches } = useMatches({ seasonId: season?.id });
  const { data: configs } = useRankingConfigs();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState(TEAM_CATEGORIES[0].id);
  const [winWeight, setWinWeight] = useState("0.6");
  const [offWeight, setOffWeight] = useState("0.2");
  const [defWeight, setDefWeight] = useState("0.2");
  const [drawValue, setDrawValue] = useState("0.5");
  const [minGames, setMinGames] = useState("6");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the existing config for the selected category (or defaults).
  useEffect(() => {
    const existing = (configs ?? [])
      .filter((c) => c.season_id === season?.id && c.category === category)
      .sort((a, b) => b.version - a.version)[0];
    if (existing) {
      setWinWeight(`${existing.win_rate_weight}`);
      setOffWeight(`${existing.offensive_weight}`);
      setDefWeight(`${existing.defensive_weight}`);
      setDrawValue(`${existing.draw_value}`);
      setMinGames(`${existing.min_games}`);
    } else {
      setWinWeight(`${DEFAULT_RANKING_CONFIG.win_rate_weight}`);
      setOffWeight(`${DEFAULT_RANKING_CONFIG.offensive_weight}`);
      setDefWeight(`${DEFAULT_RANKING_CONFIG.defensive_weight}`);
      setDrawValue(`${DEFAULT_RANKING_CONFIG.draw_value}`);
      setMinGames(`${DEFAULT_RANKING_CONFIG.min_games}`);
    }
  }, [configs, season?.id, category]);

  const draft = useMemo(
    () => ({
      win_rate_weight: Number(winWeight) || 0,
      offensive_weight: Number(offWeight) || 0,
      defensive_weight: Number(defWeight) || 0,
      draw_value: Number(drawValue) || 0,
      min_games: Number(minGames) || 1,
    }),
    [winWeight, offWeight, defWeight, drawValue, minGames],
  );

  const categoryTeams = useMemo(
    () => (teams ?? []).filter((v) => v.team.category === category).map((v) => v.team),
    [teams, category],
  );

  const preview = useMemo(
    () => computeRankings({ teams: categoryTeams, matches: matches ?? [], config: draft }),
    [categoryTeams, matches, draft],
  );

  const existingConfig = useMemo(
    () =>
      (configs ?? [])
        .filter((c) => c.season_id === season?.id && c.category === category)
        .sort((a, b) => b.version - a.version)[0],
    [configs, season?.id, category],
  );

  async function saveAndPublish(publish: boolean) {
    if (!season) return;
    setBusy(true);
    setError(null);
    try {
      const config = await repo.upsertRankingConfig({ season_id: season.id, category, ...draft, status: publish ? "published" : "draft" });
      if (publish) {
        await repo.saveRankingSnapshot(
          { season_id: season.id, category, config_id: config.id, config_version: config.version, published: true, rows: preview },
          { id: user?.id ?? "admin", name: user?.name ?? "Administrator" },
        );
      }
      await queryClient.invalidateQueries({ queryKey: qk.rankingConfigs });
      await queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      await queryClient.invalidateQueries({ queryKey: ["published-ranking"] });
      setError(publish ? null : null);
      if (publish) {
        // gentle confirmation via the table header note
        void queryClient.invalidateQueries({ queryKey: qk.matches({ seasonId: season.id }) });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the ranking configuration.");
    } finally {
      setBusy(false);
    }
  }

  const w = normalisedWeights(draft);

  return (
    <AdminPage
      title="Rankings config"
      sub="Set the weighted formula per season and category, preview exactly what would be published, then publish a versioned snapshot. Published snapshots are immutable history."
    >
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <DarkField label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
              <SelectContent className="border-white/20 bg-forest-950 text-cream">
                {TEAM_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </DarkField>
          <div className="grid grid-cols-3 gap-2">
            <DarkField label="Win rate wt"><Input value={winWeight} onChange={(e) => setWinWeight(e.target.value)} inputMode="decimal" className={`${inputCls} font-data`} /></DarkField>
            <DarkField label="Offence wt"><Input value={offWeight} onChange={(e) => setOffWeight(e.target.value)} inputMode="decimal" className={`${inputCls} font-data`} /></DarkField>
            <DarkField label="Defence wt"><Input value={defWeight} onChange={(e) => setDefWeight(e.target.value)} inputMode="decimal" className={`${inputCls} font-data`} /></DarkField>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DarkField label="Draw value"><Input value={drawValue} onChange={(e) => setDrawValue(e.target.value)} inputMode="decimal" className={`${inputCls} font-data`} /></DarkField>
            <DarkField label="Min games"><Input value={minGames} onChange={(e) => setMinGames(e.target.value)} inputMode="numeric" className={`${inputCls} font-data`} /></DarkField>
          </div>
          <p className="text-xs leading-relaxed text-cream/55">
            Weights are normalised before combining — current draft applies as{" "}
            <span className="font-data">win {Math.round(w.win * 100)}% · offence {Math.round(w.off * 100)}% · defence {Math.round(w.def * 100)}%</span>.
            Teams below {draft.min_games} games are provisional and scaled by evidence.
          </p>
          {existingConfig && (
            <p className="text-xs text-cream/45">
              Existing: v{existingConfig.version} ({existingConfig.status}). Saving creates version {existingConfig.version + 1}.
            </p>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void saveAndPublish(false)} className={inputCls + " border"}>
              Save draft
            </Button>
            <Button
              disabled={busy || preview.length === 0}
              onClick={() => void saveAndPublish(true)}
              className="bg-ochre-500 font-semibold text-forest-950 hover:bg-ochre-400"
            >
              {busy ? "Working…" : "Publish snapshot"}
            </Button>
          </div>
        </div>

        <div>
          {!season ? (
            <EmptyState dark title="No season exists yet" hint="Create a season first." />
          ) : preview.length === 0 ? (
            <LoadingState />
          ) : (
            <DarkTable
              headers={["#", "Team", "Played", "W-D-L", "GF", "GA", "Diff", "Score", "Eligibility"]}
              caption="Rankings preview"
            >
              {preview.map((r) => (
                <tr key={r.team_id} className="border-t border-white/5">
                  <Td mono className="font-bold">{r.rank}</Td>
                  <Td className="font-medium">{categoryTeams.find((t) => t.id === r.team_id)?.name ?? r.team_id}</Td>
                  <Td mono>{r.games_played}</Td>
                  <Td mono className="whitespace-nowrap">{r.wins}-{r.draws}-{r.losses}</Td>
                  <Td mono>{r.goals_for}</Td>
                  <Td mono>{r.goals_against}</Td>
                  <Td mono>{r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}</Td>
                  <Td mono className="font-bold text-ochre-300">{r.score.toFixed(3)}</Td>
                  <Td><EligibilityBadge e={r.eligibility} /></Td>
                </tr>
              ))}
            </DarkTable>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
