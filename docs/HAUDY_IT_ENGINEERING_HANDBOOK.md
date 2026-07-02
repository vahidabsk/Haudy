# Haudy Audit Suite IT And Engineering Handbook

Version: 2026-07-02

## 1. System Overview

Haudy Audit Suite is a frontend-only React/Vite application for fire alarm audit field notes, confirmation letters, and report generation. It is designed to run as a static site and stores operational data in the user's browser storage.

Current architecture:

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Browser localStorage
- Static deployment on Render
- No backend service
- No server-side database
- No authentication layer in the current version

Primary repository path on the local development machine:

```text
/Users/vahidabbasi/Documents/Project/haudy
```

## 2. Main Capabilities

The application supports:

- DOCX certificate intake and certificate data extraction.
- ASC grouping by name/city/state.
- Property-level field notes.
- Confirmation letter generation.
- Report drafting and print/PDF output.
- CSIS defect list search.
- Auditor report wording database search.
- Local folder save through supported browser APIs.
- Offline-ready service worker behavior.
- Haudy data export/import with optional photo inclusion.
- Portable static folder builds.

## 3. Repository Structure

Important folders and files:

```text
haudy/
  src/
    components/
    hooks/
    lib/
    pages/
  public/
  dist/
  docs/
  package.json
  vite.config.ts
  render.yaml
  README.md
```

Key source areas:

```text
src/pages/Dashboard.tsx       Home, ASC cards, upload, export/import, profile actions
src/pages/Audit.tsx           Field note editor
src/pages/Export.tsx          Field note print/export view
src/pages/Confirmation.tsx    Confirmation letter editor/output
src/pages/Report.tsx          Report editor/output
src/lib/audit-storage.ts      Audit creation, normalization, localStorage read/write
src/lib/certificate-parser.ts Certificate text parsing
src/lib/asc-documents.ts      ASC report/confirmation draft metadata
src/lib/asc-profile.ts        POC, SCN, PSN storage
src/lib/haudy-data-transfer.ts Export/import data package logic
src/lib/photo-store.ts        Photo localStorage helpers
src/register-service-worker.ts Offline readiness registration
```

## 4. Local Development

Install dependencies:

```bash
pnpm install
```

Run development server:

```bash
pnpm dev
```

Build production assets:

```bash
pnpm build
```

Preview production build:

```bash
pnpm preview
```

The current build script is:

```json
"build": "tsc && vite build"
```

## 5. Production Deployment

Haudy is deployed as a static site.

Render deployment expectations:

- Build command: `pnpm build` or equivalent
- Publish directory: `dist`
- Static site hosting
- SPA fallback should route unknown paths back to `index.html`

The app does not require a server process after build.

## 6. Render Chunk Warning

During build, Vite may show:

```text
Some chunks are larger than 500 kB after minification.
```

This is a performance warning, not a deployment failure.

The app currently bundles many features into the main JavaScript chunk, including report tools and embedded databases. Render can still deploy successfully.

Future optimization options:

- Lazy-load report page.
- Lazy-load confirmation page.
- Lazy-load CSIS defect list.
- Lazy-load auditor report database.
- Use route-level dynamic imports.
- Configure `build.rollupOptions.output.manualChunks`.

## 7. Browser Storage Model

Haudy stores data in browser localStorage. Important keys include:

```text
haudy.auditor
haudy.audits
haudy.ascProfiles
haudy.ascDocuments
haudy.photos.*
haudy.offlineReady
```

Storage implications:

- Data is per browser and per device.
- Clearing browser data removes Haudy data.
- Private/incognito modes are not reliable.
- localStorage is synchronous and has browser-specific size limits.
- Photos can consume storage quickly.

Recommended operational policy:

- Users should export Haudy data regularly.
- Large photo-heavy audits should use Export With Photos only when required.
- For cross-device work, transfer the exported Haudy data file and import it on the target device.

## 8. Data Export And Import

Export/import logic is in:

```text
src/lib/haudy-data-transfer.ts
```

Export types:

- Without photos
- With photos

Export naming includes:

- Data type
- Timestamp down to seconds

