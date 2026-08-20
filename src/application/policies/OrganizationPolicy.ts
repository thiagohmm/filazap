import { ForbiddenRoleError } from '../../domain/errors/ForbiddenRoleError';
import { Role } from '../../domain/value-objects/Role';

export type Actor = {
  userId: string;
  role: Role;
  active: boolean;
};

export class OrganizationPolicy {
  static canManageMembers(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar membros');
    }
    if (!Role.canManageMembers(actor.role)) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar membros');
    }
  }

  static canViewMembers(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'visualizar membros');
    }
  }

  static canManageChannels(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar canais');
    }
    if (!Role.canManageMembers(actor.role)) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar canais');
    }
  }

  static canViewChannels(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'visualizar canais');
    }
  }

  static canManageSettings(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar configurações');
    }
    if (!Role.canManageMembers(actor.role)) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar configurações');
    }
  }

  static canViewSettings(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'visualizar configurações');
    }
  }

  static canSendMessages(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'enviar mensagens');
    }
    if (!Role.canSendMessages(actor.role)) {
      throw new ForbiddenRoleError(actor.role, 'enviar mensagens');
    }
  }

  static canViewTickets(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'visualizar atendimentos');
    }
  }

  static canHandleTickets(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar atendimentos');
    }
    if (!Role.canHandleTickets(actor.role)) {
      throw new ForbiddenRoleError(actor.role, 'gerenciar atendimentos');
    }
  }

  static canAddNotes(actor: Actor): void {
    if (!actor.active) {
      throw new ForbiddenRoleError(actor.role, 'adicionar notas internas');
    }
    if (!Role.canAddNotes(actor.role)) {
      throw new ForbiddenRoleError(actor.role, 'adicionar notas internas');
    }
  }
}
