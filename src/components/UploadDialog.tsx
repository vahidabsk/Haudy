import { ChangeEvent, useState } from "react";
import { parseCertificateText } from "../lib/certificate-parser";
import { extractDocxText } from "../lib/docx-extract";
import { extractPdfText } from "../lib/pdf-extract";
import { ParsedCertificate } from "../lib/types";

export function UploadDialog({ onParsed }: { onParsed: (certificate: ParsedCertificate) => void }) {
  const [draft, setDraft] = useState<ParsedCertificate | null>(null);
  const [message, setMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = file.name.toLowerCase().endsWith(".docx") ? await extractDocxText(file) : await extractPdfText(file);
    const parsed = parseCertificateText(text, file.name);
    setDraft(parsed);
    setMessage(text.trim() ? "" : "No fields automatically detected. Fill manually before confirming.");
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <label className="flex min-h-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-400 bg-slate-50 px-4 text-center font-semibold text-navy">
        Upload Certificate (.docx or .pdf)
        <input className="hidden" type="file" accept=".docx,.pdf" onChange={upload} />
      </label>
      {message ? <p className="mt-3 text-sm text-signal">{message}</p> : null}
      {draft ? (
        <div className="mt-4 grid gap-3">
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
          <button className="min-h-12 rounded-md bg-signal px-4 font-semibold text-white" onClick={() => onParsed(draft)}>
            Confirm and Create Audit
          </button>
        </div>
      ) : null}
    </div>
  );
}
