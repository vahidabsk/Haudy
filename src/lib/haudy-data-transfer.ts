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
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "text/plain;charset=utf-8" });
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
  const backup = parseHaudyBackup(await file.text());
  if (backup.app !== "Haudy" || !backup.entries || typeof backup.entries !== "object") {
    throw new Error("This does not look like a Haudy data file.");
  }
  replaceHaudyEntries(backup.entries);
  return Object.keys(backup.entries).length;
}

function parseHaudyBackup(rawText: string): Partial<HaudyBackupFile> {
  const text = normalizeBackupText(rawText);
  const candidates = [
    text,
    unwrapDataUrl(text),
    extractJsonObject(text),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Partial<HaudyBackupFile>;
    } catch {
      // Try the next shape. Some mobile file providers wrap or prefix text.
    }
  }
  throw new Error("Haudy could not read this file as JSON. Please export Haudy Data again and import that exact .haudy-data.json file.");
}

function normalizeBackupText(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function unwrapDataUrl(value: string) {
  const match = value.match(/^data:[^,]*,(.*)$/s);
  if (!match) return "";
  const payload = match[1];
  try {
    return value.includes(";base64,") ? atob(payload) : decodeURIComponent(payload);
  } catch {
    return "";
  }
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return value.slice(start, end + 1);
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
