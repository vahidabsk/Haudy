import { Audit } from "./types";

export interface AscGroup {
  key: string;
  ascName: string;
  location: string;
  audits: Audit[];
}

export function groupByAsc(audits: Audit[]): AscGroup[] {
  const groups = new Map<string, Audit[]>();
  for (const audit of audits) {
    const ascName = audit.ascName || "ASC not set";
    const ascCity = audit.ascCity || "";
    const ascState = audit.ascState || "";
    const key = [ascName, ascCity, ascState].join("|");
    groups.set(key, [...(groups.get(key) || []), audit]);
  }

  return Array.from(groups, ([key, groupAudits]) => {
    const [ascName, ascCity, ascState] = key.split("|");
    return {
      key,
      ascName,
      location: [ascCity, ascState].filter(Boolean).join(", "),
      audits: groupAudits.sort((a, b) => (a.protectedProperty || "").localeCompare(b.protectedProperty || "") || (a.certificateNumber || "").localeCompare(b.certificateNumber || "")),
    };
  }).sort((a, b) => a.ascName.localeCompare(b.ascName) || a.location.localeCompare(b.location));
}
