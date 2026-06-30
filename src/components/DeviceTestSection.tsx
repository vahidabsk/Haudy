import { DeviceTestRow } from "../lib/types";
import { nowIso, uid } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";
import { ReportFindingFields } from "./ReportFindingFields";

const deviceTypes = ["Smoke Detector (SD)", "Heat Detector (HD)", "Duct Detector (DD)", "Manual Pull Station (MP)", "Waterflow Device (WF)", "Sprinkler Supervisory (SS)", "Notification Appliance (NAC)", "Other"];
type DeviceTestFlag = keyof Pick<DeviceTestRow, "functional" | "alarm" | "supervisory" | "trouble">;
const testOptions: Array<{ key: DeviceTestFlag; label: string; active: string; idle: string }> = [
  { key: "functional", label: "Functional", active: "border-sky-700 bg-sky-700 text-white", idle: "border-sky-200 bg-sky-50 text-sky-800" },
  { key: "alarm", label: "Alarm", active: "border-red-700 bg-red-700 text-white", idle: "border-red-200 bg-red-50 text-red-800" },
  { key: "supervisory", label: "Supervisory", active: "border-amber-700 bg-amber-600 text-white", idle: "border-amber-200 bg-amber-50 text-amber-800" },
  { key: "trouble", label: "Trouble", active: "border-purple-700 bg-purple-700 text-white", idle: "border-purple-200 bg-purple-50 text-purple-800" },
];
const resultOptions = [
  { value: "OK" as const, label: "In Conformance", active: "border-emerald-700 bg-emerald-700 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "VAR" as const, label: "Variation Noted", active: "border-amber-700 bg-amber-600 text-white", idle: "border-amber-200 bg-amber-50 text-amber-800" },
];

export function DeviceTestSection({ rows, localSystem, disabled, disabledMessage = "Device testing review marked No. Use the general variation note above to explain why device testing was not completed.", onLocalSystemChange, onChange }: { rows: DeviceTestRow[]; localSystem: boolean; disabled?: boolean; disabledMessage?: string; onLocalSystemChange: (localSystem: boolean) => void; onChange: (rows: DeviceTestRow[]) => void }) {
  function setLocalSystem(nextLocalSystem: boolean) {
    onLocalSystemChange(nextLocalSystem);
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold text-navy">Device Testing</h2>
      <label className="grid gap-1 rounded-lg border bg-white p-4 text-sm font-medium text-slate-700">
        Is this a local system?
        <select className="min-h-11 rounded-md border px-3 disabled:bg-slate-100 disabled:text-slate-400" value={localSystem ? "YES" : "NO"} disabled={disabled} onChange={(event) => setLocalSystem(event.target.value === "YES")}>
          <option value="NO">No - signals report to monitoring station</option>
          <option value="YES">Yes - local system only</option>
        </select>
      </label>
      {disabled ? <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">{disabledMessage}</div> : null}
      {rows.map((row) => (
        <div key={row.id} className={`grid gap-3 rounded-lg border bg-white p-4 ${disabled ? "opacity-60" : ""}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" value={disabled ? "" : row.deviceType} disabled={disabled} onChange={(e) => patch(rows, row.id, { deviceType: e.target.value }, onChange)}><option value="">Device Type Tested</option>{deviceTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" placeholder="Location" value={disabled ? "" : row.location} disabled={disabled} onChange={(e) => patch(rows, row.id, { location: e.target.value }, onChange)} />
            <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" placeholder="Device ID / Zone" value={disabled ? "" : row.deviceId} disabled={disabled} onChange={(e) => patch(rows, row.id, { deviceId: e.target.value }, onChange)} />
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Trip Time
              <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" value={disabled ? "" : row.tripTime} disabled={disabled} onChange={(e) => patch(rows, row.id, { tripTime: e.target.value }, onChange)} />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Time Received
              <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" value={localSystem || disabled ? "" : row.timeReceived} disabled={localSystem || disabled} onChange={(e) => patch(rows, row.id, { timeReceived: e.target.value }, onChange)} />
            </label>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            {testOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`min-h-11 rounded-md border px-3 font-medium ${row[option.key] ? option.active : option.idle}`}
                disabled={disabled}
                onClick={() => toggleTestFlag(rows, row.id, option.key, onChange)}
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
                disabled={disabled}
                onClick={() => patch(rows, row.id, { result: row.result === option.value ? "" : option.value }, onChange)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {disabled ? <textarea className="w-full rounded-md border border-slate-300 bg-slate-100 p-3 text-slate-400" rows={3} disabled /> : <DictationNotes value={row.notes} onChange={(notes) => patch(rows, row.id, { notes }, onChange)} />}
          {!disabled && row.result === "VAR" ? (
            <ReportFindingFields
              value={row}
              onChange={(reportFields) => patch(rows, row.id, reportFields, onChange)}
            />
          ) : null}
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" disabled={disabled} onClick={() => onChange([...rows, { id: uid("device"), deviceType: "", location: "", deviceId: "", signalType: "", functional: false, alarm: false, supervisory: false, trouble: false, notApplicable: false, tripTime: "", timeReceived: "", signalReceived: false, restoralReceived: false, localIndication: false, result: "", notes: "", reportFinding: "", reportRequiredAction: "", reportCodeStandard: "", reportCodeEdition: "", reportCodeSection: "", photos: [], updatedAt: nowIso() }])}>
        Add Device Row
      </button>
    </section>
  );
}

function patch(rows: DeviceTestRow[], id: string, update: Partial<DeviceTestRow>, onChange: (rows: DeviceTestRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}

function toggleTestFlag(rows: DeviceTestRow[], id: string, key: DeviceTestFlag, onChange: (rows: DeviceTestRow[]) => void) {
  const row = rows.find((item) => item.id === id);
  if (!row) return;
  if (key === "functional") {
    patch(rows, id, { functional: !row.functional }, onChange);
    return;
  }
  const nextSelected = !row[key];
  patch(rows, id, {
    alarm: key === "alarm" ? nextSelected : false,
    supervisory: key === "supervisory" ? nextSelected : false,
    trouble: key === "trouble" ? nextSelected : false,
  }, onChange);
}
