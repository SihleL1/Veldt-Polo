import type { ReactNode } from "react";
import { Database, Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/data/supabase/client";

export function SectionHeader({
  title, action, sub, light,
}: { title: ReactNode; action?: ReactNode; sub?: string; light?: boolean }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className={`text-xl font-bold tracking-tight ${light ? "text-cream" : "text-forest-950"}`}>{title}</h2>
        {sub && <p className={`mt-0.5 text-sm ${light ? "text-cream/60" : "text-muted-foreground"}`}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title, hint, icon, dark,
}: { title: string; hint?: string; icon?: ReactNode; dark?: boolean }) {
  if (dark) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/20 px-6 py-10 text-center">
        <div className="text-cream/50">{icon ?? <Database className="h-6 w-6" />}</div>
        <p className="font-medium text-cream">{title}</p>
        {hint && <p className="max-w-sm text-sm text-cream/60">{hint}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-forest-600/25 bg-white/60 px-6 py-10 text-center">
      <div className="text-forest-400">{icon ?? <Database className="h-6 w-6" />}</div>
      <p className="font-medium text-forest-950">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

/**
 * Honest-mode banner. When Supabase credentials are configured nothing shows;
 * otherwise every page carries a clear notice that data is demonstration data.
 */
export function ModeBanner() {
  if (isSupabaseConfigured()) return null;
  return (
    <div className="border-b border-ochre-400/40 bg-ochre-100/70 text-ochre-700">
      <div className="mx-auto max-w-7xl px-4 py-2 text-center text-xs font-medium sm:px-6">
        Demonstration mode — you are viewing the clearly-labelled 2021 proof-of-concept dataset stored in this
        browser. Connect a Supabase project to run the live platform (see the project README for setup).
      </div>
    </div>
  );
}

export const DEMO_TAG = (
  <span className="rounded bg-ochre-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre-600">
    demo data
  </span>
);
