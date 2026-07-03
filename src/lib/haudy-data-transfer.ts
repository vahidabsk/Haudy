const BACKUP_VERSION = 1;
const HAUDY_PREFIX = "haudy.";
const PHOTO_PREFIX = "haudy.photos.";
const DEVICE_ONLY_KEYS = new Set([
  "haudy.localAuth",
  "haudy.localSession",
  "haudy.offlineReady",
]);

interface HaudyBackupFile {
  app: "Haudy";
  version: number;
  exportedAt: string;
  includesPhotos?: boolean;
  entries: Record<string, string>;
}

export interface HaudyImportResult {
  imported: number;
  skippedPhotos: number;
}

export async function exportHaudyBackup({ includePhotos = false } = {}) {
  const backup: HaudyBackupFile = {
    app: "Haudy",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    includesPhotos: includePhotos,
    entries: await readHaudyEntries(includePhotos),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Haudy_Data_${includePhotos ? "With_Photos" : "Without_Photos"}_${fileTimestamp()}.haudy-data.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileTimestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "_",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

export async function importHaudyBackupFile(file: File) {
  const backup = parseHaudyBackup(await readFileText(file));
  if (backup.app !== "Haudy" || !backup.entries || typeof backup.entries !== "object") {
    throw new Error("This does not look like a Haudy data file.");
  }
  return replaceHaudyEntries(backup.entries);
}

async function readFileText(file: File) {
  try {
    return await file.text();
  } catch {
    const buffer = await file.arrayBuffer();
    return new TextDecoder("utf-8").decode(buffer);
  }
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

async function readHaudyEntries(includePhotos: boolean) {
  const entries: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isTransferableHaudyKey(key)) continue;
    if (!includePhotos && key.startsWith(PHOTO_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = await exportEntryValue(key, value, includePhotos);
  }
  return entries;
}

async function exportEntryValue(key: string, value: string, includePhotos: boolean) {
  if (key === "haudy.audits" && !includePhotos) return stripPhotoReferences(value);
  if (includePhotos && key.startsWith(PHOTO_PREFIX)) return compressPhotoDataUrl(value);
  return value;
}

function replaceHaudyEntries(entries: Record<string, string>) {
  const previousEntries = readCurrentHaudyEntries();
  Object.keys(localStorage)
    .filter(isTransferableHaudyKey)
    .forEach((key) => localStorage.removeItem(key));

  let imported = 0;
  let skippedPhotos = 0;
  try {
    Object.entries(entries).forEach(([key, value]) => {
      if (isTransferableHaudyKey(key) && typeof value === "string") {
        try {
          localStorage.setItem(key, value);
          imported += 1;
        } catch (error) {
          if (key.startsWith(PHOTO_PREFIX)) {
            skippedPhotos += 1;
            return;
          }
          throw error;
        }
      }
    });
  } catch (error) {
    restoreEntries(previousEntries);
    throw error;
  }
  return { imported, skippedPhotos };
}

function readCurrentHaudyEntries() {
  const entries: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isTransferableHaudyKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return entries;
}

function restoreEntries(entries: Record<string, string>) {
  Object.keys(localStorage)
    .filter(isTransferableHaudyKey)
    .forEach((key) => localStorage.removeItem(key));

  Object.entries(entries).forEach(([key, value]) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Best effort restore. If the browser quota is already full, keep going.
    }
  });
}

function isTransferableHaudyKey(key: string) {
  return key.startsWith(HAUDY_PREFIX) && !DEVICE_ONLY_KEYS.has(key);
}

function stripPhotoReferences(value: string) {
  try {
    const audits = JSON.parse(value) as Array<{
      documentation?: Array<{ photos?: string[] }>;
      installation?: Array<{ photos?: string[] }>;
      deviceTests?: Array<{ photos?: string[] }>;
    }>;
    audits.forEach((audit) => {
      audit.documentation?.forEach((row) => { row.photos = []; });
      audit.installation?.forEach((row) => { row.photos = []; });
      audit.deviceTests?.forEach((row) => { row.photos = []; });
    });
    return JSON.stringify(audits);
  } catch {
    return value;
  }
}

function compressPhotoDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const longEdge = Math.max(image.width, image.height);
      const scale = Math.min(1, 900 / longEdge);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.58));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}
