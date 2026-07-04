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
  "Comments and Clarifications",
  "Premises Extent Of Protection",
  "Stockroom Extent Of Protection",
  "SN",
  "File No",
];

export function parseCertificateText(rawText: string, fileName: string): ParsedCertificate {
  const fullText = normalizeText(rawText);
  const fullLines = fullText.split(/\n+/).map(clean).filter(Boolean);
  const fullJoined = fullLines.join("\n");
  const fullFlat = clean(fullLines.join(" "));
  const text = normalizeText(stripDisclaimer(rawText));
  const lines = text.split(/\n+/).map(clean).filter(Boolean);
  const joined = lines.join("\n");
  const flat = clean(lines.join(" "));

  const standalonePropertyBlock = standaloneBlock(lines, "Protected Property");
  const standaloneAscBlock = standaloneBlock(lines, "Alarm Service Company");
  const standaloneMonitoringBlock = monitoringLocationBlock(lines);
  const fullPropertyBlock = standaloneBlock(fullLines, "Protected Property");
  const fullAscBlock = standaloneBlock(fullLines, "Alarm Service Company");
  const fullMonitoringBlock = monitoringLocationBlock(fullLines);
  const protectedBlock = standalonePropertyBlock.length
    ? standalonePropertyBlock
    : fullPropertyBlock.length
      ? fullPropertyBlock
      : inlineBlock(flat, "Protected Property", ["Alarm Service Company", "Alarm System Description", "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS", "SN", "File No"]).length
        ? inlineBlock(flat, "Protected Property", ["Alarm Service Company", "Alarm System Description", "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS", "SN", "File No"])
        : inlineBlock(fullFlat, "Protected Property", ["Alarm Service Company", "Alarm System Description", "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS", "SN", "File No"]);
  const ascBlock = standaloneAscBlock.length
    ? standaloneAscBlock
    : fullAscBlock.length
      ? fullAscBlock
      : inlineBlock(flat, "Alarm Service Company", ["Monitoring Location", "Alarm System Description", "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS", "SN", "File No"]).length
        ? inlineBlock(flat, "Alarm Service Company", ["Monitoring Location", "Alarm System Description", "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS", "SN", "File No"])
        : inlineBlock(fullFlat, "Alarm Service Company", ["Monitoring Location", "Alarm System Description", "SYSTEM DEVIATIONS FROM REFERENCED NFPA STANDARDS", "SN", "File No"]);
  const monitoringBlock = standaloneMonitoringBlock.length ? standaloneMonitoringBlock : fullMonitoringBlock.length ? fullMonitoringBlock : inlineMonitoringLocationBlock(flat).length ? inlineMonitoringLocationBlock(flat) : inlineMonitoringLocationBlock(fullFlat);
  const property = splitPropertyBlock(protectedBlock);
  const asc = splitAscBlock(ascBlock);
  const ascLocation = cityStateFromAddress(asc.address);
  const monitoring = splitMonitoringBlock(monitoringBlock);

  const fileNo = firstValue(fullLines, /^File No:\s*(.+)$/i) || firstValue(lines, /^File No:\s*(.+)$/i) || fullFlat.match(/\bFile No:\s*([A-Z0-9.-]+)/i)?.[1];
  const ccn = firstValue(fullLines, /^CCN:\s*(.+)$/i) || firstValue(lines, /^CCN:\s*(.+)$/i) || fullFlat.match(/\bCCN:\s*([A-Z0-9.-]+)/i)?.[1];
  const issuedLine = firstLineMatching(fullLines, /^Issued:/i) || fullFlat.match(/\bIssued:\s*[0-9/]+(?:\s+Revised:\s*[0-9/]+)?/i)?.[0] || "";
  const revisedLine = firstLineMatching(fullLines, /^Revised:/i) || issuedLine;
  const standardMatch = fullFlat.match(/accordance\s+with\s+standard\s+(NFPA\s*72\s*[- ]\s*\d{4}|UL\s*681)/i);
  const coverageMatch = joined.match(/Coverage\s+is\s+([^\n]+)/i) || flat.match(/Coverage\s+is\s+([^]+?)(?=\b(?:Issued|Revised|Monitoring Location|SN|File No|Protected Property|Alarm Service Company)\b|$)/i);

  return {
    fileName,
    certificateNumber: firstValue(fullLines, /^SN:\s*(.+)$/i) || fullFlat.match(/\bSN:\s*([A-Z0-9.-]+)/i)?.[1],
    certificateType: firstLineMatching(fullLines, /(FIRE ALARM SYSTEM CERTIFICATE|BURGLAR ALARM SYSTEM CERTIFICATE|MERCANTILE BURGLAR ALARM)/i),
    categoryCode: firstCategoryCode(fullJoined) || ccn?.toUpperCase(),
    fileNo,
    ccn,
    issuedDate: isoDate(issuedLine.match(/Issued:\s*([0-9/]+)/i)?.[1]),
    revisedDate: isoDate(revisedLine.match(/Revised:\s*([0-9/]+)/i)?.[1]),
    propertyName: property.name,
    propertyAddress: property.address,
    ascName: asc.name,
    ascAddress: asc.address,
    ascCity: ascLocation.city,
    ascState: ascLocation.state,
    areaCovered: labelValue(joined, "Area Covered"),
    ahj: labelValue(joined, "Authority Having Jurisdiction"),
    respondingFD: labelValue(joined, "Responding Fire Department"),
    standardReferenced: standardMatch?.[1]?.replace(/\s+/g, " ").replace(/\s+-\s+/, "-"),
    coverageType: coverageMatch?.[1]?.trim(),
    systemDeviations: systemDeviations(lines),
    commentsAndClarifications: labelValue(fullJoined, "Comments and Clarifications"),
    premisesExtent: labelValue(fullJoined, "Premises Extent Of Protection"),
    stockroomExtent: labelValue(fullJoined, "Stockroom Extent Of Protection"),
    safeComplete: labelValue(fullJoined, "Safe Complete"),
    holdUp: labelValue(fullJoined, "HoldUp") || labelValue(fullJoined, "Hold Up"),
    partyNotified: labelValue(fullJoined, "Party Notified"),
    lineSecurity: labelValue(fullJoined, "Line Security"),
    alarmSoundingDeviceLocation: labelValue(fullJoined, "Alarm Sounding Device Location"),
    secondaryTransmission: labelValue(fullJoined, "Secondary Transmission Method"),
    controlTransmitterCombo: labelValue(fullJoined, "Control & Transmitter Combo"),
    controlUnitMfr: labelValue(joined, "Control Unit Manufacturer"),
    controlUnitModel: labelValue(joined, "Control Unit Model"),
    signalTransmitterMfr: labelValue(joined, "Signal Transmitter Manufacturer") || labelValue(joined, "Transmitter Manufacturer"),
    signalTransmitterModel: labelValue(joined, "Signal Transmitter Model") || labelValue(joined, "Transmitter Model"),
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
    if (block.length >= 5) break;
  }
  return block;
}

