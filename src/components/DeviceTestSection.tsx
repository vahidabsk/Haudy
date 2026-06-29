import { DeviceTestRow } from "../lib/types";
import { nowIso, uid } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";

const deviceTypes = ["Smoke Detector (SD)", "Heat Detector (HD)", "Duct Detector (DD)", "Manual Pull Station (MP)", "Waterflow Device (WF)", "Sprinkler Supervisory (SS)", "Notification Appliance (NAC)", "Other"];
const testOptions: Array<{ key: keyof Pick<DeviceTestRow, "functional" | "alarm" | "supervisory" | "trouble">; label: string; active: string; idle: string }> = [
  { key: "functional", label: "Functional", active: "border-sky-700 bg-sky-700 text-white", idle: "border-sky-200 bg-sky-50 text-sky-800" },
  { key: "alarm", label: "Alarm", active: "border-red-700 bg-red-700 text-white", idle: "border-red-200 bg-red-50 text-red-800" },
  { key: "supervisory", label: "Supervisory", active: "border-amber-700 bg-amber-600 text-white", idle: "border-amber-200 bg-amber-50 text-amber-800" },
  { key: "trouble", label: "Trouble", active: "border-purple-700 bg-purple-700 text-white", idle: "border-purple-200 bg-purple-50 text-purple-800" },
];
const resultOptions = [
  { value: "OK" as const, label: "In Conformance", active: "border-emerald-700 bg-emerald-700 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "VAR" as const, label: "Variation Noted", active: "border-amber-700 bg-amber-600 text-white", idle: "border-amber-200 bg-amber-50 text-amber-800" },
];

export function DeviceTestSection({ rows, localSystem, onLocalSystemChange, onChange }: { rows: DeviceTestRow[]; localSystem: boolean; onLocalSystemChange: (localSystem: boolean) => void; onChange: (rows: DeviceTestRow[]) => void }) {
  function setLocalSystem(nextLocalSystem: boolean) {
    onLocalSystemChange(nextLocalSystem);
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold text-navy">Device Testing</h2>
      <label className="grid gap-1 rounded-lg border bg-white p-4 text-sm font-medium text-slate-700">
        Is this a local system?
        <select className="min-h-11 rounded-md border px-3" value={localSystem ? "YES" : "NO"} onChange={(event) => setLocalSystem(event.target.value === "YES")}>
          <option value="NO">No - signals report to monitoring station</option>
          <option value="YES">Yes - local system only</option>
        </select>
      </label>
      {rows.map((row) => (
        <div key={row.id} className="grid gap-3 rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="min-h-11 rounded-md border px-2" value={row.deviceType} onChange={(e) => patch(rows, row.id, { deviceType: e.target.value }, onChange)}><option value="">Device Type Tested</option>{deviceTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="min-h-11 rounded-md border px-2" placeholder="Location" value={row.location} onChange={(e) => patch(rows, row.id, { location: e.target.value }, onChange)} />
            <input className="min-h-11 rounded-md border px-2" placeholder="Device ID / Zone" value={row.deviceId} onChange={(e) => patch(rows, row.id, { deviceId: e.target.value }, onChange)} />
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Trip Time
              <input className="min-h-11 rounded-md border px-2" type="time" value={row.tripTime} onChange={(e) => patch(rows, row.id, { tripTime: e.target.value }, onChange)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Time Received
              <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" value={localSystem ? "" : row.timeReceived} disabled={localSystem} onChange={(e) => patch(rows, row.id, { timeReceived: e.target.value }, onChange)} />
            </label>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            {testOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`min-h-11 rounded-md border px-3 font-medium ${row[option.key] ? option.active : option.idle}`}
                onClick={() => patch(rows, row.id, { [option.key]: !row[option.key] }, onChange)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {resultOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`min-h-11 rounded-md border px-3 font-medium ${row.result === option.value ? option.active : option.idle}`}
                onClick={() => patch(rows, row.id, { result: row.result === option.value ? "" : option.value }, onChange)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <DictationNotes value={row.notes} onChange={(notes) => patch(rows, row.id, { notes }, onChange)} />
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4" onClick={() => onChange([...rows, { id: uid("device"), deviceType: "", location: "", deviceId: "", signalType: "", functional: false, alarm: false, supervisory: false, trouble: false, notApplicable: false, tripTime: "", timeReceived: "", signalReceived: false, restoralReceived: false, localIndication: false, result: "", notes: "", photos: [], updatedAt: nowIso() }])}>
        Add Device Row
      </button>
    </section>
  );
}

function patch(rows: DeviceTestRow[], id: string, update: Partial<DeviceTestRow>, onChange: (rows: DeviceTestRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}
