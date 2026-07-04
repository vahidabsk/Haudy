import { uid } from "./utils";
import { Audit } from "./types";

export async function storePhoto(file: File) {
  const dataUrl = await downscale(file);
  return storePhotoDataUrl(dataUrl);
}

export function storePhotoDataUrl(dataUrl: string) {
  const id = uid("photo");
  localStorage.setItem(`haudy.photos.${id}`, normalizePhotoDataUrl(dataUrl));
  return id;
}

export function loadPhoto(id: string) {
  if (isDataUrl(id)) return normalizePhotoDataUrl(id);
  const stored = localStorage.getItem(`haudy.photos.${id}`) || "";
  return stored ? normalizePhotoDataUrl(stored) : "";
}

export function removePhoto(id: string) {
  if (isDataUrl(id)) return;
  localStorage.removeItem(`haudy.photos.${id}`);
}

export function removeAuditPhotos(audit: Audit) {
  const photoIds = [
    ...audit.documentation.flatMap((row) => row.photos),
    ...audit.installation.flatMap((row) => row.photos),
    ...audit.deviceTests.flatMap((row) => row.photos),
  ];
  photoIds.forEach(removePhoto);
}

async function downscale(file: File) {
  const bitmap = await createImageBitmap(file);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 1600 / longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare photo.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
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
  } catch {
    return "";
  }
  return "";
}
