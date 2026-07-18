const ASC_DOCUMENT_KEY = "haudy.ascDocuments";

export interface SavedDocumentStatus {
  saved: boolean;
  pocName: string;
  scn: string;
  psn: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  meetingLocation?: string;
  conversationDate?: string;
  letterDate?: string;
  confirmationPdfPath?: string;
  confirmationEmailPreparedAt?: string;
  serviceCenterHasComment?: boolean;
  serviceCenterDone?: boolean;
  serviceCenterComments?: ServiceCenterComment[];
  serviceCenterReportFinding?: string;
  serviceCenterReportRequiredAction?: string;
  reportCreated?: boolean;
  reportCreatedAt?: string;
  sentToClient?: boolean;
  reportSentAt?: string;
  clearanceStartDate?: string;
  clearanceResponseReceived?: boolean;
  clearanceResponseAt?: string;
  updatedAt: string;
}

export interface ServiceCenterComment {
  id: string;
  finding: string;
  requiredAction: string;
  codeStandard: string;
  codeEdition: string;
  codeSection: string;
}

export interface AscDocumentState {
  confirmation?: SavedDocumentStatus;
  report?: SavedDocumentStatus;
  crzhReport?: SavedDocumentStatus;
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

export function clearAscDocuments() {
  saveAscDocuments({});
  return {};
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
  const existing = documents[ascKey]?.[type];
  const next: AscDocuments = {
    ...documents,
    [ascKey]: {
      ...documents[ascKey],
      [type]: { ...existing, ...status, saved: true, updatedAt: new Date().toISOString() },
    },
  };
  saveAscDocuments(next);
  return next;
}

export function updateAscDocumentDraft(ascKey: string, type: keyof AscDocumentState, draft: Partial<Omit<SavedDocumentStatus, "updatedAt">>) {
  const documents = loadAscDocuments();
  const existing = documents[ascKey]?.[type];
  const next: AscDocuments = {
    ...documents,
    [ascKey]: {
      ...documents[ascKey],
      [type]: {
        saved: existing?.saved ?? false,
        pocName: existing?.pocName ?? "",
        scn: existing?.scn ?? "",
        psn: existing?.psn ?? "",
        ...existing,
        ...draft,
        updatedAt: new Date().toISOString(),
      },
    },
  };
  saveAscDocuments(next);
  return next;
}
