import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Auditor } from "../lib/types";

type AuditorProfileInput = Omit<Auditor, "since" | "updatedAt">;

const defaultProfile: AuditorProfileInput = {
  name: "",
  title: "Alarm System Auditor",
  department: "Fire and Security Service Solutions",
  phone: "+1.510.358.6443",
  email: "Vahid.Abbasikoohenjani@ul.com",
};

export function AuditorGate({ auditor, editing, onSave, onCancel, children }: { auditor: Auditor | null; editing: boolean; onSave: (profile: AuditorProfileInput) => void; onCancel: () => void; children: ReactNode }) {
  const [profile, setProfile] = useState<AuditorProfileInput>(() => ({ ...defaultProfile, ...auditor }));
  const needsProfile = editing || !completeProfile(auditor);
  const ready = completeProfile(profile);

  useEffect(() => {
    if (needsProfile) setProfile({ ...defaultProfile, ...auditor });
  }, [auditor, needsProfile]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (ready) onSave(trimProfile(profile));
  }

  return (
    <>
      {children}
      {needsProfile ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <form onSubmit={submit} className="grid w-full max-w-xl gap-4 rounded-lg bg-white p-6 shadow-2xl">
            <div>
              <h2 className="text-xl font-semibold text-navy">Auditor Profile</h2>
              <p className="mt-2 text-sm text-slate-600">This information is used for audit rows and the signature on confirmation and report letters.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Full name
              <input className="min-h-11 rounded-md border border-slate-300 px-3" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Auditor name" autoFocus />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Title
                <input className="min-h-11 rounded-md border border-slate-300 px-3" value={profile.title} onChange={(event) => setProfile({ ...profile, title: event.target.value })} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Department
                <input className="min-h-11 rounded-md border border-slate-300 px-3" value={profile.department} onChange={(event) => setProfile({ ...profile, department: event.target.value })} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Phone
                <input className="min-h-11 rounded-md border border-slate-300 px-3" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Email
                <input className="min-h-11 rounded-md border border-slate-300 px-3" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {completeProfile(auditor) ? (
                <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
              ) : null}
              <button className="min-h-10 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!ready}>
                Save Profile
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function completeProfile(profile?: Partial<AuditorProfileInput> | null) {
  return Boolean(profile?.name?.trim() && profile.title?.trim() && profile.department?.trim() && profile.phone?.trim() && profile.email?.trim());
}

function trimProfile(profile: AuditorProfileInput): AuditorProfileInput {
  return {
    name: profile.name.trim(),
    title: profile.title.trim(),
    department: profile.department.trim(),
    phone: profile.phone.trim(),
    email: profile.email.trim(),
  };
}
