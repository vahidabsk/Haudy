interface TauriGlobal {
  core?: {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  };
}

const STORAGE_ROOT_KEY = "haudy-desktop-database-root";

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

export async function createDesktopFolders(folderSets: string[][]) {
  const invoke = getTauriInvoke();
  const basePath = storedHaudyDatabaseRoot();
  if (!invoke || !basePath || !folderSets.length) return;
  await invoke<void>("create_haudy_folders", {
    basePath,
    folderSets,
  });
}

function getTauriInvoke() {
  return (window as Window & { __TAURI__?: TauriGlobal }).__TAURI__?.core?.invoke;
}
