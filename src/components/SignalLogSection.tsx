import { SignalLogRow, SignalType } from "../lib/types";
import { uid, nowIso } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";
import { ReportFindingFields } from "./ReportFindingFields";

const signalTypes: SignalType[] = ["Alarm", "Supervisory", "Trouble"];

export function SignalLogSection({ rows, disabled, onChange }: { rows: SignalLogRow[]; disabled?: boolean; onChange: (rows: SignalLogRow[]) => void }) {
  const counts = {
    Alarm: rows.filter((row) => row.signalType === "Alarm").length,
    Supervisory: rows.filter((row) => row.signalType === "Supervisory").length,
    Trouble: rows.filter((row) => row.signalType === "Trouble").length,
  };
  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold text-navy">Signal Review Rows</h2>
      <div className="grid grid-cols-3 gap-3">
        <Counter label="Alarms" value={counts.Alarm} className="bg-emerald-50 text-emerald-800" />
        <Counter label="Supervisory" value={counts.Supervisory} className="bg-amber-50 text-amber-800" />
        <Counter label="Trouble" value={counts.Trouble} className="bg-red-50 text-red-800" />
      </div>
      {disabled ? <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">Local system selected. Signal processing review is not applicable.</div> : null}
      {rows.map((row) => (
        <div key={row.id} className={`grid gap-3 rounded-lg border bg-white p-4 ${disabled ? "opacity-60" : ""}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" value={disabled ? "" : row.signalType} disabled={disabled} onChange={(e) => patch(rows, row.id, { signalType: e.target.value as SignalType }, onChange)}>
              <option value="">Signal Type</option>
              {signalTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
            <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="date" value={disabled ? "" : row.date} disabled={disabled} onChange={(e) => patch(rows, row.id, { date: e.target.value }, onChange)} />
            <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" value={disabled ? "" : row.time} disabled={disabled} onChange={(e) => patch(rows, row.id, { time: e.target.value }, onChange)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`min-h-10 rounded-md border px-3 py-2 text-sm font-medium ${row.handlingStatus === "OK" ? "border-emerald-300 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}
              disabled={disabled}
              onClick={() => patch(rows, row.id, { handlingStatus: row.handlingStatus === "OK" ? "" : "OK" }, onChange)}
            >
              Signal handled correctly
            </button>
            <button
              type="button"
              className={`min-h-10 rounded-md border px-3 py-2 text-sm font-medium ${row.handlingStatus === "VAR" ? "border-amber-300 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"}`}
              disabled={disabled}
              onClick={() => patch(rows, row.id, { handlingStatus: row.handlingStatus === "VAR" ? "" : "VAR" }, onChange)}
            >
              Variation noted
            </button>
          </div>
          {disabled ? <textarea className="w-full rounded-md border border-slate-300 bg-slate-100 p-3 text-slate-400" rows={2} disabled /> : <DictationNotes rows={2} value={row.notes || row.description} onChange={(notes) => patch(rows, row.id, { notes, description: "" }, onChange)} />}
          {!disabled && row.handlingStatus === "VAR" ? (
            <ReportFindingFields
              value={row}
              onChange={(reportFields) => patch(rows, row.id, reportFields, onChange)}
            />
          ) : null}
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" disabled={disabled} onClick={() => onChange([...rows, { id: uid("signal"), signalType: "", handlingStatus: "", date: "", time: "", description: "", notes: "", reportFinding: "", reportRequiredAction: "", reportCodeEdition: "", reportCodeSection: "", updatedAt: nowIso() }])}>
        Add Signal Row
      </button>
    </section>
  );
}

function Counter({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className={`rounded-lg p-3 text-center ${className}`}><div className="text-2xl font-bold">{value}</div><div className="text-xs uppercase">{label}</div></div>;
}

function patch(rows: SignalLogRow[], id: string, update: Partial<SignalLogRow>, onChange: (rows: SignalLogRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}
