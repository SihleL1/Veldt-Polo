import { AdminPage } from "./shared";
import { FileStack } from "lucide-react";

/** Phase-2 placeholder — honest scope, no fake upload UI. */
export default function AdminImports() {
  return (
    <AdminPage title="Imports" sub="Bulk data import arrives in the next iteration.">
      <div className="flex max-w-2xl flex-col items-center gap-3 rounded-xl border border-dashed border-white/20 bg-black/20 px-6 py-14 text-center">
        <FileStack className="h-8 w-8 text-cream/40" aria-hidden />
        <h2 className="text-lg font-bold text-cream">CSV import is planned, not built yet</h2>
        <p className="max-w-md text-sm leading-relaxed text-cream/60">
          The next release adds CSV import with row-level validation, a preview of exactly what would be
          created, and per-row error reporting — schools, teams, fixtures and historical results (back to
          2008) with quality indicators. The database schema already carries the audit columns this will
          need, so no migration will be required.
        </p>
        <p className="text-xs text-cream/45">
          Until then, small volumes can be captured with the forms under Schools, Teams and Fixtures &amp; matches.
        </p>
      </div>
    </AdminPage>
  );
}
