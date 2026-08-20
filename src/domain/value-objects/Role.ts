import { InvalidRoleError } from '../errors/InvalidRoleError';

export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER'
}

export namespace Role {
  export function fromString(raw: string): Role {
    switch (raw.toUpperCase()) {
      case 'OWNER':
        return Role.OWNER;
      case 'ADMIN':
        return Role.ADMIN;
      case 'AGENT':
        return Role.AGENT;
      case 'VIEWER':
        return Role.VIEWER;
      default:
        throw new InvalidRoleError(raw);
    }
  }

  export const ALL: readonly Role[] = [
    Role.OWNER,
    Role.ADMIN,
    Role.AGENT,
    Role.VIEWER
  ] as const;

  export function canManageMembers(role: Role): boolean {
    return role === Role.OWNER || role === Role.ADMIN;
  }

  export function canSendMessages(role: Role): boolean {
    return (
      role === Role.OWNER ||
      role === Role.ADMIN ||
      role === Role.AGENT
    );
  }

  export function canHandleTickets(role: Role): boolean {
    return (
      role === Role.OWNER ||
      role === Role.ADMIN ||
      role === Role.AGENT
    );
  }

  export function canAddNotes(role: Role): boolean {
    return (
      role === Role.OWNER ||
      role === Role.ADMIN ||
      role === Role.AGENT
    );
  }
}
