import { AuditRow } from "../lib/types";
import { RowSection } from "./DocumentationSection";

export function InstallationSection({ rows, auditorName, disabled, onChange }: { rows: AuditRow[]; auditorName: string; disabled?: boolean; onChange: (rows: AuditRow[]) => void }) {
  return <RowSection title="Installation Review" rows={rows} auditorName={auditorName} disabled={disabled} onChange={onChange} photoRequired />;
}
