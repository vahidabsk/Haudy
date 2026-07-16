import { uid } from "./utils";
import { Audit } from "./types";

const DB_NAME = "haudy-photo-vault";
const DB_VERSION = 1;
const STORE_NAME = "photos";
const LEGACY_PREFIX = "haudy.photos.";
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let initialization: Promise<void> | null = null;

export async function storePhoto(file: File) {
  return storePhotoDataUrl(await downscale(file));
}

export async function storePhotoDataUrl(dataUrl: string) {
  const id = uid("photo");
  const normalized = normalizePhotoDataUrl(dataUrl);
  await writePhoto(id, normalized);
  cache.set(id, normalized);
  notify();
  return id;
}

// Serve renders from memory while the vault hydrates asynchronously.
export function loadPhoto(id: string) {
  if (isDataUrl(id)) return normalizePhotoDataUrl(id);
  return cache.get(id) || "";
}

export async function removePhoto(id: string) {
  if (isDataUrl(id)) return;
  cache.delete(id);
  localStorage.removeItem(`${LEGACY_PREFIX}${id}`);
  await deletePhoto(id);
  notify();
}

export function removeAuditPhotos(audit: Audit) {
  photoIdsForAudits([audit]).forEach((id) => { void removePhoto(id); });
}

export function subscribePhotoStore(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function initializePhotoStore(audits: Audit[]) {
  if (initialization) return initialization;
  initialization = (async () => {
    await navigator.storage?.persist?.().catch(() => false);
    const referenced = new Set(photoIdsForAudits(audits));

    // Migrate referenced legacy photos and remove obsolete local entries.
    for (const key of Object.keys(localStorage).filter((key) => key.startsWith(LEGACY_PREFIX))) {
      const id = key.slice(LEGACY_PREFIX.length);
      const value = localStorage.getItem(key);
      if (value && referenced.has(id)) {
        const normalized = normalizePhotoDataUrl(value);
        await writePhoto(id, normalized);
        cache.set(id, normalized);
      }
      localStorage.removeItem(key);
    }

    for (const id of referenced) {
      if (isDataUrl(id) || cache.has(id)) continue;
      const value = await readPhoto(id);
      if (value) cache.set(id, normalizePhotoDataUrl(value));
    }
    notify();
  })().catch((error) => {
    initialization = null;
    console.error("Could not initialize Haudy photo vault.", error);
    throw error;
  });
  return initialization;
}

export async function readAllStoredPhotos() {
  const db = await openDb();
  try {
    return await new Promise<Record<string, string>>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      const photos: Record<string, string> = {};
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        photos[`${LEGACY_PREFIX}${String(cursor.key)}`] = String(cursor.value || "");
        cursor.continue();
      };
      transaction.oncomplete = () => resolve(photos);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function importStoredPhoto(key: string, value: string) {
  const id = key.startsWith(LEGACY_PREFIX) ? key.slice(LEGACY_PREFIX.length) : key;
  const normalized = normalizePhotoDataUrl(value);
  await writePhoto(id, normalized);
  cache.set(id, normalized);
}

export async function clearStoredPhotos() {
  cache.clear();
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
  notify();
}

async function downscale(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, 1200 / longEdge);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare photo.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    bitmap.close?.();
  }
}

function photoIdsForAudits(audits: Audit[]) {
  return audits.flatMap((audit) => [
    ...audit.documentation.flatMap((row) => row.photos || []),
    ...audit.installation.flatMap((row) => row.photos || []),
    ...audit.deviceTests.flatMap((row) => row.photos || []),
  ]).filter((id) => !isDataUrl(id));
}

function notify() {
  listeners.forEach((listener) => listener());
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writePhoto(id: string, value: string) {
  return photoRequest("readwrite", (store) => store.put(value, id));
}

async function readPhoto(id: string) {
  return photoRequest<string | undefined>("readonly", (store) => store.get(id));
}

async function deletePhoto(id: string) {
  return photoRequest("readwrite", (store) => store.delete(id));
}

async function photoRequest<T = unknown>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function isDataUrl(value: string) {
  return /^data:[^,]*,/i.test(value);
}

function normalizePhotoDataUrl(value: string) {
  const match = value.match(/^data:([^,]*),(.*)$/s);
  if (!match) return value;
  const meta = match[1] || "";
  const payload = match[2] || "";
  if (/^image\//i.test(meta)) return value;
  if (!/;base64/i.test(meta)) return value;
  const mime = sniffImageMime(payload);
  return mime ? `data:${mime};base64,${payload}` : value;
}

function sniffImageMime(base64Payload: string) {
  try {
    const binary = atob(base64Payload.slice(0, 32));
    const bytes = Array.from(binary, (char) => char.charCodeAt(0));
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (binary.startsWith("RIFF") && binary.slice(8, 12) === "WEBP") return "image/webp";
  } catch { return ""; }
  return "";
}
