import { AuditRow } from "../lib/types";
import { DictationNotes } from "./DictationNotes";
import { PhotoCapture } from "./PhotoCapture";
import { ReportFindingFields } from "./ReportFindingFields";
import { StatusButtons } from "./StatusButtons";
import { nowIso, uid } from "../lib/utils";

export function DocumentationSection({ rows, auditorName, disabled, onChange }: { rows: AuditRow[]; auditorName: string; disabled?: boolean; onChange: (rows: AuditRow[]) => void }) {
  return <RowSection title="Documentation Review" rows={rows} auditorName={auditorName} disabled={disabled} onChange={onChange} photoRequired={false} />;
}

export function RowSection({ title, rows, auditorName, disabled, onChange, photoRequired }: { title: string; rows: AuditRow[]; auditorName: string; disabled?: boolean; onChange: (rows: AuditRow[]) => void; photoRequired: boolean }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      {disabled ? <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">{title} marked No. Use the general variation note above to explain why this review was not completed.</div> : null}
      {rows.map((row) => (
        <div key={row.id} className={`grid gap-3 rounded-lg border bg-white p-4 ${disabled ? "opacity-60" : ""}`}>
          <input
            className="min-h-11 rounded-md border px-3 font-semibold disabled:bg-slate-100 disabled:text-slate-400"
            value={row.element}
            disabled={disabled}
            onChange={(event) => patch(rows, row.id, { element: event.target.value, updatedBy: auditorName }, onChange)}
            placeholder="Element"
          />
          {disabled ? null : <StatusButtons value={row.status} onChange={(status) => patch(rows, row.id, { status, updatedBy: auditorName }, onChange)} />}
          {disabled ? <textarea className="w-full rounded-md border border-slate-300 bg-slate-100 p-3 text-slate-400" rows={3} disabled /> : <DictationNotes value={row.notes} onChange={(notes) => patch(rows, row.id, { notes, updatedBy: auditorName }, onChange)} />}
          {!disabled && row.status === "VAR" ? (
            <ReportFindingFields
              value={row}
              onChange={(reportFields) => patch(rows, row.id, { ...reportFields, updatedBy: auditorName }, onChange)}
            />
          ) : null}
          {photoRequired && !disabled ? <PhotoCapture photos={row.photos} onChange={(photos) => patch(rows, row.id, { photos, updatedBy: auditorName }, onChange)} required /> : null}
          <div className="text-xs text-slate-500">Updated by {row.updatedBy || auditorName}</div>
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" disabled={disabled} onClick={() => onChange([...rows, { id: uid("row"), element: "", status: "", notes: "", reportFinding: "", reportRequiredAction: "", reportCodeStandard: "", reportCodeEdition: "", reportCodeSection: "", photos: [], updatedAt: nowIso(), updatedBy: auditorName }])}>
        Add Row
      </button>
    </section>
  );
}

function patch(rows: AuditRow[], id: string, update: Partial<AuditRow>, onChange: (rows: AuditRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}
