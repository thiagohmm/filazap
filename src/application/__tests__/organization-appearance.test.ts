import { describe, it, expect } from 'vitest';
import { CreateOrganization } from '../use-cases/CreateOrganization';
import { InviteMember } from '../use-cases/InviteMember';
import { UpdateOrganizationAppearance } from '../use-cases/UpdateOrganizationAppearance';
import { GetOrganizationAppearance } from '../use-cases/GetOrganizationAppearance';
import { createTestServices } from './fakes';
import {
  ForbiddenRoleError,
  MemberNotFoundError
} from '../../domain/errors';

function build() {
  const base = createTestServices();
  const createOrganization = new CreateOrganization(base);
  const inviteMember = new InviteMember({
    users: base.users,
    members: base.members,
    organizations: base.organizations,
    passwordHasher: base.passwordHasher,
    clock: base.clock,
    logger: base.logger,
    idGenerator: base.idGenerator,
    generateTemporaryPassword: base.generateTemporaryPassword
  });
  const updateOrganizationAppearance = new UpdateOrganizationAppearance({
    organizations: base.organizations,
    members: base.members,
    logger: base.logger,
    clock: base.clock
  });
  const getOrganizationAppearance = new GetOrganizationAppearance({
    organizations: base.organizations,
    members: base.members
  });

  return {
    base,
    createOrganization,
    inviteMember,
    updateOrganizationAppearance,
    getOrganizationAppearance
  };
}

async function setup() {
  const services = build();
  const org = await services.createOrganization.execute({
    name: 'Empresa A',
    adminName: 'Ana',
    adminEmail: 'ana@example.com',
    adminPassword: 'senha1234'
  });
  return { services, org };
}

describe('UpdateOrganizationAppearance', () => {
  it('atualiza tema e cor da empresa', async () => {
    const { services, org } = await setup();
    const out = await services.updateOrganizationAppearance.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      theme: 'dark',
      brandColor: '#25D366'
    });
    expect(out.organization.theme).toBe('dark');
    expect(out.organization.brandColor).toBe('#25D366');

    const current = await services.getOrganizationAppearance.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId
    });
    expect(current.organization.theme).toBe('dark');
    expect(current.organization.brandColor).toBe('#25D366');
  });

  it('mantém valores atuais quando campos não são informados', async () => {
    const { services, org } = await setup();
    await services.updateOrganizationAppearance.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      theme: 'dark'
    });
    const out = await services.updateOrganizationAppearance.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      brandColor: '#3b82f6'
    });
    expect(out.organization.theme).toBe('dark');
    expect(out.organization.brandColor).toBe('#3b82f6');
  });

  it('tema padrão é claro com cor esmeralda', async () => {
    const { services, org } = await setup();
    const out = await services.getOrganizationAppearance.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId
    });
    expect(out.organization.theme).toBe('light');
    expect(out.organization.brandColor).toBe('#10b981');
  });

  it('AGENT não pode alterar aparência', async () => {
    const { services, org } = await setup();
    await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT'
    });
    const agentUser = await services.base.users.findByEmail('agente@example.com');
    await expect(
      services.updateOrganizationAppearance.execute({
        actorUserId: agentUser!.id,
        organizationId: org.organizationId,
        theme: 'dark'
      })
    ).rejects.toBeInstanceOf(ForbiddenRoleError);
  });

  it('não permite alterar organização inexistente', async () => {
    const { services, org } = await setup();
    await expect(
      services.updateOrganizationAppearance.execute({
        actorUserId: org.user.id,
        organizationId: 'org-inexistente',
        theme: 'dark'
      })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});

describe('GetOrganizationAppearance', () => {
  it('retorna aparência da empresa para membro ativo', async () => {
    const { services, org } = await setup();
    const out = await services.getOrganizationAppearance.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId
    });
    expect(out.organization.id).toBe(org.organizationId);
    expect(out.organization.name).toBe('Empresa A');
  });

  it('falha para organização inexistente', async () => {
    const { services, org } = await setup();
    await expect(
      services.getOrganizationAppearance.execute({
        actorUserId: org.user.id,
        organizationId: 'org-inexistente'
      })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it('falha quando organização existe mas membro não pertence', async () => {
    const { services, org } = await setup();
    const out = await services.createOrganization.execute({
      name: 'Empresa B',
      adminName: 'Bia',
      adminEmail: 'bia@example.com',
      adminPassword: 'senha1234'
    });
    await expect(
      services.getOrganizationAppearance.execute({
        actorUserId: out.user.id,
        organizationId: org.organizationId
      })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});
