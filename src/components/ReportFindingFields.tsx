import { DictationNotes } from "./DictationNotes";
import { AuditorReportDatabase } from "./AuditorReportDatabase";
import { CsisDefectList } from "./CsisDefectList";

export interface ReportFindingValue {
  reportFinding: string;
  reportRequiredAction: string;
  reportCodeStandard: string;
  reportCodeEdition: string;
  reportCodeSection: string;
}

const editionOptions = ["2022", "2019", "2016", "2013", "2010", "2007", "2002"];
const standardOptions = ["NFPA 72", "NFPA 71", "NFPA 70"];

export function ReportFindingFields({ value, onChange, showCsisHelp, helpStandard, helpYear }: { value: ReportFindingValue; onChange: (value: Partial<ReportFindingValue>) => void; showCsisHelp?: boolean; helpStandard?: string; helpYear?: string }) {
  const selectedStandard = value.reportCodeStandard || "NFPA 72";
  return (
    <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-amber-950">Report language for this variation</div>
        {showCsisHelp ? (
          <div className="flex flex-wrap gap-2">
            <CsisDefectList
              initialStandard={helpStandard}
              initialYear={helpYear}
              onSelect={(defect) => onChange({
                reportCodeStandard: defect.standard || "NFPA 72",
                reportCodeEdition: defect.year || "",
                reportCodeSection: defect.section || "",
              })}
            />
            <AuditorReportDatabase
              initialStandard={helpStandard}
              initialYear={helpYear}
              onSelect={(finding) => onChange({
                reportFinding: finding.finding,
                reportRequiredAction: finding.requiredAction,
                reportCodeStandard: finding.standard || "NFPA 72",
                reportCodeEdition: finding.year || "",
                reportCodeSection: finding.section || "",
              })}
            />
          </div>
        ) : null}
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Finding
        <DictationNotes rows={2} value={value.reportFinding} onChange={(reportFinding) => onChange({ reportFinding })} />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Required Action
        <DictationNotes rows={2} value={value.reportRequiredAction} onChange={(reportRequiredAction) => onChange({ reportRequiredAction })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[160px_160px_1fr]">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Code Reference
          <input className="min-h-11 rounded-md border bg-white px-3" list="report-code-standard-options" value={selectedStandard} onChange={(event) => onChange({ reportCodeStandard: event.target.value })} placeholder="Example: NFPA 72" />
          <datalist id="report-code-standard-options">{standardOptions.map((standard) => <option key={standard} value={standard} />)}</datalist>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Edition
          <input className="min-h-11 rounded-md border bg-white px-3" list="report-code-edition-options" value={value.reportCodeEdition} onChange={(event) => onChange({ reportCodeEdition: event.target.value })} placeholder="Example: 2022" />
          <datalist id="report-code-edition-options">{editionOptions.map((edition) => <option key={edition} value={edition} />)}</datalist>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Section / paragraph number
          <input className="min-h-11 rounded-md border bg-white px-3" value={value.reportCodeSection} onChange={(event) => onChange({ reportCodeSection: event.target.value })} placeholder="Example: 26.3.8.1" />
        </label>
      </div>
    </div>
  );
}
