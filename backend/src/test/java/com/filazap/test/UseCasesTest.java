package com.filazap.test;

import com.filazap.application.usecase.Authenticate;
import com.filazap.application.usecase.CreateOrganization;
import com.filazap.application.usecase.InviteMember;
import com.filazap.application.usecase.ListMembers;
import com.filazap.application.usecase.RemoveMember;
import com.filazap.domain.error.EmailAlreadyRegisteredError;
import com.filazap.domain.error.ForbiddenRoleError;
import com.filazap.domain.error.InvalidCredentialsError;
import com.filazap.domain.error.MemberCannotBeRemovedError;
import com.filazap.domain.error.MemberNotFoundError;
import com.filazap.domain.error.SlugAlreadyExistsError;
import com.filazap.domain.valueobject.Role;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static com.filazap.test.Maps.list;
import static com.filazap.test.Maps.map;
import static com.filazap.test.Maps.str;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UseCasesTest {

    private static final class Services {
        final TestFakes.TestServices deps;
        final CreateOrganization createOrganization;
        final Authenticate authenticate;
        final InviteMember inviteMember;
        final ListMembers listMembers;
        final RemoveMember removeMember;

        Services() {
            this.deps = TestFakes.testServices();
            this.createOrganization = new CreateOrganization(deps.organizations, deps.users, deps.members,
                    deps.passwordHasher, deps.tokenService, deps.clock, deps.logger, deps.idGenerator);
            this.authenticate = new Authenticate(deps.users, deps.members, deps.passwordHasher,
                    deps.tokenService, deps.logger);
            this.inviteMember = new InviteMember(deps.users, deps.members, deps.organizations,
                    deps.passwordHasher, deps.clock, deps.logger, deps.idGenerator);
            this.listMembers = new ListMembers(deps.users, deps.members);
            this.removeMember = new RemoveMember(deps.members, deps.clock, deps.logger);
        }
    }

    private Map<String, Object> createOrg(Services s, String name, String adminName, String email) {
        return s.createOrganization.execute(name, adminName, email, "senha1234");
    }

    @Test
    void criaEmpresaAdminOwnerERetornaToken() {
        Services s = new Services();
        Map<String, Object> out = createOrg(s, "Minha Empresa", "João", "joao@example.com");

        assertNotNull(out.get("organizationId"));
        assertEquals("minha-empresa", str(out, "slug"));
        assertEquals("joao@example.com", str(map(out, "user"), "email"));
        assertTrue(str(out, "token").contains("token:"));

        var member = s.deps.members.findByUserAndOrganization(
                str(map(out, "user"), "id"), str(out, "organizationId"));
        assertEquals(Role.OWNER, member.getRole());
    }

    @Test
    void rejeitaEmailJaRegistrado() {
        Services s = new Services();
        createOrg(s, "Empresa A", "Ana", "ana@example.com");
        assertThrows(EmailAlreadyRegisteredError.class,
                () -> createOrg(s, "Empresa B", "Ana", "ana@example.com"));
    }

    @Test
    void rejeitaSlugDuplicado() {
        Services s = new Services();
        createOrg(s, "Empresa Piloto", "Ana", "a@example.com");
        assertThrows(SlugAlreadyExistsError.class,
                () -> createOrg(s, "Empresa-Piloto", "Bob", "b@example.com"));
    }

    @Test
    void autenticaComCredenciaisValidasEListaOrganizacoes() {
        Services s = new Services();
        Map<String, Object> created = createOrg(s, "Empresa A", "Ana", "ana@example.com");

        Map<String, Object> out = s.authenticate.execute("ana@example.com", "senha1234");

        assertEquals(str(map(created, "user"), "id"), str(map(out, "user"), "id"));
        assertEquals(1, list(out, "organizations").size());
        assertEquals("OWNER", str(list(out, "organizations").get(0), "role"));
    }

    @Test
    void rejeitaSenhaIncorreta() {
        Services s = new Services();
        createOrg(s, "Empresa A", "Ana", "ana@example.com");
        assertThrows(InvalidCredentialsError.class,
                () -> s.authenticate.execute("ana@example.com", "errada"));
    }

    @Test
    void rejeitaUsuarioInexistente() {
        Services s = new Services();
        assertThrows(InvalidCredentialsError.class,
                () -> s.authenticate.execute("nao@example.com", "senha1234"));
    }

    private static final class Setup {
        final Services services;
        final Map<String, Object> org;

        Setup() {
            services = new Services();
            org = services.createOrganization.execute("Empresa A", "Ana", "ana@example.com", "senha1234");
        }
    }

    @Test
    void ownerConvidaUmAgent() {
        Setup setup = new Setup();
        Map<String, Object> out = setup.services.inviteMember.execute(
                str(map(setup.org, "user"), "id"), str(setup.org, "organizationId"),
                "agente@example.com", "Agente", "AGENT");
        assertEquals("AGENT", str(map(out, "member"), "role"));
        assertEquals("agente@example.com", str(map(map(out, "member"), "user"), "email"));
    }

    @Test
    void agentNaoPodeConvidar() {
        Setup setup = new Setup();
        setup.services.inviteMember.execute(str(map(setup.org, "user"), "id"),
                str(setup.org, "organizationId"), "agente@example.com", "Agente", "AGENT");
        var agentUser = setup.services.deps.users.findByEmail("agente@example.com");
        assertThrows(ForbiddenRoleError.class, () -> setup.services.inviteMember.execute(
                agentUser.getId(), str(setup.org, "organizationId"), "outro@example.com", "Outro", "AGENT"));
    }

    @Test
    void rejeitaMembroQueNaoPertenceAOrganizacao() {
        Setup setup = new Setup();
        setup.services.createOrganization.execute("Outra Empresa", "Carol", "carol@example.com", "senha1234");
        assertThrows(MemberNotFoundError.class, () -> setup.services.inviteMember.execute(
                "id-3", str(setup.org, "organizationId"), "x@example.com", "X", "AGENT"));
    }

    @Test
    void listaMembrosDaOrganizacao() {
        Setup setup = new Setup();
        Map<String, Object> out = setup.services.listMembers.execute(
                str(map(setup.org, "user"), "id"), str(setup.org, "organizationId"));
        assertEquals(1, list(out, "members").size());
        assertEquals("ana@example.com", str(map(list(out, "members").get(0), "user"), "email"));
    }

    private static final class RemoveSetup {
        final Services services;
        final Map<String, Object> org;
        final Map<String, Object> agent;

        RemoveSetup() {
            services = new Services();
            org = services.createOrganization.execute("Empresa A", "Ana", "ana@example.com", "senha1234");
            agent = services.inviteMember.execute(str(map(org, "user"), "id"), str(org, "organizationId"),
                    "agente@example.com", "Agente", "AGENT");
        }
    }

    @Test
    void proprietarioRemoveUmAtendenteSemApagarHistorico() {
        RemoveSetup setup = new RemoveSetup();
        Map<String, Object> out = setup.services.removeMember.execute(
                str(map(setup.org, "user"), "id"), str(setup.org, "organizationId"),
                str(map(setup.agent, "member"), "id"));

        assertFalse((Boolean) map(out, "member").get("active"));
        var removed = setup.services.deps.members.findById(str(map(setup.agent, "member"), "id"));
        assertFalse(removed.isActive());
        assertNotNull(setup.services.deps.users.findById(str(map(map(setup.agent, "member"), "user"), "id")));
    }

    @Test
    void administradorRemoveUmAtendente() {
        RemoveSetup setup = new RemoveSetup();
        Map<String, Object> admin = setup.services.inviteMember.execute(
                str(map(setup.org, "user"), "id"), str(setup.org, "organizationId"),
                "admin2@example.com", "Admin 2", "ADMIN");
        Map<String, Object> out = setup.services.removeMember.execute(
                str(map(map(admin, "member"), "user"), "id"), str(setup.org, "organizationId"),
                str(map(setup.agent, "member"), "id"));
        assertFalse((Boolean) map(out, "member").get("active"));
    }

    @Test
    void atendenteNaoPodeRemoverOutroAtendente() {
        RemoveSetup setup = new RemoveSetup();
        Map<String, Object> other = setup.services.inviteMember.execute(
                str(map(setup.org, "user"), "id"), str(setup.org, "organizationId"),
                "outro@example.com", "Outro", "AGENT");
        assertThrows(ForbiddenRoleError.class, () -> setup.services.removeMember.execute(
                str(map(map(setup.agent, "member"), "user"), "id"), str(setup.org, "organizationId"),
                str(map(other, "member"), "id")));
    }

    @Test
    void naoPermiteRemoverProprietarioOuAdministrador() {
        RemoveSetup setup = new RemoveSetup();
        var owner = setup.services.deps.members.findByUserAndOrganization(
                str(map(setup.org, "user"), "id"), str(setup.org, "organizationId"));
        assertThrows(MemberCannotBeRemovedError.class, () -> setup.services.removeMember.execute(
                str(map(setup.org, "user"), "id"), str(setup.org, "organizationId"), owner.getId()));
    }
}
