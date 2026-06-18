import { useState } from "react";
import { useAuthCtx } from "../App";

export default function Login() {
  const { signIn, signUp } = useAuthCtx();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === "up") setMsg("Registriert. Bitte E-Mail bestätigen (falls aktiviert) und einloggen.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form onSubmit={submit} className="w-80 space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">workXperts Cockpit</h1>
        <p className="text-xs text-slate-500">
          {mode === "in" ? "Anmelden" : "Registrieren"} — neue Nutzer erhalten automatisch die Rolle „viewer".
        </p>
        <input
          type="email" required placeholder="E-Mail" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <input
          type="password" required placeholder="Passwort" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        {msg && <p className="text-xs text-red-600">{msg}</p>}
        <button type="submit" disabled={busy} className="w-full rounded bg-slate-800 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "…" : mode === "in" ? "Anmelden" : "Registrieren"}
        </button>
        <button
          type="button" onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="w-full text-xs text-slate-500 hover:text-slate-800"
        >
          {mode === "in" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Anmelden"}
        </button>
      </form>
    </div>
  );
}
