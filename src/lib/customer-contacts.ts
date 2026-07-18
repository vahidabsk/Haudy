const CUSTOMER_CONTACTS_KEY = "haudy.customerContacts";
const TRACKER_DIRECTORY_KEY = "haudy.trackerDirectory";

export interface CustomerContact {
  psn: string;
  company: string;
  address: string;
  name: string;
  phone: string;
  email: string;
  type: string;
}

export interface TrackerDirectoryEntry {
  psn: string;
  ascName: string;
  city: string;
  state: string;
  auditorName: string;
}

export function loadCustomerContacts(): CustomerContact[] {
  try {
    const raw = localStorage.getItem(CUSTOMER_CONTACTS_KEY);
    const contacts = raw ? JSON.parse(raw) : [];
    return Array.isArray(contacts) ? contacts : [];
  } catch {
    return [];
  }
}

export function saveCustomerContacts(contacts: CustomerContact[]) {
  localStorage.setItem(CUSTOMER_CONTACTS_KEY, JSON.stringify(contacts));
}

export function loadTrackerDirectory(): TrackerDirectoryEntry[] {
  try {
    const raw = localStorage.getItem(TRACKER_DIRECTORY_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export function saveTrackerDirectory(entries: TrackerDirectoryEntry[]) {
  localStorage.setItem(TRACKER_DIRECTORY_KEY, JSON.stringify(entries));
}

export function contactsForPsn(psn?: string) {
  const cleanPsn = String(psn || "").trim();
  return loadCustomerContacts().filter((contact) => contact.psn === cleanPsn);
}
