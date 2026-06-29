import { DeviceTestRow, StatusCode } from "../lib/types";
import { nowIso, uid } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";
import { PhotoCapture } from "./PhotoCapture";
import { StatusButtons } from "./StatusButtons";

const deviceTypes = ["Smoke Detector (SD)", "Heat Detector (HD)", "Duct Detector (DD)", "Manual Pull Station (MP)", "Waterflow Device (WF)", "Sprinkler Supervisory (SS)", "Notification Appliance (NAC)", "Other"];

export function DeviceTestSection({ rows, onChange }: { rows: DeviceTestRow[]; onChange: (rows: DeviceTestRow[]) => void }) {
  return (
    <section className="grid gap-4">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-3 rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
              <select className="min-h-11 rounded-md border px-2" value={row.deviceType} onChange={(e) => patch(rows, row.id, { deviceType: e.target.value }, onChange)}><option value="">Device Type Tested</option>{deviceTypes.map((item) => <option key={item}>{item}</option>)}</select>
              <input className="min-h-11 rounded-md border px-2" placeholder="Location" value={row.location} onChange={(e) => patch(rows, row.id, { location: e.target.value }, onChange)} />
              <input className="min-h-11 rounded-md border px-2" placeholder="Device ID / Zone" value={row.deviceId} onChange={(e) => patch(rows, row.id, { deviceId: e.target.value }, onChange)} />
              <input className="min-h-11 rounded-md border px-2" placeholder="Trip Time" value={row.tripTime} onChange={(e) => patch(rows, row.id, { tripTime: e.target.value }, onChange)} />
              <input className="min-h-11 rounded-md border px-2" placeholder="Time Rcvd or N/A" value={row.timeReceived} onChange={(e) => patch(rows, row.id, { timeReceived: e.target.value }, onChange)} />
            </div>
          <div className="grid gap-2 text-sm sm:grid-cols-5">
            <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2"><input type="checkbox" checked={!!row.functional} onChange={(e) => patch(rows, row.id, { functional: e.target.checked }, onChange)} />F Functional</label>
            <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2"><input type="checkbox" checked={!!row.alarm} onChange={(e) => patch(rows, row.id, { alarm: e.target.checked }, onChange)} />A Alarm</label>
            <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2"><input type="checkbox" checked={!!row.supervisory} onChange={(e) => patch(rows, row.id, { supervisory: e.target.checked }, onChange)} />S Supervisory</label>
            <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2"><input type="checkbox" checked={!!row.trouble} onChange={(e) => patch(rows, row.id, { trouble: e.target.checked }, onChange)} />T Trouble</label>
            <label className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2"><input type="checkbox" checked={!!row.notApplicable} onChange={(e) => patch(rows, row.id, { notApplicable: e.target.checked }, onChange)} />N/A</label>
          </div>
          <StatusButtons value={row.result} onChange={(result: StatusCode) => patch(rows, row.id, { result }, onChange)} />
          <DictationNotes value={row.notes} onChange={(notes) => patch(rows, row.id, { notes }, onChange)} />
          <PhotoCapture photos={row.photos} onChange={(photos) => patch(rows, row.id, { photos }, onChange)} required />
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
