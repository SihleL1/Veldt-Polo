import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { BarChart3, ClipboardList, FileSpreadsheet, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "@/components/layout/SiteHeader";
import { ModeBanner } from "@/components/shared/States";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/team", label: "My team", icon: ClipboardList, end: false },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, end: false },
  { to: "/dashboard/reports", label: "Reports & export", icon: FileSpreadsheet, end: false },
];

/** Dark, private dashboard shell for coaches and analysts. */
export function DashboardShell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="console-dark min-h-screen">
      <ModeBanner />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="lg:w-60 lg:shrink-0">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="text-cream"><Wordmark dark /></Link>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/50">Private dashboard</p>
          <nav aria-label="Dashboard" className="mt-6 flex gap-2 overflow-x-auto lg:flex-col">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-ochre-500 font-semibold text-forest-950" : "text-cream/75 hover:bg-white/10 hover:text-cream"
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 hidden rounded-lg border border-white/10 bg-white/5 p-4 lg:block">
            <p className="text-xs font-semibold text-cream">{user?.name}</p>
            <p className="mt-0.5 break-all font-data text-[11px] text-cream/60">{user?.email}</p>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-ochre-400">
              {user?.roles.map((r) => r.replace("_", " ")).join(" · ") || "no role"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full border-white/20 bg-transparent text-cream hover:bg-white/10 hover:text-cream"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden /> Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-cream">{title}</h1>
              {sub && <p className="mt-1 text-sm text-cream/60">{sub}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-transparent text-cream hover:bg-white/10 hover:text-cream lg:hidden"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden /> Sign out
            </Button>
          </header>
          <div className="py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
