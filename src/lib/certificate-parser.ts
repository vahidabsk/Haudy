import { CertificateDeviceSection, ParsedCertificate } from "./types";

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
  "Emergency Voice Alarm Devices",
  "Control and Transmitter Unit",
  "Monitoring Location",
  "Comments and Clarifications",
  "Government Manual",
  "Government Contract Number",
  "Protected Area",
  "Protected Area Type",
  "Protected Area Description",
  "Physical Boundary",
  "Closed Area",
  "Alarm Response",
  "Guard Response",
  "Openings/Closings",
  "Opening/Closing",
  "Independent Code",
  "ASD Form",
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
  const standardMatch = fullFlat.match(/accordance\s+with\s+standard\s+(NFPA\s*72\s*[- ]\s*\d{4}|UL\s*681|UL\s*2050)/i);
  const coverageMatch = joined.match(/Coverage\s+is\s+([^\n]+)/i) || flat.match(/Coverage\s+is\s+([^]+?)(?=\b(?:Issued|Revised|Monitoring Location|SN|File No|Protected Property|Alarm Service Company)\b|$)/i);
  const parsedFireDeviceSections = fireDeviceSections(fullLines);
  const parsedSprinklerType = sprinklerTypeFromSections(parsedFireDeviceSections) || sprinklerSystemType(fullJoined) || sprinklerSystemType(joined);

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
    governmentManual: labelValue(fullJoined, "Government Manual") || labelValue(fullJoined, "Government Security Manual"),
    governmentContractNumber: labelValue(fullJoined, "Government Contract Number") || labelValue(fullJoined, "Government Contract"),
    protectedArea: labelValue(fullJoined, "Protected Area"),
    protectedAreaType: labelValue(fullJoined, "Protected Area Type") || labelValue(fullJoined, "Type of Protected Area"),
    protectedAreaDescription: labelValue(fullJoined, "Protected Area Description") || labelValue(fullJoined, "Protected Area Comments"),
    physicalBoundary: labelValue(fullJoined, "Physical Boundary"),
    closedArea: labelValue(fullJoined, "Closed Area"),
    alarmResponse: labelValue(fullJoined, "Alarm Response"),
    guardResponse: labelValue(fullJoined, "Guard Response"),
    openingClosing: labelValue(fullJoined, "Openings/Closings") || labelValue(fullJoined, "Opening/Closing"),
    independentCode: labelValue(fullJoined, "Independent Code"),
    asdForm: labelValue(fullJoined, "ASD Form"),
    premisesExtent: labelValue(fullJoined, "Premises Extent Of Protection"),
    stockroomExtent: labelValue(fullJoined, "Stockroom Extent Of Protection"),
    safeComplete: labelValue(fullJoined, "Safe Complete"),
    holdUp: labelValue(fullJoined, "HoldUp") || labelValue(fullJoined, "Hold Up"),
    partyNotified: labelValue(fullJoined, "Party Notified"),
    lineSecurity: lineSecurityValue(fullJoined),
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
    sprinklerSystemType: parsedSprinklerType,
    fireDeviceSections: parsedFireDeviceSections,
    deviceCounts: deviceCounts(joined, parsedFireDeviceSections),
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
  return text.match(/\b(UUFX|UUJS|UUHX|UUFM|CVSG|CRZH)\b/i)?.[1]?.toUpperCase();
}

function labelValue(text: string, label: string) {
  return text.match(new RegExp(`${escapeRegExp(label)}:\\s*([^\\n]+)`, "i"))?.[1]?.trim();
}

