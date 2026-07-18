# Haudy Audit Suite

Tablet-friendly browser workspace for fire alarm certificate audits, field notes, confirmation letters, and reports. This v1 is a frontend-only React/Vite app that stores data in the browser.

## Run Locally

```bash
bun install
bun run dev
```

`npm install && npm run dev` is an acceptable fallback when Bun is unavailable.

## Deploy To Render

Push this folder to GitHub and create a Render Static Site. The included `render.yaml` builds with:

```bash
bun install && bun run build
```

## V1 Constraints

- No backend in v1. Data is per-browser and per-device.
- DOCX extraction is the reliable certificate upload path.
- PDF extraction is best-effort and will fail for many modern PDFs.
- Image-only/scanned PDFs cannot be parsed without OCR, which is not included in v1.
- Browser localStorage has a practical size cap around 5MB per origin; photos are downscaled before storage.
- Web Speech API is not supported in iOS Safari. Typing notes always works.

## Upgrade Path

For production-grade certificate intake, add `pdfjs-dist` for PDF text extraction and OCR such as `tesseract.js` for scanned/image-only PDFs. For multi-user persistence, add authenticated backend storage.

## Handbooks

- [User Operation Manual](docs/HAUDY_USER_OPERATION_MANUAL.md)
- [IT And Engineering Handbook](docs/HAUDY_IT_ENGINEERING_HANDBOOK.md)
- [Windows Standalone Build](docs/windows-standalone-build.md)
