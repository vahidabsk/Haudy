import { StatusCode } from "../lib/types";

const options: Array<{ value: StatusCode; label: string; active: string; idle: string }> = [
  { value: "OK", label: "In Conformance", active: "border-emerald-700 bg-emerald-700 text-white", idle: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "VAR", label: "Variations Noted", active: "border-amber-700 bg-amber-600 text-white", idle: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "NA", label: "Not Applicable", active: "border-slate-700 bg-slate-700 text-white", idle: "border-slate-200 bg-slate-50 text-slate-700" },
  { value: "NR", label: "Not Reviewed", active: "border-red-700 bg-red-700 text-white", idle: "border-red-200 bg-red-50 text-red-800" },
];

export function StatusButtons({ value, onChange }: { value: StatusCode | ""; onChange: (value: StatusCode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`min-h-11 rounded-md border px-3 text-sm font-medium ${value === option.value ? option.active : option.idle}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
