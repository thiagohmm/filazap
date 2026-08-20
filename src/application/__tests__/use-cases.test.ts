import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrganization } from '../use-cases/CreateOrganization';
import { Authenticate } from '../use-cases/Authenticate';
import { InviteMember } from '../use-cases/InviteMember';
import { ListMembers } from '../use-cases/ListMembers';
import { createTestServices } from './fakes';
import {
  EmailAlreadyRegisteredError,
  SlugAlreadyExistsError,
  InvalidCredentialsError,
  ForbiddenRoleError,
  MemberNotFoundError
} from '../../domain/errors';
import { Role } from '../../domain/value-objects/Role';

function build(deps = createTestServices()) {
  return {
    deps,
    createOrganization: new CreateOrganization(deps),
    authenticate: new Authenticate(deps),
    inviteMember: new InviteMember(deps),
    listMembers: new ListMembers(deps)
  };
}

describe('CreateOrganization', () => {
  let services: ReturnType<typeof build>;

  beforeEach(() => {
    services = build();
  });

  it('cria empresa, admin OWNER e retorna token', async () => {
    const out = await services.createOrganization.execute({
      name: 'Minha Empresa',
      adminName: 'João',
      adminEmail: 'joao@example.com',
      adminPassword: 'senha1234'
    });

    expect(out.organizationId).toBeDefined();
    expect(out.slug).toBe('minha-empresa');
    expect(out.user.email).toBe('joao@example.com');
    expect(out.token).toContain('token:');

    const member = await services.deps.members.findByUserAndOrganization(
      out.user.id,
      out.organizationId
    );
    expect(member?.role).toBe(Role.OWNER);
  });

  it('rejeita e-mail já registrado', async () => {
    await services.createOrganization.execute({
      name: 'Empresa A',
      adminName: 'Ana',
      adminEmail: 'ana@example.com',
      adminPassword: 'senha1234'
    });
    await expect(
      services.createOrganization.execute({
        name: 'Empresa B',
        adminName: 'Ana',
        adminEmail: 'ana@example.com',
        adminPassword: 'senha1234'
      })
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('rejeita slug duplicado', async () => {
    await services.createOrganization.execute({
      name: 'Empresa Piloto',
      adminName: 'Ana',
      adminEmail: 'a@example.com',
      adminPassword: 'senha1234'
    });
    await expect(
      services.createOrganization.execute({
        name: 'Empresa-Piloto',
        adminName: 'Bob',
        adminEmail: 'b@example.com',
        adminPassword: 'senha1234'
      })
    ).rejects.toBeInstanceOf(SlugAlreadyExistsError);
  });
});

describe('Authenticate', () => {
  it('autentica com credenciais válidas e lista organizações', async () => {
    const services = build();
    const created = await services.createOrganization.execute({
      name: 'Empresa A',
      adminName: 'Ana',
      adminEmail: 'ana@example.com',
      adminPassword: 'senha1234'
    });

    const out = await services.authenticate.execute({
      email: 'ana@example.com',
      password: 'senha1234'
    });

    expect(out.user.id).toBe(created.user.id);
    expect(out.organizations).toHaveLength(1);
    expect(out.organizations[0].role).toBe('OWNER');
  });

  it('rejeita senha incorreta', async () => {
    const services = build();
    await services.createOrganization.execute({
      name: 'Empresa A',
      adminName: 'Ana',
      adminEmail: 'ana@example.com',
      adminPassword: 'senha1234'
    });

    await expect(
      services.authenticate.execute({
        email: 'ana@example.com',
        password: 'errada'
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejeita usuário inexistente', async () => {
    const services = build();
    await expect(
      services.authenticate.execute({
        email: 'nao@example.com',
        password: 'senha1234'
      })
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe('InviteMember', () => {
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

  it('OWNER convida um AGENT', async () => {
    const { services, org } = await setup();
    const out = await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT'
    });

    expect(out.member.role).toBe('AGENT');
    expect(out.member.user.email).toBe('agente@example.com');
  });

  it('AGENT não pode convidar', async () => {
    const { services, org } = await setup();
    await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT'
    });

    const agentUser = await services.deps.users.findByEmail(
      'agente@example.com'
    );

    await expect(
      services.inviteMember.execute({
        actorUserId: agentUser!.id,
        organizationId: org.organizationId,
        email: 'outro@example.com',
        name: 'Outro',
        role: 'AGENT'
      })
    ).rejects.toBeInstanceOf(ForbiddenRoleError);
  });

  it('rejeita membro que não pertence à organização', async () => {
    const { services, org } = await setup();
    await services.createOrganization.execute({
      name: 'Outra Empresa',
      adminName: 'Carol',
      adminEmail: 'carol@example.com',
      adminPassword: 'senha1234'
    });

    await expect(
      services.inviteMember.execute({
        actorUserId: 'id-3',
        organizationId: org.organizationId,
        email: 'x@example.com',
        name: 'X',
        role: 'AGENT'
      })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});

describe('ListMembers', () => {
  it('lista membros da organização', async () => {
    const { services, org } = await setup();
    const out = await services.listMembers.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId
    });

    expect(out.members).toHaveLength(1);
    expect(out.members[0].user.email).toBe('ana@example.com');
  });

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
});
