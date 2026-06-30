import { useEffect, useState } from "react";
import { DeviceTestRow } from "../lib/types";
import { nowIso, uid } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";

const deviceTypes = [
  "Backup battery",
  "Communication fail",
  "Ground fault",
  "AC fail",
  "NAC disable",
  "NAC trouble",
  "Smoke detector",
  "Heat detector",
  "Carbon monoxide detector",
  "Duct-type smoke detector",
  "Tamper switch",
  "Control valve",
  "Waterflow switch",
  "PIV",
  "OS & Y",
  "Manual pull station",
];
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
  const [currentTime, setCurrentTime] = useState(() => timeStamp(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(timeStamp(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

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
      {rows.map((row) => {
        const isWaterflow = row.deviceType === "Waterflow switch";
        const waterflowMode = row.waterflowEntryMode || "";
        const waterflowAutomatic = isWaterflow && waterflowMode === "automatic";
        const waterflowManual = isWaterflow && waterflowMode === "manual";
        const waterflowSeconds = waterflowAutomatic ? secondsBetween(row.tripTime, row.timeReceived || currentTime) : null;
        const waterflowRunning = waterflowAutomatic && row.tripTime && !row.timeReceived;
        const waterflowOverdue = Boolean(waterflowRunning && waterflowSeconds !== null && waterflowSeconds >= 90);
        return (
        <div key={row.id} className={`grid gap-3 rounded-lg border bg-white p-4 ${disabled ? "opacity-60" : ""}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" value={disabled ? "" : row.deviceType} disabled={disabled} onChange={(e) => patch(rows, row.id, { deviceType: e.target.value, waterflowEntryMode: "", tripTime: "", timeReceived: "", result: "", notes: "" }, onChange)}><option value="">Device Type Tested</option>{deviceTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" placeholder="Location" value={disabled ? "" : row.location} disabled={disabled} onChange={(e) => patch(rows, row.id, { location: e.target.value }, onChange)} />
            <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" placeholder="Device ID / Zone" value={disabled ? "" : row.deviceId} disabled={disabled} onChange={(e) => patch(rows, row.id, { deviceId: e.target.value }, onChange)} />
            {!isWaterflow ? (
              <>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Trip Time
                  <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" value={disabled ? "" : row.tripTime} disabled={disabled} onChange={(e) => patch(rows, row.id, { tripTime: e.target.value }, onChange)} />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Time Received
                  <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" value={localSystem || disabled ? "" : row.timeReceived} disabled={localSystem || disabled} onChange={(e) => patch(rows, row.id, { timeReceived: e.target.value }, onChange)} />
                </label>
              </>
            ) : null}
          </div>
          {isWaterflow ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-navy">Waterflow entry method</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${waterflowMode === "manual" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
                  disabled={disabled}
                  onClick={() => patch(rows, row.id, { waterflowEntryMode: "manual", tripTime: "", timeReceived: "", result: "", notes: "" }, onChange)}
                >
                  Manual Entry
                </button>
                <button
                  type="button"
                  className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${waterflowMode === "automatic" ? "border-sky-700 bg-sky-700 text-white" : "border-sky-300 bg-white text-sky-900 hover:bg-sky-50"}`}
                  disabled={disabled}
                  onClick={() => patch(rows, row.id, { waterflowEntryMode: "automatic", tripTime: "", timeReceived: "", result: "", notes: "" }, onChange)}
                >
                  Automatic Stopwatch
                </button>
              </div>
            </div>
          ) : null}
          {waterflowManual ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Trip Time
                <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" step={1} value={disabled ? "" : row.tripTime} disabled={disabled} onChange={(e) => patch(rows, row.id, { tripTime: e.target.value }, onChange)} />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Time Received
                <input className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" type="time" step={1} value={localSystem || disabled ? "" : row.timeReceived} disabled={localSystem || disabled} onChange={(e) => patch(rows, row.id, { timeReceived: e.target.value }, onChange)} />
              </label>
            </div>
          ) : null}
          {waterflowAutomatic ? (
            <div className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <div className="grid gap-2 text-sm text-sky-950 sm:grid-cols-3">
                <div>
                  <div className="text-xs font-semibold uppercase text-sky-700">Trig time</div>
                  <div className="font-mono text-lg font-bold">{row.tripTime || "--:--:--"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-sky-700">Received time</div>
                  <div className="font-mono text-lg font-bold">{row.timeReceived || "--:--:--"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-sky-700">Elapsed</div>
                  <div className={`rounded-md px-2 py-1 font-mono text-lg font-bold ${elapsedColorClass(waterflowSeconds)}`}>{waterflowSeconds === null ? "--" : formatElapsed(waterflowSeconds)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => patch(rows, row.id, { tripTime: timeStamp(new Date()), timeReceived: "", result: "", notes: "" }, onChange)}
                >
                  Flow Water
                </button>
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled || localSystem || !row.tripTime}
                  onClick={() => completeWaterflowTest(rows, row.id, timeStamp(new Date()), onChange)}
                >
                  Alarm Signal Received
                </button>
                {waterflowOverdue ? (
                  <button
                    type="button"
                    className="min-h-10 rounded-md border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => patch(rows, row.id, { timeReceived: "", result: "VAR", notes: "The waterflow switch is not functioning correctly." }, onChange)}
                  >
                    Signal Has Not Been Received
                  </button>
                ) : null}
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => patch(rows, row.id, { tripTime: "", timeReceived: "", result: "", notes: "" }, onChange)}
                >
                  Reset Test
                </button>
              </div>
            </div>
          ) : null}
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
        </div>
        );
      })}
      <button className="min-h-11 rounded-md border bg-white px-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" disabled={disabled} onClick={() => onChange([...rows, { id: uid("device"), deviceType: "", waterflowEntryMode: "", location: "", deviceId: "", signalType: "", functional: false, alarm: false, supervisory: false, trouble: false, notApplicable: false, tripTime: "", timeReceived: "", signalReceived: false, restoralReceived: false, localIndication: false, result: "", notes: "", reportFinding: "", reportRequiredAction: "", reportCodeStandard: "", reportCodeEdition: "", reportCodeSection: "", photos: [], updatedAt: nowIso() }])}>
        Add Device Row
      </button>
    </section>
  );
}

