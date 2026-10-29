import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { RequireAuth } from "@/components/layout/Guards";
import { AdminShell } from "@/components/layout/AdminShell";

// Public
import Home from "./pages/Home";
import Live from "./pages/Live";
import Fixtures from "./pages/Fixtures";
import Results from "./pages/Results";
import Rankings from "./pages/Rankings";
import Statistics from "./pages/Statistics";
import { Competitions } from "./pages/Competitions";
import CompetitionDetail from "./pages/CompetitionDetail";
import Schools from "./pages/Schools";
import SchoolProfile from "./pages/SchoolProfile";
import TeamProfile from "./pages/TeamProfile";
import MatchReport from "./pages/MatchReport";
// Auth
import Login from "./pages/Login";
// Private dashboards
import DashboardOverview from "./pages/dashboard/Overview";
import DashboardTeam from "./pages/dashboard/MyTeam";
import DashboardAnalytics from "./pages/dashboard/Analytics";
import DashboardReports from "./pages/dashboard/Reports";
// Operations
import ScorekeeperList from "./pages/score/ScorekeeperList";
import ScoreConsole from "./pages/score/ScoreConsole";
// Admin
import AdminOverview from "./pages/admin/Overview";
import AdminSchools from "./pages/admin/Schools";
import AdminTeams from "./pages/admin/Teams";
import AdminSeasons from "./pages/admin/Seasons";
import AdminTournaments from "./pages/admin/Tournaments";
import AdminFixtures from "./pages/admin/Fixtures";
import AdminUsers from "./pages/admin/Users";
import RankingsAdmin from "./pages/admin/RankingsAdmin";
import AdminImports from "./pages/admin/Imports";
import AdminDataQuality from "./pages/admin/DataQuality";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import AdminSettings from "./pages/admin/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/live" element={<Live />} />
            <Route path="/fixtures" element={<Fixtures />} />
            <Route path="/results" element={<Results />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/competitions" element={<Competitions />} />
            <Route path="/competitions/:slug" element={<CompetitionDetail />} />
            <Route path="/schools" element={<Schools />} />
            <Route path="/schools/:slug" element={<SchoolProfile />} />
            <Route path="/teams/:id" element={<TeamProfile />} />
            <Route path="/matches/:id" element={<MatchReport />} />

            {/* Auth */}
            <Route path="/login" element={<Login />} />

            {/* Private dashboards (any signed-in operator role) */}
            <Route path="/dashboard" element={<RequireAuth><DashboardOverview /></RequireAuth>} />
            <Route path="/dashboard/team" element={<RequireAuth><DashboardTeam /></RequireAuth>} />
            <Route path="/dashboard/analytics" element={<RequireAuth><DashboardAnalytics /></RequireAuth>} />
            <Route path="/dashboard/reports" element={<RequireAuth><DashboardReports /></RequireAuth>} />

            {/* Operations */}
            <Route path="/score" element={<RequireAuth roles={["scorekeeper", "tournament_admin", "admin"]}><ScorekeeperList /></RequireAuth>} />
            <Route path="/score/:matchId" element={<RequireAuth roles={["scorekeeper", "tournament_admin", "admin"]}><ScoreConsole /></RequireAuth>} />

            {/* Admin console */}
            <Route path="/admin" element={<RequireAuth roles={["admin", "tournament_admin"]}><AdminShell /></RequireAuth>} />
            <Route path="/admin/schools" element={<RequireAuth roles={["admin", "tournament_admin"]}><AdminSchools /></RequireAuth>} />
            <Route path="/admin/teams" element={<RequireAuth roles={["admin", "tournament_admin"]}><AdminTeams /></RequireAuth>} />
            <Route path="/admin/seasons" element={<RequireAuth roles={["admin"]}><AdminSeasons /></RequireAuth>} />
            <Route path="/admin/tournaments" element={<RequireAuth roles={["admin", "tournament_admin"]}><AdminTournaments /></RequireAuth>} />
            <Route path="/admin/fixtures" element={<RequireAuth roles={["admin", "tournament_admin"]}><AdminFixtures /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth roles={["admin"]}><AdminUsers /></RequireAuth>} />
            <Route path="/admin/rankings" element={<RequireAuth roles={["admin"]}><RankingsAdmin /></RequireAuth>} />
            <Route path="/admin/imports" element={<RequireAuth roles={["admin"]}><AdminImports /></RequireAuth>} />
            <Route path="/admin/data-quality" element={<RequireAuth roles={["admin", "tournament_admin"]}><AdminDataQuality /></RequireAuth>} />
            <Route path="/admin/audit-logs" element={<RequireAuth roles={["admin"]}><AdminAuditLogs /></RequireAuth>} />
            <Route path="/admin/settings" element={<RequireAuth roles={["admin", "tournament_admin"]}><AdminSettings /></RequireAuth>} />

            <Route path="/home" element={<Navigate to="/" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
