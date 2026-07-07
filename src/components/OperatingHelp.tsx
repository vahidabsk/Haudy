import { X } from "lucide-react";
import { ReactNode } from "react";

export function OperatingHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-3 py-4">
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Haudy Operating Help</p>
            <h2 className="text-2xl font-bold text-navy">Current Haudy Suite Handbook</h2>
            <p className="mt-1 text-sm text-slate-600">A practical guide to the tools available now in Haudy Suite and iHaudy.</p>
          </div>
          <button type="button" className="grid min-h-10 min-w-10 place-items-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50" onClick={onClose} aria-label="Close help">
            <X size={20} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <div className="grid gap-4 text-sm leading-6 text-slate-700">
            <HelpSection title="1. What Haudy Suite Does">
              <p>Haudy Suite is the desktop audit workspace for fire alarm and security certificate audits. Use it to import assignments, upload certificate PDFs, create confirmation letters, prepare field notes, write reports, save PDFs, and manage audit status.</p>
              <HelpList items={["Use the Windows desktop app for the full workflow.", "Use iHaudy on iPad or iPhone for field-note work only.", "Choose the Haudy Database folder once so Haudy can save documents into the correct local folders.", "Save work before leaving confirmation, field-note, or report pages."]} />
            </HelpSection>

            <HelpSection title="2. Home Screen">
              <p>The home screen shows ASC cards sorted by audit status. Use the status tabs to move between Pool of Jobs, Scheduled, Report Due, Report Created, Waiting for Clearance, and Done.</p>
              <HelpList items={["Import Audit Tracker creates ASC assignment cards for the signed-in auditor.", "The Pool of Jobs search finds ASCs by company name or PSN.", "Click Field Notes on an ASC card to open the related property cards.", "Use Confirmation and Report buttons from the ASC card.", "Use Delete ASC only when you intend to remove that ASC and its saved audit data."]} />
            </HelpSection>

            <HelpSection title="3. Dashboard">
              <p>The dashboard tracks the audit season from January 15 through December 15. A job is complete when the report has been sent to the customer.</p>
              <HelpList items={["Audit Days Assigned comes from the Audit Tracker audit-days column.", "Audit Days Complete counts those assigned audit days after the ASC report is sent.", "Company Count Assigned is the number of ASC cards assigned to the auditor.", "Company Count Completed is the number of ASC cards marked report sent.", "Total Audit Completion combines audit-day completion and company-count completion.", "Calendar blocks with scheduled ASCs are clickable and open the related ASC card."]} />
            </HelpSection>

            <HelpSection title="4. Certificates and Properties">
              <p>Add certificate PDFs from the correct ASC card. Haudy reads the certificate text and creates property cards under the ASC.</p>
              <HelpList items={["Haudy supports readable PDF certificates.", "If a certificate appears to belong to another ASC, Haudy blocks the upload and shows a warning.", "Property cards are grouped by category such as UUFX, UUJS, CVSG, or CRZH.", "Each property card can be opened for field notes, exported, or deleted.", "CRZH certificates use a separate CRZH report from the ASC card."]} />
            </HelpSection>

            <HelpSection title="5. Confirmation Letters">
              <p>Create or edit confirmation letters from the ASC card. Haudy uses the ASC profile, POC, SCN, PSN, audit dates, conversation date, letter date, optional start time, and optional meeting location.</p>
              <HelpList items={["Save Confirmation stores the draft.", "Save as PDF writes the confirmation into the Haudy Database folder.", "Audit start and end dates become available as field audit dates in field notes.", "The saved confirmation can be viewed and edited from the ASC card."]} />
            </HelpSection>

            <HelpSection title="6. Field Notes in Haudy Suite">
              <p>Field notes are completed by property. The available tabs depend on certificate category.</p>
              <HelpList items={["UUFX and UUJS use the fire field-note sections.", "CVSG uses the mercantile/security field-note sections.", "CRZH includes guard-service testing where required.", "Signal, documentation, installation, device test, line security, waterflow, and guard-service sections appear only where applicable.", "Installation photos are captured with the related deficiency and can export with the field note and report.", "Save Field Note before returning to the property cards."]} />
            </HelpSection>

            <HelpSection title="7. iHaudy Field App">
              <p>iHaudy is the portable field-note app for iPad and iPhone. It is designed for field data collection, photos, dictation, and timed tests.</p>
              <HelpList items={["Export Field Notes for iHaudy from Haudy Suite before field work.", "Import the Haudy Suite field-note file into iHaudy.", "Complete field notes, capture photos, use dictation, and run timed tests in iHaudy.", "Export from iHaudy after the field audit.", "Import the finished iHaudy file back into Haudy Suite.", "Use Clear This iPad only after confirming the field-note data has been exported."]} />
            </HelpSection>

            <HelpSection title="8. Timed Tests">
              <p>Timed tests help record measured field performance without hand-calculating elapsed time.</p>
              <HelpList items={["Waterflow supports manual time entry and automatic stopwatch mode.", "Automatic waterflow records trip time, received time, elapsed seconds, pass/fail status, and notes.", "Line security appears when the certificate declares Standard or Encrypted line security.", "CRZH guard-service testing includes manual and automatic timing where applicable.", "Reset Test clears the timed test back to a blank state."]} />
            </HelpSection>

            <HelpSection title="9. Report Writing">
              <p>Reports are created from the ASC card. Service Center Comments belong to the ASC. Protected Property Comments are organized by property and section.</p>
              <HelpList items={["Regular reports can include UUFX, UUJS, and CVSG properties together.", "CRZH has a separate CRZH report.", "Each deficiency needs Finding, Required Action, and Code Reference unless a reference field is marked not used.", "Completed deficiency cards turn light green.", "Use section Done toggles to track completion.", "Save Report Draft before leaving the report page.", "Save as PDF writes the final report into the Haudy Database folder."]} />
            </HelpSection>

            <HelpSection title="10. Past Reports">
              <p>Past Reports helps auditors reuse approved wording and reference information while writing reports.</p>
              <HelpList items={["Open Past Reports beside a deficiency.", "Search by keyword, standard, edition, or section.", "Use finding, required action, reference, or all fields from a result.", "Edit a result header when the standard, edition, or section needs correction.", "New completed Haudy reports can add final wording back into Past Reports while avoiding duplicates."]} />
            </HelpSection>

            <HelpSection title="11. Audit Status">
              <p>Haudy moves ASC cards through status tabs as work progresses.</p>
              <HelpList items={["Pool of Jobs means no scheduled audit date has been set.", "Scheduled means confirmation dates exist and the audit date is upcoming.", "Report Due starts after the audit date.", "Report Created appears after a report PDF is created.", "Waiting for Clearance starts when the report is marked sent to the customer.", "Done means the report has been sent and deficiency response/clearance has been received where applicable."]} />
            </HelpSection>

            <HelpSection title="12. Storage and Files">
              <p>The Haudy Database folder is the main local storage location for generated audit files.</p>
              <HelpList items={["Choose Haudy Database from the home screen.", "Haudy creates ASC, property, confirmation, report, field-note, and iHaudy transfer folders automatically.", "Save as PDF opens a save dialog in the correct related folder.", "iHaudy transfer files are stored under the ASC iHaudy files folder.", "Keep exported data files secure because they may contain audit notes and photos."]} />
            </HelpSection>

            <HelpSection title="13. Patches">
              <p>The Patch button checks for Haudy desktop updates from inside the app.</p>
              <HelpList items={["Use Check Latest Patch to see whether an update is available.", "Use Install Patch only after saving open work.", "Patch installation requires internet access.", "After a patch installs, restart Haudy if prompted."]} />
            </HelpSection>

            <HelpSection title="14. Common Problems">
              <HelpList items={["Certificate did not read: confirm the PDF contains selectable text and is not a scanned image.", "Audit days show zero: re-import the Audit Tracker so Haudy can read the audit-days column.", "Photos missing after iHaudy import: confirm the latest iHaudy version was used for export and import the finished iHaudy file again.", "Save button is disabled: required fields may be missing, or there may be no unsaved changes.", "Offline use failed: open the app online first and let it finish loading before going offline."]} />
            </HelpSection>
          </div>
        </div>
      </section>
    </div>
  );
}

function HelpSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-base font-bold text-navy">{title}</h3>
      <div className="mt-2 grid gap-2">{children}</div>
    </section>
  );
}

function HelpList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}
