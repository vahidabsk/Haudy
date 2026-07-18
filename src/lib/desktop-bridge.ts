interface TauriGlobal {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
}

const STORAGE_ROOT_KEY = "haudy-desktop-database-root";

export interface DesktopCertificateFile {
  fileName: string;
  text: string;
}

export interface DesktopTrackerAssignment {
  auditorName: string;
  ascName: string;
  city: string;
  state: string;
  ccn: string;
  fileNo: string;
  scn: string;
  certCount: string;
  auditDays: string;
  psn: string;
  auditorNotes: string;
  ascStatus: string;
}

export interface DesktopCustomerContact {
  psn: string;
  name: string;
  phone: string;
  email: string;
  type: string;
}

export function hasDesktopBridge() {
  return Boolean(getTauriInvoke());
}

export function storedHaudyDatabaseRoot() {
  return localStorage.getItem(STORAGE_ROOT_KEY) || "";
}

export async function chooseHaudyDatabaseRoot() {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Haudy Database storage is available in the Windows desktop app.");
  const selected = await invoke<string | null>("choose_haudy_database_location");
  if (!selected) return "";
  localStorage.setItem(STORAGE_ROOT_KEY, selected);
  return selected;
}

export async function openCertificatePdfs() {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("PDF upload is available in the Windows desktop app.");
  return invoke<DesktopCertificateFile[]>("open_certificate_pdfs");
}

export async function openAuditTracker() {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Audit tracker import is available in the Windows desktop app.");
  return invoke<DesktopTrackerAssignment[]>("open_audit_tracker");
}

export async function openCustomerContactList() {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Customer contact-list import is available in the Windows desktop app.");
  return invoke<DesktopCustomerContact[]>("open_customer_contact_list");
}

export async function saveDesktopTextFile(folders: string[], fileName: string, contents: string) {
  const invoke = getTauriInvoke();
  const basePath = storedHaudyDatabaseRoot();
  if (!invoke || !basePath) throw new Error("Choose the Haudy Database location first.");
  return invoke<string>("save_haudy_text_file", {
    basePath,
    folders,
    fileName,
    contents,
  });
}

export async function saveDesktopBinaryFile(folders: string[], fileName: string, contents: Uint8Array) {
  const invoke = getTauriInvoke();
  const basePath = storedHaudyDatabaseRoot();
  if (!invoke || !basePath) throw new Error("Choose the Haudy Database location first.");
  return invoke<string>("save_haudy_binary_file", {
    basePath,
    folders,
    fileName,
    contents: Array.from(contents),
  });
}

export async function saveDesktopBinaryFileWithDialog(folders: string[], fileName: string, contents: Uint8Array) {
  const invoke = getTauriInvoke();
  const basePath = storedHaudyDatabaseRoot();
  if (!invoke || !basePath) throw new Error("Choose the Haudy Database location first.");
  try {
    return await invoke<string | null>("save_haudy_binary_file_with_dialog", {
      basePath,
      folders,
      fileName,
      contents: Array.from(contents),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("save_haudy_binary_file_with_dialog")) throw error;
    return saveDesktopBinaryFile(folders, fileName, contents);
  }
}

export async function createDesktopFolders(folderSets: string[][]) {
  const invoke = getTauriInvoke();
  const basePath = storedHaudyDatabaseRoot();
  if (!invoke || !basePath || !folderSets.length) return;
  await invoke<void>("create_haudy_folders", {
    basePath,
    folderSets,
  });
}

export async function getDesktopAppVersion() {
  const invoke = getTauriInvoke();
  if (!invoke) return "";
  const result = await invoke<{ version: string }>("get_haudy_version");
  return result.version;
}

export async function installDesktopPatch(downloadUrl: string, fileName: string) {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Patch installation is available in the Windows desktop app.");
  return invoke<string>("install_haudy_patch", {
    downloadUrl,
    fileName,
  });
}

function getTauriInvoke() {
  return (window as Window & { __TAURI__?: TauriGlobal }).__TAURI__?.core?.invoke;
}
