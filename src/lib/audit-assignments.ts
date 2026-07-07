import { DesktopTrackerAssignment } from "./desktop-bridge";
import { Audit, AuditAssignment, ParsedCertificate } from "./types";
import { nowIso, uid } from "./utils";

const ASSIGNMENTS_KEY = "haudy.auditAssignments";

export interface AssignmentGroup {
  key: string;
  ascName: string;
  ascCity: string;
  ascState: string;
  location: string;
  psn: string;
  scn: string;
  assignments: AuditAssignment[];
  audits: Audit[];
}

export function loadAuditAssignments(): AuditAssignment[] {
  return readJson<AuditAssignment[]>(ASSIGNMENTS_KEY, []).map(normalizeAssignment);
}

export function saveAuditAssignments(assignments: AuditAssignment[]) {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments.map(normalizeAssignment)));
}

export function clearAuditAssignments() {
  localStorage.removeItem(ASSIGNMENTS_KEY);
  return [];
}

export function importTrackerAssignments(rows: DesktopTrackerAssignment[], auditorName: string) {
  const now = nowIso();
  const matchedRows = rows.filter((row) => auditorMatches(row.auditorName, auditorName));
  const assignments = matchedRows.map((row) => normalizeAssignment({
    id: uid("assignment"),
    createdAt: now,
    updatedAt: now,
    auditorName: row.auditorName,
    ascName: row.ascName,
    ascCity: row.city,
    ascState: row.state,
    psn: row.psn,
    scn: row.scn,
    ccn: row.ccn,
    fileNo: row.fileNo,
    certCount: row.certCount,
    auditDays: row.auditDays,
    auditorNotes: row.auditorNotes,
    ascStatus: row.ascStatus,
  }));
  const merged = mergeAssignments(loadAuditAssignments(), assignments);
  saveAuditAssignments(merged);
  return { assignments: merged, imported: assignments.length, matchedRows: matchedRows.length };
}

export function groupAssignmentsAndAudits(assignments: AuditAssignment[], audits: Audit[]): AssignmentGroup[] {
  const groups = new Map<string, AssignmentGroup>();
  for (const assignment of assignments) {
    const key = assignmentKey(assignment);
    const group = groups.get(key) || emptyAssignmentGroup(key, assignment.ascName, assignment.ascCity, assignment.ascState, assignment.psn, assignment.scn);
    group.assignments.push(assignment);
    groups.set(key, group);
  }

  for (const audit of audits) {
    const key = assignmentKeyFromAudit(audit, assignments);
    const group = groups.get(key) || emptyAssignmentGroup(key, audit.ascName || "ASC not set", audit.ascCity || "", audit.ascState || "", "", "");
    group.audits.push(audit);
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    assignments: group.assignments.sort((a, b) => a.ccn.localeCompare(b.ccn) || a.fileNo.localeCompare(b.fileNo)),
    audits: group.audits.sort((a, b) => (a.protectedProperty || "").localeCompare(b.protectedProperty || "") || (a.certificateNumber || "").localeCompare(b.certificateNumber || "")),
  })).sort((a, b) => a.ascName.localeCompare(b.ascName) || a.location.localeCompare(b.location) || a.psn.localeCompare(b.psn));
}

export function assignmentCertificateOverrides(group: AssignmentGroup): Partial<ParsedCertificate> {
  return {
    ascName: group.ascName,
    ascCity: group.ascCity,
    ascState: group.ascState,
  };
}

export function assignmentProfileDefaults(group: AssignmentGroup) {
  return {
    scn: group.scn,
    psn: group.psn,
  };
}

export function assignmentKeyForAudit(audit: Audit, assignments = loadAuditAssignments()) {
  return assignmentKeyFromAudit(audit, assignments);
}

function mergeAssignments(existing: AuditAssignment[], incoming: AuditAssignment[]) {
  const byKey = new Map<string, AuditAssignment>();
  for (const assignment of existing) byKey.set(rowKey(assignment), assignment);
  for (const assignment of incoming) byKey.set(rowKey(assignment), assignment);
  return Array.from(byKey.values());
}

function assignmentKey(assignment: Pick<AuditAssignment, "ascName" | "ascCity" | "ascState" | "psn">) {
  return [
    assignment.ascName || "ASC not set",
    assignment.ascCity || "",
    assignment.ascState || "",
    assignment.psn || "",
  ].join("|");
}

function assignmentKeyFromAudit(audit: Audit, assignments: AuditAssignment[]) {
  const matchingAssignment = assignments.find((assignment) =>
    sameText(assignment.ascName, audit.ascName) &&
    sameText(assignment.ascCity, audit.ascCity) &&
    sameText(assignment.ascState, audit.ascState)
  );
  if (matchingAssignment) return assignmentKey(matchingAssignment);
  return [audit.ascName || "ASC not set", audit.ascCity || "", audit.ascState || ""].join("|");
}

function rowKey(assignment: AuditAssignment) {
  return [
    assignmentKey(assignment),
    assignment.ccn,
    assignment.fileNo,
  ].map(normalizeText).join("|");
}

function emptyAssignmentGroup(key: string, ascName: string, city: string, state: string, psn: string, scn: string): AssignmentGroup {
  return {
    key,
    ascName,
    ascCity: city,
    ascState: state,
    location: [city, state].filter(Boolean).join(", "),
    psn,
    scn,
    assignments: [],
    audits: [],
  };
}

function normalizeAssignment(assignment: AuditAssignment): AuditAssignment {
  return {
    id: assignment.id || uid("assignment"),
    createdAt: assignment.createdAt || nowIso(),
    updatedAt: assignment.updatedAt || nowIso(),
    auditorName: clean(assignment.auditorName),
    ascName: clean(assignment.ascName),
    ascCity: clean(assignment.ascCity),
    ascState: clean(assignment.ascState),
    psn: clean(assignment.psn),
    scn: clean(assignment.scn),
    ccn: clean(assignment.ccn).toUpperCase(),
    fileNo: clean(assignment.fileNo).toUpperCase(),
    certCount: clean(assignment.certCount),
    auditDays: clean(assignment.auditDays),
    auditorNotes: clean(assignment.auditorNotes),
    ascStatus: clean(assignment.ascStatus),
  };
}

function auditorMatches(trackerName: string, auditorName: string) {
  const tracker = normalizeName(trackerName);
  const auditor = normalizeName(auditorName);
  if (!tracker || !auditor) return false;
  if (tracker === auditor) return true;
  const auditorParts = auditor.split(" ").filter(Boolean);
  return auditorParts.length >= 2 && auditorParts.every((part) => tracker.includes(part));
}

function sameText(first: string, second: string) {
  return normalizeText(first) === normalizeText(second);
}

function normalizeName(value: string) {
  return normalizeText(value).replace(/[^a-z0-9 ]/g, "");
}

function normalizeText(value: string) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function clean(value: string | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
