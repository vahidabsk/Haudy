import { useMemo, useState } from "react";
import { CheckCircle2, Search, X } from "lucide-react";
import { CsisDefect, csisCategories, csisStandards, csisYears, searchCsisDefects } from "../lib/csis-defects";

interface CsisDefectListProps {
  initialStandard?: string;
  initialYear?: string;
  onSelect: (defect: CsisDefect) => void;
}

export function CsisDefectList({ initialStandard = "", initialYear = "", onSelect }: CsisDefectListProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [standard, setStandard] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const results = useMemo(() => searchCsisDefects({ keyword, standard, year, category }), [keyword, standard, year, category]);

  function openSearch() {
    setKeyword("");
    setStandard(initialStandard);
    setYear(initialYear);
    setOpen(true);
  }

  function selectDefect(defect: CsisDefect) {
    onSelect(defect);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
        onClick={openSearch}
      >
        <Search size={16} /> CSIS Defect List
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/45 p-3">
          <div className="grid max-h-[92vh] w-full max-w-[calc(100vw-2rem)] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-2xl xl:max-w-4xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-navy">CSIS Defect List</h3>
                <p className="text-sm text-slate-600">Search the standard, edition, category, or wording. Select a result to fill the code reference for this deficiency.</p>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => setOpen(false)} aria-label="Close CSIS Defect List">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-3 border-b bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-[1.25fr_1fr_0.75fr]">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Keyword
                <input className="min-h-11 w-full rounded-md border bg-white px-3" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="as-built, battery, transmitter..." autoFocus />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Standard
                <select className="min-h-11 w-full rounded-md border bg-white px-3" value={standard} onChange={(event) => setStandard(event.target.value)}>
                  <option value="">All standards</option>
                  {csisStandards.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Edition
                <select className="min-h-11 w-full rounded-md border bg-white px-3" value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value="">All editions</option>
                  {csisYears.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Category
                <select className="min-h-11 w-full rounded-md border bg-white px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">All categories</option>
                  {csisCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="min-w-0 overflow-y-auto p-4">
              <div className="mb-3 text-sm font-medium text-slate-600">{results.length} result{results.length === 1 ? "" : "s"} shown</div>
              <div className="grid gap-3">
                {results.map((result, index) => (
                  <div key={`${result.standard}-${result.year}-${result.section}-${result.category}-${index}`} className="grid min-w-0 max-w-full gap-3 overflow-hidden rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>{result.standard || "Standard not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.year ? `${result.year} Edition` : "Edition not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.section ? `Section ${result.section}` : "Section not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span className="break-words">{result.category || "No category"}</span>
                    </div>
                    <p className="max-w-full whitespace-normal text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{result.defect}</p>
                    <div>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                        onClick={() => selectDefect(result)}
                      >
                        <CheckCircle2 size={16} /> Use this code
                      </button>
                    </div>
                  </div>
                ))}
                {!results.length ? <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">No matching CSIS defect found. Try a broader keyword or remove one filter.</div> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
