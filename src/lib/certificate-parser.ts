import { ParsedCertificate } from "./types";

const headings = [
  "Protected Property",
  "Alarm Service Company",
  "Alarm System Description",
  "Authority Having Jurisdiction",
  "Responding Fire Department",
  "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS",
  "Automatic Fire Detection and Alarm Devices",
  "Sprinkler System and Supervisory Service",
  "Manual Fire Alarm Devices",
  "Alarm Notification and Annunciation Devices",
  "Control and Transmitter Unit",
  "Monitoring Location",
  "SN",
  "File No",
];

export function parseCertificateText(rawText: string, fileName: string): ParsedCertificate {
  const text = normalizeText(stripDisclaimer(rawText));
  const lines = text.split(/\n+/).map(clean).filter(Boolean);
  const joined = lines.join("\n");

  const protectedBlock = standaloneBlock(lines, "Protected Property");
  const ascBlock = standaloneBlock(lines, "Alarm Service Company");
  const monitoringBlock = monitoringLocationBlock(lines);
  const property = splitPropertyBlock(protectedBlock);
  const asc = splitAscBlock(ascBlock);
  const ascLocation = cityStateFromAddress(asc.address);
  const monitoring = splitMonitoringBlock(monitoringBlock);

  const fileLine = firstLineMatching(lines, /^File No:/i) || "";
  const issuedLine = firstLineMatching(lines, /^Issued:/i) || "";
  const standardMatch = joined.match(/accordance\s+with\s+standard\s+(NFPA\s*72-\d{4})/i);
  const coverageMatch = joined.match(/Coverage\s+is\s+([^\n]+)/i);

  return {
    fileName,
    certificateNumber: firstValue(lines, /^SN:\s*(.+)$/i),
    certificateType: firstLineMatching(lines, /FIRE ALARM SYSTEM CERTIFICATE/i),
    fileNo: fileLine.match(/File No:\s*([A-Z0-9.-]+)/i)?.[1],
    ccn: fileLine.match(/CCN:\s*([A-Z0-9.-]+)/i)?.[1],
    issuedDate: isoDate(issuedLine.match(/Issued:\s*([0-9/]+)/i)?.[1]),
    revisedDate: isoDate(issuedLine.match(/Revised:\s*([0-9/]+)/i)?.[1]),
    propertyName: property.name,
    propertyAddress: property.address,
    ascName: asc.name,
    ascAddress: asc.address,
    ascCity: ascLocation.city,
    ascState: ascLocation.state,
    areaCovered: labelValue(joined, "Area Covered"),
    ahj: labelValue(joined, "Authority Having Jurisdiction"),
    respondingFD: labelValue(joined, "Responding Fire Department"),
    standardReferenced: standardMatch?.[1]?.replace(/\s+/g, " "),
    coverageType: coverageMatch?.[1]?.trim(),
    systemDeviations: systemDeviations(lines),
    controlUnitMfr: labelValue(joined, "Control Unit Manufacturer"),
    controlUnitModel: labelValue(joined, "Control Unit Model"),
    primaryTransmission: labelValue(joined, "Primary Transmission Method"),
    retransmission: labelValue(joined, "Retransmission To Fire Department"),
    centralStation: monitoring.name,
    centralStationAddress: monitoring.address,
    centralStationFile: monitoring.file,
    deviceCounts: deviceCounts(joined),
  };
}

function stripDisclaimer(text: string) {
  return text.replace(/THIS CERTIFIES[\s\S]*?ALARM SYSTEM DESCRIPTION:\s*/i, "");
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n");
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function standaloneBlock(lines: string[], label: string) {
  const index = lines.findIndex((line) => line.replace(/:$/, "").toLowerCase() === label.toLowerCase());
  if (index < 0) return [];
  const block: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (isHeading(line)) break;
    block.push(line);
    if (block.length >= 3) break;
  }
  return block;
}

