import findingRows from "../data/auditor-report-findings.json";

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

export function searchAuditorReportFindings(filters: AuditorReportSearchFilters, limit = 80) {
  const terms = normalize(filters.keyword).split(" ").filter(Boolean);
  const standard = normalize(filters.standard);
  const year = normalize(filters.year);
  const reviewType = normalize(filters.reviewType);
  const category = normalize(filters.category);

  return auditorReportFindings
    .map((row) => ({ row, score: scoreFinding(row, terms, standard, year, reviewType, category) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.reviewType.localeCompare(b.row.reviewType) || a.row.category.localeCompare(b.row.category) || a.row.finding.localeCompare(b.row.finding))
    .slice(0, limit)
    .map((item) => item.row);
}

function scoreFinding(row: AuditorReportFinding, terms: string[], standard: string, year: string, reviewType: string, category: string) {
  const haystack = normalize([row.standard, row.year, row.reviewType, row.category, row.findingType, row.section, row.finding, row.requiredAction, row.keywords, row.examples].join(" "));
  if (standard && normalize(row.standard) !== standard) return 0;
  if (year && normalize(row.year) !== year) return 0;
  if (reviewType && normalize(row.reviewType) !== reviewType) return 0;
  if (category && normalize(row.category) !== category) return 0;
  if (terms.length && !terms.every((term) => haystack.includes(term))) return 0;

  let score = 1;
  if (standard) score += 25;
  if (year) score += 25;
  if (reviewType) score += 18;
  if (category) score += 18;
  terms.forEach((term) => {
    if (normalize(row.category).includes(term)) score += 10;
    if (normalize(row.findingType).includes(term)) score += 10;
    if (normalize(row.section).includes(term)) score += 8;
    if (normalize(row.finding).includes(term)) score += 5;
    if (normalize(row.requiredAction).includes(term)) score += 5;
    if (normalize(row.keywords).includes(term)) score += 4;
  });
  return score;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}