function lineSecurityValue(text: string) {
  const direct = labelValue(text, "Line Security");
  if (direct) return direct;
  const inline = text.match(/\bLine\s+Security\b\s*:?\s*(Encrypted|Standard|No|None|N\/A|Not Applicable)\b/i)?.[1];
  if (inline) return clean(inline);
  if (/\bEncrypted\s+Line\s+Security\b/i.test(text)) return "Encrypted";
  if (/\bStandard\s+Line\s+Security\b/i.test(text)) return "Standard";
  return undefined;
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

function deviceCounts(text: string, sections: CertificateDeviceSection[] = []) {
  const sectionCount = (category: RegExp, description?: RegExp) => countFromSections(sections, category, description);
  return {
    smoke: sectionCount(/Smoke Detector/i),
    photoelectricSmoke: sectionCount(/Smoke Detector/i, /Photo/i),
    ionizationSmoke: totalNear(text, /Ionization\s+Smoke Detector/i),
    heat: sectionCount(/Heat Detector/i),
    duct: sectionCount(/Other Detector|Duct/i, /Duct/i),
    tamperSwitches: totalNear(text, /Tamper Switch/i),
    sprinklerWaterflow: sectionCount(/Sprinkler Device/i, /Waterflow/i),
    waterflowSwitches: sectionCount(/Sprinkler Device/i, /Waterflow/i),
    controlValves: sectionCount(/Sprinkler Device/i, /Control Valve/i),
    valveSupervisory: totalNear(text, /Valve Supervisory/i),
    osy: totalNear(text, /OS\s*&\s*Y/i),
    piv: totalNear(text, /PIV|Post Indicator Valve/i),
    pressureSwitches: totalNear(text, /Pressure Switch/i),
    lowAirSwitches: totalNear(text, /Low Air Switch/i),
    waterflowControlValve: totalFromSection(sections, /Sprinkler System and Supervisory Service/i) || totalNear(text, /Waterflow[\s\S]*?Control Valve/i),
    manualStations: totalFromSection(sections, /Manual Fire Alarm Devices/i) || totalNear(text, /Manual[\s\S]*?(Station|Boxes)/i),
    hornStrobe: sectionCount(/Combination Signaling|Notification Appliances/i, /Horn\s*\/\s*Strobe/i),
    strobe: sectionCount(/Visual Only Signaling|Notification Appliances/i, /^Strobe$/i),
    notificationAppliances: totalFromSection(sections, /Alarm Notification and Annunciation Devices/i),
  };
}

function fireDeviceSections(lines: string[]): CertificateDeviceSection[] {
  const specs = [
    "Automatic Fire Detection and Alarm Devices",
    "Sprinkler System and Supervisory Service",
    "Manual Fire Alarm Devices",
    "Alarm Notification and Annunciation Devices",
    "Emergency Voice Alarm Devices",
  ];
  return specs
    .map((title) => {
      const parsed = parseDeviceSection(title, sectionLines(lines, title));
      return parsed.rows.length || parsed.metadata?.length ? parsed : null;
    })
    .filter((section): section is NonNullable<typeof section> => Boolean(section));
}

function sectionLines(lines: string[], title: string) {
  const start = lines.findIndex((line) => sameHeading(line, title));
  if (start < 0) return [];
  const block: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (isHeading(line)) break;
    block.push(line);
  }
  return block;
}

