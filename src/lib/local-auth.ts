const AUTH_KEY = "haudy.localAuth";
const SESSION_KEY = "haudy.localSession";

const DEFAULT_ADMIN_USERNAME = "Admin";
const DEFAULT_ADMIN_SALT = "haudy-default-admin-v1";
const DEFAULT_ADMIN_HASH = "01d676c85572215bfd99ee328369b3ecbf71b51d78a87bff03aae7c9984be4d5";

export interface LocalAuthUser {
  username: string;
  salt: string;
  passwordHash: string;
  updatedAt: string;
}

export interface LocalAuthState {
  user?: LocalAuthUser;
  admin: LocalAuthUser;
}

export interface LocalSession {
  username: string;
  role: "user" | "admin";
  loggedInAt: string;
}

export function loadLocalAuth(): LocalAuthState {
  const existing = readJson<Partial<LocalAuthState> | null>(AUTH_KEY, null);
  const admin = existing?.admin || defaultAdmin();
  return { ...existing, admin };
}

export function saveLocalAuth(auth: LocalAuthState) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function loadLocalSession(): LocalSession | null {
  // Credentials remain persistent, but an authenticated session lasts only for
  // the current application window. Remove sessions created by older releases.
  localStorage.removeItem(SESSION_KEY);
  return readSessionJson<LocalSession | null>(SESSION_KEY, null);
}

export function saveLocalSession(session: LocalSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearLocalSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export async function createLocalUser(username: string, password: string) {
  const auth = loadLocalAuth();
  const user = await createCredential(username, password);
  const next = { ...auth, user };
  saveLocalAuth(next);
  saveLocalSession({ username: user.username, role: "user", loggedInAt: new Date().toISOString() });
  return next;
}

export async function verifyLocalUser(username: string, password: string) {
  const auth = loadLocalAuth();
  if (!auth.user) return false;
  if (auth.user.username.trim().toLowerCase() !== username.trim().toLowerCase()) return false;
  return verifyCredential(auth.user, password);
}

export async function verifyAdmin(username: string, password: string) {
  const auth = loadLocalAuth();
  if (auth.admin.username !== username.trim()) return false;
  return verifyCredential(auth.admin, password);
}

export async function resetLocalUserPassword(password: string) {
  const auth = loadLocalAuth();
  if (!auth.user) return auth;
  const user = await createCredential(auth.user.username, password);
  const next = { ...auth, user };
  saveLocalAuth(next);
  return next;
}

export async function changeAdminPassword(password: string) {
  const auth = loadLocalAuth();
  const admin = await createCredential(auth.admin.username || DEFAULT_ADMIN_USERNAME, password);
  const next = { ...auth, admin };
  saveLocalAuth(next);
  return next;
}

export function unlockAsLocalUser() {
  const auth = loadLocalAuth();
  if (!auth.user) return null;
  const session = { username: auth.user.username, role: "user" as const, loggedInAt: new Date().toISOString() };
  saveLocalSession(session);
  return session;
}

async function createCredential(username: string, password: string): Promise<LocalAuthUser> {
  const salt = randomSalt();
  return {
    username: username.trim(),
    salt,
    passwordHash: await hashPassword(salt, password),
    updatedAt: new Date().toISOString(),
  };
}

async function verifyCredential(user: LocalAuthUser, password: string) {
  return user.passwordHash === await hashPassword(user.salt, password);
}

async function hashPassword(salt: string, password: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function defaultAdmin(): LocalAuthUser {
  return {
    username: DEFAULT_ADMIN_USERNAME,
    salt: DEFAULT_ADMIN_SALT,
    passwordHash: DEFAULT_ADMIN_HASH,
    updatedAt: "2026-07-02T00:00:00.000Z",
  };
}

function randomSalt() {
  const values = new Uint8Array(16);
  crypto.getRandomValues(values);
  return Array.from(values).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function readSessionJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}
