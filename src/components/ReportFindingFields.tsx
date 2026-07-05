import { DictationNotes } from "./DictationNotes";
import { AuditorReportDatabase, AuditorReportSelection } from "./AuditorReportDatabase";
import { AuditorReportFinding } from "../lib/auditor-report-findings";
import { CsisDefectList } from "./CsisDefectList";
import { isReferenceComplete, isReferenceUsed, UNUSED_REFERENCE_VALUE } from "../lib/report-reference";

export interface ReportFindingValue {
  reportFinding: string;
  reportRequiredAction: string;
  reportCodeStandard: string;
  reportCodeEdition: string;
  reportCodeSection: string;
}

const editionOptions = ["2022", "2019", "2016", "2013", "2010", "2007", "2002"];
const standardOptions = ["NFPA 72", "NFPA 71", "NFPA 70", "UL 681", "UL 827", "UL 2050"];

export function ReportFindingFields({ value, onChange, showCsisHelp, helpStandard, helpYear }: { value: ReportFindingValue; onChange: (value: Partial<ReportFindingValue>) => void; showCsisHelp?: boolean; helpStandard?: string; helpYear?: string }) {
  const standardUsed = isReferenceUsed(value.reportCodeStandard);
  const editionUsed = isReferenceUsed(value.reportCodeEdition);
  const sectionUsed = isReferenceUsed(value.reportCodeSection);
  const selectedStandard = standardUsed ? value.reportCodeStandard || "NFPA 72" : "";
  const complete = Boolean(
    value.reportFinding.trim() &&
    value.reportRequiredAction.trim() &&
    isReferenceComplete(value.reportCodeStandard, "NFPA 72") &&
    isReferenceComplete(value.reportCodeEdition) &&
    isReferenceComplete(value.reportCodeSection),
  );
  function applyAuditorReportSelection(finding: AuditorReportFinding, selection: AuditorReportSelection) {
    const referenceFields = {
      reportCodeStandard: finding.standard || "NFPA 72",
      reportCodeEdition: finding.year || "",
      reportCodeSection: finding.section || "",
    };
    if (selection === "finding") {
      onChange({ reportFinding: finding.finding });
    } else if (selection === "requiredAction") {
      onChange({ reportRequiredAction: finding.requiredAction });
    } else if (selection === "reference") {
      onChange(referenceFields);
    } else {
      onChange({
        reportFinding: finding.finding,
        reportRequiredAction: finding.requiredAction,
        ...referenceFields,
      });
    }
  }

  return (
    <div className={`grid gap-3 rounded-md border p-3 transition-colors ${complete ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={`text-sm font-semibold ${complete ? "text-emerald-900" : "text-amber-950"}`}>Report language for this variation</div>
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
              onSelect={applyAuditorReportSelection}
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
      <div className="grid gap-3 md:grid-cols-[minmax(140px,1fr)_minmax(120px,1fr)] xl:grid-cols-[minmax(150px,0.8fr)_minmax(130px,0.7fr)_minmax(300px,2fr)]">
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-2">
            Code Reference
            <ReferenceUseToggle used={standardUsed} onChange={(used) => onChange({ reportCodeStandard: used ? "NFPA 72" : UNUSED_REFERENCE_VALUE })} />
          </span>
          <input className="min-h-11 min-w-0 rounded-md border bg-white px-3 disabled:bg-slate-100 disabled:text-slate-400" disabled={!standardUsed} list="report-code-standard-options" value={selectedStandard} onChange={(event) => onChange({ reportCodeStandard: event.target.value })} placeholder={standardUsed ? "Example: NFPA 72" : "Not used"} />
          <datalist id="report-code-standard-options">{standardOptions.map((standard) => <option key={standard} value={standard} />)}</datalist>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-2">
            Edition
            <ReferenceUseToggle used={editionUsed} onChange={(used) => onChange({ reportCodeEdition: used ? "" : UNUSED_REFERENCE_VALUE })} />
          </span>
          <input className="min-h-11 min-w-0 rounded-md border bg-white px-3 disabled:bg-slate-100 disabled:text-slate-400" disabled={!editionUsed} list="report-code-edition-options" value={editionUsed ? value.reportCodeEdition : ""} onChange={(event) => onChange({ reportCodeEdition: event.target.value })} placeholder={editionUsed ? "Example: 2022" : "Not used"} />
          <datalist id="report-code-edition-options">{editionOptions.map((edition) => <option key={edition} value={edition} />)}</datalist>
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-1">
          <span className="flex items-center justify-between gap-2">
            Section / paragraph number
            <ReferenceUseToggle used={sectionUsed} onChange={(used) => onChange({ reportCodeSection: used ? "" : UNUSED_REFERENCE_VALUE })} />
          </span>
          <input className="min-h-11 min-w-0 rounded-md border bg-white px-3 disabled:bg-slate-100 disabled:text-slate-400" disabled={!sectionUsed} value={sectionUsed ? value.reportCodeSection : ""} onChange={(event) => onChange({ reportCodeSection: event.target.value })} placeholder={sectionUsed ? "Example: 26.3.8.1" : "Not used"} />
        </label>
      </div>
    </div>
  );
}

function ReferenceUseToggle({ used, onChange }: { used: boolean; onChange: (used: boolean) => void }) {
  return (
    <button
      type="button"
      className={`rounded-full border px-2 py-1 text-xs font-semibold ${used ? "border-slate-200 bg-white text-slate-600" : "border-slate-300 bg-slate-200 text-slate-700"}`}
      onClick={(event) => {
        event.preventDefault();
        onChange(!used);
      }}
    >
      {used ? "Use" : "Not used"}
    </button>
  );
}
