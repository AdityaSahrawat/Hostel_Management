export type StaffRole = "WARDEN" | "STAFF";

export type StoredAuth = {
  token: string;
  user: {
    id: string;
    username: string;
    role: StaffRole;
  };
};

const STORAGE_KEY = "fsd_staff_auth";

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.user?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
