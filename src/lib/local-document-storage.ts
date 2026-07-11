import { Audit } from "./types";
import { isDesktopApp } from "./desktop-runtime";
import { chooseHaudyDatabaseRoot, createDesktopFolders, hasDesktopBridge, saveDesktopTextFile, storedHaudyDatabaseRoot } from "./desktop-bridge";

export type DocumentFolder = "Confirmation" | "Report" | "Field Notes";

export interface StorageDocumentDetails {
  year: string;
  ascName: string;
  cityState: string;
  psn: string;
  categoryCode?: string;
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
    const base = ascFolderName(detail);
    folderSets.add(JSON.stringify([base, "Confirmation"]));
    folderSets.add(JSON.stringify([base, "Report"]));
    if (detail.propertyName || detail.certificateNumber) {
      folderSets.add(JSON.stringify(fieldNoteFolders(detail)));
    }
  }
  folderSets.add(JSON.stringify(["iHaudy files"]));
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
    categoryCode: auditCategoryCode(audit),
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
  const base = ascFolderName(details);
  if (details.folder === "Field Notes") {
    return fieldNoteFolders(details);
  }
  return [base, details.folder];
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

function ascFolderName(details: Pick<StorageDocumentDetails, "year" | "ascName">) {
  return safeName([details.year || new Date().getFullYear().toString(), details.ascName || "ASC"].filter(Boolean).join(" - "));
}

function fieldNoteFolders(details: Pick<StorageDocumentDetails, "year" | "ascName" | "categoryCode" | "propertyName" | "certificateNumber" | "psn">) {
  const propertyFolderName = safeName([details.propertyName || "Property", details.certificateNumber || details.psn || "Certificate"].filter(Boolean).join(" - "));
  return [
    ascFolderName(details),
    "Selected Certificates (Properties)",
    safeName((details.categoryCode || "Uncategorized").toUpperCase()),
    propertyFolderName,
  ];
}

function auditCategoryCode(audit: Audit) {
  const certificate = audit.certificates?.[audit.primaryCertificateIndex] || audit.certificates?.[0];
  return (certificate?.categoryCode || certificate?.ccn || audit.fileScn.match(/\b(UUFX|UUJS|CVSG|CRZH)\b/i)?.[1] || "Uncategorized").toUpperCase();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
