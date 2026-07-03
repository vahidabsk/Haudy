import { Audit } from "./types";
import { isDesktopApp } from "./desktop-runtime";
import { chooseHaudyDatabaseRoot, createDesktopFolders, hasDesktopBridge, saveDesktopTextFile, storedHaudyDatabaseRoot } from "./desktop-bridge";

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
  return isDesktopApp() && hasDesktopBridge();
}

export async function saveCurrentDocumentSnapshot(details: StorageDocumentDetails) {
  if (!canSaveDocumentsToFolder()) {
    throw new Error("Folder saving is available in the Windows desktop app.");
  }
  if (!storedHaudyDatabaseRoot()) await chooseStorageRoot();
  await saveDesktopTextFile(storageFoldersForDetails(details), `${safeName(details.fileName)}.html`, await printableHtmlSnapshot(details.fileName));
}

export async function chooseStorageRoot() {
  if (!canSaveDocumentsToFolder()) {
    throw new Error("Folder saving is available in the Windows desktop app.");
  }
  return chooseHaudyDatabaseRoot();
}

export async function prepareStorageFolders(details: Array<Omit<StorageDocumentDetails, "folder" | "fileName">>) {
  if (!storedHaudyDatabaseRoot()) await chooseStorageRoot();
  const folderSets = new Set<string>();
  for (const detail of details) {
    const base = safeName([detail.year || new Date().getFullYear().toString(), detail.ascName || "ASC"].filter(Boolean).join(" - "));
    folderSets.add(JSON.stringify([base, "Confirmation"]));
    folderSets.add(JSON.stringify([base, "Report"]));
    if (detail.propertyName || detail.certificateNumber) {
      const property = safeName([detail.propertyName || "Property", detail.certificateNumber || detail.psn || "Certificate"].filter(Boolean).join(" - "));
      folderSets.add(JSON.stringify([base, property, "Field Notes"]));
    }
  }
  await createDesktopFolders(Array.from(folderSets, (folders) => JSON.parse(folders) as string[]));
}

export async function hasStorageRoot() {
  return Boolean(storedHaudyDatabaseRoot());
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

export function storageFoldersForDetails(details: StorageDocumentDetails) {
  const ascFolderName = safeName([details.year || new Date().getFullYear().toString(), details.ascName || "ASC"].filter(Boolean).join(" - "));
  if (details.folder === "Field Notes") {
    const propertyFolderName = safeName([details.propertyName || "Property", details.certificateNumber || details.psn || "Certificate"].filter(Boolean).join(" - "));
    return [ascFolderName, propertyFolderName, details.folder];
  }
  return [ascFolderName, details.folder];
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

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Haudy Document";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
