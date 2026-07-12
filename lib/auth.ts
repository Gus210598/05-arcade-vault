export interface StoredUser {
  name: string;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

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
