export type OrganizationInfo = {
  id: string;
  name: string;
  slug: string;
  role: string;
  theme?: string;
  brandColor?: string;
};

export type Session = {
  token: string;
  user: { id: string; name: string; email: string };
  organizations: OrganizationInfo[];
};

const KEY = 'filazap_session';

export function saveSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
