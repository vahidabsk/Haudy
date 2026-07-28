import { useState } from "react";
import { DictationNotes } from "./DictationNotes";
import { AuditorReportDatabase, AuditorReportSelection } from "./AuditorReportDatabase";
import { AuditorReportFinding } from "../lib/auditor-report-findings";
import { isReferenceComplete, isReferenceUsed, UNUSED_REFERENCE_VALUE } from "../lib/report-reference";
import { HaudyAiContext, HaudyAiSuggestion, haudyAiDeviceToken, requestHaudyAiSuggestion, saveHaudyAiDeviceToken } from "../lib/haudy-ai-client";

export interface ReportFindingValue {
  reportFinding: string;
  reportRequiredAction: string;
  reportCodeStandard: string;
  reportCodeEdition: string;
  reportCodeSection: string;
}

const editionOptions = ["2022", "2019", "2016", "2013", "2010", "2007", "2002"];
const standardOptions = ["NFPA 72", "NFPA 71", "NFPA 70", "UL 681", "UL 827", "UL 2050"];

export function ReportFindingFields({ value, onChange, showReportHelp, helpStandard, helpYear, aiContext }: { value: ReportFindingValue; onChange: (value: Partial<ReportFindingValue>) => void; showReportHelp?: boolean; helpStandard?: string; helpYear?: string; aiContext?: HaudyAiContext }) {
  const [showAi, setShowAi] = useState(false);
  const [aiObservation, setAiObservation] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<HaudyAiSuggestion | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showGatewaySetup, setShowGatewaySetup] = useState(false);
  const [gatewayToken, setGatewayToken] = useState(() => haudyAiDeviceToken());
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
        {showReportHelp ? (
          <div className="flex flex-wrap gap-2">
            {aiContext ? (
              <button
                type="button"
                className="min-h-9 rounded-md border border-teal-300 bg-teal-50 px-3 text-sm font-bold text-teal-800 hover:bg-teal-100"
                onClick={() => {
                  setShowAi((current) => !current);
                  setAiObservation((current) => current || aiContext.fieldNote || value.reportFinding);
                }}
              >
                Assist with Haudy AI
              </button>
            ) : null}
            <AuditorReportDatabase
              initialStandard={helpStandard}
              initialYear={helpYear}
              onSelect={applyAuditorReportSelection}
            />
          </div>
        ) : null}
      </div>
      {showAi && aiContext ? (
        <div className="grid gap-3 rounded-md border border-teal-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-bold text-navy">Haudy AI auditor preview</div>
              <div className="text-xs text-slate-600">No report field changes until you accept a suggestion.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-bold ${gatewayToken ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{gatewayToken ? "Gateway configured" : "Local mode"}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">NFPA 72 · {aiContext.nfpa72Edition || "edition required"}</span>
            </div>
          </div>
          <button type="button" className="w-fit text-xs font-bold text-teal-800 underline" onClick={() => setShowGatewaySetup((current) => !current)}>Haudy AI Gateway setup</button>
          {showGatewaySetup ? (
            <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="grid gap-1 text-xs font-bold text-slate-700">
                Authorized device token
                <input type="password" className="min-h-10 rounded-md border bg-white px-3" value={gatewayToken} onChange={(event) => setGatewayToken(event.target.value)} placeholder="Paste the authorized Haudy device token" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-md bg-navy px-3 py-2 text-xs font-bold text-white" onClick={() => { const token = saveHaudyAiDeviceToken(gatewayToken); setGatewayToken(token); setShowGatewaySetup(false); }}>Save on this computer</button>
                <button type="button" className="rounded-md border bg-white px-3 py-2 text-xs font-bold text-slate-700" onClick={() => { saveHaudyAiDeviceToken(""); setGatewayToken(""); }}>Use local mode</button>
              </div>
              <p className="text-xs text-slate-500">The token is stored only in this Haudy installation and can be revoked at the gateway.</p>
            </div>
          ) : null}
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Observation sent for analysis
            <textarea className="min-h-24 rounded-md border bg-white p-3" value={aiObservation} onChange={(event) => setAiObservation(event.target.value)} />
          </label>
          <button
            type="button"
            disabled={aiBusy || !aiObservation.trim() || !aiContext.nfpa72Edition}
            className="min-h-10 rounded-md bg-teal-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={async () => {
              setAiBusy(true);
              setAiError("");
              setAiSuggestion(null);
              try {
                setAiSuggestion(await requestHaudyAiSuggestion({ ...aiContext, fieldNote: aiObservation }, value.reportFinding, value.reportRequiredAction));
              } catch (error) {
                setAiError(error instanceof Error ? error.message : "Haudy AI could not analyze this finding.");
              } finally {
                setAiBusy(false);
              }
            }}
          >
            {aiBusy ? "Analyzing…" : "Generate review draft"}
          </button>
          {aiError ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{aiError}</div> : null}
          {aiSuggestion ? <HaudyAiPreview suggestion={aiSuggestion} onAccept={onChange} /> : null}
        </div>
      ) : null}
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

