export async function extractDocxText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xml = await extractZipEntry(bytes, "word/document.xml");
  if (!xml) return "";
  return xmlToText(xml);
}

async function extractZipEntry(bytes: Uint8Array, name: string) {
  const decoder = new TextDecoder();
  for (let offset = 0; offset < bytes.length - 30; offset++) {
    if (readU32(bytes, offset) !== 0x04034b50) continue;
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const fileNameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const fileName = decoder.decode(bytes.slice(offset + 30, offset + 30 + fileNameLength));
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    if (fileName === name) {
      if (method === 0) return decoder.decode(data);
      if (method === 8) return decoder.decode(await decompress(data, "deflate-raw"));
      return "";
    }
    offset = dataStart + compressedSize - 1;
  }
  return "";
}

async function decompress(data: Uint8Array, format: CompressionFormat) {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function xmlToText(xml: string) {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function readU16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}
