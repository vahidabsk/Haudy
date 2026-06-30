import { useMemo, useState } from "react";
import { CheckCircle2, Search, X } from "lucide-react";
import {
  AuditorReportFinding,
  auditorReportCategories,
  auditorReportReviewTypes,
  auditorReportStandards,
  auditorReportYears,
  searchAuditorReportFindings,
} from "../lib/auditor-report-findings";

interface AuditorReportDatabaseProps {
  initialKeyword?: string;
  initialStandard?: string;
  initialYear?: string;
  initialReviewType?: string;
  onSelect: (finding: AuditorReportFinding) => void;
}

export function AuditorReportDatabase({ initialKeyword = "", initialStandard = "", initialYear = "", initialReviewType = "", onSelect }: AuditorReportDatabaseProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [standard, setStandard] = useState("");
  const [year, setYear] = useState("");
  const [reviewType, setReviewType] = useState("");
  const [category, setCategory] = useState("");
  const results = useMemo(() => searchAuditorReportFindings({ keyword, standard, year, reviewType, category }), [keyword, standard, year, reviewType, category]);

  function openSearch() {
    setKeyword((current) => current || initialKeyword);
    setStandard(initialStandard);
    setYear(initialYear);
    setReviewType(initialReviewType);
    setOpen(true);
  }

  function selectFinding(finding: AuditorReportFinding) {
    onSelect(finding);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
        onClick={openSearch}
      >
        <Search size={16} /> Report DB
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="grid max-h-[88vh] w-full max-w-5xl grid-rows-[auto_auto_1fr] overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-navy">Auditor Report Database</h3>
                <p className="text-sm text-slate-600">Search report wording and select a result to fill Finding, Required Action, and Code Reference for this deficiency.</p>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => setOpen(false)} aria-label="Close Auditor Report Database">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-3 border-b bg-slate-50 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Keyword
                <input className="min-h-11 rounded-md border bg-white px-3" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="signal history, as-built, battery..." autoFocus />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Standard
                <select className="min-h-11 rounded-md border bg-white px-3" value={standard} onChange={(event) => setStandard(event.target.value)}>
                  <option value="">All standards</option>
                  {auditorReportStandards.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Edition
                <select className="min-h-11 rounded-md border bg-white px-3" value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value="">All editions</option>
                  {auditorReportYears.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Review
                <select className="min-h-11 rounded-md border bg-white px-3" value={reviewType} onChange={(event) => setReviewType(event.target.value)}>
                  <option value="">All reviews</option>
                  {auditorReportReviewTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Category
                <select className="min-h-11 rounded-md border bg-white px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">All categories</option>
                  {auditorReportCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="mb-3 text-sm font-medium text-slate-600">{results.length} result{results.length === 1 ? "" : "s"} shown</div>
              <div className="grid gap-3">
                {results.map((result) => (
                  <div key={result.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>{result.standard || "Standard not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.year ? `${result.year} Edition` : "Edition not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.section ? `Section ${result.section}` : "Section not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.reviewType || "Review not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.category || "No category"}</span>
                    </div>
                    <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      <p><span className="font-semibold text-navy">Finding:</span> {result.finding}</p>
                      <p><span className="font-semibold text-navy">Required Action:</span> {result.requiredAction}</p>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                        onClick={() => selectFinding(result)}
                      >
                        <CheckCircle2 size={16} /> Use wording
                      </button>
                    </div>
                  </div>
                ))}
                {!results.length ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">No matching report wording found. Try a broader keyword or remove one filter.</div> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
