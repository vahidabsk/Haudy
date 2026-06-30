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

export function ReportFindingFields({ value, onChange, showCsisHelp, helpKeyword, helpStandard, helpYear, helpReviewType }: { value: ReportFindingValue; onChange: (value: Partial<ReportFindingValue>) => void; showCsisHelp?: boolean; helpKeyword?: string; helpStandard?: string; helpYear?: string; helpReviewType?: string }) {
  const selectedStandard = value.reportCodeStandard || "NFPA 72";
  const selectedEdition = value.reportCodeEdition;
  return (
    <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-amber-950">Report language for this variation</div>
        {showCsisHelp ? (
          <div className="flex flex-wrap gap-2">
            <CsisDefectList
              initialKeyword={helpKeyword}
              initialStandard={helpStandard}
              initialYear={helpYear}
              onSelect={(defect) => onChange({
                reportCodeStandard: defect.standard || "NFPA 72",
                reportCodeEdition: defect.year || "",
                reportCodeSection: defect.section || "",
              })}
            />
            <AuditorReportDatabase
              initialKeyword={helpKeyword}
              initialStandard={helpStandard}
              initialYear={helpYear}
              initialReviewType={helpReviewType}
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
          <select className="min-h-11 rounded-md border bg-white px-3" value={selectedStandard} onChange={(event) => onChange({ reportCodeStandard: event.target.value })}>
            <option value="">Standard</option>
            {selectedStandard && !standardOptions.includes(selectedStandard) ? <option value={selectedStandard}>{selectedStandard}</option> : null}
            {standardOptions.map((standard) => <option key={standard} value={standard}>{standard}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Edition
          <select className="min-h-11 rounded-md border bg-white px-3" value={value.reportCodeEdition} onChange={(event) => onChange({ reportCodeEdition: event.target.value })}>
            <option value="">Edition</option>
            {selectedEdition && !editionOptions.includes(selectedEdition) ? <option value={selectedEdition}>{selectedEdition} Edition</option> : null}
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
