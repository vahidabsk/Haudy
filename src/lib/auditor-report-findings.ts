import findingRows from "../data/auditor-report-findings.json";

const PAST_REPORTS_KEY = "haudy.pastReports.library";

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

export interface PastReportImportResult {
  fileName: string;
  found: number;
  added: number;
  skipped: number;
}

export interface AuditorReportSearchFilters {
  keyword: string;
  standard: string;
  year: string;
  reviewType: string;
  category: string;
}

export const auditorReportFindings = findingRows as AuditorReportFinding[];

export const auditorReportStandards = uniqueSorted([...auditorReportFindings.map((row) => row.standard), "UL 681", "UL 827", "UL 2050"]);
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
    standards: uniqueSorted([...rows.map((row) => row.standard), "UL 681", "UL 827", "UL 2050"]),
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

export function importPastReports(files: { fileName: string; text: string }[]) {
  const existing = loadPastReportFindings();
  const fingerprints = new Set([...existing, ...auditorReportFindings].map(findingFingerprint));
  const results: PastReportImportResult[] = [];
  const nextRows = [...existing];

  files.forEach((file) => {
    const parsed = parsePastReportText(file.fileName, file.text);
    let added = 0;
    let skipped = 0;
    parsed.forEach((row) => {
      const fingerprint = findingFingerprint(row);
      if (fingerprints.has(fingerprint)) {
        skipped += 1;
        return;
      }
      fingerprints.add(fingerprint);
      nextRows.unshift(row);
      added += 1;
    });
    results.push({ fileName: file.fileName, found: parsed.length, added, skipped });
  });

  savePastReportFindings(nextRows);
  return results;
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

export function parsePastReportText(fileName: string, text: string) {
  const cleanText = normalizeReportText(text);
  const matches = Array.from(cleanText.matchAll(/\bFindings?\s*:\s*/gi));
  return matches
    .map((match, index) => rowFromReportEntry(fileName, cleanText, match, index))
    .filter((row): row is AuditorReportFinding => Boolean(row));
}

function rowFromReportEntry(fileName: string, fullText: string, match: RegExpMatchArray, index: number) {
  const findingLabelStart = match.index ?? 0;
  const findingStart = findingLabelStart + match[0].length;
  const afterFinding = fullText.slice(findingStart);
  const actionMatch = afterFinding.match(/\bRequired\s+Action\s*:\s*/i);
  if (!actionMatch || actionMatch.index === undefined) return null;

  const nextFindingStart = nextFindingIndex(fullText, findingStart);
  const entryEnd = nextFindingStart >= 0 ? nextFindingStart : fullText.length;
  const actionStart = findingStart + actionMatch.index + actionMatch[0].length;
  if (actionStart <= findingStart) return null;

  const finding = stripCodeFragments(fullText.slice(findingStart, findingStart + actionMatch.index)).trim();
  const requiredActionText = fullText.slice(actionStart, entryEnd);
  const requiredAction = stripTrailingReportNoise(requiredActionText).trim();
  if (!finding || !requiredAction) return null;

  const context = fullText.slice(Math.max(0, findingLabelStart - 900), findingLabelStart);
  const reference = parseReference(`${context}\n${requiredActionText}`);
  const reviewType = inferReviewType(context);
  const category = inferCategory(context);
  const id = `PR-${Date.now().toString(36)}-${index}-${hashText(`${fileName}|${finding}|${requiredAction}`)}`;

  return {
    id,
    standard: reference.standard,
    year: reference.year,
    reviewType,
    category,
    findingType: category,
    section: reference.section,
    finding,
    requiredAction,
    keywords: buildKeywords([category, reviewType, reference.standard, reference.year, reference.section, finding]),
    examples: `Imported from ${fileName}`,
  };
}

function parseReference(codeText: string) {
  const standardMatch = codeText.match(/\b(UL\s*\d+|NFPA\s*\d+)\b/i);
  const standard = standardMatch ? standardMatch[1].replace(/\s+/g, " ").toUpperCase() : "";
  const yearMatch = codeText.match(/\b((?:19|20)\d{2})\b/);
  const editionMatch = codeText.match(/\bEdition\s+([0-9]+(?:st|nd|rd|th)?)\b/i) || codeText.match(/\b([0-9]+(?:st|nd|rd|th)?)\s+Edition\b/i);
  const year = yearMatch ? yearMatch[1] : editionMatch ? editionMatch[1] : "";
  const sections = Array.from(codeText.matchAll(/\b\d+(?:[-.]\d+)+(?:\([a-z0-9]+\))?/gi))
    .map((match) => match[0])
    .filter((section, index, values) => values.indexOf(section) === index);
  return { standard, year, section: sections.join("; ") };
}

function inferReviewType(context: string) {
  const headings = Array.from(context.matchAll(/-{2,}\s*([A-Za-z /&]+Review)\s*-{2,}/g)).map((match) => match[1].trim());
  if (headings.length) return headings[headings.length - 1];
  if (/Central Station Comments/i.test(context)) return "Service Center Comments";
  return "Installation Review";
}

function inferCategory(context: string) {
  const lines = context.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.length > 90) continue;
    if (/^(Audit Comments|Central Station Comments|Protected Properties Comments|Findings?|Required Action|SN:|CCN:)/i.test(line)) continue;
    if (/^-{2,}.*-{2,}$/.test(line)) continue;
    if (/^(UL|NFPA)\s+\d+/i.test(line)) continue;
    return line.replace(/^\d+\.\s*/, "");
  }
  return "Past Report Finding";
}

function normalizeReportText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\bRequired\s*\n\s*Action\s*:/gi, "Required Action:")
    .replace(/\bCode\s*\n\s*Reference\s*:/gi, "Code Reference:")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/RequiredAction/gi, "Required Action")
    .replace(/Findings:/gi, "Findings:")
    .trim();
}

function stripCodeFragments(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTrailingReportNoise(value: string) {
  return value
    .replace(/\bCode\s+Reference\s*:[\s\S]*$/i, "")
    .replace(/\n\s*(Audit Comments|Protected Properties Comments|Central Station Comments)\b[\s\S]*$/i, "")
    .replace(/\n\s*(SN:|CCN:)\b[\s\S]*$/i, "")
    .replace(/\n\s*-{2,}[^-\n]+-{2,}[\s\S]*$/i, "")
    .replace(/\*{3}END\*{3}[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nextFindingIndex(text: string, afterIndex: number) {
  const next = text.slice(afterIndex).search(/\bFindings?\s*:\s*/i);
  return next >= 0 ? afterIndex + next : -1;
}

function findingFingerprint(row: AuditorReportFinding) {
  return normalize([row.standard, row.year, row.section, row.category, row.finding, row.requiredAction].join(" "));
}

function buildKeywords(values: string[]) {
  return uniqueSorted(values.join(" ").split(/\s+/).map((value) => value.replace(/[^a-zA-Z0-9.]+/g, "").trim()).filter((value) => value.length > 2)).join("; ");
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
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
