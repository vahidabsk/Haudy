import { Link } from "react-router-dom";
import { Flame, UserRound } from "lucide-react";
import { Auditor } from "../lib/types";

export function UlHeader({ auditor, onChange }: { auditor: Auditor | null; onChange: () => void }) {
  return (
    <header className="no-print">
      <div className="h-1 bg-signal" />
      <div className="bg-navy text-white shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link className="flex items-center gap-3" to="/">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-white text-navy">
              <Flame size={24} strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Haudy</p>
              <h1 className="text-lg font-semibold">Fire Alarm Field Notes</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-2 sm:flex"><UserRound size={16} />{auditor?.name || "No auditor"}</span>
            <button className="min-h-11 rounded-md border border-white/30 px-3 font-medium hover:bg-white/10" onClick={onChange}>
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
