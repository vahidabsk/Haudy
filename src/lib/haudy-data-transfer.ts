const BACKUP_VERSION = 1;
const HAUDY_PREFIX = "haudy.";

interface HaudyBackupFile {
  app: "Haudy";
  version: number;
  exportedAt: string;
  entries: Record<string, string>;
}

export function exportHaudyBackup() {
  const backup: HaudyBackupFile = {
    app: "Haudy",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: readHaudyEntries(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Haudy_Data_${new Date().toISOString().slice(0, 10)}.haudy-data.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importHaudyBackupFile(file: File) {
  const backup = JSON.parse(await file.text()) as Partial<HaudyBackupFile>;
  if (backup.app !== "Haudy" || !backup.entries || typeof backup.entries !== "object") {
    throw new Error("This does not look like a Haudy data file.");
  }
  replaceHaudyEntries(backup.entries);
  return Object.keys(backup.entries).length;
}

function readHaudyEntries() {
  const entries: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(HAUDY_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return entries;
}

function replaceHaudyEntries(entries: Record<string, string>) {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(HAUDY_PREFIX))
    .forEach((key) => localStorage.removeItem(key));

  Object.entries(entries).forEach(([key, value]) => {
    if (key.startsWith(HAUDY_PREFIX) && typeof value === "string") {
      localStorage.setItem(key, value);
    }
  });
}
