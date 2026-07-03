import { isDesktopApp } from "./desktop-runtime";
import { chooseHaudyDatabaseRoot, hasDesktopBridge, saveDesktopBinaryFileWithDialog, storedHaudyDatabaseRoot } from "./desktop-bridge";

const LETTER_WIDTH_PT = 612;
const LETTER_HEIGHT_PT = 792;
const RENDER_SCALE = 2;

interface PdfImagePage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export function canSavePdfDirectly() {
  return isDesktopApp() && hasDesktopBridge();
}

export async function savePrintablePagesAsPdf(fileName: string, folders: string[]) {
  if (!canSavePdfDirectly()) {
    throw new Error("Save as PDF is available in the Windows desktop app.");
  }
  if (!storedHaudyDatabaseRoot()) await chooseHaudyDatabaseRoot();
  const pages = Array.from(document.querySelectorAll<HTMLElement>(".print-page"));
  if (!pages.length) throw new Error("No printable pages were found.");

  try {
    const images = await renderPagesToJpegs(pages);
    const pdf = buildImagePdf(images);
    const savedPath = await saveDesktopBinaryFileWithDialog(folders, `${safeName(fileName)}.pdf`, pdf);
    return savedPath ? "PDF saved." : "PDF save canceled.";
  } catch {
    window.print();
    return "Windows PDF save opened. Choose Save as PDF or Microsoft Print to PDF.";
  }
}

async function renderPagesToJpegs(pages: HTMLElement[]) {
  const images: PdfImagePage[] = [];
  for (const page of pages) {
    images.push(await renderPageToJpeg(page));
  }
  return images;
}

async function renderPageToJpeg(page: HTMLElement): Promise<PdfImagePage> {
  const styles = collectStyles();
  const clone = page.cloneNode(true) as HTMLElement;
  await inlineImages(clone);
  const rect = page.getBoundingClientRect();
  const width = Math.max(Math.ceil(rect.width), 816);
  const height = Math.max(Math.ceil(rect.height), 1056);
  const html = `
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${styles}</style>
      <style>
        html, body { margin: 0; padding: 0; background: #fff; }
        .print-page { box-shadow: none !important; margin: 0 !important; }
        .no-print { display: none !important; }
      </style>
      ${clone.outerHTML}
    </div>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  let image: HTMLImageElement;
  try {
    image = await loadImage(svgUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width * RENDER_SCALE;
  canvas.height = height * RENDER_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create PDF page.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
  return {
    bytes: dataUrlToBytes(dataUrl),
    width: canvas.width,
    height: canvas.height,
  };
}

function buildImagePdf(images: PdfImagePage[]) {
  const objects: string[] = [];
  const binaries: Uint8Array[] = [];
  const pageObjectNumbers: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "";

  let nextObject = 3;
  for (const image of images) {
    const pageNumber = nextObject++;
    const contentNumber = nextObject++;
    const imageNumber = nextObject++;
    pageObjectNumbers.push(pageNumber);
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LETTER_WIDTH_PT} ${LETTER_HEIGHT_PT}] /Resources << /XObject << /Im${imageNumber} ${imageNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`;
    const content = `q\n${LETTER_WIDTH_PT} 0 0 ${LETTER_HEIGHT_PT} 0 0 cm\n/Im${imageNumber} Do\nQ\n`;
    objects[contentNumber] = `<< /Length ${byteLength(content)} >>\nstream\n${content}endstream`;
    objects[imageNumber] = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n__BINARY_${binaries.length}__\nendstream`;
    binaries.push(image.bytes);
  }

  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  return buildPdfObjects(objects, binaries);
}

function buildPdfObjects(objects: string[], binaries: Uint8Array[]) {
  const chunks: Uint8Array[] = [textBytes("%PDF-1.4\n")];
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = totalLength(chunks);
    chunks.push(textBytes(`${index} 0 obj\n`));
    const parts = objects[index].split(/(__BINARY_\d+__)/g);
    for (const part of parts) {
      const match = part.match(/^__BINARY_(\d+)__$/);
      chunks.push(match ? binaries[Number(match[1])] : textBytes(part));
    }
    chunks.push(textBytes("\nendobj\n"));
  }
  const xrefOffset = totalLength(chunks);
  chunks.push(textBytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n`));
  for (let index = 1; index < objects.length; index += 1) {
    chunks.push(textBytes(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`));
  }
  chunks.push(textBytes(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return concatBytes(chunks);
}

function collectStyles() {
  return Array.from(document.styleSheets).map((sheet) => {
    try {
      return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
    } catch {
      return "";
    }
  }).join("\n");
}

async function inlineImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(images.map(async (image) => {
    const src = image.getAttribute("src");
    if (!src || src.startsWith("data:")) return;
    try {
      const response = await fetch(new URL(src, window.location.href).href);
      const blob = await response.blob();
      image.setAttribute("src", await blobToDataUrl(blob));
    } catch {
      image.removeAttribute("src");
    }
  }));
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not render PDF page."));
    image.src = src;
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks: Uint8Array[]) {
  const output = new Uint8Array(totalLength(chunks));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function totalLength(chunks: Uint8Array[]) {
  return chunks.reduce((total, chunk) => total + chunk.length, 0);
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "Haudy Document";
}
