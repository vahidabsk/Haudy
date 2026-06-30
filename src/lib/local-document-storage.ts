import { Audit } from "./types";

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};

const DB_NAME = "haudy-file-storage";
const STORE_NAME = "handles";
const ROOT_KEY = "root";

export type DocumentFolder = "Confirmation" | "Report" | "Field Notes";

export interface StorageDocumentDetails {
  year: string;
  ascName: string;
  cityState: string;
  psn: string;
  folder: DocumentFolder;
  fileName: string;
}

export async function saveCurrentDocumentSnapshot(details: StorageDocumentDetails) {
  if (!("showDirectoryPicker" in window)) {
    throw new Error("Folder saving is supported in Chrome or Edge on desktop. Safari and iPad do not allow web apps to choose a local folder.");
  }
  const root = await getOrChooseRootDirectory();
  const folder = await documentFolder(root, details);
  const file = await folder.getFileHandle(`${safeName(details.fileName)}.html`, { create: true });
  const writable = await file.createWritable();
  await writable.write(await printableHtmlSnapshot(details.fileName));
  await writable.close();
}

export async function chooseStorageRoot() {
  if (!("showDirectoryPicker" in window)) {
    throw new Error("Folder saving is supported in Chrome or Edge on desktop. Safari and iPad do not allow web apps to choose a local folder.");
  }
  const picker = window.showDirectoryPicker;
  if (!picker) throw new Error("Folder saving is supported in Chrome or Edge on desktop. Safari and iPad do not allow web apps to choose a local folder.");
  const root = await picker({ mode: "readwrite" }) as DirectoryHandle;
  await setRootHandle(root);
  return root;
}

export async function prepareStorageFolders(details: Array<Omit<StorageDocumentDetails, "folder" | "fileName">>) {
  const root = await chooseStorageRoot();
  for (const detail of details) {
    for (const folder of ["Confirmation", "Report", "Field Notes"] as DocumentFolder[]) {
      await documentFolder(root, { ...detail, folder, fileName: folder });
    }
  }
}

export function storageDetailsFromAudit(audit: Audit, folder: DocumentFolder, fileName: string): StorageDocumentDetails {
  return {
    year: (audit.auditDate || audit.createdAt || new Date().toISOString()).slice(0, 4),
    ascName: audit.ascName || "ASC",
    cityState: [audit.ascCity, audit.ascState].filter(Boolean).join(" "),
    psn: audit.certificateNumber || "PSN",
    folder,
    fileName,
  };
}

export function storageDetailsFromAsc({ year, ascName, cityState, psn, folder, fileName }: StorageDocumentDetails): StorageDocumentDetails {
  return { year, ascName, cityState, psn, folder, fileName };
}

async function getOrChooseRootDirectory() {
  const existing = await getRootHandle();
  if (existing && await verifyPermission(existing)) return existing;
  return chooseStorageRoot();
}

async function documentFolder(root: DirectoryHandle, details: StorageDocumentDetails) {
  const main = await root.getDirectoryHandle("Haudy Storage", { create: true });
  const year = await main.getDirectoryHandle(safeName(details.year || new Date().getFullYear().toString()), { create: true });
  const ascFolderName = safeName([details.ascName, details.cityState, `PSN ${details.psn || "not-set"}`].filter(Boolean).join(" - "));
  const asc = await year.getDirectoryHandle(ascFolderName, { create: true });
  return asc.getDirectoryHandle(details.folder, { create: true });
}

async function printableHtmlSnapshot(title: string) {
  const styles = Array.from(document.styleSheets).map((sheet) => {
    try {
      return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
    } catch {
      return "";
    }
  }).join("\n");
  const pages = Array.from(document.querySelectorAll(".print-page")).map((page) => page.outerHTML).join("\n");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
${pages}
</body>
</html>`;
}

async function verifyPermission(handle: DirectoryHandle) {
  const descriptor = { mode: "readwrite" as const };
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if (await handle.queryPermission(descriptor) === "granted") return true;
  return await handle.requestPermission(descriptor) === "granted";
}

async function getRootHandle() {
  const db = await openDb();
  return new Promise<DirectoryHandle | null>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(ROOT_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

async function setRootHandle(handle: DirectoryHandle) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, ROOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Haudy Document";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandle>;
  }
}
