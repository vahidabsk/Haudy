import { X } from "lucide-react";
import { ReactNode } from "react";

export function OperatingHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 px-3 py-4">
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Haudy Operating Help</p>
            <h2 className="text-2xl font-bold text-navy">Auditor Quick Handbook</h2>
            <p className="mt-1 text-sm text-slate-600">Use this guide while working in Haudy. It follows the normal audit flow from upload to final report.</p>
          </div>
          <button type="button" className="grid min-h-10 min-w-10 place-items-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50" onClick={onClose} aria-label="Close help">
            <X size={20} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <div className="grid gap-4 text-sm leading-6 text-slate-700">
            <HelpSection title="1. Start Here">
              <p>Haudy is used to manage fire alarm certificate audits. The normal order is: import the audit tracker, choose the Haudy Database location, add certificate PDFs from the correct ASC card, create the confirmation letter, complete field notes, prepare the report, then save the final documents.</p>
              <HelpList items={["Use readable PDF certificate files for upload in the Windows desktop app.", "Save before leaving field notes, confirmation, or report pages.", "Use the iHaudy export/import tools when field notes need to move between the desktop and iPad field app.", "Do not delete a property unless you are ready to remove its saved audit work."]} />
            </HelpSection>

            <HelpSection title="2. Home Screen">
              <p>The home screen shows Alarm Service Companies as ASC cards. Each card groups related certificates and properties under that company branch.</p>
              <HelpList items={["Import Audit Tracker creates the ASC assignment cards for the signed-in auditor.", "Choose Haudy Database tells the desktop app where to create the local project folders.", "Add certificates from the matching ASC card so Haudy can connect each certificate to the correct company.", "Use the home tabs to follow Pool of Jobs, Scheduled, Report Due, Report Created, Waiting for Clearance, and Done work."]} />
            </HelpSection>

            <HelpSection title="3. ASC Cards">
              <p>Each ASC card shows the company name, city/state, certificate count, POC, SCN, PSN, and document status.</p>
              <HelpList items={["If POC, SCN, or PSN is missing, use Add Info or Edit Info.", "Create Confirmation opens the confirmation setup for that ASC.", "Create Report opens the report writing section for that ASC.", "Open the ASC to see the property cards."]} />
            </HelpSection>

            <HelpSection title="4. Uploading Certificates">
              <p>Upload one or multiple PDF certificates in the same session. Haudy extracts the ASC, property, certificate number, file number, category, standard, and other available details.</p>
              <HelpList items={["If Haudy detects a duplicate certificate/property, review the warning carefully.", "Replacing a duplicate may remove existing audit notes for that property.", "If city or state is not detected, confirm the certificate text is readable and not image-only."]} />
            </HelpSection>

            <HelpSection title="5. Properties">
              <p>Inside an ASC, properties are grouped by category such as UUFX or UUJS. Each property card can be opened for field notes, export, or deletion.</p>
              <HelpList items={["The property card shows property name, address, file number, and standard.", "Use Edit Field Note to complete the audit notes.", "Use Export/Print Field Note after the field note is saved.", "Deleting a property clears that property from Haudy."]} />
            </HelpSection>

            <HelpSection title="6. Saving Work">
              <p>Haudy uses one consistent save behavior. Changes stay temporary until you press Save.</p>
              <HelpList items={["Field Notes: use Save Field Note.", "Report: use Save Report Draft.", "Confirmation: use Save Confirmation.", "If you try to leave with unsaved changes, Haudy asks you to Cancel, Discard Changes, or Save.", "Saved means the current page has been stored on this device. Unsaved changes means edits are still temporary."]} />
            </HelpSection>

            <HelpSection title="7. Field Notes">
              <p>Field notes are organized into four tabs: Signal Processing, Documentation, Installation, and Device Test.</p>
              <HelpList items={["Choose the Field audit date at the top of the page.", "Signal Processing is disabled when the system is local.", "If a review section is marked No, Haudy treats it as a variation and opens a general note area.", "Use dictation where available, or type manually.", "Save Field Note before returning to properties."]} />
            </HelpSection>

            <HelpSection title="8. Signal Processing">
              <p>Use this section to record whether signal processing was reviewed, the review period, auto test status, and individual signal events.</p>
              <HelpList items={["For local systems, signal processing does not apply.", "If signal history was not provided, mark Signal processing reviewed as No and explain in the note.", "Each signal row can be marked Signal handled correctly or Variation noted.", "Signal event time uses a time picker."]} />
            </HelpSection>

            <HelpSection title="9. Documentation">
              <p>Use Documentation Review to evaluate required records such as as-builts, battery calculations, IAT, ROC, contracts, service records, and owner manuals.</p>
              <HelpList items={["Use In Conformance when acceptable.", "Use Variations Noted when a deficiency exists.", "Use Not Applicable or Not Reviewed only when appropriate.", "Variation notes become available for report writing."]} />
            </HelpSection>

            <HelpSection title="10. Installation">
              <p>Use Installation Review for certificate display, certificate match, listed equipment, transmitter, wiring, detectors, waterflow, sprinkler supervisory, and other installation items.</p>
              <HelpList items={["Photo capture is available for installation deficiencies.", "Captured deficiency photos can appear after the report content.", "If installation was not reviewed, mark the review question No and explain why in the general note."]} />
            </HelpSection>

            <HelpSection title="11. Device Test">
              <p>Use Device Test to document field-tested devices, signal type, trip time, received time, result, and notes.</p>
              <HelpList items={["Alarm, supervisory, and trouble are mutually exclusive.", "If the system is local, received time is disabled and exports as N/A where applicable.", "Device notes are placed in the device testing additional comments area on the field note output.", "If devices were not tested in the field, mark the section No and explain why."]} />
            </HelpSection>

            <HelpSection title="12. Waterflow Timer">
              <p>For Waterflow switch, choose manual entry or automatic entry.</p>
              <HelpList items={["Manual entry lets the auditor enter trip and received times with seconds.", "Automatic entry stamps the trip time when Flow Water is pressed.", "Press Alarm Signal Received when the alarm is received.", "If received under 90 seconds, Haudy marks the result in conformance.", "If more than 90 seconds, Haudy creates a variation note.", "If no signal is received, press Signal Has Not Been Received after waiting; Haudy stops the timer and writes a failure note.", "Use Reset Test to clear the waterflow timer."]} />
            </HelpSection>

            <HelpSection title="13. Confirmation Letter">
              <p>Create the confirmation from the ASC card. Haudy uses POC, SCN, PSN, audit dates, optional start time, optional meeting location, conversation date, and letter date.</p>
              <HelpList items={["Audit start/end dates become available as field audit dates in field notes.", "The optional start time and meeting location appear in the confirmation wording.", "Use Save Confirmation to store the letter settings and save to the selected desktop storage folder when available.", "In the Windows desktop app, use Save as PDF to choose a location and write the PDF file directly."]} />
            </HelpSection>

            <HelpSection title="14. Report Writing">
              <p>The report section has ASC-level Service Center Comments and property-level comments for Signal Processing, Documentation, and Installation.</p>
              <HelpList items={["Property cards show deficiencies noted and deficiencies needing attention.", "Each deficiency needs Finding, Required Action, and Code Reference unless the reference field is marked not used.", "Completed report wording changes to a light green status.", "Use the section Done toggle after the section is complete.", "Use Save Report Draft before leaving."]} />
            </HelpSection>

            <HelpSection title="15. Report Help Tools">
              <p>Use Past Reports beside a deficiency to help select code references and report wording.</p>
              <HelpList items={["Past Reports can fill Finding, Required Action, Reference, or All fields.", "Keyword search is intended for finding-related wording.", "Auditors can still manually type the final wording.", "New completed Haudy reports add their final wording back into Past Reports automatically."]} />
            </HelpSection>

            <HelpSection title="16. iHaudy Field Transfer">
              <p>Use iHaudy transfer when field notes need to move between Haudy Suite on the desktop and iHaudy on the iPad.</p>
              <HelpList items={["Export Field Notes for iHaudy from the ASC property page before field work.", "Import Field Notes from iHaudy after the field audit is complete.", "Captured installation photos are carried inside the iHaudy transfer file.", "Keep transfer files secure because they may contain audit information."]} />
            </HelpSection>

            <HelpSection title="17. Offline Use">
              <p>Haudy can work offline after it has been opened and cached on a device. Offline behavior depends on the browser and device settings.</p>
              <HelpList items={["Open Haudy while online before going offline.", "Confirm the app shows offline ready.", "Do not clear browser cache or site data.", "Private browsing is not recommended for audit work."]} />
            </HelpSection>

            <HelpSection title="18. Patches">
              <p>Use Patch in the top bar when a newer Haudy desktop installer is available.</p>
              <HelpList items={["Check Latest Patch stays inside Haudy and checks whether a desktop patch is available.", "Install Patch starts the Haudy patch flow from inside the app.", "Save open work before installing a desktop patch.", "Patch downloads require internet access."]} />
            </HelpSection>

            <HelpSection title="19. Common Problems">
              <HelpList items={["Upload did not read the certificate: confirm it is a PDF file with selectable/readable text, not a scanned image.", "Save did not keep changes: confirm the status changes to Saved before leaving.", "Import failed: try the no-photo export file or confirm the file is a Haudy export file.", "Storage folder did not save: choose the Haudy Database location again from the home screen.", "Offline did not work: open Haudy online first and confirm offline ready."]} />
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
