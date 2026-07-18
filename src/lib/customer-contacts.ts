const CUSTOMER_CONTACTS_KEY = "haudy.customerContacts";

export interface CustomerContact {
  psn: string;
  name: string;
  phone: string;
  email: string;
  type: string;
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

export function contactsForPsn(psn?: string) {
  const cleanPsn = String(psn || "").trim();
  return loadCustomerContacts().filter((contact) => contact.psn === cleanPsn);
}
