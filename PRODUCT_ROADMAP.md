# Haudy Roadmap

This project follows the supplied 14-phase plan:

1. Scaffold Vite + React + TS + Tailwind + shadcn-style primitives with the UL-inspired theme.
2. Routing shell and `AuditorGate` onboarding.
3. Dashboard with upload CTA and audit cards.
4. localStorage layer and autosave hook.
5. Audit workspace shell with sticky header and review sections.
6. Signal log with A/S/T counters.
7. Documentation and installation status rows.
8. Device testing cards.
9. Dictation notes with graceful fallback.
10. Photo capture with downscale and browser storage.
11. DOCX extractor and certificate parser implementing the 10 parser rules.
12. Best-effort PDF extractor and editable upload review.
13. Multi-certificate panel and primary certificate switching.
14. Export page with print and CSV, README, and Render deployment files.

## Safety Rule

Haudy must only present code and standard references from verified source material for the applicable edition. Unverified NFPA, UL, and manufacturer references must not be presented as authoritative.

## Current Build State

The current scaffold contains the route shell, localStorage model, parser/extractor foundation, review sections, photo capture, dictation fallback, print export, CSV export, Render config, and CI config. It still needs dependency installation and full acceptance-test hardening before production use.
