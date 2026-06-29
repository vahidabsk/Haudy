import { DeviceTestRow, SignalType, StatusCode } from "../lib/types";
import { nowIso, uid } from "../lib/utils";
import { DictationNotes } from "./DictationNotes";
import { PhotoCapture } from "./PhotoCapture";
import { StatusButtons } from "./StatusButtons";

const deviceTypes = ["Smoke", "Heat", "Manual pull", "Waterflow", "Tamper", "Duct", "Sprinkler supervisory", "Notification appliance", "Monitor module", "Control relay", "Communication path", "Other"];
const signalTypes: SignalType[] = ["Alarm", "Supervisory", "Trouble"];

export function DeviceTestSection({ rows, onChange }: { rows: DeviceTestRow[]; onChange: (rows: DeviceTestRow[]) => void }) {
  return (
    <section className="grid gap-4">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-3 rounded-lg border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="min-h-11 rounded-md border px-2" value={row.deviceType} onChange={(e) => patch(rows, row.id, { deviceType: e.target.value }, onChange)}><option value="">Device Type</option>{deviceTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="min-h-11 rounded-md border px-2" placeholder="Location" value={row.location} onChange={(e) => patch(rows, row.id, { location: e.target.value }, onChange)} />
            <input className="min-h-11 rounded-md border px-2" placeholder="Device ID / Zone" value={row.deviceId} onChange={(e) => patch(rows, row.id, { deviceId: e.target.value }, onChange)} />
            <select className="min-h-11 rounded-md border px-2" value={row.signalType} onChange={(e) => patch(rows, row.id, { signalType: e.target.value as SignalType }, onChange)}><option value="">Signal Type</option>{signalTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="min-h-11 rounded-md border px-2" placeholder="Trip Time" value={row.tripTime} onChange={(e) => patch(rows, row.id, { tripTime: e.target.value }, onChange)} />
            <input className="min-h-11 rounded-md border px-2" placeholder="Time Received" value={row.timeReceived} onChange={(e) => patch(rows, row.id, { timeReceived: e.target.value }, onChange)} />
          </div>
          <StatusButtons value={row.result} onChange={(result: StatusCode) => patch(rows, row.id, { result }, onChange)} />
          <DictationNotes value={row.notes} onChange={(notes) => patch(rows, row.id, { notes }, onChange)} />
          <PhotoCapture photos={row.photos} onChange={(photos) => patch(rows, row.id, { photos }, onChange)} required />
        </div>
      ))}
      <button className="min-h-11 rounded-md border bg-white px-4" onClick={() => onChange([...rows, { id: uid("device"), deviceType: "", location: "", deviceId: "", signalType: "", tripTime: "", timeReceived: "", signalReceived: false, restoralReceived: false, localIndication: false, result: "", notes: "", photos: [], updatedAt: nowIso() }])}>
        Add Device Row
      </button>
    </section>
  );
}

function patch(rows: DeviceTestRow[], id: string, update: Partial<DeviceTestRow>, onChange: (rows: DeviceTestRow[]) => void) {
  onChange(rows.map((row) => (row.id === id ? { ...row, ...update, updatedAt: nowIso() } : row)));
}
