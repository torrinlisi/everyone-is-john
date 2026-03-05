const KEY = "eij:session";

export interface SessionData {
  roomId: string;
  playerId: string;
}

export function saveSession(data: SessionData): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function getSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (data?.roomId && data?.playerId) return data;
    return null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
