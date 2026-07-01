export const UNUSED_REFERENCE_VALUE = "__HAUDY_NOT_USED__";

export function isReferenceUsed(value: string | undefined) {
  return value !== UNUSED_REFERENCE_VALUE;
}

export function isReferenceComplete(value: string | undefined, fallback = "") {
  return !isReferenceUsed(value) || Boolean((value || fallback).trim());
}

export function printableReferenceValue(value: string | undefined, fallback = "") {
  return isReferenceUsed(value) ? (value || fallback).trim() : "";
}
