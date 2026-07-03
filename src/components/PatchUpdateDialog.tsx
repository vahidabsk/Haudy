import { Download, ExternalLink, RefreshCw, X } from "lucide-react";

const RELEASES_URL = "https://github.com/vahidabsk/Haudy/releases";
const LATEST_RELEASE_URL = "https://github.com/vahidabsk/Haudy/releases/latest";

export function PatchUpdateDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <section className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Haudy Patch Center</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Get The Latest Patch</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={onClose} title="Close patch center">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm leading-6 text-slate-700">
          Use this when a new Haudy desktop build is available. The patch opens from the official Haudy GitHub release page so the auditor can download and install the newest Windows package.
        </p>

        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-navy">Recommended update steps</p>
          <p>Save any open Haudy work, download the latest Windows package, close Haudy, then run the new installer.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50" href={LATEST_RELEASE_URL} target="_blank" rel="noreferrer">
            <RefreshCw size={16} />
            Check Latest Patch
          </a>
          <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100" href={LATEST_RELEASE_URL} target="_blank" rel="noreferrer">
            <Download size={16} />
            Install Patch
          </a>
        </div>

        <a className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-navy" href={RELEASES_URL} target="_blank" rel="noreferrer">
          View all Haudy releases
          <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}
