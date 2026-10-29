import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AdminPage } from "./shared";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/data";
import { resetDemoDb } from "@/lib/data";
import { useState } from "react";

export default function AdminSettings() {
  const { user } = useAuth();
  const configured = isSupabaseConfigured();
  const [resetDone, setResetDone] = useState(false);

  return (
    <AdminPage title="Settings" sub="Platform configuration and data mode.">
      <section className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-bold text-cream">Data mode</h2>
        {configured ? (
          <div className="mt-3 space-y-1 text-sm text-cream/75">
            <p>Connected to a live Postgres database (Supabase). All reads and writes flow through the anon client with Row Level Security; roles are enforced server-side.</p>
            <p className="font-data text-xs text-cream/50">VITE_SUPABASE_URL = {SUPABASE_URL ? `${SUPABASE_URL.slice(0, 28)}…` : "set"}</p>
            <p className="font-data text-xs text-cream/50">VITE_SUPABASE_ANON_KEY = {SUPABASE_ANON_KEY ? "set (safe for client bundles)" : "set"}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-cream/75">
            <p>
              Running in <span className="font-semibold text-ochre-300">demonstration mode</span>: the clearly-labelled
              2021 proof-of-concept dataset is stored in this browser only. Nothing is faked as official — the banner on
              every page says so.
            </p>
            <p>
              To go live: create a Supabase project, set <span className="font-data text-ochre-300">VITE_SUPABASE_URL</span> and{" "}
              <span className="font-data text-ochre-300">VITE_SUPABASE_ANON_KEY</span>, run the SQL migrations in{" "}
              <span className="font-data">backend/migrations</span>, and promote your first admin with the snippet in the README.
              The service-role key never touches this client.
            </p>
            <p className="text-xs text-cream/50">See the project README for the full setup sequence.</p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-bold text-cream">Roles & enforcement</h2>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">
          Roles: platform administrator, tournament administrator, scorekeeper, coach, analyst. The interface hides what a
          role cannot do; the database enforces it regardless. Signed in as{" "}
          <span className="font-data text-ochre-300">{user?.email}</span>{" "}
          ({user?.roles.map((r) => r.replace("_", " ")).join(", ") || "no role"}).
        </p>
      </section>

      {!configured && (
        <section className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <h2 className="text-lg font-bold text-cream">Demonstration data</h2>
          <p className="mt-2 text-sm text-cream/70">
            Reset the browser dataset to its freshly generated state. All local changes — including scored matches and
            invited users — are discarded. This control exists only in demonstration mode.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="outline"
              className="border-red-400/50 bg-transparent text-red-200 hover:bg-red-500/20 hover:text-red-100"
              onClick={() => {
                if (confirm("Reset the demonstration dataset? All local changes are discarded.")) {
                  resetDemoDb();
                  setResetDone(true);
                }
              }}
            >
              Reset demonstration data
            </Button>
            {resetDone && <span className="text-xs text-emerald-300">Reset done — reload the page to see the fresh dataset.</span>}
          </div>
        </section>
      )}

      <p className="mt-6 text-xs text-cream/45">
        Public site: <Link to="/" className="text-ochre-400 hover:underline">home</Link> · Rankings{" "}
        <Link to="/rankings" className="text-ochre-400 hover:underline">methodology</Link> is public by design —
        transparency of the formula is part of the product.
      </p>
    </AdminPage>
  );
}
