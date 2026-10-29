import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { DEMO_PASSWORD, isDemoMode, listDemoUsers } from "@/lib/data";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { ModeBanner } from "@/components/shared/States";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormValues = z.infer<typeof schema>;

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  tournament_admin: "Tournament admin",
  scorekeeper: "Scorekeeper",
  coach: "Coach",
  analyst: "Analyst",
};

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  const demo = isDemoMode();

  async function onSubmit(values: FormValues) {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await signIn(values.email.trim().toLowerCase(), values.password);
      if (err) {
        setError(err);
        return;
      }
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <SiteHeader />
      <ModeBanner />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 lg:flex-row">
        <div className="flex-1 rounded-xl bg-forest-950 p-8 text-cream shadow-lg lg:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ochre-400">Operator access</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Sign in to score, coach or administer</h1>
          <p className="mt-3 text-sm leading-relaxed text-cream/70">
            Accounts are issued by the competition administrator — there is no public sign-up.
            Scorekeepers run live matches, coaches and analysts see their own team dashboards,
            and administrators manage competitions and publish rankings.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-cream/85">
            <li className="flex gap-3"><Dot /> Scoring consoles record every action with an undo trail and audit log.</li>
            <li className="flex gap-3"><Dot /> Coach and analyst dashboards are private to their school.</li>
            <li className="flex gap-3"><Dot /> Roles are enforced in the database, not just hidden in the interface.</li>
          </ul>
          {demo && (
            <div className="mt-8 rounded-lg border border-ochre-500/40 bg-ochre-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ochre-400">Demonstration accounts</p>
              <p className="mt-1 text-xs text-cream/70">Password for every demo account: <span className="font-data text-ochre-300">{DEMO_PASSWORD}</span></p>
              <ul className="mt-3 space-y-1.5 text-xs">
                {listDemoUsers().map((u) => (
                  <li key={u.email} className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      className="font-data text-left text-cream hover:text-ochre-300 hover:underline"
                      onClick={() => {
                        form.setValue("email", u.email);
                        form.setValue("password", DEMO_PASSWORD);
                      }}
                    >
                      {u.email}
                    </button>
                    <span className="text-cream/60">{u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ") || "No role"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-cream/50">Click an address to fill the form. Demonstration data — not real schools' results.</p>
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="rounded-xl border border-forest-600/15 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-bold text-forest-950">Email sign-in</h2>
            <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@school.org.za" {...form.register("email")} />
                {form.formState.errors.email && <p className="text-xs text-red-700">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.register("password")} />
                {form.formState.errors.password && <p className="text-xs text-red-700">{form.formState.errors.password.message}</p>}
              </div>
              {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full bg-forest-950 text-cream hover:bg-forest-950/90">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
              Need an account? Your school's coach or the competition administrator issues invitations.
              Public fixtures, results and rankings need no account —{" "}
              <Link to="/" className="text-forest-600 underline">browse from the homepage</Link>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Dot() {
  return <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ochre-400" />;
}
