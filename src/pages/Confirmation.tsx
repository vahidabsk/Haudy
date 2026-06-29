import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAudits } from "../hooks/use-audits";
import { groupByAsc } from "../lib/asc-groups";
import { Audit, ParsedCertificate } from "../lib/types";

export function ConfirmationPage({ auditorName }: { auditorName: string }) {
  const { ascKey = "" } = useParams();
  const [searchParams] = useSearchParams();
  const store = useAudits(auditorName);
  const group = groupByAsc(store.audits).find((item) => item.key === decodeURIComponent(ascKey));
  const pocName = searchParams.get("poc") || "";
  const startDate = searchParams.get("start") || searchParams.get("date") || "";
  const endDate = searchParams.get("end") || startDate;
  const scn = searchParams.get("scn") || "";
  const psn = searchParams.get("psn") || "";

  if (!group) return <main className="p-6">ASC not found.</main>;

  const today = new Date();
  const ascAddress = group.audits.map(primaryCertificate).find((certificate) => certificate?.ascAddress)?.ascAddress || "";
  const ascAddressLines = formatAscAddressLines(ascAddress || group.location);
  const fileReferences = referenceFiles(group.audits);
  const selectedSites = groupByCategory(group.audits);
  const scheduledYear = startDate ? dateParts(startDate).year : today.getFullYear().toString();

  return (
    <main className="mx-auto max-w-[8.5in] px-4 py-6 print:m-0 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex justify-between gap-2">
        <Link className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to={`/asc/${encodeURIComponent(group.key)}`}>
          <ArrowLeft size={16} /> Back to Properties
        </Link>
        <button className="min-h-10 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100" onClick={() => window.print()}>Print PDF</button>
      </div>

      <section className="confirmation-page print-page bg-white text-black shadow-sm print:shadow-none">
        <ConfirmationHeader />
        <div className="confirmation-letter">
          <p>{formatLongDate(today)}</p>
          <p>
            {pocName}<br />
            {group.ascName}<br />
            {ascAddressLines.map((line) => <span key={line}>{line}<br /></span>)}
          </p>
          <p>Our Reference: FILE(s): {fileReferences || "Not listed"}<span className="confirmation-reference-gap">SCN: {scn || ""}</span><span className="confirmation-reference-gap">PSN: {psn || ""}</span></p>
          <p>Subject: Annual Audit Confirmation</p>
          <p>Dear {firstName(pocName)} ,</p>
          <p>This is to confirm our conversation on {formatLongDate(today)} during which we scheduled the annual audit of the referenced file for {formatDateRange(startDate, endDate)}.</p>
          <p>As noted in the Service Agreement that your organization executed with UL, your continued Listing is contingent upon your continued ability to deliver Code/Standard compliant service. Your organization was granted a Listing based on a favorable assessment of its ability to fulfill this obligation. Our audit this year is intended to verify this ability.</p>
          <p>We will review compliance to the applicable standards for the category or categories being audited. This could include but is not limited to certificated field installations, documentation, records, signal handling, operational procedures, response procedures, and/or monitoring facilities.</p>
          <p>Our objective is to verify that your organization is still capable of delivering Code/Standard compliant service. Our desire is to make the process as smooth as possible. Our experience is that preparation is key to success on both counts.</p>
          <p className="confirmation-sincerely">Sincerely,</p>
          <p>
            <b>{auditorName || "Vahid Abbasi"}</b><br />
            Alarm System Auditor<br />
            Fire and Security Service Solutions<br />
            (510) 358-6443<br />
            vahid.abbasikoohenjani@ul.com
          </p>
        </div>
        <ConfirmationFooter />
      </section>

      <section className="confirmation-page confirmation-sites-page print-page bg-white text-black shadow-sm print:shadow-none">
        <h1>SELECTED SITES FOR UL AUDIT -{scheduledYear}</h1>
        {selectedSites.map((section) => (
          <div key={section.category} className="confirmation-site-section">
            <h2>{section.category}</h2>
            <table>
              <thead>
                <tr>
                  <th>Certificate Number</th>
                  <th>Protected Property</th>
                  <th>Protected Property Address</th>
                </tr>
              </thead>
              <tbody>
                {section.audits.map((audit) => (
                  <tr key={audit.id}>
                    <td>{audit.certificateNumber}</td>
                    <td>{audit.protectedProperty}</td>
                    <td>{formatSiteAddress(primaryCertificate(audit)?.propertyAddress || "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </main>
  );
}

function ConfirmationHeader() {
  return (
    <header className="confirmation-header">
      <img className="confirmation-logo" src="/confirmation-logo.png" alt="UL Solutions" />
      <img className="confirmation-safety" src="/confirmation-safety.png" alt="Safety. Science. Transformation." />
    </header>
  );
}

function ConfirmationFooter() {
  return (
    <footer className="confirmation-footer">
      <div>
        UL Solutions<br />
        333 Pfingsten Road<br />
        Northbrook, IL 600623<br />
        +1.887.854.3577<br />
        <b>UL.com/Solution</b>
      </div>
      <div>UL LLC &copy; 2022. All rights reserved.</div>
    </footer>
  );
}

function primaryCertificate(audit: Audit): ParsedCertificate | undefined {
  return audit.certificates[audit.primaryCertificateIndex] || audit.certificates[0];
}

function referenceFiles(audits: Audit[]) {
  const references = new Set<string>();
  for (const audit of audits) {
    const certificate = primaryCertificate(audit);
    if (certificate?.fileNo) references.add(certificate.fileNo);
    if (certificate?.ccn) references.add(certificate.ccn);
  }
  return Array.from(references).join(", ");
}

function formatSiteAddress(address: string) {
  return address
    .replace(/\s+UNITED STATES$/i, "")
    .replace(/\bCA\b/g, "California")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAscAddressLines(address: string) {
  const normalized = address.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.*?),\s*([^,]+),\s*([A-Z]{2}|[A-Za-z]+)\s+([0-9-]+)(?:\s+(UNITED STATES|United States))?$/);
  if (!match) return normalized ? [normalized] : [];

  const street = match[1].trim();
  const city = match[2].trim().toUpperCase();
  const state = stateName(match[3].trim());
  const postalCode = match[4].trim();
  const country = match[5]?.toUpperCase() || "UNITED STATES";
  return [street, `${city}, ${state} ${postalCode} ${country}`];
}

function stateName(value: string) {
  const states: Record<string, string> = { CA: "California" };
  return states[value.toUpperCase()] || value;
}

function groupByCategory(audits: Audit[]) {
  const groups = new Map<string, Audit[]>();
  for (const audit of audits) {
    const certificate = primaryCertificate(audit);
    const category = certificate?.categoryCode || categoryFromText([certificate?.fileName, certificate?.certificateType, certificate?.coverageType, certificate?.areaCovered].filter(Boolean).join(" ")) || "SELECTED SITES";
    groups.set(category, [...(groups.get(category) || []), audit]);
  }
  return Array.from(groups, ([category, sectionAudits]) => ({ category, audits: sectionAudits }));
}

function categoryFromText(value: string) {
  return value.match(/\b(UUFX|UUJS|UUHX|UUFM)\b/i)?.[1]?.toUpperCase();
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function formatLongDate(value: string | Date) {
  const date = value instanceof Date ? value : dateParts(value).date;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string) {
  if (!start) return "";
  if (!end || start === end) return formatLongDate(start);

  const startDate = dateParts(start).date;
  const endDate = dateParts(end).date;
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const sameMonth = sameYear && startDate.getMonth() === endDate.getMonth();

  if (sameMonth) {
    const days = daysBetween(startDate, endDate);
    if (days.length > 1 && days.length <= 5) {
      const dayText = days.length === 2 ? `${days[0]} and ${days[1]}` : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
      return `${startDate.toLocaleDateString("en-US", { month: "long" })} ${dayText}, ${startDate.getFullYear()}`;
    }
    return `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} through ${endDate.toLocaleDateString("en-US", { day: "numeric", year: "numeric" })}`;
  }

  if (sameYear) {
    return `${startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} through ${endDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  }

  return `${formatLongDate(start)} through ${formatLongDate(end)}`;
}

function daysBetween(start: Date, end: Date) {
  const days: number[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(cursor.getDate());
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function dateParts(value: string) {
  const date = value ? new Date(`${value}T12:00:00`) : new Date();
  return { date, year: date.getFullYear().toString() };
}