function parseDeviceSection(title: string, lines: string[]): CertificateDeviceSection {
  const rows: CertificateDeviceSection["rows"] = [];
  const metadata: Array<{ label: string; value: string }> = [];
  let currentCategory = "";
  let pendingCountedRow: CertificateDeviceSection["rows"][number] | undefined;

  for (const rawLine of lines.map(clean).filter(Boolean)) {
    const categoryWithCountedTotal = rawLine.match(/^(.+?)\s+(\d+)\s+(.+?)\s+Total\s*:?\s*(\d+)$/i);
    if (categoryWithCountedTotal && !/^(Coverage|Sprinkler Type)\b/i.test(rawLine)) {
      rows.push({
        category: clean(categoryWithCountedTotal[1]),
        count: Number(categoryWithCountedTotal[2]),
        description: clean(categoryWithCountedTotal[3]),
        total: Number(categoryWithCountedTotal[4]),
      });
      pendingCountedRow = undefined;
      continue;
    }
    const categoryWithCounted = rawLine.match(/^(.+?)\s+(\d+)\s+([A-Za-z].+)$/);
    if (categoryWithCounted && !rawLine.match(/^(\d+)\s+/) && !/^(Coverage|Sprinkler Type)\b/i.test(rawLine)) {
      rows.push({
        category: clean(categoryWithCounted[1]),
        count: Number(categoryWithCounted[2]),
        description: clean(categoryWithCounted[3]),
      });
      pendingCountedRow = rows[rows.length - 1];
      continue;
    }
    const coverage = rawLine.match(/^Coverage\s+is\s+(.+)$/i);
    if (coverage) {
      metadata.push({ label: "Coverage", value: clean(coverage[1]) });
      pendingCountedRow = undefined;
      continue;
    }
    const sprinklerType = rawLine.match(/^Sprinkler\s+Type\s+is\s+(.+)$/i) || rawLine.match(/^Sprinkler\s+Type\s*:?\s*(.+)$/i);
    if (sprinklerType) {
      metadata.push({ label: "Sprinkler type", value: clean(sprinklerType[1]) });
      pendingCountedRow = undefined;
      continue;
    }
    const countedWithTotal = rawLine.match(/^(\d+)\s+(.+?)\s+Total\s*:?\s*(\d+)$/i);
    if (countedWithTotal) {
      rows.push({ category: currentCategory, count: Number(countedWithTotal[1]), description: clean(countedWithTotal[2]), total: Number(countedWithTotal[3]) });
      pendingCountedRow = undefined;
      continue;
    }
    const counted = rawLine.match(/^(\d+)\s+(.+)$/);
    if (counted) {
      rows.push({ category: currentCategory, count: Number(counted[1]), description: clean(counted[2]) });
      pendingCountedRow = rows[rows.length - 1];
      continue;
    }
    const totalOnly = rawLine.match(/^Total\s*:?\s*(\d+)$/i);
    if (totalOnly && (pendingCountedRow || rows.length)) {
      (pendingCountedRow || rows[rows.length - 1]).total = Number(totalOnly[1]);
      pendingCountedRow = undefined;
      continue;
    }
    currentCategory = rawLine.replace(/:$/, "");
    pendingCountedRow = undefined;
  }

  return {
    title,
    metadata: metadata.length ? metadata : undefined,
    rows,
  };
}

function sameHeading(line: string, title: string) {
  return line.replace(/:$/, "").toLowerCase() === title.toLowerCase();
}

function sprinklerTypeFromSections(sections: CertificateDeviceSection[]) {
  return sections
    .find((section) => /Sprinkler System/i.test(section.title))
    ?.metadata?.find((item) => /sprinkler type/i.test(item.label))
    ?.value;
}

function countFromSections(sections: CertificateDeviceSection[], category: RegExp, description?: RegExp) {
  for (const row of sections.flatMap((section) => section.rows)) {
    const categoryText = row.category || "";
    const descriptionText = row.description || "";
    if (!category.test(categoryText) && !category.test(descriptionText)) continue;
    if (description && !description.test(descriptionText)) continue;
    return row.count ?? row.total;
  }
  return undefined;
}

function totalFromSection(sections: CertificateDeviceSection[], title: RegExp) {
  const rows = sections.find((section) => title.test(section.title))?.rows || [];
  const totals = rows.map((row) => row.total).filter((total): total is number => typeof total === "number");
  if (totals.length) return totals[totals.length - 1];
  const counts = rows.map((row) => row.count).filter((count): count is number => typeof count === "number");
  return counts.length ? counts.reduce((sum, count) => sum + count, 0) : undefined;
}

function sprinklerSystemType(text: string) {
  return (
    labelValue(text, "Sprinkler System Type") ||
    labelValue(text, "Type of Sprinkler System") ||
    labelValue(text, "Sprinkler Type") ||
    text.match(/\b(?:Type of )?Sprinkler System\b\s*:?\s*([A-Za-z0-9 /&(),.-]+?)(?=\s{2,}|\n|$)/i)?.[1]?.trim()
  );
}

function totalNear(text: string, label: RegExp) {
  const match = text.match(new RegExp(`${label.source}[\\s\\S]{0,120}_?Total:\\s*(\\d+)_?`, label.flags));
  return match ? Number(match[1]) : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