Import replaces/loads stored Haudy data. Engineers should treat exported files as sensitive because they can contain audit content, customer information, and photos.

## 9. Photo Handling

Photos are stored in localStorage through `src/lib/photo-store.ts`.

Operational constraints:

- Photos are compressed before storage where applicable.
- localStorage can still be exceeded.
- iPad/browser behavior varies.

Engineering recommendation:

- Move photos to IndexedDB in a future version.
- Keep only photo IDs in audit records.
- Store binary blobs separately.
- Consider image resize/compression before persistence.

## 10. Offline Behavior

Haudy registers a service worker and caches app assets for offline use.

Important notes:

- The app must be loaded once while online.
- Browser cache must not be cleared.
- Offline mode is browser-dependent.
- Local file/folder portable mode behaves differently from hosted PWA mode.

Files involved:

```text
src/register-service-worker.ts
public/sw.js or generated service worker asset
public/manifest.webmanifest
```

Recommended test:

1. Deploy current build.
2. Open app online.
3. Confirm offline ready status.
4. Disable network.
5. Reload app.
6. Confirm dashboard and stored audits load.

## 11. Portable Builds

Portable static builds are refreshed from `dist` into local folders:

```text
/Users/vahidabbasi/Documents/Project/Haudy-Portable-2026-06-29
/Users/vahidabbasi/Documents/Project/Haudy-iPad-Portable-2026-06-29
```

The iPad portable artifact inlines CSS/JS and selected images into one HTML file:

```text
Haudy-iPad-Portable-2026-06-29/Haudy.html
```

Portable ZIPs:

```text
Haudy-Portable-2026-06-29.zip
Haudy-iPad-Portable-2026-06-29.zip
```

Portable refresh should be run after production build when user-facing changes are made.

## 12. Save Workflow

Current save model:

- Field Notes: draft edits remain temporary until Save Field Note.
- Report: report wording and section status use a working draft until Save Report Draft.
- Confirmation: confirmation date/time/location edits remain temporary until Save Confirmation.

All three major workspaces show:

- Saved
- Unsaved changes

If a user attempts to leave with unsaved changes, Haudy shows a custom dialog:

- Cancel
- Discard Changes
- Save

Engineering considerations:

- The custom dialog handles in-app navigation.
- Browser reload/close may still require native `beforeunload` handling depending on page implementation.
- Keep the save workflow consistent across future pages.

## 13. Field Notes

Field note editor:

```text
src/pages/Audit.tsx
```

Field note export:

```text
src/pages/Export.tsx
```

Field note data lives in the `Audit` object:

- `signalLog`
- `documentation`
- `installation`
- `deviceTests`
- section review fields
- certificate references
- report wording fields

When modifying field note data structures:

- Update `src/lib/types.ts`.
- Update normalizers in `src/lib/audit-storage.ts`.
- Update export/report consumers.
- Preserve backward compatibility for older localStorage records.

## 14. Report System

Report page:

```text
src/pages/Report.tsx
```

Report items are collected from:

- Signal variations
- Documentation variations
- Installation variations
- Device test variations
- Section-level review not completed notes
- Extra findings added manually by auditor
- Service center comments

Each report item can contain:

- Finding
- Required Action
- Code Standard
- Code Edition
- Code Section

Reference completion uses:

```text
src/lib/report-reference.ts
```

Report helper databases:

```text
src/lib/csis-defects.ts or related generated data
src/lib/auditor-report-findings.ts
src/components/CsisDefectList.tsx
src/components/AuditorReportDatabase.tsx
```

## 15. Confirmation System

Confirmation page:

```text
src/pages/Confirmation.tsx
```

Confirmation state is stored in ASC document metadata:

- POC name
- SCN
- PSN
- Audit start date
- Audit end date
- Optional start time
- Optional meeting location
- Schedule conversation date
- Letter date
- Saved status

Confirmation output includes:

- Letter page
- Selected sites page
- ASC address
- File references
- Category grouping

## 16. Certificate Parsing

Certificate parser:

```text
src/lib/certificate-parser.ts
```

Parser extracts:

