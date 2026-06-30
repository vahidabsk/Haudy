import { DictationNotes } from "./DictationNotes";

export interface ReportFindingValue {
  reportFinding: string;
  reportRequiredAction: string;
  reportCodeEdition: string;
  reportCodeSection: string;
}

const editionOptions = ["2022", "2019", "2016", "2013", "2010", "2007", "2002"];

export function ReportFindingFields({ value, onChange }: { value: ReportFindingValue; onChange: (value: Partial<ReportFindingValue>) => void }) {
  return (
    <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <div className="text-sm font-semibold text-amber-950">Report language for this variation</div>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Finding
        <DictationNotes rows={2} value={value.reportFinding} onChange={(reportFinding) => onChange({ reportFinding })} />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Required Action
        <DictationNotes rows={2} value={value.reportRequiredAction} onChange={(reportRequiredAction) => onChange({ reportRequiredAction })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Code Reference: NFPA 72
          <select className="min-h-11 rounded-md border bg-white px-3" value={value.reportCodeEdition} onChange={(event) => onChange({ reportCodeEdition: event.target.value })}>
            <option value="">Edition</option>
            {editionOptions.map((edition) => <option key={edition} value={edition}>{edition} Edition</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Section / paragraph number
          <input className="min-h-11 rounded-md border bg-white px-3" value={value.reportCodeSection} onChange={(event) => onChange({ reportCodeSection: event.target.value })} placeholder="Example: 26.3.8.1" />
        </label>
      </div>
    </div>
  );
}
