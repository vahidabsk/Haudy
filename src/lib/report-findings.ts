import { findingsDatabase, FindingRecord } from "../data/findings";
import { Audit, AuditRow, DeviceTestRow, SignalLogRow } from "./types";

export interface VariationCandidate {
  id: string;
  audit: Audit;
  reviewType: string;
  category: string;
  notes: string;
  codeEdition: string;
  matches: FindingMatch[];
}

export interface FindingMatch {
  finding: FindingRecord;
  score: number;
}

export function collectVariationCandidates(audits: Audit[]): VariationCandidate[] {
  return audits.flatMap((audit) => [
    ...audit.signalLog.filter((row) => row.handlingStatus === "VAR").map((row) => signalVariation(audit, row)),
    ...audit.documentation.filter((row) => row.status === "VAR").map((row) => checklistVariation(audit, row, "Documentation Review")),
    ...audit.installation.filter((row) => row.status === "VAR").map((row) => checklistVariation(audit, row, "Installation Review")),
    ...audit.deviceTests.filter((row) => row.result === "VAR").map((row) => deviceVariation(audit, row)),
  ]).map((candidate) => ({ ...candidate, matches: matchFindings(candidate) }));
}

export function bestFinding(candidate: VariationCandidate, selectedId?: string) {
  return findingsDatabase.find((finding) => finding.Finding_ID === selectedId) || candidate.matches[0]?.finding;
}

export function matchFindings(candidate: Omit<VariationCandidate, "matches">): FindingMatch[] {
  const query = [
    candidate.reviewType,
    candidate.category,
    candidate.notes,
    candidate.codeEdition,
  ].join(" ");
  const queryTokens = tokens(query);

  return findingsDatabase
    .map((finding) => ({ finding, score: scoreFinding(finding, candidate, queryTokens, query.toLowerCase()) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function signalVariation(audit: Audit, row: SignalLogRow): Omit<VariationCandidate, "matches"> {
  return {
    id: `${audit.id}:signal:${row.id}`,
    audit,
    reviewType: "Signal Processing Review",
    category: row.signalType || "Signal Processing",
    notes: [row.signalType, row.date, row.time, row.notes || row.description].filter(Boolean).join(" "),
    codeEdition: audit.codeEdition,
  };
}

function checklistVariation(audit: Audit, row: AuditRow, reviewType: string): Omit<VariationCandidate, "matches"> {
  return {
    id: `${audit.id}:${reviewType}:${row.id}`,
    audit,
    reviewType,
    category: row.element,
    notes: row.notes,
    codeEdition: audit.codeEdition,
  };
}

function deviceVariation(audit: Audit, row: DeviceTestRow): Omit<VariationCandidate, "matches"> {
  return {
    id: `${audit.id}:device:${row.id}`,
    audit,
    reviewType: "Device Test",
    category: [row.deviceType, row.location, row.deviceId].filter(Boolean).join(" / ") || "Device Test",
    notes: row.notes,
    codeEdition: audit.codeEdition,
  };
}

function scoreFinding(finding: FindingRecord, candidate: Omit<VariationCandidate, "matches">, queryTokens: Set<string>, query: string) {
  const haystack = [
    finding.Review_Type,
    finding.Category,
    finding.Finding_Type,
    finding.Code_Section,
    finding.Code_Text,
    finding.Finding,
    finding.Required_Action,
    finding.Keywords,
  ].join(" ").toLowerCase();
  const haystackTokens = tokens(haystack);
  const overlap = [...queryTokens].filter((token) => haystackTokens.has(token)).length;
  let score = overlap / Math.max(1, Math.sqrt(queryTokens.size) * Math.sqrt(haystackTokens.size));

  if (candidate.reviewType && haystack.includes(candidate.reviewType.toLowerCase())) score += 0.35;
  if (candidate.category && haystack.includes(candidate.category.toLowerCase())) score += 0.25;
  if (candidate.codeEdition && finding.Edition && candidate.codeEdition.includes(finding.Edition)) score += 0.15;

  for (const phrase of phraseBoosts) {
    if (query.includes(phrase) && haystack.includes(phrase)) score += 0.22;
  }

  return score;
}

const phraseBoosts = [
  "purchase order",
  "contract",
  "annual",
  "battery",
  "ground",
  "clearance",
  "high voltage",
  "low voltage",
  "telguard",
  "trouble",
  "certificate",
  "as built",
  "record of completion",
  "manual",
];

function tokens(value: string) {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g) || []);
}
