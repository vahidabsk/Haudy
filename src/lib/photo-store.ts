import { uid } from "./utils";

export async function storePhoto(file: File) {
  const dataUrl = await downscale(file);
  const id = uid("photo");
  localStorage.setItem(`haudy.photos.${id}`, dataUrl);
  return id;
}

export function loadPhoto(id: string) {
  return localStorage.getItem(`haudy.photos.${id}`) || "";
}

export function removePhoto(id: string) {
  localStorage.removeItem(`haudy.photos.${id}`);
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
