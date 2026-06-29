import { Audit } from "./types";

export function auditToCsv(audit: Audit) {
  const rows = [
    ["Section", "Element", "Status", "Notes"],
    ...audit.documentation.map((row) => ["Documentation", row.element, row.status, row.notes]),
    ...audit.installation.map((row) => ["Installation", row.element, row.status, row.notes]),
    ...audit.deviceTests.map((row) => ["Device Testing", `${row.deviceType} ${row.location}`, row.result, row.notes]),
    ...audit.signalLog.map((row) => ["Signal Log", [row.notes, row.description].filter(Boolean).join(" - "), row.signalType, ""]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
