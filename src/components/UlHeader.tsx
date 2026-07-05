import { Link } from "react-router-dom";
import { DownloadCloud, Flame, HelpCircle, UserRound } from "lucide-react";
import { Auditor } from "../lib/types";

export function UlHeader({ auditor, localUsername, onChange, onHelp, onPatch, onLogout }: { auditor: Auditor | null; localUsername: string; onChange: () => void; onHelp: () => void; onPatch: () => void; onLogout: () => void }) {
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
              <p className="text-xs uppercase tracking-wide text-white/70">Haudy Audit Suite</p>
              <h1 className="text-lg font-semibold">Fire Alarm and Security Certificate Audits</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-2 sm:flex"><UserRound size={16} />{localUsername || auditor?.name || "No user"}</span>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/30 px-3 font-medium hover:bg-white/10" onClick={onHelp} title="Open Haudy operating help">
              <HelpCircle size={17} />
              <span className="hidden sm:inline">Help</span>
            </button>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/30 px-3 font-medium hover:bg-white/10" onClick={onPatch} title="Check for the latest Haudy patch">
              <DownloadCloud size={17} />
              <span className="hidden sm:inline">Patch</span>
            </button>
            <button className="min-h-11 rounded-md border border-white/30 px-3 font-medium hover:bg-white/10" onClick={onChange}>
              Edit Profile
            </button>
            <button className="min-h-11 rounded-md border border-white/30 px-3 font-medium hover:bg-white/10" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
