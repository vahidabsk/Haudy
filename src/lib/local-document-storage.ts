import { Audit } from "./types";
import { isDesktopApp } from "./desktop-runtime";

type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
};

const DB_NAME = "haudy-file-storage";
const STORE_NAME = "handles";
const ROOT_KEY = "root";
const DATABASE_FOLDER = "Haudy Database";

export type DocumentFolder = "Confirmation" | "Report" | "Field Notes";

export interface StorageDocumentDetails {
  year: string;
  ascName: string;
  cityState: string;
  psn: string;
  propertyName?: string;
  certificateNumber?: string;
  folder: DocumentFolder;
  fileName: string;
}

export function canSaveDocumentsToFolder() {
  return isDesktopApp() && "showDirectoryPicker" in window;
}

export async function saveCurrentDocumentSnapshot(details: StorageDocumentDetails) {
  if (!canSaveDocumentsToFolder()) {
    throw new Error("Folder saving is available in the Windows desktop app.");
  }
  const root = await getOrChooseRootDirectory();
  const folder = await documentFolder(root, details);
  const file = await folder.getFileHandle(`${safeName(details.fileName)}.html`, { create: true });
  const writable = await file.createWritable();
  await writable.write(await printableHtmlSnapshot(details.fileName));
  await writable.close();
}

export async function chooseStorageRoot() {
  if (!canSaveDocumentsToFolder()) {
    throw new Error("Folder saving is available in the Windows desktop app.");
  }
  const picker = window.showDirectoryPicker;
  if (!picker) throw new Error("Folder saving is available in the Windows desktop app.");
  const root = await picker({ mode: "readwrite" }) as DirectoryHandle;
  await setRootHandle(root);
  return root;
}

export async function prepareStorageFolders(details: Array<Omit<StorageDocumentDetails, "folder" | "fileName">>) {
  const root = await chooseStorageRoot();
  const seen = new Set<string>();
  for (const detail of details.length ? details : [{ year: new Date().getFullYear().toString(), ascName: "ASC", cityState: "", psn: "" }]) {
    const ascKey = `${detail.year}|${detail.ascName}`;
    if (!seen.has(`${ascKey}|Confirmation`)) {
      await documentFolder(root, { ...detail, folder: "Confirmation", fileName: "Confirmation" });
      seen.add(`${ascKey}|Confirmation`);
    }
    if (!seen.has(`${ascKey}|Report`)) {
      await documentFolder(root, { ...detail, folder: "Report", fileName: "Report" });
      seen.add(`${ascKey}|Report`);
    }
    if (detail.propertyName || detail.certificateNumber) {
      await documentFolder(root, { ...detail, folder: "Field Notes", fileName: "Field Notes" });
    }
  }
}

export async function hasStorageRoot() {
  return Boolean(await getRootHandle());
}

export function storageDetailsFromAudit(audit: Audit, folder: DocumentFolder, fileName: string): StorageDocumentDetails {
  return {
    year: (audit.auditDate || audit.createdAt || new Date().toISOString()).slice(0, 4),
    ascName: audit.ascName || "ASC",
    cityState: [audit.ascCity, audit.ascState].filter(Boolean).join(" "),
    psn: audit.certificateNumber || "PSN",
    propertyName: audit.protectedProperty || "Property",
    certificateNumber: audit.certificateNumber || audit.id,
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
  const main = await root.getDirectoryHandle(DATABASE_FOLDER, { create: true });
  const ascFolderName = safeName([details.year || new Date().getFullYear().toString(), details.ascName || "ASC"].filter(Boolean).join(" - "));
  const asc = await main.getDirectoryHandle(ascFolderName, { create: true });
  if (details.folder === "Field Notes") {
    const propertyFolderName = safeName([details.propertyName || "Property", details.certificateNumber || details.psn || "Certificate"].filter(Boolean).join(" - "));
    const property = await asc.getDirectoryHandle(propertyFolderName, { create: true });
    return property.getDirectoryHandle(details.folder, { create: true });
  }
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
  const pageClones = Array.from(document.querySelectorAll<HTMLElement>(".print-page")).map((page) => page.cloneNode(true) as HTMLElement);
  await Promise.all(pageClones.map(inlineImages));
  const pages = pageClones.map((page) => page.outerHTML).join("\n");
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

async function inlineImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(images.map(async (image) => {
    const src = image.getAttribute("src");
    if (!src || src.startsWith("data:")) return;
    try {
      const absoluteUrl = new URL(src, window.location.href).href;
      const response = await fetch(absoluteUrl);
      const blob = await response.blob();
      image.setAttribute("src", await blobToDataUrl(blob));
    } catch {
      image.setAttribute("data-haudy-image-warning", "Could not embed image before saving.");
    }
  }));
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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