- Certificate number
- Certificate type/category
- File number
- CCN/category
- Property name/address
- ASC name/address/city/state
- Standard reference
- Central station
- Control unit make/model
- Transmitter make/model
- Coverage and other certificate details

DOCX extraction is the reliable path. PDF/image extraction is not reliable in the current frontend-only version.

When updating parsing logic:

- Test multiple real certificates.
- Include multiline ASC addresses.
- Include certificates with suite/unit lines.
- Confirm grouping by ASC remains stable.
- Confirm duplicate detection still works.

## 17. Duplicate Detection

Duplicate logic:

```text
src/lib/audit-duplicates.ts
```

Duplicates should warn users before replacing a certificate/property. Replacement can delete existing audit notes.

Expected behavior:

- Same exact certificate/property triggers Haudy UI warning.
- User can cancel or replace.
- Replacement clears old field notes/report data for that property.

## 18. Local Folder Save

Folder save logic:

```text
src/lib/local-document-storage.ts
```

Target folder structure:

```text
Haudy Storage/
  2026/
    ASC NAME-CITY-STATE-PSN/
      Confirmation/
      Report/
      Field Notes/
```

Browser support for folder access varies. Chromium-based browsers support File System Access API better than Safari/iOS.

## 19. Security And Privacy

Current constraints:

- No authentication.
- Data remains local to browser unless exported.
- Export files may contain sensitive audit information.
- Photos may contain site conditions.

Recommended policies:

- Store exported files in approved company locations.
- Do not email export files unless approved.
- Use device passcodes.
- Avoid shared browsers.
- Clear data only after confirmed backup/export.

Future production hardening:

- Add authentication.
- Add encrypted backend storage.
- Add role-based access.
- Add audit logs.
- Add secure attachment storage.
- Add backup/restore management.

## 20. Browser Compatibility

Recommended:

- Desktop Chrome
- Desktop Edge
- Modern Safari for general use

Known limitations:

- iOS Safari may not support all dictation/browser speech APIs.
- Folder save APIs vary by browser.
- localStorage quotas vary.
- Offline behavior can differ between hosted and file-based portable modes.

## 21. Build And Release Checklist

Before release:

1. Confirm working tree state.
2. Run production build.
3. Refresh portable folders.
4. Test hosted app locally or on Render.
5. Test upload of at least one DOCX certificate.
6. Test Save Field Note.
7. Test Save Confirmation.
8. Test Save Report Draft.
9. Test export/import without photos.
10. Test print/PDF output for field notes, confirmation, and report.
11. Commit changes with a clear message.
12. Push to GitHub/Render deployment branch.

Build:

```bash
pnpm build
```

## 22. Backup Procedure

Project backups may be stored outside the repository. Existing backup location example:

```text
/Users/vahidabbasi/Documents/Project/Codex_Backups/
```

Recommended backup naming:

```text
haudy_backup_YYYYMMDD_HHMMSS.tar.gz
```

User data backup is separate from project backup. User data should be exported from inside Haudy using Export Data.

## 23. Future Engineering Roadmap

High-value improvements:

- Move data from localStorage to IndexedDB.
- Add backend sync.
- Add user authentication.
- Add shared team workspace.
- Add encrypted cloud backup.
- Add OCR/PDF parsing.
- Add route-level code splitting.
- Add automated Playwright tests for print layouts.
- Add versioned migration framework for local data.
- Add PDF generation independent of browser print.

## 24. Emergency Recovery Notes

If a user reports missing data:

1. Do not clear browser data.
2. Confirm correct browser/device.
3. Check whether the user imported another Haudy data file.
4. Look for recent exported `.haudy-data.json` files.
5. If storage quota errors occurred, ask whether photos were attached.
6. Try exporting current data before attempting repair.

If Render deploy fails:

1. Read the first actual error above the deploy failure.
2. Confirm build command.
3. Confirm package manager.
4. Confirm `dist` publish directory.
5. Confirm no read-only filesystem command is used.
6. Re-run build locally.

If the app is live but has a Vite chunk warning:

- Treat as non-blocking.
- Optimize later if load time becomes an issue.

