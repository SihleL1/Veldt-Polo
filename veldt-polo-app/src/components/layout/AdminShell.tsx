import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Award, CalendarDays, ClipboardList, FileClock, Import, ListChecks,
  LayoutDashboard, School as SchoolIcon, Settings, ShieldCheck, Trophy, Users,
} from "lucide-react";
import { Wordmark } from "./SiteHeader";
import { ModeBanner } from "@/components/shared/States";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/schools", label: "Schools", icon: SchoolIcon },
  { to: "/admin/teams", label: "Teams", icon: Users },
  { to: "/admin/seasons", label: "Seasons", icon: CalendarDays },
  { to: "/admin/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/admin/fixtures", label: "Fixtures & matches", icon: ClipboardList },
  { to: "/admin/users", label: "Users & roles", icon: ShieldCheck },
  { to: "/admin/rankings", label: "Rankings config", icon: Award },
  { to: "/admin/imports", label: "Imports", icon: Import },
  { to: "/admin/data-quality", label: "Data quality", icon: ListChecks },
  { to: "/admin/audit-logs", label: "Audit logs", icon: FileClock },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-forest-950 text-cream">
      <div className="border-b border-cream/10 bg-forest-900/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="[&_a]:!text-cream">
            <Wordmark dark />
          </div>
          <button
            onClick={() => navigate("/")}
            className="rounded border border-cream/20 px-3 py-1.5 text-xs font-medium text-cream/80 hover:bg-cream/10"
          >
            ← Back to public site
          </button>
        </div>
      </div>
      <ModeBanner />
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <nav aria-label="Administration" className="hidden w-56 shrink-0 md:block">
          <ul className="sticky top-6 space-y-1">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
                      isActive ? "bg-forest-600/40 font-semibold text-cream" : "text-cream/60 hover:bg-cream/5 hover:text-cream",
                    )
                  }
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap gap-2 md:hidden">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-full border border-cream/15 px-3 py-1 text-xs",
                    isActive ? "bg-forest-600/40 font-semibold" : "text-cream/60",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className="rounded-xl border border-cream/10 bg-forest-900/40 p-6">
            <p className="sr-only">Signed in as {user?.name}</p>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