function splitPropertyBlock(block: string[]) {
  const first = block[0] || "";
  const match = first.match(/^(.*?)(\d.*)$/);
  const name = match ? clean(match[1]) : first;
  const addressLines = match ? [match[2], ...block.slice(1)] : block.slice(1);
  return { name, address: addressLines.map(clean).filter(Boolean).join(", ") };
}

function splitAscBlock(block: string[]) {
  return { name: clean(block[0] || ""), address: block.slice(1).map(clean).filter(Boolean).join(", ") };
}

export function cityStateFromAddress(address?: string) {
  const value = clean(address || "");
  const match = value.match(/(?:^|,\s*)([A-Za-z][A-Za-z .'-]+?),?\s+([A-Z]{2})\s+\d{5}(?:-\d{4})?$/);
  if (match) return { city: clean(match[1]), state: match[2] };

  const parts = value.split(",").map(clean).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const stateMatch = last.match(/\b([A-Z]{2})\b/);
  if (parts.length >= 2 && stateMatch) return { city: parts[parts.length - 2], state: stateMatch[1] };

  return { city: "", state: "" };
}

function monitoringLocationBlock(lines: string[]) {
  const index = lines.findIndex((line) => /^Monitoring Location:/i.test(line));
  if (index < 0) return [];
  const first = lines[index].replace(/^Monitoring Location:\s*/i, "");
  const block = first ? [first] : [];
  for (const line of lines.slice(index + 1)) {
    if (/^SN:/i.test(line) || /^File No:/i.test(line)) break;
    block.push(line);
    if (block.length >= 3) break;
  }
  return block;
}

function splitMonitoringBlock(block: string[]) {
  const combined = block.join(" ");
  const file = combined.match(/File:\s*([A-Z0-9.-]+)/i)?.[1];
  const withoutLabel = combined.replace(/UL Listed Central Station File:\s*[A-Z0-9.-]+/i, "").trim();
  const match = withoutLabel.match(/^(.*?)(\d.*)$/);
  return {
    file,
    name: clean(match ? match[1] : withoutLabel),
    address: clean(match ? match[2] : ""),
  };
}

function isHeading(line: string) {
  const normalized = line.replace(/:$/, "").toLowerCase();
  return headings.some((heading) => normalized === heading.toLowerCase() || normalized.startsWith(`${heading.toLowerCase()}:`));
}

function firstLineMatching(lines: string[], pattern: RegExp) {
  return lines.find((line) => pattern.test(line));
}

function firstValue(lines: string[], pattern: RegExp) {
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) return clean(match[1]);
  }
  return undefined;
}

function labelValue(text: string, label: string) {
  return text.match(new RegExp(`${escapeRegExp(label)}:\\s*([^\\n]+)`, "i"))?.[1]?.trim();
}

function isoDate(value?: string) {
  if (!value) return undefined;
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) return undefined;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function systemDeviations(lines: string[]) {
  const index = lines.findIndex((line) => line.toUpperCase() === "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS");
  if (index < 0) return undefined;
  const value = lines[index + 1] || "";
  return /^NONE$/i.test(value) ? "" : value;
}

function deviceCounts(text: string) {
  return {
    smoke: totalNear(text, /Smoke Detector/i),
    heat: totalNear(text, /Heat Detector/i),
    duct: totalNear(text, /Duct Detector/i),
    waterflowControlValve: totalNear(text, /Waterflow[\s\S]*?Control Valve/i),
    manualStations: totalNear(text, /Manual[\s\S]*?(Station|Boxes)/i),
    hornStrobe: totalNear(text, /Horn\s*\/\s*Strobe/i),
    strobe: totalNear(text, /(^|\n)Strobe/i),
  };
}

function totalNear(text: string, label: RegExp) {
  const match = text.match(new RegExp(`${label.source}[\\s\\S]{0,120}_?Total:\\s*(\\d+)_?`, label.flags));
  return match ? Number(match[1]) : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
