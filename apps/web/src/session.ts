import { Session } from './types';

const storageKey = 'taxi-rio-session';

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || (parsed.profile?.role !== 'passenger' && parsed.profile?.role !== 'driver')) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  sessionStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(storageKey);
}
