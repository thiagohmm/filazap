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
const JWT_RE = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

function isOrganization(value: unknown): value is OrganizationInfo {
  if (!value || typeof value !== 'object') return false;
  const org = value as Partial<OrganizationInfo>;
  return (
    typeof org.id === 'string' &&
    org.id.length > 0 &&
    typeof org.name === 'string' &&
    org.name.length > 0 &&
    typeof org.slug === 'string' &&
    org.slug.length > 0 &&
    typeof org.role === 'string' &&
    org.role.length > 0
  );
}

function normalizeSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Session>;
  if (
    typeof candidate.token !== 'string' ||
    !candidate.token ||
    !JWT_RE.test(candidate.token)
  ) {
    return null;
  }
  if (!candidate.user || typeof candidate.user !== 'object') return null;
  const user = candidate.user as { id?: unknown; name?: unknown; email?: unknown };
  if (
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string'
  ) {
    return null;
  }
  if (!Array.isArray(candidate.organizations)) return null;
  const organizations = candidate.organizations.filter(isOrganization);
  if (organizations.length !== candidate.organizations.length) return null;
  return {
    token: candidate.token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    },
    organizations
  };
}

export function saveSession(session: Session): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizeSession(session);
  if (!normalized) return;
  localStorage.setItem(KEY, JSON.stringify(normalized));
}

export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeSession(JSON.parse(raw)) : null;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
