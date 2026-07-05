import { useEffect, useState } from "react";
import { AuditProgram } from "../lib/audit-program";
import { DeviceTestRow } from "../lib/types";
import { nowIso, uid } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";

const fireDeviceTypes = [
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
const mercantileDeviceTypes = [
  "Door Contact",
  "Roll-Up Contact",
  "Window Contact",
  "Motion",
  "Glass Break",
  "Beam",
  "Vibration",
  "Shock",
  "Safe Contact",
  "Vault Contact",
  "Hold-Up",
  "Panic",
  "Money Clip",
  "Foil",
  "Roof Hatch",
  "Trap",
  "Panel Tamper",
  "Device Tamper",
  "Bell/Siren Tamper",
  "Power Tamper",
  "Comm Tamper",
  "Bell/Siren",
  "Strobe",
  "Communicator",
  "Battery",
  "AC Fail",
  "Comm Fail",
  "Ground Fault",
];
type DeviceTestFlag = keyof Pick<DeviceTestRow, "functional" | "alarm" | "supervisory" | "trouble">;
const fireTestOptions: Array<{ key: DeviceTestFlag; label: string; active: string; idle: string }> = [
  { key: "functional", label: "Functional", active: "border-sky-700 bg-sky-700 text-white", idle: "border-sky-200 bg-sky-50 text-sky-800" },
  { key: "alarm", label: "Alarm", active: "border-red-700 bg-red-700 text-white", idle: "border-red-200 bg-red-50 text-red-800" },
  { key: "supervisory", label: "Supervisory", active: "border-amber-700 bg-amber-600 text-white", idle: "border-amber-200 bg-amber-50 text-amber-800" },
  { key: "trouble", label: "Trouble", active: "border-purple-700 bg-purple-700 text-white", idle: "border-purple-200 bg-purple-50 text-purple-800" },
];
const mercantileTestOptions: Array<{ key: DeviceTestFlag; label: string; active: string; idle: string }> = [
  { key: "functional", label: "Functional", active: "border-sky-700 bg-sky-700 text-white", idle: "border-sky-200 bg-sky-50 text-sky-800" },
  { key: "alarm", label: "Alarm", active: "border-red-700 bg-red-700 text-white", idle: "border-red-200 bg-red-50 text-red-800" },
  { key: "trouble", label: "Trouble", active: "border-purple-700 bg-purple-700 text-white", idle: "border-purple-200 bg-purple-50 text-purple-800" },
];
const lineSecurityDeviceType = "Line security test";
const lineSecurityIntervals = [
  { label: "Single path - 200 seconds", value: 200 },
  { label: "Dual primary path - 360 seconds", value: 360 },
  { label: "Secondary path - 24 hours", value: 86400 },
];
const resultOptions = [
  { value: "OK" as const, label: "In Conformance", active: "border-emerald-700 bg-emerald-700 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "VAR" as const, label: "Variation Noted", active: "border-amber-700 bg-amber-600 text-white", idle: "border-amber-200 bg-amber-50 text-amber-800" },
];

export function DeviceTestSection({ rows, localSystem, disabled, disabledMessage = "Device testing review marked No. Use the general variation note above to explain why device testing was not completed.", program = "fire", lineSecurityKind = "", onLocalSystemChange, onChange }: { rows: DeviceTestRow[]; localSystem: boolean; disabled?: boolean; disabledMessage?: string; program?: AuditProgram; lineSecurityKind?: string; onLocalSystemChange: (localSystem: boolean) => void; onChange: (rows: DeviceTestRow[]) => void }) {
  const [currentTime, setCurrentTime] = useState(() => timeStamp(new Date()));
  const testOptions = program === "mercantile" ? mercantileTestOptions : fireTestOptions;
  const isMercantile = program === "mercantile";
  const deviceTypes = isMercantile ? mercantileDeviceTypes : fireDeviceTypes;
  const showLineSecurityTest = isMercantile && hasLineSecurityRequirement(lineSecurityKind);
  const lineSecurityRow = rows.find((row) => row.deviceType === lineSecurityDeviceType);
  const deviceRows = isMercantile ? rows.filter((row) => row.deviceType !== lineSecurityDeviceType) : rows;

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(timeStamp(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (showLineSecurityTest && !lineSecurityRow) {
      onChange([createLineSecurityRow(), ...rows]);
      return;
    }
    if (!showLineSecurityTest && lineSecurityRow && isMercantile) {
      onChange(rows.filter((row) => row.deviceType !== lineSecurityDeviceType));
    }
  }, [showLineSecurityTest, lineSecurityRow?.id, isMercantile]);

  function setLocalSystem(nextLocalSystem: boolean) {
    onLocalSystemChange(nextLocalSystem);
  }

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold text-navy">Device Testing</h2>
      {!isMercantile ? <label className="grid gap-1 rounded-lg border bg-white p-4 text-sm font-medium text-slate-700">
        Is this a local system?
        <select className="min-h-11 rounded-md border px-3 disabled:bg-slate-100 disabled:text-slate-400" value={localSystem ? "YES" : "NO"} disabled={disabled} onChange={(event) => setLocalSystem(event.target.value === "YES")}>
          <option value="NO">No - signals report to monitoring station</option>
          <option value="YES">Yes - local system only</option>
        </select>
      </label> : null}
      {disabled ? <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">{disabledMessage}</div> : null}
      {showLineSecurityTest ? (
        <LineSecurityTestCard
          row={lineSecurityRow || createLineSecurityRow()}
          declaredKind={lineSecurityKind}
          currentTime={currentTime}
          disabled={disabled}
          onChange={(update) => patchOrAddLineSecurityRow(rows, update, onChange)}
        />
      ) : null}
      {deviceRows.map((row) => {
        const isWaterflow = row.deviceType === "Waterflow switch";
        const waterflowMode = row.waterflowEntryMode || "";
        const waterflowAutomatic = isWaterflow && waterflowMode === "automatic";
        const waterflowManual = isWaterflow && waterflowMode === "manual";
        const stoppedWaterflowSeconds = typeof row.waterflowElapsedSeconds === "number" && row.waterflowElapsedSeconds > 0 ? row.waterflowElapsedSeconds : null;
        const waterflowSeconds = waterflowAutomatic ? stoppedWaterflowSeconds ?? secondsBetween(row.tripTime, row.timeReceived || currentTime) : null;
        const waterflowRunning = waterflowAutomatic && row.tripTime && !row.timeReceived && stoppedWaterflowSeconds === null;
        const waterflowOverdue = Boolean(waterflowRunning && waterflowSeconds !== null && waterflowSeconds >= 90);
        return (
        <div key={row.id} className={`grid gap-3 rounded-lg border bg-white p-4 ${disabled ? "opacity-60" : ""}`}>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="min-h-11 rounded-md border px-2 disabled:bg-slate-100 disabled:text-slate-400" value={disabled ? "" : row.deviceType} disabled={disabled} onChange={(e) => patch(rows, row.id, { deviceType: e.target.value, waterflowEntryMode: "", waterflowElapsedSeconds: 0, tripTime: "", timeReceived: "", result: "", notes: "" }, onChange)}><option value="">Device Type Tested</option>{deviceTypes.map((item) => <option key={item}>{item}</option>)}</select>
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
                  onClick={() => patch(rows, row.id, { waterflowEntryMode: "manual", waterflowElapsedSeconds: 0, tripTime: "", timeReceived: "", result: "", notes: "" }, onChange)}
                >
                  Manual Entry
                </button>
                <button
                  type="button"
                  className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${waterflowMode === "automatic" ? "border-sky-700 bg-sky-700 text-white" : "border-sky-300 bg-white text-sky-900 hover:bg-sky-50"}`}
                  disabled={disabled}
                  onClick={() => patch(rows, row.id, { waterflowEntryMode: "automatic", waterflowElapsedSeconds: 0, tripTime: "", timeReceived: "", result: "", notes: "" }, onChange)}
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
                  onClick={() => patch(rows, row.id, { tripTime: timeStamp(new Date()), waterflowElapsedSeconds: 0, timeReceived: "", result: "", notes: "" }, onChange)}
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
                    onClick={() => markWaterflowNotReceived(rows, row.id, timeStamp(new Date()), onChange)}
                  >
                    Signal Has Not Been Received
                  </button>
                ) : null}
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => patch(rows, row.id, { tripTime: "", waterflowElapsedSeconds: 0, timeReceived: "", result: "", notes: "" }, onChange)}
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
      <button className="min-h-11 rounded-md border bg-white px-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400" disabled={disabled} onClick={() => onChange([...rows, createDeviceRow()])}>
        Add Device Row
      </button>
    </section>
  );
}

function LineSecurityTestCard({ row, declaredKind, currentTime, disabled, onChange }: { row: DeviceTestRow; declaredKind: string; currentTime: string; disabled?: boolean; onChange: (update: Partial<DeviceTestRow>) => void }) {
  const mode = row.waterflowEntryMode || "";
  const expectedSeconds = row.lineSecurityExpectedSeconds || defaultLineSecurityInterval(declaredKind);
  const stoppedSeconds = typeof row.waterflowElapsedSeconds === "number" && row.waterflowElapsedSeconds > 0 ? row.waterflowElapsedSeconds : null;
  const elapsedSeconds = mode === "automatic" && row.tripTime ? stoppedSeconds ?? secondsBetween(row.tripTime, row.timeReceived || currentTime) : null;
  const running = mode === "automatic" && row.tripTime && !row.timeReceived && stoppedSeconds === null;
  const overdue = Boolean(running && elapsedSeconds !== null && elapsedSeconds >= expectedSeconds);
  return (
    <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-navy">Line Security Test</h3>
          <p className="text-sm text-slate-700">Certificate line security: <b>{declaredKind}</b>. Record check-in supervision timing here before normal device tests.</p>
        </div>
        <label className="grid min-w-56 gap-1 text-sm font-semibold text-slate-700">
          Expected check-in
          <select className="min-h-10 rounded-md border border-amber-200 bg-white px-3" value={expectedSeconds} disabled={disabled} onChange={(event) => onChange({ lineSecurityExpectedSeconds: Number(event.target.value), result: "", notes: "" })}>
            {lineSecurityIntervals.map((interval) => <option key={interval.value} value={interval.value}>{interval.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${mode === "manual" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
          disabled={disabled}
          onClick={() => onChange({ waterflowEntryMode: "manual", waterflowElapsedSeconds: 0, tripTime: "", timeReceived: "", result: "", notes: "" })}
        >
          Manual Entry
        </button>
        <button
          type="button"
          className={`min-h-10 rounded-md border px-3 text-sm font-semibold ${mode === "automatic" ? "border-sky-700 bg-sky-700 text-white" : "border-sky-300 bg-white text-sky-900 hover:bg-sky-50"}`}
          disabled={disabled}
          onClick={() => onChange({ waterflowEntryMode: "automatic", waterflowElapsedSeconds: 0, tripTime: "", timeReceived: "", result: "", notes: "" })}
        >
          Automatic Stopwatch
        </button>
      </div>
      {mode === "manual" ? (
        <div className="grid gap-3 rounded-lg border border-amber-100 bg-white p-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Test started
            <input className="min-h-11 rounded-md border px-2" type="time" step={1} value={disabled ? "" : row.tripTime} disabled={disabled} onChange={(event) => onChange({ tripTime: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Check-in received
            <input className="min-h-11 rounded-md border px-2" type="time" step={1} value={disabled ? "" : row.timeReceived} disabled={disabled} onChange={(event) => applyManualLineSecurity(row, event.target.value, expectedSeconds, onChange)} />
          </label>
        </div>
      ) : null}
      {mode === "automatic" ? (
        <div className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="grid gap-2 text-sm text-sky-950 sm:grid-cols-3">
            <TimeReadout label="Test started" value={row.tripTime || "--:--:--"} />
            <TimeReadout label="Check-in received" value={row.timeReceived || "--:--:--"} />
            <div>
              <div className="text-xs font-semibold uppercase text-sky-700">Elapsed</div>
              <div className={`rounded-md px-2 py-1 font-mono text-lg font-bold ${elapsedColorClassForLimit(elapsedSeconds, expectedSeconds)}`}>{elapsedSeconds === null ? "--" : formatElapsed(elapsedSeconds)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-10 rounded-md border border-sky-300 bg-white px-3 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={() => onChange({ tripTime: timeStamp(new Date()), waterflowElapsedSeconds: 0, timeReceived: "", functional: true, lineSecurity: true, result: "", notes: "" })}>
              Start Line Security Test
            </button>
            <button type="button" className="min-h-10 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || !row.tripTime} onClick={() => completeLineSecurityTest(row, timeStamp(new Date()), expectedSeconds, onChange)}>
              Check-In Signal Received
            </button>
            {overdue ? (
              <button type="button" className="min-h-10 rounded-md border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={() => markLineSecurityNotReceived(row, timeStamp(new Date()), expectedSeconds, onChange)}>
                Check-In Not Received
              </button>
            ) : null}
            <button type="button" className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={() => onChange({ tripTime: "", waterflowElapsedSeconds: 0, timeReceived: "", result: "", notes: "" })}>
              Reset Test
            </button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {resultOptions.map((option) => (
          <button key={option.value} type="button" className={`min-h-11 rounded-md border px-3 font-medium ${row.result === option.value ? option.active : option.idle}`} disabled={disabled} onClick={() => onChange({ result: row.result === option.value ? "" : option.value, functional: true, lineSecurity: true })}>
            {option.label}
          </button>
        ))}
      </div>
      {disabled ? <textarea className="w-full rounded-md border border-slate-300 bg-slate-100 p-3 text-slate-400" rows={3} disabled /> : <DictationNotes value={row.notes} onChange={(notes) => onChange({ notes })} />}
    </div>
  );
}

function patch(rows: DeviceTestRow[], id: string, update: Partial<DeviceTestRow>, onChange: (rows: DeviceTestRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}

function patchOrAddLineSecurityRow(rows: DeviceTestRow[], update: Partial<DeviceTestRow>, onChange: (rows: DeviceTestRow[]) => void) {
  const existing = rows.find((row) => row.deviceType === lineSecurityDeviceType);
  const nextRow = {
    ...(existing || createLineSecurityRow()),
    ...update,
    deviceType: lineSecurityDeviceType,
    functional: update.functional ?? existing?.functional ?? true,
    lineSecurity: update.lineSecurity ?? existing?.lineSecurity ?? true,
    alarm: false,
    supervisory: false,
    trouble: false,
    updatedAt: nowIso(),
  };
  if (existing) {
    onChange(rows.map((row) => (row.id === existing.id ? nextRow : row)));
    return;
  }
  onChange([nextRow, ...rows]);
}

function createDeviceRow(): DeviceTestRow {
  return {
    id: uid("device"),
    deviceType: "",
    waterflowEntryMode: "",
    waterflowElapsedSeconds: 0,
    lineSecurityExpectedSeconds: 200,
    location: "",
    deviceId: "",
    signalType: "",
    functional: false,
    alarm: false,
    supervisory: false,
    trouble: false,
    lineSecurity: false,
    notApplicable: false,
    tripTime: "",
    timeReceived: "",
    signalReceived: false,
    restoralReceived: false,
    localIndication: false,
    result: "",
    notes: "",
    reportFinding: "",
    reportRequiredAction: "",
    reportCodeStandard: "",
    reportCodeEdition: "",
    reportCodeSection: "",
    photos: [],
    updatedAt: nowIso(),
  };
}

function createLineSecurityRow(): DeviceTestRow {
  return {
    ...createDeviceRow(),
    id: uid("line-security"),
    deviceType: lineSecurityDeviceType,
    functional: true,
    lineSecurity: true,
  };
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
    waterflowElapsedSeconds: 0,
    result: passed ? "OK" : "VAR",
    notes: passed ? row.notes : `Waterflow test failed; exceeded 90 seconds${duration === null ? "." : ` (${duration} seconds).`}`,
  }, onChange);
}

function applyManualLineSecurity(row: DeviceTestRow, receivedTime: string, expectedSeconds: number, onChange: (update: Partial<DeviceTestRow>) => void) {
  const duration = secondsBetween(row.tripTime, receivedTime);
  const passed = duration !== null && duration <= expectedSeconds;
  onChange({
    timeReceived: receivedTime,
    waterflowElapsedSeconds: 0,
    functional: true,
    lineSecurity: true,
    result: duration === null ? row.result : passed ? "OK" : "VAR",
    notes: duration === null || passed ? row.notes : `Line security check-in exceeded the expected ${expectedSeconds} second interval (${duration} seconds).`,
  });
}

function completeLineSecurityTest(row: DeviceTestRow, receivedTime: string, expectedSeconds: number, onChange: (update: Partial<DeviceTestRow>) => void) {
  const duration = secondsBetween(row.tripTime, receivedTime);
  const passed = duration !== null && duration <= expectedSeconds;
  onChange({
    timeReceived: receivedTime,
    waterflowElapsedSeconds: 0,
    functional: true,
    lineSecurity: true,
    result: passed ? "OK" : "VAR",
    notes: passed ? row.notes : `Line security check-in exceeded the expected ${expectedSeconds} second interval${duration === null ? "." : ` (${duration} seconds).`}`,
  });
}

function markLineSecurityNotReceived(row: DeviceTestRow, stoppedTime: string, expectedSeconds: number, onChange: (update: Partial<DeviceTestRow>) => void) {
  const duration = secondsBetween(row.tripTime, stoppedTime);
  onChange({
    timeReceived: "",
    waterflowElapsedSeconds: duration ?? expectedSeconds,
    functional: true,
    lineSecurity: true,
    result: "VAR",
    notes: `Line security check-in was not received after waiting ${duration ?? expectedSeconds} seconds.`,
  });
}

function markWaterflowNotReceived(rows: DeviceTestRow[], id: string, stoppedTime: string, onChange: (rows: DeviceTestRow[]) => void) {
  const row = rows.find((item) => item.id === id);
  if (!row) return;
  const duration = secondsBetween(row.tripTime, stoppedTime);
  patch(rows, id, {
    timeReceived: "",
    waterflowElapsedSeconds: duration ?? 0,
    result: "VAR",
    notes: `The waterflow is not functioning; after waiting ${duration ?? 0} seconds, no alarm signal was received.`,
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

function elapsedColorClassForLimit(seconds: number | null, limit: number) {
  if (seconds === null) return "bg-slate-100 text-slate-600";
  const ratio = seconds / limit;
  if (ratio < 0.65) return "bg-emerald-100 text-emerald-800";
  if (ratio < 0.8) return "bg-lime-100 text-lime-800";
  if (ratio < 0.92) return "bg-amber-100 text-amber-900";
  if (ratio < 1) return "bg-orange-100 text-orange-900";
  return "bg-red-100 text-red-800";
}

function hasLineSecurityRequirement(value: string) {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized && !["no", "none", "n/a", "na", "not applicable", "without line security"].includes(normalized));
}

function defaultLineSecurityInterval(value: string) {
  return /dual/i.test(value) ? 360 : 200;
}

function TimeReadout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-sky-700">{label}</div>
      <div className="font-mono text-lg font-bold">{value}</div>
    </div>
  );
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
