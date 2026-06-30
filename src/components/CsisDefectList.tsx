import { useMemo, useState } from "react";
import { CheckCircle2, Search, X } from "lucide-react";
import { CsisDefect, csisCategories, csisStandards, csisYears, searchCsisDefects } from "../lib/csis-defects";

interface CsisDefectListProps {
  initialKeyword?: string;
  onSelect: (defect: CsisDefect) => void;
}

export function CsisDefectList({ initialKeyword = "", onSelect }: CsisDefectListProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [standard, setStandard] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const results = useMemo(() => searchCsisDefects({ keyword, standard, year, category }), [keyword, standard, year, category]);

  function openSearch() {
    setKeyword((current) => current || initialKeyword);
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="grid max-h-[88vh] w-full max-w-4xl grid-rows-[auto_auto_1fr] overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-navy">CSIS Defect List</h3>
                <p className="text-sm text-slate-600">Search the standard, edition, category, or wording. Select a result to fill the code reference for this deficiency.</p>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => setOpen(false)} aria-label="Close CSIS Defect List">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-3 border-b bg-slate-50 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Keyword
                <input className="min-h-11 rounded-md border bg-white px-3" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="as-built, battery, transmitter..." autoFocus />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Standard
                <select className="min-h-11 rounded-md border bg-white px-3" value={standard} onChange={(event) => setStandard(event.target.value)}>
                  <option value="">All standards</option>
                  {csisStandards.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Edition
                <select className="min-h-11 rounded-md border bg-white px-3" value={year} onChange={(event) => setYear(event.target.value)}>
                  <option value="">All editions</option>
                  {csisYears.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Category
                <select className="min-h-11 rounded-md border bg-white px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="">All categories</option>
                  {csisCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="mb-3 text-sm font-medium text-slate-600">{results.length} result{results.length === 1 ? "" : "s"} shown</div>
              <div className="grid gap-3">
                {results.map((result, index) => (
                  <div key={`${result.standard}-${result.year}-${result.section}-${result.category}-${index}`} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>{result.standard || "Standard not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.year ? `${result.year} Edition` : "Edition not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.section ? `Section ${result.section}` : "Section not listed"}</span>
                      <span className="text-slate-300">|</span>
                      <span>{result.category || "No category"}</span>
                    </div>
                    <p className="text-sm leading-6 text-slate-700">{result.defect}</p>
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
