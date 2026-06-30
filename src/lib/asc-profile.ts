const ASC_PROFILE_KEY = "haudy.ascProfiles";

export interface AscProfile {
  pocName: string;
  scn: string;
  psn: string;
  updatedAt: string;
}

export type AscProfiles = Record<string, AscProfile>;

export function loadAscProfiles(): AscProfiles {
  try {
    const raw = localStorage.getItem(ASC_PROFILE_KEY);
    return raw ? JSON.parse(raw) as AscProfiles : {};
  } catch {
    return {};
  }
}

export function saveAscProfiles(profiles: AscProfiles) {
  localStorage.setItem(ASC_PROFILE_KEY, JSON.stringify(profiles));
}

export function deleteAscProfile(ascKey: string) {
  const profiles = loadAscProfiles();
  if (!(ascKey in profiles)) return profiles;
  const next = { ...profiles };
  delete next[ascKey];
  saveAscProfiles(next);
  return next;
}

export function completeAscProfile(profile?: AscProfile) {
  return Boolean(profile?.pocName.trim() && profile.scn.trim() && profile.psn.trim());
}
