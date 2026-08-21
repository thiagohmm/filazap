import { describe, expect, it } from 'vitest';
import { ChatRecipientUnavailableError, ForbiddenRoleError } from '../../domain/errors';
import type {
  TeamChatRecord,
  TeamChatRepository
} from '../ports/TeamChatRepository';
import { CreateOrganization } from '../use-cases/CreateOrganization';
import { HeartbeatTeamChat } from '../use-cases/HeartbeatTeamChat';
import { InviteMember } from '../use-cases/InviteMember';
import { ListTeamChat } from '../use-cases/ListTeamChat';
import { SendTeamChatMessage } from '../use-cases/SendTeamChatMessage';
import { createTestServices } from './fakes';

class InMemoryTeamChatRepository implements TeamChatRepository {
  private presences = new Map<string, Date>();
  private messages: TeamChatRecord[] = [];

  async touchPresence(organizationId: string, userId: string, now: Date): Promise<void> {
    this.presences.set(`${organizationId}:${userId}`, now);
  }

  async listOnlineUserIds(organizationId: string, since: Date): Promise<string[]> {
    return [...this.presences.entries()]
      .filter(([key, date]) => key.startsWith(`${organizationId}:`) && date >= since)
      .map(([key]) => key.slice(organizationId.length + 1));
  }

  async isUserOnline(organizationId: string, userId: string, since: Date): Promise<boolean> {
    return (this.presences.get(`${organizationId}:${userId}`)?.getTime() ?? 0) >= since.getTime();
  }

  async save(message: TeamChatRecord): Promise<TeamChatRecord> {
    this.messages.push(message);
    return message;
  }

  async listVisibleMessages(organizationId: string, userId: string, limit: number): Promise<TeamChatRecord[]> {
    return this.messages.filter((message) =>
      message.organizationId === organizationId &&
      (!message.recipientUserId || message.senderUserId === userId || message.recipientUserId === userId)
    ).slice(-limit);
  }
}

async function setup() {
  const base = createTestServices();
  const teamChat = new InMemoryTeamChatRepository();
  let now = new Date('2026-08-21T18:00:00Z');
  const clock = { now: () => now };
  const createOrganization = new CreateOrganization(base);
  const inviteMember = new InviteMember(base);
  const organization = await createOrganization.execute({
    name: 'Empresa Chat',
    adminName: 'Ana',
    adminEmail: 'ana@example.com',
    adminPassword: 'senha1234'
  });
  const agent = await inviteMember.execute({
    actorUserId: organization.user.id,
    organizationId: organization.organizationId,
    email: 'agente@example.com',
    name: 'Bruno',
    role: 'AGENT'
  });
  const otherAgent = await inviteMember.execute({
    actorUserId: organization.user.id,
    organizationId: organization.organizationId,
    email: 'outro@example.com',
    name: 'Carla',
    role: 'AGENT'
  });
  const viewer = await inviteMember.execute({
    actorUserId: organization.user.id,
    organizationId: organization.organizationId,
    email: 'leitor@example.com',
    name: 'Leitor',
    role: 'VIEWER'
  });
  const deps = { ...base, teamChat, clock };
  return {
    organization,
    agent,
    otherAgent,
    viewer,
    heartbeat: new HeartbeatTeamChat(deps),
    list: new ListTeamChat(deps),
    send: new SendTeamChatMessage(deps),
    setNow: (value: Date) => { now = value; }
  };
}

describe('Team chat', () => {
  it('lista somente membros ativos no último minuto', async () => {
    const services = await setup();
    await services.heartbeat.execute({
      actorUserId: services.organization.user.id,
      organizationId: services.organization.organizationId
    });
    await services.heartbeat.execute({
      actorUserId: services.agent.member.user.id,
      organizationId: services.organization.organizationId
    });

    const chat = await services.list.execute({
      actorUserId: services.organization.user.id,
      organizationId: services.organization.organizationId
    });
    expect(chat.onlineMembers.map((member) => member.name)).toEqual(['Ana', 'Bruno']);
  });

  it('mantém mensagem direta privada entre remetente e destinatário', async () => {
    const services = await setup();
    for (const userId of [services.organization.user.id, services.agent.member.user.id, services.otherAgent.member.user.id]) {
      await services.heartbeat.execute({ actorUserId: userId, organizationId: services.organization.organizationId });
    }
    await services.send.execute({
      actorUserId: services.organization.user.id,
      organizationId: services.organization.organizationId,
      recipientUserId: services.agent.member.user.id,
      body: 'Mensagem privada'
    });

    const recipientChat = await services.list.execute({
      actorUserId: services.agent.member.user.id,
      organizationId: services.organization.organizationId
    });
    const thirdPartyChat = await services.list.execute({
      actorUserId: services.otherAgent.member.user.id,
      organizationId: services.organization.organizationId
    });
    expect(recipientChat.messages).toHaveLength(1);
    expect(thirdPartyChat.messages).toHaveLength(0);
  });

  it('entrega mensagem para toda a equipe', async () => {
    const services = await setup();
    await services.send.execute({
      actorUserId: services.organization.user.id,
      organizationId: services.organization.organizationId,
      body: 'Aviso geral'
    });
    const chat = await services.list.execute({
      actorUserId: services.otherAgent.member.user.id,
      organizationId: services.organization.organizationId
    });
    expect(chat.messages[0].body).toBe('Aviso geral');
    expect(chat.messages[0].recipient).toBeNull();
  });

  it('rejeita mensagem direta para atendente offline', async () => {
    const services = await setup();
    await expect(services.send.execute({
      actorUserId: services.organization.user.id,
      organizationId: services.organization.organizationId,
      recipientUserId: services.agent.member.user.id,
      body: 'Você está aí?'
    })).rejects.toBeInstanceOf(ChatRecipientUnavailableError);
  });

  it('não permite que leitor entre no chat operacional', async () => {
    const services = await setup();
    await expect(services.heartbeat.execute({
      actorUserId: services.viewer.member.user.id,
      organizationId: services.organization.organizationId
    })).rejects.toBeInstanceOf(ForbiddenRoleError);
  });
});
