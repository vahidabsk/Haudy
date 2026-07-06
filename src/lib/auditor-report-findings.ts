import findingRows from "../data/auditor-report-findings.json";

const PAST_REPORTS_KEY = "haudy.pastReports.library.excel-v1";

export interface AuditorReportFinding {
  id: string;
  standard: string;
  year: string;
  reviewType: string;
  category: string;
  findingType: string;
  section: string;
  finding: string;
  requiredAction: string;
  keywords: string;
  examples: string;
}

export interface AuditorReportSearchFilters {
  keyword: string;
  standard: string;
  year: string;
  reviewType: string;
  category: string;
}

export const auditorReportFindings = findingRows as AuditorReportFinding[];

export const auditorReportStandards = uniqueSorted(auditorReportFindings.map((row) => row.standard));
export const auditorReportYears = uniqueSorted(auditorReportFindings.map((row) => row.year)).sort((a, b) => Number(b) - Number(a));
export const auditorReportReviewTypes = uniqueSorted(auditorReportFindings.map((row) => row.reviewType));
export const auditorReportCategories = uniqueSorted(auditorReportFindings.map((row) => row.category));

export function loadPastReportFindings() {
  try {
    const raw = localStorage.getItem(PAST_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAuditorReportFinding) : [];
  } catch {
    return [];
  }
}

export function savePastReportFindings(rows: AuditorReportFinding[]) {
  localStorage.setItem(PAST_REPORTS_KEY, JSON.stringify(rows));
}

export function allAuditorReportFindings() {
  return [...loadPastReportFindings(), ...auditorReportFindings];
}

export function pastReportOptions() {
  const rows = allAuditorReportFindings();
  return {
    standards: uniqueSorted(rows.map((row) => row.standard)),
    years: uniqueSorted(rows.map((row) => row.year)).sort((a, b) => Number(b) - Number(a)),
    reviewTypes: uniqueSorted(rows.map((row) => row.reviewType)),
    categories: uniqueSorted(rows.map((row) => row.category)),
  };
}

export function searchAuditorReportFindings(filters: AuditorReportSearchFilters, limit = 80) {
  const terms = normalize(filters.keyword).split(" ").filter(Boolean);
  const standard = normalize(filters.standard);
  const year = normalize(filters.year);
  const reviewType = normalize(filters.reviewType);
  const category = normalize(filters.category);

  return allAuditorReportFindings()
    .map((row) => ({ row, score: scoreFinding(row, terms, standard, year, reviewType, category) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.reviewType.localeCompare(b.row.reviewType) || a.row.category.localeCompare(b.row.category) || a.row.finding.localeCompare(b.row.finding))
    .slice(0, limit)
    .map((item) => item.row);
}

export function addReportFindingsToPastReports(rows: AuditorReportFinding[]) {
  const existing = loadPastReportFindings();
  const fingerprints = new Set([...existing, ...auditorReportFindings].map(findingFingerprint));
  const nextRows = [...existing];
  let added = 0;
  rows.forEach((row) => {
    const fingerprint = findingFingerprint(row);
    if (fingerprints.has(fingerprint)) return;
    fingerprints.add(fingerprint);
    nextRows.unshift(row);
    added += 1;
  });
  if (added) savePastReportFindings(nextRows);
  return added;
}

function findingFingerprint(row: AuditorReportFinding) {
  return normalize([row.standard, row.year, row.section, row.category, row.finding, row.requiredAction].join(" "));
}

function buildKeywords(values: string[]) {
  return uniqueSorted(values.join(" ").split(/\s+/).map((value) => value.replace(/[^a-zA-Z0-9.]+/g, "").trim()).filter((value) => value.length > 2)).join("; ");
}

function isAuditorReportFinding(value: unknown): value is AuditorReportFinding {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<AuditorReportFinding>;
  return typeof row.id === "string" && typeof row.finding === "string" && typeof row.requiredAction === "string";
}

function scoreFinding(row: AuditorReportFinding, terms: string[], standard: string, year: string, reviewType: string, category: string) {
  const keywordHaystack = normalize(row.finding);
  if (standard && normalize(row.standard) !== standard) return 0;
  if (year && normalize(row.year) !== year) return 0;
  if (reviewType && normalize(row.reviewType) !== reviewType) return 0;
  if (category && normalize(row.category) !== category) return 0;
  if (terms.length && !terms.every((term) => keywordHaystack.includes(term))) return 0;

  let score = 1;
  if (standard) score += 25;
  if (year) score += 25;
  if (reviewType) score += 18;
  if (category) score += 18;
  terms.forEach((term) => {
    if (normalize(row.category).includes(term)) score += 10;
    if (normalize(row.findingType).includes(term)) score += 10;
    if (normalize(row.section).includes(term)) score += 8;
    if (keywordHaystack.includes(term)) score += 12;
  });
  return score;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}
