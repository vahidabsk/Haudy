# Haudy Audit Suite User Operation Manual

Version: 2026-07-02

## 1. Purpose

Haudy Audit Suite is a browser-based audit workspace for fire alarm certificate audits. It helps auditors:

- Upload UL certificate DOCX files.
- Organize certificates by Alarm Service Company (ASC), city, state, and property.
- Complete field notes.
- Create confirmation letters.
- Prepare audit reports.
- Save/export Haudy data for backup or transfer to another device.

Haudy is designed for tablet and laptop use during audits. It stores work on the device unless exported or saved to a selected local folder.

## 2. Important Rules Before Use

- Upload certificate files in DOCX format.
- Use the Save button before leaving any working page.
- If Haudy shows an unsaved changes warning, choose Save, Discard Changes, or Cancel.
- Do not delete a property unless you are ready to remove that property's field notes and report content from Haudy.
- Export Haudy data regularly if moving between computers or tablets.
- Photos can make data files large. Use Export With Photos only when needed.

## 3. Opening Haudy

Haudy may be opened in one of these ways:

- Online app hosted on Render.
- Local portable app folder.
- iPad/tablet browser if the file or site has been opened correctly.

If using the hosted app, open the Haudy web address provided by your team.

## 4. First-Time Auditor Profile

When Haudy is first used, it asks for auditor profile information. This profile is used in report and confirmation signatures.

Typical information includes:

- Auditor name
- Title
- Department
- Phone
- Email

To update the profile later, use Edit Profile in the top bar.

## 5. Home Screen Overview

The home screen shows ASC cards. Each card represents one alarm service company branch.

Each ASC card can show:

- ASC name
- City and state
- Number of certificates/properties
- POC, SCN, and PSN information
- Confirmation status
- Report status
- Buttons to open properties, create/view confirmation, create/view report, or edit ASC information

The top bar includes compact controls for:

- Upload Certificate
- Choose Storage
- Export Data - No Photos
- Export Data - With Photos
- Import Data
- Offline status
- ASC and certificate counts

## 6. Uploading Certificates

1. Select Upload Certificate.
2. Choose one or multiple DOCX certificate files.
3. Haudy extracts the certificate information.
4. Haudy groups the certificates by ASC.
5. Stay on the home screen after upload.

If the same certificate/property already exists, Haudy shows a duplicate warning. Replacing a duplicate can remove existing audit notes for that property.

## 7. ASC Information

Before creating a confirmation letter or report, Haudy needs ASC-level information:

- POC name
- SCN number
- PSN number

If this information is missing, the ASC card shows a message asking you to add it.

Once entered, this information is saved and reused for confirmation letters and reports.

## 8. Property Screen

Opening an ASC shows its related properties. Properties are grouped by certificate category, such as UUFX or UUJS.

Each property card shows:

- Property name
- Address
- File number
- Standard/edition
- Status and action buttons

Use the property card to:

- Edit field notes
- Export/print field notes
- Delete the property

## 9. Field Notes Page

The field notes page is organized by tabs:

- Signal Processing
- Documentation
- Installation
- Device Test

At the top, Haudy shows a compact certificate summary with important information such as:

- Property name and address
- Standard/edition
- Monitoring station
- Control unit make/model
- Transmitter make/model, when available

The Field audit date dropdown uses the audit dates selected in the confirmation letter.

## 10. Saving Field Notes

Field note edits are temporary until saved.

Use Save Field Note to store changes.

If you try to leave with unsaved changes, Haudy asks:

- Cancel
- Discard Changes
- Save

Choose Save to keep your work before leaving.

## 11. Signal Processing Review

The Signal Processing tab includes:

- Is this system local?
- Signal processing reviewed?
- Signal review period
- Auto test status
- Signal review rows
- Signal notes with dictation

If the system is local, signal processing is not applicable and the related signal fields are disabled.

If Signal processing reviewed is No, Haudy treats it as a variation, disables the signal rows, and leaves a general variation note area open for explanation.

Signal rows allow:

- Signal type
- Date
- Time
- Description/note
- Signal handled correctly
- Variation noted

## 12. Documentation Review

The Documentation tab includes standard documentation items such as:

- Record Drawings (As Builts)
- Battery Calculations
- Initial Acceptance Test (IAT)
- Reacceptance Test
- Record of Completion (ROC)
- Periodic Testing Records
- Sensitivity Testing
- Contracts
- Service Records
- Owners Manuals

Each row can be marked:

- In Conformance
- Variations Noted
- Not Applicable
- Not Reviewed

When a row is marked as a variation, notes entered there can become report content.

## 13. Installation Review

The Installation tab includes:

- Installation reviewed?
- Matches certificate declarations?
- Certificate displayed?
- Installation review rows
- Photo capture for deficiencies

Use photo capture for installation deficiencies when needed. Photos can later appear in the report appendix after the report content.

If Installation reviewed is No, Haudy disables the installation rows and opens a general variation note.

## 14. Device Test

The Device Test tab includes:

- Were devices tested in the field?
- Local system status
- Device type
- Location
- Device ID
- Functional
- Alarm
- Supervisory
- Trouble
- Trip time
- Time received
- Result
- Notes

Device types include:

- Backup battery
- Communication fail
- Ground fault
- AC fail
- NAC disable
- NAC trouble
- Smoke detector
- Heat detector
- Carbon monoxide detector
- Duct-type smoke detector
- Tamper switch
- Control valve
- Waterflow switch
- PIV
- OS & Y
- Manual pull station

