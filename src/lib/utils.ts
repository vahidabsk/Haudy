import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatUsPhone(value?: string) {
  const rawDigits = String(value || "").replace(/\D/g, "");
  const digits = (rawDigits.length === 11 && rawDigits.startsWith("1") ? rawDigits.slice(1) : rawDigits).slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
