import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Auditor } from "../lib/types";

type AuditorProfileInput = Omit<Auditor, "since" | "updatedAt">;

const auditorTitles = [
  "Alarm System Auditor",
  "Senior Alarm System Auditor",
  "Lead Auditor Technologist",
  "Lead Auditor Specialist",
];

const defaultDepartment = "Built Environment - Critical Infrastructure Service\nFire and Security Service Solutions";

const defaultProfile: AuditorProfileInput = {
  name: "",
  title: auditorTitles[0],
  department: defaultDepartment,
  phone: "",
  email: "",
};

export function AuditorGate({ auditor, editing, onSave, onCancel, children }: { auditor: Auditor | null; editing: boolean; onSave: (profile: AuditorProfileInput) => void; onCancel: () => void; children: ReactNode }) {
  const [profile, setProfile] = useState<AuditorProfileInput>(() => ({ ...defaultProfile, ...auditor }));
  // A saved profile belongs to the user and should not interrupt each login.
  // Validation is enforced when it is created or intentionally edited.
  const needsProfile = editing || !auditor;
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
                <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3" value={auditorTitles.includes(profile.title) ? profile.title : auditorTitles[0]} onChange={(event) => setProfile({ ...profile, title: event.target.value })}>
                  {auditorTitles.map((title) => <option key={title} value={title}>{title}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Department
                <textarea className="min-h-20 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700" value={defaultDepartment} readOnly />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Phone
                <input className="min-h-11 rounded-md border border-slate-300 px-3" inputMode="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: formatPhone(event.target.value) })} placeholder="(123)456-7890" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Email
                <input className="min-h-11 rounded-md border border-slate-300 px-3" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="name@ul.com" />
                {profile.email.trim() && !validUlEmail(profile.email) ? <span className="text-xs font-semibold text-red-700">Use your UL email address ending in @ul.com.</span> : null}
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {auditor ? (
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
  return Boolean(profile?.name?.trim() && profile.title?.trim() && profile.phone?.trim() && validUlEmail(profile.email));
}

function trimProfile(profile: AuditorProfileInput): AuditorProfileInput {
  return {
    name: profile.name.trim(),
    title: profile.title.trim() || auditorTitles[0],
    department: defaultDepartment,
    phone: formatPhone(profile.phone),
    email: profile.email.trim(),
  };
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validUlEmail(value?: string) {
  return /^[^\s@]+@ul\.com$/i.test(value?.trim() || "");
}
