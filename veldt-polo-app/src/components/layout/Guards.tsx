import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/shared/States";
import type { Role } from "@/lib/domain/types";

/** Server-enforced roles remain authoritative; this guard only shapes navigation. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-[50vh]"><LoadingState label="Checking your session" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.some((r) => user.roles.includes(r))) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-forest-950">Not authorised</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account ({user.email}) does not have one of the required roles: {roles.join(", ")}.
          Permissions are enforced again by the database for every action.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