function inlineBlock(text: string, label: string, stopLabels: string[]) {
  const labelSource = flexibleLabelSource(label);
  const stopSource = stopLabels.map(flexibleLabelSource).join("|");
  const match = text.match(new RegExp(`(?:^|\\b)${labelSource}\\s*:?\\s*([\\s\\S]*?)(?=\\b(?:${stopSource})\\s*:?|$)`, "i"));
  const value = clean(match?.[1] || "");
  return value ? [value] : [];
}

function flexibleLabelSource(label: string) {
  return escapeRegExp(label).replace(/\\ /g, "\\s+");
}

function splitPropertyBlock(block: string[]) {
  return splitNameAddressBlock(block);
}

function splitAscBlock(block: string[]) {
  return splitNameAddressBlock(block);
}

function splitNameAddressBlock(block: string[]) {
  const first = block[0] || "";
  const streetStart = streetAddressStart(first);
  const name = streetStart > 0 ? first.slice(0, streetStart) : first;
  const addressLines = streetStart > 0 ? [first.slice(streetStart), ...block.slice(1)] : block.slice(1);
  return { name: clean(name), address: addressLines.map(clean).filter(Boolean).join(", ") };
}

function streetAddressStart(line: string) {
  const candidates = Array.from(line.matchAll(/\b\d{1,6}[A-Z]?\b/gi));
  let best = { index: -1, score: Number.POSITIVE_INFINITY };
  for (const candidate of candidates) {
    if (candidate.index === undefined) continue;
    const before = line.slice(0, candidate.index).trim();
    if (/\b(BLDG|BUILDING|STE|SUITE|UNIT|APT|ROOM|FL|FLOOR)\s*$/i.test(before)) continue;
    const rest = line.slice(candidate.index);
    const suffix = rest.search(streetSuffixRegex());
    const stateZip = rest.search(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i);
    const score = suffix >= 0 ? suffix : stateZip >= 0 ? stateZip + 100 : Number.POSITIVE_INFINITY;
    if (score < best.score) best = { index: candidate.index, score };
  }
  return best.index;
}

export function cityStateFromAddress(address?: string) {
  const value = clean(address || "");
  const match = value.match(/(?:^|,\s*)([A-Za-z][A-Za-z .'-]+?),?\s+([A-Z]{2})\s+\d{5}(?:-\d{4})?$/);
  if (match) return { city: clean(match[1]), state: match[2] };

  const parts = value.split(",").map(clean).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const stateMatch = last.match(/\b([A-Z]{2})\b/);
  if (parts.length >= 2 && stateMatch) return { city: parts[parts.length - 2], state: stateMatch[1] };

  const stateZipMatch = value.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/i);
  if (stateZipMatch?.index !== undefined) {
    const beforeState = clean(value.slice(0, stateZipMatch.index).replace(/,/g, " "));
    const suffixMatches = Array.from(beforeState.matchAll(streetSuffixRegex()));
    const lastSuffix = suffixMatches[suffixMatches.length - 1];
    const city = lastSuffix?.index === undefined ? "" : clean(beforeState.slice(lastSuffix.index + lastSuffix[0].length));
    if (city) return { city, state: stateZipMatch[1].toUpperCase() };
  }

  return { city: "", state: "" };
}

function streetSuffixRegex() {
  return /\b(ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|CIR|CIRCLE|WAY|PKWY|PARKWAY|PL|PLACE|HWY|HIGHWAY|TER|TERRACE|LOOP)\.?\b/gi;
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

function inlineMonitoringLocationBlock(text: string) {
  const value = inlineBlock(text, "Monitoring Location", ["SN", "File No", "Issued", "Protected Property", "Alarm Service Company"])[0] || "";
  return value ? [value] : [];
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

function firstCategoryCode(text: string) {
  return text.match(/\b(UUFX|UUJS|UUHX|UUFM|CVSG)\b/i)?.[1]?.toUpperCase();
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
