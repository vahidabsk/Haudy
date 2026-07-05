import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CloudDownload, RefreshCw, ShieldCheck, X } from "lucide-react";
import { getDesktopAppVersion, installDesktopPatch } from "../lib/desktop-bridge";

type PatchStatus = "idle" | "checking" | "upToDate" | "available" | "installing" | "installed" | "error";

interface PatchRelease {
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  assetName: string;
  downloadUrl: string;
}

const fallbackCurrentVersion = "0.1.0";
const latestReleaseUrl = "https://api.github.com/repos/vahidabsk/Haudy/releases/latest";

export function PatchUpdateDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<PatchStatus>("idle");
  const [release, setRelease] = useState<PatchRelease | null>(null);
  const [message, setMessage] = useState("");

  async function checkPatch() {
    setStatus("checking");
    setMessage("");
    try {
      const currentVersion = (await getDesktopAppVersion()) || fallbackCurrentVersion;
      const response = await fetch(latestReleaseUrl, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error("Could not reach the Haudy patch channel.");
      const latest = await response.json() as GithubRelease;
      const latestVersion = cleanReleaseVersion(latest.tag_name);
      const asset = latest.assets?.find((item) => /\.msi$/i.test(item.name)) || latest.assets?.find((item) => /\.exe$/i.test(item.name));
      if (!latestVersion || !asset?.browser_download_url) {
        throw new Error("The latest Haudy release does not include a Windows installer.");
      }
      const nextRelease = {
        currentVersion,
        latestVersion,
        releaseName: latest.name || latest.tag_name || `Haudy ${latestVersion}`,
        assetName: asset.name,
        downloadUrl: asset.browser_download_url,
      };
      setRelease(nextRelease);
      setStatus(compareVersions(latestVersion, currentVersion) > 0 ? "available" : "upToDate");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not check for a Haudy patch.");
    }
  }

  async function installPatch() {
    if (!release) return;
    setStatus("installing");
    setMessage("Downloading the installer. Windows may ask for permission to run it.");
    try {
      const result = await installDesktopPatch(release.downloadUrl, release.assetName);
      setMessage(result);
      setStatus("installed");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not install the Haudy patch.");
    }
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
          <PatchMessage status={status} release={release} message={message} />
          {status === "installing" ? (
            <div className="mt-4">
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-500" />
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-700">Preparing Windows installer...</p>
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
          Admin note: a patch appears only when the latest desktop release version is newer than this installed Haudy version.
        </p>
      </section>
    </div>
  );
}

function PatchMessage({ status, release, message }: { status: PatchStatus; release: PatchRelease | null; message: string }) {
  if (status === "checking") {
    return <StatusBlock icon={<RefreshCw className="mt-0.5 animate-spin text-sky-700" size={20} />} title="Checking for the latest Haudy patch..." text="Haudy is checking the desktop patch channel." />;
  }
  if (status === "available" && release) {
    return (
      <StatusBlock
        icon={<CloudDownload className="mt-0.5 text-emerald-700" size={20} />}
        title={`Patch ${release.latestVersion} is available.`}
        text={`Installed: ${release.currentVersion}. Package: ${release.assetName}. Save open work before installing.`}
      />
    );
  }
  if (status === "upToDate" && release) {
    return (
      <StatusBlock
        icon={<CheckCircle2 className="mt-0.5 text-emerald-700" size={20} />}
        title="Haudy is up to date."
        text={`Installed: ${release.currentVersion}. Latest available patch: ${release.latestVersion}.`}
      />
    );
  }
  if (status === "installing") {
    return <StatusBlock icon={<ShieldCheck className="mt-0.5 text-emerald-700" size={20} />} title="Installing patch..." text={message || "Keep Haudy open while the installer is prepared."} />;
  }
  if (status === "installed") {
    return <StatusBlock icon={<CheckCircle2 className="mt-0.5 text-emerald-700" size={20} />} title="Patch installer is ready." text={message || "Finish the Windows installer, then restart Haudy."} />;
  }
  if (status === "error") {
    return <StatusBlock icon={<AlertTriangle className="mt-0.5 text-red-700" size={20} />} title="Patch check needs attention." text={message || "Could not complete the patch operation."} />;
  }
  return <StatusBlock icon={<ShieldCheck className="mt-0.5 text-slate-600" size={20} />} title="No patch check has been run in this session." text="Use Check Latest Patch to see whether a newer Haudy desktop update is available." />;
}

function StatusBlock({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      {icon}
      <div>
        <p className="font-bold text-navy">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{text}</p>
      </div>
    </div>
  );
}

interface GithubRelease {
  tag_name?: string;
  name?: string;
  assets?: Array<{ name: string; browser_download_url: string }>;
}

function cleanReleaseVersion(value?: string) {
  return (value || "").replace(/^desktop-v/i, "").replace(/^v/i, "").trim();
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
