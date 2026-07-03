import { ChangeEvent, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { parseCertificateText } from "../lib/certificate-parser";
import { hasDesktopBridge, openCertificatePdfs } from "../lib/desktop-bridge";
import { extractDocxText } from "../lib/docx-extract";
import { ParsedCertificate } from "../lib/types";

export function UploadDialog({ onParsed, compact = false, compactLabel = "Upload PDF", fullLabel = "Upload Certificate PDF" }: { onParsed: (certificates: ParsedCertificate[]) => string | null | void | Promise<string | null | void>; compact?: boolean; compactLabel?: string; fullLabel?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const desktopPdfUpload = hasDesktopBridge();

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
      validateParsedCertificates(certificates);
      const nextMessage = await onParsed(certificates);
      setMessage(nextMessage === null ? "" : nextMessage || `${certificates.length} certificate${certificates.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "One of the files could not be read. Please upload DOCX certificate files only.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadDesktopPdfs() {
    setBusy(true);
    setMessage("");
    try {
      const files = await openCertificatePdfs();
      if (!files.length) return;
      const certificates = files.map((file) => parseCertificateText(file.text, file.fileName));
      validateParsedCertificates(certificates);
      const nextMessage = await onParsed(certificates);
      setMessage(nextMessage === null ? "" : nextMessage || `${certificates.length} certificate${certificates.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "One of the PDF certificates could not be read.");
    } finally {
      setBusy(false);
    }
  }

  const compactButton = desktopPdfUpload ? (
    <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-70" onClick={uploadDesktopPdfs} disabled={busy}>
      <UploadCloud size={16} />
      <span>{busy ? "Reading..." : compactLabel}</span>
    </button>
  ) : (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-100">
      <UploadCloud size={16} />
      <span>{busy ? "Reading..." : "Upload Certificate"}</span>
      <input className="hidden" type="file" accept=".docx" multiple onChange={upload} disabled={busy} />
    </label>
  );

  const fullButton = desktopPdfUpload ? (
    <button type="button" className="flex min-h-24 w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center font-semibold text-navy transition hover:border-sky-400 hover:bg-sky-50 disabled:cursor-wait disabled:opacity-70" onClick={uploadDesktopPdfs} disabled={busy}>
      <span className="grid h-11 w-11 place-items-center rounded-md bg-navy text-white"><UploadCloud size={23} /></span>
      <span>{busy ? "Reading PDF certificates..." : fullLabel}</span>
    </button>
  ) : (
    <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center font-semibold text-navy transition hover:border-sky-400 hover:bg-sky-50">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-navy text-white"><UploadCloud size={23} /></span>
      <span>{busy ? "Reading certificates..." : "Upload Certificate (.docx)"}</span>
      <input className="hidden" type="file" accept=".docx" multiple onChange={upload} disabled={busy} />
    </label>
  );

  return compact ? (
    <div className="flex flex-wrap items-center gap-2">
      {compactButton}
      {message ? (
        <span className={`text-sm font-semibold ${message.includes("uploaded") || message.includes("replaced") ? "text-emerald-700" : "text-red-700"}`}>{message}</span>
      ) : null}
    </div>
  ) : (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {fullButton}
      {message ? (
        <div className={`mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${message.includes("uploaded") || message.includes("replaced") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {message.includes("uploaded") || message.includes("replaced") ? <FileCheck2 size={18} /> : null}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}

function validateParsedCertificates(certificates: ParsedCertificate[]) {
  const unreadable = certificates.find((certificate) => {
    const detectedFields = [
      certificate.ascName,
      certificate.propertyName,
      certificate.certificateNumber,
      certificate.fileNo,
      certificate.standardReferenced,
    ].filter(Boolean).length;
    return detectedFields < 2;
  });
  if (unreadable) {
    throw new Error(`${unreadable.fileName} was read, but Haudy could not detect the certificate fields. Use the official text PDF, not a scanned copy.`);
  }
}
