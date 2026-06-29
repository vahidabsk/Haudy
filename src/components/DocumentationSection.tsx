import { AuditRow } from "../lib/types";
import { DictationNotes } from "./DictationNotes";
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
          <div className="font-semibold">{row.element}</div>
          <StatusButtons value={row.status} onChange={(status) => patch(rows, row.id, { status, updatedBy: auditorName }, onChange)} />
          <DictationNotes value={row.notes} onChange={(notes) => patch(rows, row.id, { notes, updatedBy: auditorName }, onChange)} />
          <div className="text-xs text-slate-500">Updated by {row.updatedBy || auditorName}</div>
          {photoRequired ? <div className="text-sm text-slate-600">Photo required for this row.</div> : null}
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4" onClick={() => onChange([...rows, { id: uid("row"), element: "Custom element", status: "", notes: "", photos: [], updatedAt: nowIso(), updatedBy: auditorName }])}>
        Add custom element
      </button>
    </section>
  );
}

function patch(rows: AuditRow[], id: string, update: Partial<AuditRow>, onChange: (rows: AuditRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}
