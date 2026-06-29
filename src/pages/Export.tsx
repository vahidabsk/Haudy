import { useParams } from "react-router-dom";
import { useAudits } from "../hooks/use-audits";
import { auditToCsv } from "../lib/export-csv";

const statusExport: Record<string, string> = { OK: "OK", VAR: "VAR", NA: "N/A", NR: "N/R", "": "" };

export function ExportPage({ auditorName }: { auditorName: string }) {
  const { auditId } = useParams();
  const store = useAudits(auditorName);
  const audit = store.audits.find((item) => item.id === auditId);
  if (!audit) return <main className="p-6">Audit not found.</main>;
  const currentAudit = audit;

  function csv() {
    const blob = new Blob([auditToCsv(currentAudit)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentAudit.certificateNumber || currentAudit.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="no-print mb-4 flex justify-end gap-2">
        <button className="min-h-11 rounded-md border px-4" onClick={csv}>Download CSV</button>
        <button className="min-h-11 rounded-md bg-navy px-4 font-semibold text-white" onClick={() => window.print()}>Print PDF</button>
      </div>
      <section className="print-page rounded-lg border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-navy">01-CA-F0851 Fire Alarm System Audit Field Notes</h1>
        <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <div><dt>ASC</dt><dd className="font-semibold">{audit.ascName}</dd></div>
          <div><dt>Certificate #</dt><dd className="font-semibold">{audit.certificateNumber}</dd></div>
          <div><dt>Protected Property</dt><dd className="font-semibold">{audit.protectedProperty}</dd></div>
          <div><dt>Auditor</dt><dd className="font-semibold">{audit.auditorName}</dd></div>
        </dl>
        <ExportRows title="Documentation" rows={audit.documentation.map((row) => [row.element, statusExport[row.status], row.notes])} />
        <ExportRows title="Installation" rows={audit.installation.map((row) => [row.element, statusExport[row.status], row.notes])} />
        <ExportRows title="Device Testing" rows={audit.deviceTests.map((row) => [row.deviceType || row.location, statusExport[row.result], row.notes])} />
      </section>
    </main>
  );
}

function ExportRows({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="mt-6">
      <h2 className="border-b pb-1 font-semibold text-navy">{title}</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border p-2 align-top">{cell}</td>)}</tr>)}</tbody>
      </table>
    </section>
  );
}
