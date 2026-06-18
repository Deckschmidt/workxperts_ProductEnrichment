import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthCtx } from "../App";
import { useRunState } from "../hooks/useRunState";
import StatusBanner from "./StatusBanner";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/manual", label: "Manuell-Liste" },
  { to: "/audit", label: "Audit" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuthCtx();
  const { runState } = useRunState();
  const loc = useLocation();

  return (
    <div className="min-h-screen">
      <StatusBanner runState={runState} />
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-800">workXperts Cockpit</span>
          <nav className="flex gap-4">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`text-sm ${loc.pathname === n.to ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {user?.email} · <span className="font-medium">{role}</span>
          </span>
          <button onClick={() => signOut()} className="rounded border px-2 py-1 hover:bg-slate-50">
            Abmelden
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
