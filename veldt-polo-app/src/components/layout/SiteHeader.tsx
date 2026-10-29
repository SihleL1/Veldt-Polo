import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Search } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-600 text-cream font-bold font-mono text-[10px] leading-none tracking-tighter ring-2 ring-ochre-400/70 group-hover:ring-ochre-400 transition-colors"
        aria-hidden
      >
        SWP
      </span>
      <span className="leading-tight">
        <span className={cn("block text-sm font-bold tracking-wide uppercase", dark ? "text-cream" : "text-forest-800")}>
          Schools Water Polo
        </span>
        <span className={cn("block text-[11px] font-semibold tracking-[0.28em] uppercase", dark ? "text-ochre-300" : "text-forest-400")}>
          South Africa
        </span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/live", label: "Live" },
  { to: "/competitions", label: "Competitions" },
  { to: "/rankings", label: "Rankings" },
  { to: "/statistics", label: "Statistics" },
];

const MORE = [
  { to: "/fixtures", label: "Fixtures" },
  { to: "/results", label: "Results" },
  { to: "/schools", label: "Schools & Teams" },
];

export function SiteHeader() {
  const { user, signOut, hasRole, isAdmin } = useAuth();
  const navigate = useNavigate();

  const link = (active: boolean) =>
    cn(
      "relative px-1 py-2 text-sm font-medium transition-colors hover:text-forest-600",
      active ? "text-forest-800" : "text-forest-950/60",
      active && "after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:bg-ochre-400",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-cream-deep bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => link(isActive)}>
              {n.label}
            </NavLink>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 py-2 text-sm font-medium text-forest-950/60 hover:text-forest-600">
              More <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white">
              <DropdownMenuLabel>Follow the game</DropdownMenuLabel>
              {MORE.map((m) => (
                <DropdownMenuItem key={m.to} onClick={() => navigate(m.to)}>{m.label}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/statistics")}>Statistics & leaders</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-forest-600/30 bg-white">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 font-mono text-[10px] font-bold text-cream">
                    {user.name.slice(0, 1)}
                  </span>
                  <span className="hidden sm:inline">{user.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white">
                <DropdownMenuLabel className="font-normal">
                  <span className="block text-sm font-semibold">{user.name}</span>
                  <span className="block text-xs text-muted-foreground">{user.roles.join(" · ") || "No role"}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>My dashboard</DropdownMenuItem>
                {isAdmin && <DropdownMenuItem onClick={() => navigate("/admin")}>Administration</DropdownMenuItem>}
                {(hasRole("scorekeeper", "tournament_admin", "admin")) && (
                  <DropdownMenuItem onClick={() => navigate("/scorekeeper")}>Live scoring</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-red-700">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/live")} aria-label="Search competitions">
                <Search className="h-4 w-4 text-forest-950/60" />
              </Button>
              <Button size="sm" className="bg-forest-600 text-cream hover:bg-forest-500" onClick={() => navigate("/login")}>
                Sign in
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-forest-800/20 bg-forest-950 text-cream/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <p className="text-lg font-bold text-cream">Schools Water Polo South Africa</p>
          <p className="text-sm text-cream/60">
            A national competition, live scoring and rankings platform for South African school water polo.
            A stronger water polo nation, built school by school.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          {[...NAV.map((n) => ({ to: n.to, label: n.label })), ...MORE].map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-ochre-300">{l.label}</Link>
          ))}
          <Link to="/login" className="hover:text-ochre-300">Sign in</Link>
        </nav>
      </div>
      <div className="border-t border-cream/10 py-4 text-center text-xs text-cream/40">
        Data shown may include clearly-labelled demonstration data. No official affiliations are implied.
      </div>
    </footer>
  );
}
