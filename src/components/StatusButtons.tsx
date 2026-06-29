import { StatusCode } from "../lib/types";

const options: Array<{ value: StatusCode; label: string }> = [
  { value: "OK", label: "In Conformance" },
  { value: "VAR", label: "Variations Noted" },
  { value: "NA", label: "Not Applicable" },
  { value: "NR", label: "Not Reviewed" },
];

export function StatusButtons({ value, onChange }: { value: StatusCode | ""; onChange: (value: StatusCode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`min-h-11 rounded-md border px-3 text-sm font-medium ${
            value === option.value ? "border-navy bg-navy text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
