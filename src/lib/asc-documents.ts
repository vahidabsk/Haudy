const ASC_DOCUMENT_KEY = "haudy.ascDocuments";

export interface SavedDocumentStatus {
  saved: boolean;
  pocName: string;
  scn: string;
  psn: string;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
}

export interface AscDocumentState {
  confirmation?: SavedDocumentStatus;
  report?: SavedDocumentStatus;
}

export type AscDocuments = Record<string, AscDocumentState>;

export function loadAscDocuments(): AscDocuments {
  try {
    const raw = localStorage.getItem(ASC_DOCUMENT_KEY);
    return raw ? JSON.parse(raw) as AscDocuments : {};
  } catch {
    return {};
  }
}

export function saveAscDocuments(documents: AscDocuments) {
  localStorage.setItem(ASC_DOCUMENT_KEY, JSON.stringify(documents));
}

export function deleteAscDocuments(ascKey: string) {
  const documents = loadAscDocuments();
  if (!(ascKey in documents)) return documents;
  const next = { ...documents };
  delete next[ascKey];
  saveAscDocuments(next);
  return next;
}

export function saveAscDocument(ascKey: string, type: keyof AscDocumentState, status: Omit<SavedDocumentStatus, "saved" | "updatedAt">) {
  const documents = loadAscDocuments();
  const next: AscDocuments = {
    ...documents,
    [ascKey]: {
      ...documents[ascKey],
      [type]: { ...status, saved: true, updatedAt: new Date().toISOString() },
    },
  };
  saveAscDocuments(next);
  return next;
}