function HaudyAiPreview({ suggestion, onAccept }: { suggestion: HaudyAiSuggestion; onAccept: (value: Partial<ReportFindingValue>) => void }) {
  const governing = suggestion.references.find((reference) => reference.role === "governing");
  const verified = governing?.verificationStatus === "verified";
  const candidate = governing?.verificationStatus === "candidate";
  const referenceAvailable = Boolean(governing?.standard && governing.edition && governing.section && (verified || candidate));
  const referencePatch = referenceAvailable && governing ? {
    reportCodeStandard: governing.standard,
    reportCodeEdition: governing.edition,
    reportCodeSection: governing.section,
  } : {};
  return (
    <div className="grid gap-3 border-t border-slate-200 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${verified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          {verified ? "Verified reference" : candidate ? "Candidate reference — verify before use" : "Reference verification required"}
        </span>
        <span className="text-xs font-semibold text-slate-500">Confidence {suggestion.confidence}%</span>
      </div>
      <AiDraftField label="Proposed Finding" value={suggestion.finding} onAccept={() => onAccept({ reportFinding: suggestion.finding })} />
      <AiDraftField label="Proposed Required Action" value={suggestion.requiredAction} onAccept={() => onAccept({ reportRequiredAction: suggestion.requiredAction })} />
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        <div className="font-bold text-navy">Governing reference</div>
        <div className="mt-1">{referenceAvailable && governing ? `${governing.standard}, ${governing.edition} Edition, Section ${governing.section}` : "No exact section was asserted."}</div>
        <div className="mt-1 text-xs text-slate-600">{governing?.requirementSummary}</div>
        <button type="button" disabled={!referenceAvailable} className="mt-2 rounded-md border bg-white px-3 py-1.5 text-xs font-bold text-navy disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onAccept(referencePatch)}>{candidate ? "Accept after manual verification" : "Accept reference"}</button>
      </div>
      <div className="rounded-md bg-sky-50 p-3 text-xs text-sky-900">{suggestion.reasoningSummary}</div>
      <button type="button" disabled={!verified} className="min-h-10 rounded-md bg-navy px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" onClick={() => onAccept({ reportFinding: suggestion.finding, reportRequiredAction: suggestion.requiredAction, ...referencePatch })}>Accept verified draft</button>
    </div>
  );
}

function AiDraftField({ label, value, onAccept }: { label: string; value: string; onAccept: () => void }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3 text-sm">
      <div className="font-bold text-navy">{label}</div>
      <p className="my-2 leading-relaxed text-slate-700">{value}</p>
      <button type="button" className="rounded-md border bg-white px-3 py-1.5 text-xs font-bold text-navy" onClick={onAccept}>Accept this field</button>
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
