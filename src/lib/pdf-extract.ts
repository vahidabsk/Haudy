export async function extractPdfText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const raw = new TextDecoder("latin1").decode(bytes);
  const chunks: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of raw.matchAll(streamPattern)) {
    chunks.push(extractPdfStrings(match[1]));
  }
  return chunks.join("\n").replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractPdfStrings(text: string) {
  const parts: string[] = [];
  for (const match of text.matchAll(/\(([^()]*)\)|<([0-9A-Fa-f]{4,})>/g)) {
    if (match[1]) parts.push(match[1].replace(/\\([()\\])/g, "$1"));
    if (match[2]) parts.push(hexToText(match[2]));
  }
  return parts.join(" ");
}

function hexToText(hex: string) {
  const chars = [];
  for (let index = 0; index < hex.length; index += 2) {
    const code = Number.parseInt(hex.slice(index, index + 2), 16);
    if (Number.isFinite(code) && code >= 32 && code <= 126) chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}
