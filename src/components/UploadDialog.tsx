import { ChangeEvent, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { parseCertificateText } from "../lib/certificate-parser";
import { extractDocxText } from "../lib/docx-extract";
import { ParsedCertificate } from "../lib/types";

export function UploadDialog({ onParsed }: { onParsed: (certificates: ParsedCertificate[]) => string | void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setBusy(true);
    setMessage("");
    try {
      const certificates = await Promise.all(files.map(async (file) => {
        const text = await extractDocxText(file);
        return parseCertificateText(text, file.name);
      }));
      setMessage(onParsed(certificates) || `${certificates.length} certificate${certificates.length === 1 ? "" : "s"} uploaded.`);
    } catch {
      setMessage("One of the files could not be read. Please upload DOCX certificate files only.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center font-semibold text-navy transition hover:border-sky-400 hover:bg-sky-50">
        <span className="grid h-11 w-11 place-items-center rounded-md bg-navy text-white"><UploadCloud size={23} /></span>
        <span>{busy ? "Reading certificates..." : "Upload Certificate (.docx)"}</span>
        <input className="hidden" type="file" accept=".docx" multiple onChange={upload} disabled={busy} />
      </label>
      {message ? (
        <div className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${message.includes("uploaded") || message.includes("replaced") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {message.includes("uploaded") || message.includes("replaced") ? <FileCheck2 size={18} /> : null}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
