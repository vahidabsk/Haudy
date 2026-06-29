import { SignalLogRow, SignalType } from "../lib/types";
import { uid, nowIso } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";

const signalTypes: SignalType[] = ["Alarm", "Supervisory", "Trouble"];

export function SignalLogSection({ rows, onChange }: { rows: SignalLogRow[]; onChange: (rows: SignalLogRow[]) => void }) {
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
      {rows.map((row) => (
        <div key={row.id} className="grid gap-3 rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-5">
          <select className="min-h-11 rounded-md border px-2" value={row.signalType} onChange={(e) => patch(rows, row.id, { signalType: e.target.value as SignalType }, onChange)}>
            <option value="">Signal Type</option>
            {signalTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
          <input className="min-h-11 rounded-md border px-2" type="date" value={row.date} onChange={(e) => patch(rows, row.id, { date: e.target.value }, onChange)} />
          <input className="min-h-11 rounded-md border px-2" type="time" value={row.time} onChange={(e) => patch(rows, row.id, { time: e.target.value }, onChange)} />
          <input className="min-h-11 rounded-md border px-2 md:col-span-2" placeholder="Description" value={row.description} onChange={(e) => patch(rows, row.id, { description: e.target.value }, onChange)} />
          </div>
          <DictationNotes rows={2} value={row.notes} onChange={(notes) => patch(rows, row.id, { notes }, onChange)} />
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4" onClick={() => onChange([...rows, { id: uid("signal"), signalType: "", date: "", time: "", description: "", notes: "", updatedAt: nowIso() }])}>
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
