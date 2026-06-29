import { ChangeEvent, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { parseCertificateText } from "../lib/certificate-parser";
import { extractDocxText } from "../lib/docx-extract";
import { ParsedCertificate } from "../lib/types";

export function UploadDialog({ onParsed }: { onParsed: (certificate: ParsedCertificate) => void }) {
  const [draft, setDraft] = useState<ParsedCertificate | null>(null);
  const [message, setMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await extractDocxText(file);
    const parsed = parseCertificateText(text, file.name);
    setDraft(parsed);
    setMessage(text.trim() ? "" : "No fields automatically detected. Fill manually before confirming.");
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center font-semibold text-navy transition hover:border-sky-400 hover:bg-sky-50">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-navy text-white"><UploadCloud size={23} /></span>
        <span>Upload Certificate (.docx)</span>
        <input className="hidden" type="file" accept=".docx" onChange={upload} />
      </label>
      {message ? <p className="mt-3 text-sm text-signal">{message}</p> : null}
      {draft ? (
        <div className="mt-4 grid gap-3">
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <FileCheck2 size={18} /> Certificate parsed
          </div>
          {Object.entries(draft)
            .filter(([key]) => key !== "deviceCounts")
            .map(([key, value]) => (
              <label key={key} className="grid gap-1 text-sm">
                <span className="font-medium text-slate-600">{key}</span>
                <input
                  className="min-h-11 rounded-md border px-3"
                  value={String(value || "")}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                />
              </label>
            ))}
          <button className="min-h-12 rounded-md bg-signal px-4 font-semibold text-white hover:bg-red-700" onClick={() => onParsed(draft)}>
            Confirm and Create Audit
          </button>
        </div>
      ) : null}
    </div>
  );
}
