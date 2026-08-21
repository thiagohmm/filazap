import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrganization } from '../use-cases/CreateOrganization';
import { Authenticate } from '../use-cases/Authenticate';
import { InviteMember } from '../use-cases/InviteMember';
import { ListMembers } from '../use-cases/ListMembers';
import { RemoveMember } from '../use-cases/RemoveMember';
import { createTestServices } from './fakes';
import {
  EmailAlreadyRegisteredError,
  SlugAlreadyExistsError,
  InvalidCredentialsError,
  ForbiddenRoleError,
  MemberNotFoundError,
  MemberCannotBeRemovedError
} from '../../domain/errors';
import { Role } from '../../domain/value-objects/Role';

function build(deps = createTestServices()) {
  return {
    deps,
    createOrganization: new CreateOrganization(deps),
    authenticate: new Authenticate(deps),
    inviteMember: new InviteMember(deps),
    listMembers: new ListMembers(deps),
    removeMember: new RemoveMember(deps)
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

describe('RemoveMember', () => {
  async function setup() {
    const services = build();
    const org = await services.createOrganization.execute({
      name: 'Empresa A',
      adminName: 'Ana',
      adminEmail: 'ana@example.com',
      adminPassword: 'senha1234'
    });
    const agent = await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT'
    });
    return { services, org, agent };
  }

  it('proprietário remove um atendente sem apagar seu histórico', async () => {
    const { services, org, agent } = await setup();

    const output = await services.removeMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      memberId: agent.member.id
    });

    expect(output.member.active).toBe(false);
    const removed = await services.deps.members.findById(agent.member.id);
    expect(removed?.active).toBe(false);
    expect(await services.deps.users.findById(agent.member.user.id)).not.toBeNull();
  });

  it('administrador remove um atendente', async () => {
    const { services, org, agent } = await setup();
    const admin = await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'admin2@example.com',
      name: 'Admin 2',
      role: 'ADMIN'
    });

    await expect(services.removeMember.execute({
      actorUserId: admin.member.user.id,
      organizationId: org.organizationId,
      memberId: agent.member.id
    })).resolves.toMatchObject({ member: { active: false } });
  });

  it('atendente não pode remover outro atendente', async () => {
    const { services, org, agent } = await setup();
    const otherAgent = await services.inviteMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      email: 'outro@example.com',
      name: 'Outro',
      role: 'AGENT'
    });

    await expect(services.removeMember.execute({
      actorUserId: agent.member.user.id,
      organizationId: org.organizationId,
      memberId: otherAgent.member.id
    })).rejects.toBeInstanceOf(ForbiddenRoleError);
  });

  it('não permite remover proprietário ou administrador', async () => {
    const { services, org } = await setup();
    const owner = await services.deps.members.findByUserAndOrganization(
      org.user.id,
      org.organizationId
    );

    await expect(services.removeMember.execute({
      actorUserId: org.user.id,
      organizationId: org.organizationId,
      memberId: owner!.id
    })).rejects.toBeInstanceOf(MemberCannotBeRemovedError);
  });
});
