import { FormEvent, ReactNode, useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import {
  changeAdminPassword,
  clearLocalSession,
  createLocalUser,
  loadLocalAuth,
  loadLocalSession,
  LocalSession,
  resetLocalUserPassword,
  unlockAsLocalUser,
  verifyAdmin,
  verifyLocalUser,
} from "../lib/local-auth";

export function LocalAuthGate({ children }: { children: (session: LocalSession, logout: () => void) => ReactNode }) {
  const [session, setSession] = useState<LocalSession | null>(() => loadLocalSession());
  const [authVersion, setAuthVersion] = useState(0);
  const auth = loadLocalAuth();

  useEffect(() => {
    setSession(loadLocalSession());
  }, [authVersion]);

  function logout() {
    clearLocalSession();
    setSession(null);
  }

  if (session) return <>{children(session, logout)}</>;

  return (
    <LocalLoginScreen
      hasUser={Boolean(auth.user)}
      username={auth.user?.username || ""}
      onLoggedIn={() => setSession(loadLocalSession())}
      onAuthChanged={() => setAuthVersion((value) => value + 1)}
    />
  );
}

function LocalLoginScreen({ hasUser, username, onLoggedIn, onAuthChanged }: { hasUser: boolean; username: string; onLoggedIn: () => void; onAuthChanged: () => void }) {
  const [mode, setMode] = useState<"login" | "setup" | "admin">(hasUser ? "login" : "setup");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto grid max-w-xl gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-navy text-white">
            <LockKeyhole size={24} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Haudy Local Access</p>
            <h1 className="text-2xl font-bold text-navy">{mode === "setup" ? "Create Local User" : mode === "admin" ? "Admin Tool" : "Log In"}</h1>
          </div>
        </div>
        {mode === "setup" ? (
          <CreateUserForm onDone={() => { onAuthChanged(); onLoggedIn(); }} />
        ) : mode === "admin" ? (
          <AdminTool username={username} onBack={() => setMode(hasUser ? "login" : "setup")} onAuthChanged={onAuthChanged} onLoggedIn={onLoggedIn} />
        ) : (
          <LoginForm username={username} onDone={onLoggedIn} />
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
          {hasUser && mode !== "login" ? <button className="font-semibold text-slate-600 hover:text-navy" onClick={() => setMode("login")}>Back to Login</button> : <span />}
          {mode !== "admin" ? <button className="font-semibold text-red-700 hover:text-red-800" onClick={() => setMode("admin")}>Admin Tool</button> : null}
        </div>
      </div>
    </main>
  );
}

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const ready = username.trim() && password.length >= 6 && password === confirmPassword;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    await createLocalUser(username, password);
    onDone();
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <p className="rounded-md border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">Create the local user for this device. This protects Haudy from casual access on this browser.</p>
      <AuthInput label="Username" value={username} onChange={setUsername} autoFocus />
      <AuthInput label="Password" value={password} onChange={setPassword} type="password" />
      <AuthInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} type="password" />
      {password && password.length < 6 ? <p className="text-sm font-medium text-amber-700">Use at least 6 characters.</p> : null}
      {confirmPassword && password !== confirmPassword ? <p className="text-sm font-medium text-amber-700">Passwords do not match.</p> : null}
      {message ? <p className="text-sm font-medium text-red-700">{message}</p> : null}
      <button className="min-h-11 rounded-md bg-navy px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!ready} onClick={() => setMessage("")}>Create User</button>
    </form>
  );
}

function LoginForm({ username, onDone }: { username: string; onDone: () => void }) {
  const [enteredUsername, setEnteredUsername] = useState(username);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await verifyLocalUser(enteredUsername, password)) {
      localStorage.setItem("haudy.localSession", JSON.stringify({ username: enteredUsername.trim(), role: "user", loggedInAt: new Date().toISOString() }));
      onDone();
      return;
    }
    setMessage("Username or password is not correct.");
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <AuthInput label="Username" value={enteredUsername} onChange={setEnteredUsername} autoFocus />
      <AuthInput label="Password" value={password} onChange={setPassword} type="password" />
      {message ? <p className="text-sm font-medium text-red-700">{message}</p> : null}
      <button className="min-h-11 rounded-md bg-navy px-4 font-semibold text-white">Log In</button>
    </form>
  );
}

function AdminTool({ username, onBack, onAuthChanged, onLoggedIn }: { username: string; onBack: () => void; onAuthChanged: () => void; onLoggedIn: () => void }) {
  const [adminUsername, setAdminUsername] = useState("Admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminOk, setAdminOk] = useState(false);
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [message, setMessage] = useState("");

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (await verifyAdmin(adminUsername, adminPassword)) {
      setAdminOk(true);
      setMessage("");
      return;
    }
    setMessage("Admin username or password is not correct.");
  }

  async function resetUserPassword() {
    if (newUserPassword.length < 6) {
      setMessage("New user password must be at least 6 characters.");
      return;
    }
    await resetLocalUserPassword(newUserPassword);
    setNewUserPassword("");
    onAuthChanged();
    setMessage("Local user password was reset.");
  }

  async function saveAdminPassword() {
    if (newAdminPassword.length < 6) {
      setMessage("New admin password must be at least 6 characters.");
      return;
    }
    await changeAdminPassword(newAdminPassword);
    setNewAdminPassword("");
    setAdminPassword("");
    setAdminOk(false);
    onAuthChanged();
    setMessage("Admin password was changed. Log in to the Admin Tool again.");
  }

  function openAsUser() {
    const session = unlockAsLocalUser();
    if (session) onLoggedIn();
  }

  if (!adminOk) {
    return (
      <form className="grid gap-3" onSubmit={unlock}>
        <p className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-950">Use the built-in admin account to reset the local user password on this device.</p>
        <AuthInput label="Admin username" value={adminUsername} onChange={setAdminUsername} autoFocus />
        <AuthInput label="Admin password" value={adminPassword} onChange={setAdminPassword} type="password" />
        {message ? <p className="text-sm font-medium text-red-700">{message}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700" onClick={onBack}>Cancel</button>
          <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-800"><ShieldCheck size={16} /> Open Admin Tool</button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Admin tool unlocked.</div>
      <section className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h2 className="font-bold text-navy">Reset Local User Password</h2>
        <p className="text-sm text-slate-600">Current local user: <b>{username || "No local user created"}</b></p>
        <AuthInput label="New local user password" value={newUserPassword} onChange={setNewUserPassword} type="password" />
        <button className="min-h-10 rounded-md border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-sky-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!username} onClick={resetUserPassword}>Reset User Password</button>
        <button className="min-h-10 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!username} onClick={openAsUser}>Open Haudy As Local User</button>
      </section>
      <section className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h2 className="font-bold text-navy">Change Admin Password</h2>
        <AuthInput label="New admin password" value={newAdminPassword} onChange={setNewAdminPassword} type="password" />
        <button className="min-h-10 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-800" onClick={saveAdminPassword}>Change Admin Password</button>
      </section>
      {message ? <p className="text-sm font-medium text-red-700">{message}</p> : null}
      <button className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700" onClick={onBack}>Close Admin Tool</button>
    </div>
  );
}

function AuthInput({ label, value, onChange, type = "text", autoFocus }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoFocus?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      <input className="min-h-11 rounded-md border border-slate-300 px-3" type={type} value={value} onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} />
    </label>
  );
}
