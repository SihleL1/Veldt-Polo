import type { ReactNode } from "react";

/** Shared dark admin primitives so every admin page looks and behaves alike. */

export function AdminPage({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cream">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-cream/60">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="py-5">{children}</div>
    </div>
  );
}

export function DarkTable({ headers, children, caption }: { headers: string[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-white/15 bg-black/20 text-left text-[11px] uppercase tracking-wider text-cream/50">
            {headers.map((h, i) => (
              <th key={h} scope="col" className={`px-3 py-2 font-semibold ${i === headers.length - 1 ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, mono }: { children?: ReactNode; className?: string; mono?: boolean }) {
  return <td className={`px-3 py-2 text-cream/85 ${mono ? "font-data" : ""} ${className ?? ""}`}>{children}</td>;
}

export function DarkField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-cream/60">{label}</span>
      {children}
      {hint && <p className="text-[11px] text-cream/45">{hint}</p>}
    </div>
  );
}

export const inputCls = "border-white/20 bg-black/30 text-cream placeholder:text-cream/35 focus-visible:ring-ochre-500";
export const ghostBtnCls = "border border-white/20 bg-transparent text-cream hover:bg-white/10 hover:text-cream";
