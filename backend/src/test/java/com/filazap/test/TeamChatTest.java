package com.filazap.test;

import com.filazap.application.usecase.CreateOrganization;
import com.filazap.application.usecase.HeartbeatTeamChat;
import com.filazap.application.usecase.InviteMember;
import com.filazap.application.usecase.ListTeamChat;
import com.filazap.application.usecase.SendTeamChatMessage;
import com.filazap.domain.error.ChatRecipientUnavailableError;
import com.filazap.domain.error.ForbiddenRoleError;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.filazap.test.Maps.list;
import static com.filazap.test.Maps.map;
import static com.filazap.test.Maps.str;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TeamChatTest {

    private static final class Services {
        final TestFakes.TestServices base = TestFakes.testServices();
        final TestFakes.InMemoryTeamChatRepository teamChat = new TestFakes.InMemoryTeamChatRepository();
        final TestFakes.MutableClock clock = new TestFakes.MutableClock(Instant.parse("2026-08-21T18:00:00Z"));
        final Map<String, Object> organization;
        final Map<String, Object> agent;
        final Map<String, Object> otherAgent;
        final Map<String, Object> viewer;
        final HeartbeatTeamChat heartbeat;
        final ListTeamChat list;
        final SendTeamChatMessage send;

        Services() {
            CreateOrganization createOrganization = new CreateOrganization(base.organizations, base.users,
                    base.members, base.passwordHasher, base.tokenService, base.clock, base.logger, base.idGenerator);
            InviteMember inviteMember = new InviteMember(base.users, base.members, base.organizations,
                    base.passwordHasher, base.clock, base.logger, base.idGenerator);

            organization = createOrganization.execute("Empresa Chat", "Ana", "ana@example.com", "senha1234");
            String ownerId = str(map(organization, "user"), "id");
            String orgId = str(organization, "organizationId");
            agent = inviteMember.execute(ownerId, orgId, "agente@example.com", "Bruno", "AGENT");
            otherAgent = inviteMember.execute(ownerId, orgId, "outro@example.com", "Carla", "AGENT");
            viewer = inviteMember.execute(ownerId, orgId, "leitor@example.com", "Leitor", "VIEWER");

            heartbeat = new HeartbeatTeamChat(base.members, teamChat, clock);
            list = new ListTeamChat(base.users, base.members, teamChat, clock);
            send = new SendTeamChatMessage(base.members, teamChat, clock, base.logger, base.idGenerator);
        }

        String ownerId() { return str(map(organization, "user"), "id"); }
        String orgId() { return str(organization, "organizationId"); }
        String agentId() { return str(map(map(agent, "member"), "user"), "id"); }
        String otherAgentId() { return str(map(map(otherAgent, "member"), "user"), "id"); }
        String viewerId() { return str(map(map(viewer, "member"), "user"), "id"); }
    }

    @Test
    void listaSomenteMembrosAtivosNoUltimoMinuto() {
        Services s = new Services();
        s.heartbeat.execute(s.ownerId(), s.orgId());
        s.heartbeat.execute(s.agentId(), s.orgId());

        Map<String, Object> chat = s.list.execute(s.ownerId(), s.orgId());
        List<String> names = list(chat, "onlineMembers").stream()
                .map(m -> str(m, "name")).toList();
        assertEquals(List.of("Ana", "Bruno"), names);
    }

    @Test
    void mantemMensagemDiretaPrivada() {
        Services s = new Services();
        s.heartbeat.execute(s.ownerId(), s.orgId());
        s.heartbeat.execute(s.agentId(), s.orgId());
        s.heartbeat.execute(s.otherAgentId(), s.orgId());

        s.send.execute(s.ownerId(), s.orgId(), s.agentId(), "Mensagem privada");

        Map<String, Object> recipient = s.list.execute(s.agentId(), s.orgId());
        Map<String, Object> thirdParty = s.list.execute(s.otherAgentId(), s.orgId());
        assertEquals(1, list(recipient, "messages").size());
        assertEquals(0, list(thirdParty, "messages").size());
    }

    @Test
    void entregaMensagemParaTodaAEquipe() {
        Services s = new Services();
        s.send.execute(s.ownerId(), s.orgId(), null, "Aviso geral");
        Map<String, Object> chat = s.list.execute(s.otherAgentId(), s.orgId());
        assertEquals("Aviso geral", str(list(chat, "messages").get(0), "body"));
        assertNull(list(chat, "messages").get(0).get("recipient"));
    }

    @Test
    void rejeitaMensagemDiretaParaAtendenteOffline() {
        Services s = new Services();
        assertThrows(ChatRecipientUnavailableError.class,
                () -> s.send.execute(s.ownerId(), s.orgId(), s.agentId(), "Você está aí?"));
    }

    @Test
    void naoPermiteQueLeitorEntreNoChatOperacional() {
        Services s = new Services();
        assertThrows(ForbiddenRoleError.class,
                () -> s.heartbeat.execute(s.viewerId(), s.orgId()));
    }
}
