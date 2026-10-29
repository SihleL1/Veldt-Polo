import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/data/supabase/client";
import { checkDemoCredentials } from "@/lib/data/demo/demoRepo";
import type { Role, UserProfile } from "@/lib/domain/types";

/**
 * Authentication context. Two modes:
 *  - Supabase configured: native Supabase Auth (email + password). The signed-in
 *    user's id is auth.uid(); roles come from user_profiles/role_assignments and
 *    are enforced again by RLS on every query.
 *  - Not configured: demo mode against the clearly-labelled demonstration users.
 */

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isAdmin: boolean;
  mode: "supabase" | "demo";
}

const AuthContext = createContext<AuthState | null>(null);

async function loadProfile(userId: string, email: string | null): Promise<UserProfile | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.from("user_profiles_with_roles").select("*").eq("id", userId).maybeSingle();
  if (data) return { id: data.id, email: data.email, name: data.name, roles: data.roles ?? [], school_id: data.school_id, created_at: data.created_at };
  // Profile may not exist yet (first sign-in before the trigger runs)
  return { id: userId, email: email ?? "", name: email?.split("@")[0] ?? "User", roles: [], school_id: null, created_at: new Date().toISOString() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = !isSupabaseConfigured();

  useEffect(() => {
    let mounted = true;
    if (demo) {
      const raw = sessionStorage.getItem("swpza.demo.session");
      if (raw) {
        try {
          setUser(JSON.parse(raw) as UserProfile);
        } catch {
          sessionStorage.removeItem("swpza.demo.session");
        }
      }
      setLoading(false);
      return;
    }
    const sb = getSupabaseClient()!;
    sb.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setUser(await loadProfile(data.session.user.id, data.session.user.email));
      }
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(await loadProfile(session.user.id, session.user.email));
      } else {
        setUser(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [demo]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      if (demo) {
        const u = checkDemoCredentials(email, password);
        if (!u) return { error: "Invalid email or password. Demonstration accounts are listed below." };
        sessionStorage.setItem("swpza.demo.session", JSON.stringify(u));
        setUser(u);
        return { error: null };
      }
      const sb = getSupabaseClient()!;
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      setUser(await loadProfile(data.user.id, data.user.email));
      return { error: null };
    },
    [demo],
  );

  const signOut = useCallback(async () => {
    if (demo) {
      sessionStorage.removeItem("swpza.demo.session");
      setUser(null);
      return;
    }
    await getSupabaseClient()!.auth.signOut();
    setUser(null);
  }, [demo]);

  const hasRole = useCallback(
    (...roles: Role[]): boolean => !!user && roles.some((r) => user.roles.includes(r)),
    [user],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn,
      signOut,
      hasRole,
      isAdmin: hasRole("admin"),
      mode: demo ? "demo" : "supabase",
    }),
    [user, loading, signIn, signOut, hasRole, demo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
