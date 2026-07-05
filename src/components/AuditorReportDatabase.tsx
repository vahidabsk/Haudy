import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Search, Upload, X } from "lucide-react";
import {
  AuditorReportFinding,
  importPastReports,
  pastReportOptions,
  searchAuditorReportFindings,
} from "../lib/auditor-report-findings";
import { hasDesktopBridge, openPastReportPdfs } from "../lib/desktop-bridge";
import { extractPdfText } from "../lib/pdf-extract";

export type AuditorReportSelection = "finding" | "requiredAction" | "reference" | "all";

interface AuditorReportDatabaseProps {
  initialStandard?: string;
  initialYear?: string;
  onSelect: (finding: AuditorReportFinding, selection: AuditorReportSelection) => void;
}

export function AuditorReportDatabase({ initialStandard = "", initialYear = "", onSelect }: AuditorReportDatabaseProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [standard, setStandard] = useState("");
  const [year, setYear] = useState("");
  const [reviewType, setReviewType] = useState("");
  const [category, setCategory] = useState("");
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const options = useMemo(() => pastReportOptions(), [libraryVersion]);
  const results = useMemo(() => searchAuditorReportFindings({ keyword, standard, year, reviewType, category }), [keyword, standard, year, reviewType, category, libraryVersion]);

  function openSearch() {
    setKeyword("");
    setStandard(initialStandard);
    setYear(initialYear);
    setReviewType("");
    setOpen(true);
  }

  function selectFinding(finding: AuditorReportFinding, selection: AuditorReportSelection) {
    onSelect(finding, selection);
    setOpen(false);
  }

  async function importDesktopReports() {
    setImporting(true);
    setImportMessage("");
    try {
      const files = await openPastReportPdfs();
      finishImport(files);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  async function importBrowserReports(files: FileList | null) {
    if (!files?.length) return;
    setImporting(true);
    setImportMessage("");
    try {
      const extracted = await Promise.all(Array.from(files).map(async (file) => ({ fileName: file.name, text: await extractPdfText(file) })));
      finishImport(extracted);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function finishImport(files: { fileName: string; text: string }[]) {
    if (!files.length) {
      setImportMessage("No report was selected.");
      return;
    }
    const summary = importPastReports(files);
    const found = summary.reduce((total, item) => total + item.found, 0);
    const added = summary.reduce((total, item) => total + item.added, 0);
    const skipped = summary.reduce((total, item) => total + item.skipped, 0);
    setLibraryVersion((value) => value + 1);
    setImportMessage(`${added} Past Reports item${added === 1 ? "" : "s"} added from ${summary.length} PDF${summary.length === 1 ? "" : "s"}. ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped. ${found} finding${found === 1 ? "" : "s"} detected.`);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900"
        onClick={openSearch}
      >
        <Search size={16} /> Past Reports
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/45 p-3">
          <div className="grid max-h-[92vh] w-full max-w-[calc(100vw-2rem)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-2xl xl:max-w-5xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-navy">Past Reports</h3>
                <p className="text-sm text-slate-600">Search wording from prior reports and use only the part you need, or use the full row.</p>
              </div>
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} className="hidden" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => importBrowserReports(event.target.files)} />
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:cursor-wait disabled:opacity-60"
                  disabled={importing}
                  onClick={() => {
                    if (hasDesktopBridge()) void importDesktopReports();
                    else fileInputRef.current?.click();
                  }}
                >
                  <Upload size={16} /> {importing ? "Importing..." : "Import Past Reports"}
                </button>
                <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => setOpen(false)} aria-label="Close Past Reports">
                  <X size={20} />
                </button>
              </div>
            </div>
            {importMessage ? <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900">{importMessage}</div> : null}
            <div className="grid gap-3 border-b bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_0.75fr]">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Keyword
                <input className="min-h-11 w-full rounded-md border bg-white px-3" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search finding text..." autoFocus />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Standard
                <select className="min-h-11 w-full rounded-md border bg-white px-3" value={standard} onChange={(event) => setStandard(event.target.value)}>
                  <option value="">All standards</option>
                  {options.standards.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Edition
                <select className="min-h-11 w-full rounded-md border bg-white px-3" value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value="">All editions</option>
                  {options.years.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Review
                <select className="min-h-11 w-full rounded-md border bg-white px-3" value={reviewType} onChange={(event) => setReviewType(event.target.value)}>
                  <option value="">All reviews</option>
                  {options.reviewTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Category
                <select className="min-h-11 w-full rounded-md border bg-white px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">All categories</option>
                  {options.categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="min-w-0 overflow-y-auto p-4">
              <div className="mb-3 text-sm font-medium text-slate-600">{results.length} result{results.length === 1 ? "" : "s"} shown</div>
              <div className="grid gap-3">
                {results.map((result) => (
                  <div key={result.id} className="grid min-w-0 max-w-full gap-3 overflow-hidden rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>{result.standard || "Standard not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.year ? `${result.year} Edition` : "Edition not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.section ? `Section ${result.section}` : "Section not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.reviewType || "Review not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span className="break-words">{result.category || "No category"}</span>
                    </div>
                    <div className="grid min-w-0 max-w-full gap-2 overflow-hidden rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      <p className="max-w-full whitespace-normal [overflow-wrap:anywhere]"><span className="font-semibold text-navy">Finding:</span> {result.finding}</p>
                      <p className="max-w-full whitespace-normal [overflow-wrap:anywhere]"><span className="font-semibold text-navy">Required Action:</span> {result.requiredAction}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                        onClick={() => selectFinding(result, "finding")}
                      >
                        <CheckCircle2 size={16} /> Use finding
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100"
                        onClick={() => selectFinding(result, "requiredAction")}
                      >
                        <CheckCircle2 size={16} /> Use required action
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100"
                        onClick={() => selectFinding(result, "reference")}
                      >
                        <CheckCircle2 size={16} /> Use reference
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        onClick={() => selectFinding(result, "all")}
                      >
                        <CheckCircle2 size={16} /> Use all
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