function patch(rows: DeviceTestRow[], id: string, update: Partial<DeviceTestRow>, onChange: (rows: DeviceTestRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}

function secondsBetween(start: string, end: string) {
  const startSeconds = timeToSeconds(start);
  const endSeconds = timeToSeconds(end);
  if (startSeconds === null || endSeconds === null) return null;
  return endSeconds >= startSeconds ? endSeconds - startSeconds : endSeconds + 24 * 60 * 60 - startSeconds;
}

function completeWaterflowTest(rows: DeviceTestRow[], id: string, receivedTime: string, onChange: (rows: DeviceTestRow[]) => void) {
  const row = rows.find((item) => item.id === id);
  if (!row) return;
  const duration = secondsBetween(row.tripTime, receivedTime);
  const passed = duration !== null && duration < 90;
  patch(rows, id, {
    timeReceived: receivedTime,
    result: passed ? "OK" : "VAR",
    notes: passed ? row.notes : `Waterflow test failed; exceeded 90 seconds${duration === null ? "." : ` (${duration} seconds).`}`,
  }, onChange);
}

function timeToSeconds(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;
  const [hours, minutes, seconds = 0] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

function timeStamp(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
}

function formatElapsed(seconds: number) {
  return `${seconds}s`;
}

function elapsedColorClass(seconds: number | null) {
  if (seconds === null) return "bg-slate-100 text-slate-600";
  if (seconds < 60) return "bg-emerald-100 text-emerald-800";
  if (seconds < 75) return "bg-lime-100 text-lime-800";
  if (seconds < 85) return "bg-amber-100 text-amber-900";
  if (seconds < 90) return "bg-orange-100 text-orange-900";
  return "bg-red-100 text-red-800";
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
