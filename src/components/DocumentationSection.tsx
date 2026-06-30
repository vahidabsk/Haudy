import { AuditRow } from "../lib/types";
import { DictationNotes } from "./DictationNotes";
import { PhotoCapture } from "./PhotoCapture";
import { ReportFindingFields } from "./ReportFindingFields";
import { StatusButtons } from "./StatusButtons";
import { nowIso, uid } from "../lib/utils";

export function DocumentationSection({ rows, auditorName, onChange }: { rows: AuditRow[]; auditorName: string; onChange: (rows: AuditRow[]) => void }) {
  return <RowSection title="Documentation Review" rows={rows} auditorName={auditorName} onChange={onChange} photoRequired={false} />;
}

export function RowSection({ title, rows, auditorName, onChange, photoRequired }: { title: string; rows: AuditRow[]; auditorName: string; onChange: (rows: AuditRow[]) => void; photoRequired: boolean }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      {rows.map((row) => (
        <div key={row.id} className="grid gap-3 rounded-lg border bg-white p-4">
          <input
            className="min-h-11 rounded-md border px-3 font-semibold"
            value={row.element}
            onChange={(event) => patch(rows, row.id, { element: event.target.value, updatedBy: auditorName }, onChange)}
            placeholder="Element"
          />
          <StatusButtons value={row.status} onChange={(status) => patch(rows, row.id, { status, updatedBy: auditorName }, onChange)} />
          <DictationNotes value={row.notes} onChange={(notes) => patch(rows, row.id, { notes, updatedBy: auditorName }, onChange)} />
          {row.status === "VAR" ? (
            <ReportFindingFields
              value={row}
              onChange={(reportFields) => patch(rows, row.id, { ...reportFields, updatedBy: auditorName }, onChange)}
            />
          ) : null}
          {photoRequired ? <PhotoCapture photos={row.photos} onChange={(photos) => patch(rows, row.id, { photos, updatedBy: auditorName }, onChange)} required /> : null}
          <div className="text-xs text-slate-500">Updated by {row.updatedBy || auditorName}</div>
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4" onClick={() => onChange([...rows, { id: uid("row"), element: "", status: "", notes: "", reportFinding: "", reportRequiredAction: "", reportCodeStandard: "", reportCodeEdition: "", reportCodeSection: "", photos: [], updatedAt: nowIso(), updatedBy: auditorName }])}>
        Add Row
      </button>
    </section>
  );
}

function patch(rows: AuditRow[], id: string, update: Partial<AuditRow>, onChange: (rows: AuditRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}
