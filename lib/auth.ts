export interface StoredUser {
  name: string;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";
const USER_EVENT = "av-user-change";

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
  window.dispatchEvent(new Event(USER_EVENT));
}

// Snapshot en string crudo para usarlo con useSyncExternalStore: dos lecturas
// con el mismo contenido son === (igualdad de valor entre primitivos string),
// así que no dispara renders de más aunque getStoredUser cree un objeto nuevo cada vez.
export function getStoredUserSnapshot(): string {
  if (typeof window === "undefined") return "null";
  return localStorage.getItem(USER_KEY) ?? "null";
}

export function getStoredUserServerSnapshot(): string {
  return "null";
}

export function subscribeStoredUser(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(USER_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(USER_EVENT, callback);
  };
}

export function saveScoreEntry(entry: {
  game: string;
  score: number;
  name: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // localStorage no disponible o corrupto: guardado decorativo, se ignora
  }
}
