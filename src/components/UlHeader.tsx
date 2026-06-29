import { Auditor } from "../lib/types";

export function UlHeader({ auditor, onChange }: { auditor: Auditor | null; onChange: () => void }) {
  return (
    <header className="no-print">
      <div className="h-1.5 bg-signal" />
      <div className="bg-navy text-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-sm bg-white font-bold text-navy">H</div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Haudy</p>
              <h1 className="text-lg font-semibold">Fire Alarm Field Notes</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>{auditor?.name || "No auditor"}</span>
            <button className="min-h-11 rounded-md border border-white/30 px-3" onClick={onChange}>
              Change
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
