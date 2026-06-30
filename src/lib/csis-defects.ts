import defectRows from "../data/csis-defects.json";

export interface CsisDefect {
  defect: string;
  standard: string;
  year: string;
  section: string;
  category: string;
}

export interface CsisSearchFilters {
  keyword: string;
  standard: string;
  year: string;
  category: string;
}

export const csisDefects = defectRows as CsisDefect[];

export const csisStandards = uniqueSorted(csisDefects.flatMap((row) => splitMultiValue(row.standard)));
export const csisYears = uniqueSorted(csisDefects.flatMap((row) => splitMultiValue(row.year))).sort((a, b) => Number(b) - Number(a));
export const csisCategories = uniqueSorted(csisDefects.map((row) => row.category).filter(Boolean));

export function searchCsisDefects(filters: CsisSearchFilters, limit = 80) {
  const terms = normalize(filters.keyword).split(" ").filter(Boolean);
  const standard = normalize(filters.standard);
  const year = normalize(filters.year);
  const category = normalize(filters.category);

  return csisDefects
    .map((row) => ({ row, score: scoreDefect(row, terms, standard, year, category) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.row.category.localeCompare(b.row.category) || a.row.defect.localeCompare(b.row.defect))
    .slice(0, limit)
    .map((item) => item.row);
}

function scoreDefect(row: CsisDefect, terms: string[], standard: string, year: string, category: string) {
  const haystack = normalize([row.defect, row.standard, row.year, row.section, row.category].join(" "));
  if (standard && !normalize(row.standard).includes(standard)) return 0;
  if (year && !splitMultiValue(row.year).map(normalize).includes(year)) return 0;
  if (category && normalize(row.category) !== category) return 0;
  if (terms.length && !terms.every((term) => haystack.includes(term))) return 0;

  let score = 1;
  if (standard) score += 25;
  if (year) score += 25;
  if (category) score += 25;
  terms.forEach((term) => {
    if (normalize(row.category).includes(term)) score += 8;
    if (normalize(row.section).includes(term)) score += 8;
    if (normalize(row.defect).includes(term)) score += 4;
  });
  return score;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function splitMultiValue(value: string) {
  return value.split(";").map((item) => item.trim()).filter(Boolean);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}