Alarm, supervisory, and trouble cannot be selected at the same time.

If the system is local, received times are disabled and exported as N/A for completed rows.

## 15. Waterflow Automatic Timer

When Waterflow switch is selected, Haudy can use manual or automatic entry.

Manual entry works like other device rows, but times include seconds.

Automatic entry provides a timer workflow:

1. Press Flow Water.
2. Haudy stamps the trip time.
3. Press Alarm Signal Received when the signal arrives.
4. Haudy stamps the received time and calculates elapsed seconds.
5. If received in less than 90 seconds, the result is in conformance.
6. If more than 90 seconds, Haudy creates a variation note.
7. If the signal is not received, press Signal Has Not Been Received. Haudy stops the timer and writes the note.
8. Use Reset Test to clear the timer and start over.

## 16. Dictation

Dictation buttons are available in many note fields.

Use Start Dictation to begin voice input and stop it when finished. If dictation is not supported by the browser, type the note manually.

Note: iOS Safari may not support browser dictation in the same way as desktop browsers.

## 17. Field Note Export

Field note export creates a printable field note result based on the entered audit information.

Before printing/exporting:

- Save the field note.
- Review alignment.
- Confirm the field audit date.
- Confirm device test comments appear in the correct additional comments area.

## 18. Confirmation Letter

From the ASC card, choose Create Confirmation or View / Edit Confirmation.

The confirmation setup includes:

- Audit start date
- Audit end date
- Optional audit start time
- Optional audit meeting location
- Schedule conversation date
- Letter date

The letter uses:

- Full POC name after Dear
- ASC address
- File references
- SCN
- PSN
- Selected sites grouped by category

Use Save Confirmation to save the confirmation draft and save the document to the selected Haudy Storage folder when available.

## 19. Report Section

From the ASC card, choose Create Report or View / Edit Report.

The report section includes:

- ASC-level Service Center Comments
- Property-level report writing
- Property tabs
- Section tabs for Signal Processing, Documentation, and Installation

Each property card shows:

- Number of deficiencies noted
- Number needing attention
- Status color

Each report item allows entry of:

- Finding
- Required Action
- Code Reference standard
- Edition
- Section/paragraph number

Items turn light green when complete.

## 20. Report Help Tools

Haudy includes report writing help tools:

- CSIS Defect List
- Report DB

Use these tools beside a deficiency to search by:

- Standard
- Edition
- Category
- Keyword

The Report DB can fill:

- Finding only
- Required Action only
- Reference code/edition only
- All fields

You can also enter standard, edition, and section manually.

If a standard, edition, or section is not used for an item, mark it as not used so the item can be completed.

## 21. Report Saving

Report edits are temporary until saved.

Use Save Report Draft.

If you try to leave with unsaved changes, Haudy asks:

- Cancel
- Discard Changes
- Save

Choose Save to keep your report draft before leaving.

## 22. Storage Folder

Use Choose Storage to select where Haudy should store generated files.

Haudy creates a folder structure similar to:

- Haudy Storage
- Year
- ASC name, city, state, PSN
- Confirmation
- Report
- Field Notes

Saved output files are placed in the matching folder when browser folder access is available.

## 23. Exporting And Importing Haudy Data

Use export/import to move data between devices.

Export Data - No Photos:

- Smaller file.
- Best for most transfers.
- Does not include captured photos.

Export Data - With Photos:

- Larger file.
- Includes compressed photo data when available.

Import Data:

- Restores a Haudy data export file.
- Use this when moving work to another computer or tablet.

Keep exported data files secure because they may contain audit information.

## 24. Offline Use

Haudy can work offline after it has been loaded on a device and the browser has cached the app.

Before going offline:

- Open Haudy while online.
- Confirm the app loads.
- Confirm the device shows offline ready.
- Avoid clearing browser data.

Offline behavior depends on browser support and device settings.

## 25. Deleting Properties

Deleting a property removes that property's saved Haudy data from the device.

If the property is uploaded again later, it should start clean.

Use caution. Export Haudy data first if you may need the deleted work later.

## 26. Recommended Daily Workflow

1. Open Haudy.
2. Confirm auditor profile.
3. Upload certificate DOCX files.
4. Confirm ASC POC, SCN, and PSN.
5. Create confirmation letter and set audit dates.
6. Open each property.
7. Complete field notes.
8. Save field notes.
9. Create or update the report.
10. Complete report findings, required actions, and code references.
11. Save report draft.
12. Print or save PDF outputs.
13. Export Haudy data for backup.

## 27. Troubleshooting

If Save does not appear to work:

- Confirm the Saved status appears after pressing Save.
- Leave and reopen the page to verify the data.
- Do not close the browser before saving.

If upload does not extract correctly:

- Confirm the file is DOCX.
- Confirm the certificate text is readable.
- Try a different certificate file.

If import fails:

- Confirm the selected file is a Haudy data export.
- Try Export Data - No Photos if the file with photos is too large.
- Confirm the device has enough browser storage.

If offline mode does not work:

- Open Haudy online first.
- Confirm offline ready.
- Avoid private browsing mode.
- Do not clear browser cache.

If print alignment looks wrong:

- Use browser print preview.
- Use letter-size paper.
- Disable browser headers/footers if needed.
- Save as PDF from the browser print dialog.

