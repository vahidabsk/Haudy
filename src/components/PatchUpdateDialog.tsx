import { useEffect, useState } from "react";
import { CheckCircle2, CloudDownload, RefreshCw, ShieldCheck, X } from "lucide-react";

type PatchStatus = "idle" | "checking" | "available" | "installing" | "installed";

export function PatchUpdateDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<PatchStatus>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status !== "installing") return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          window.clearInterval(timer);
          window.setTimeout(() => setStatus("installed"), 250);
          return 100;
        }
        return Math.min(100, value + 14);
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [status]);

  function checkPatch() {
    setStatus("checking");
    setProgress(0);
    window.setTimeout(() => setStatus("available"), 900);
  }

  function installPatch() {
    setStatus("installing");
    setProgress(6);
  }

  const busy = status === "checking" || status === "installing";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <section className="grid w-full max-w-lg gap-4 rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Haudy Patch Center</p>
            <h2 className="mt-1 text-xl font-bold text-navy">Check And Install Patch</h2>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={onClose} title="Close patch center">
            <X size={18} />
          </button>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <PatchMessage status={status} />
          {status === "installing" ? (
            <div className="mt-4">
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-700">{progress}% complete</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={checkPatch}
          >
            <RefreshCw size={16} className={status === "checking" ? "animate-spin" : ""} />
            Check Latest Patch
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status !== "available"}
            onClick={installPatch}
          >
            <CloudDownload size={16} />
            Install Patch
          </button>
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Auditors stay inside Haudy during patch checks. The desktop update package is handled by Haudy, without showing repository or release pages.
        </p>
      </section>
    </div>
  );
}

function PatchMessage({ status }: { status: PatchStatus }) {
  if (status === "checking") {
    return (
      <div className="flex gap-3">
        <RefreshCw className="mt-0.5 animate-spin text-sky-700" size={20} />
        <div>
          <p className="font-bold text-navy">Checking for the latest Haudy patch...</p>
          <p className="mt-1 text-sm text-slate-600">Haudy is checking the desktop patch channel.</p>
        </div>
      </div>
    );
  }
  if (status === "available") {
    return (
      <div className="flex gap-3">
        <CloudDownload className="mt-0.5 text-emerald-700" size={20} />
        <div>
          <p className="font-bold text-navy">A Haudy desktop patch is available.</p>
          <p className="mt-1 text-sm text-slate-600">Save open work, then choose Install Patch to apply it from inside Haudy.</p>
        </div>
      </div>
    );
  }
  if (status === "installing") {
    return (
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 text-emerald-700" size={20} />
        <div>
          <p className="font-bold text-navy">Installing patch...</p>
          <p className="mt-1 text-sm text-slate-600">Keep Haudy open while the patch is prepared.</p>
        </div>
      </div>
    );
  }
  if (status === "installed") {
    return (
      <div className="flex gap-3">
        <CheckCircle2 className="mt-0.5 text-emerald-700" size={20} />
        <div>
          <p className="font-bold text-navy">Patch installation completed.</p>
          <p className="mt-1 text-sm text-slate-600">Restart Haudy to finish applying the update.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <ShieldCheck className="mt-0.5 text-slate-600" size={20} />
      <div>
        <p className="font-bold text-navy">No patch check has been run in this session.</p>
        <p className="mt-1 text-sm text-slate-600">Use Check Latest Patch to see whether a Haudy desktop update is available.</p>
      </div>
    </div>
  );
}
