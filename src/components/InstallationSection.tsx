import { AuditRow } from "../lib/types";
import { RowSection } from "./DocumentationSection";

export function InstallationSection({ rows, auditorName, onChange }: { rows: AuditRow[]; auditorName: string; onChange: (rows: AuditRow[]) => void }) {
  return <RowSection title="Installation Review" rows={rows} auditorName={auditorName} onChange={onChange} photoRequired />;
}
