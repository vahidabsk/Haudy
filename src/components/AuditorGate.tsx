import { FormEvent, ReactNode, useState } from "react";
import { Auditor } from "../lib/types";

export function AuditorGate({ auditor, onSave, children }: { auditor: Auditor | null; onSave: (name: string) => void; children: ReactNode }) {
  const [name, setName] = useState(auditor?.name || "");
  const needsName = !auditor?.name;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  }

  return (
    <>
      {children}
      {needsName ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-navy">Enter your name to continue</h2>
            <p className="mt-2 text-sm text-slate-600">Your name is stamped on audits and updated rows.</p>
            <input
              className="mt-5 h-12 w-full rounded-md border border-slate-300 px-3"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Auditor name"
              autoFocus
            />
            <button className="mt-4 h-12 w-full rounded-md bg-signal px-4 font-semibold text-white" type="submit">
              Continue
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
