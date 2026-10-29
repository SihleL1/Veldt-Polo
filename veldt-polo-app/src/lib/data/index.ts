import { isSupabaseConfigured } from "./supabase/client";
import { DemoRepo } from "./demo/demoRepo";
import { SupabaseRepo } from "./supabase/supaRepo";
import type { AppRepo } from "./repo";

/**
 * Repository selector. When Supabase credentials are configured the app talks
 * to the real database; otherwise it runs on the clearly-labelled demonstration
 * dataset. Nothing pretends to be persisted when it is not — the UI surfaces
 * the active mode everywhere it matters.
 */
export const repo: AppRepo = isSupabaseConfigured() ? new SupabaseRepo() : new DemoRepo();

export const isDemoMode = (): boolean => repo.mode === "demo";

/** Label shown on anything computed from the demonstration dataset. */
export const DEMO_TAG = "Demonstration data";

export { resetDemoDb, DEMO_PASSWORD, listDemoUsers } from "./demo/demoRepo";
export { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase/client";
export type { AppRepo } from "./repo";
