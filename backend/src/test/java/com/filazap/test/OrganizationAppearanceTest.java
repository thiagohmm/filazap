package com.filazap.test;

import com.filazap.application.usecase.CreateOrganization;
import com.filazap.application.usecase.GetOrganizationAppearance;
import com.filazap.application.usecase.InviteMember;
import com.filazap.application.usecase.UpdateOrganizationAppearance;
import com.filazap.domain.error.ForbiddenRoleError;
import com.filazap.domain.error.MemberNotFoundError;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static com.filazap.test.Maps.map;
import static com.filazap.test.Maps.str;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OrganizationAppearanceTest {

    private static final class Services {
        final TestFakes.TestServices base = TestFakes.testServices();
        final CreateOrganization createOrganization;
        final InviteMember inviteMember;
        final UpdateOrganizationAppearance update;
        final GetOrganizationAppearance get;

        Services() {
            createOrganization = new CreateOrganization(base.organizations, base.users, base.members,
                    base.passwordHasher, base.tokenService, base.clock, base.logger, base.idGenerator);
            inviteMember = new InviteMember(base.users, base.members, base.organizations,
                    base.passwordHasher, base.clock, base.logger, base.idGenerator);
            update = new UpdateOrganizationAppearance(base.organizations, base.members, base.logger, base.clock);
            get = new GetOrganizationAppearance(base.organizations, base.members);
        }
    }

    private static final class Setup {
        final Services services;
        final Map<String, Object> org;

        Setup() {
            services = new Services();
            org = services.createOrganization.execute("Empresa A", "Ana", "ana@example.com", "senha1234");
        }
    }

    private static String ownerId(Map<String, Object> org) { return str(map(org, "user"), "id"); }
    private static String orgId(Map<String, Object> org) { return str(org, "organizationId"); }

    @Test
    void atualizaTemaECorDaEmpresa() {
        Setup setup = new Setup();
        Map<String, Object> out = setup.services.update.execute(ownerId(setup.org), orgId(setup.org), "dark", "#25D366");
        assertEquals("dark", str(map(out, "organization"), "theme"));
        assertEquals("#25D366", str(map(out, "organization"), "brandColor"));

        Map<String, Object> current = setup.services.get.execute(ownerId(setup.org), orgId(setup.org));
        assertEquals("dark", str(map(current, "organization"), "theme"));
        assertEquals("#25D366", str(map(current, "organization"), "brandColor"));
    }

    @Test
    void mantemValoresAtuaisQuandoCamposNaoSaoInformados() {
        Setup setup = new Setup();
        setup.services.update.execute(ownerId(setup.org), orgId(setup.org), "dark", null);
        Map<String, Object> out = setup.services.update.execute(ownerId(setup.org), orgId(setup.org), null, "#3b82f6");
        assertEquals("dark", str(map(out, "organization"), "theme"));
        assertEquals("#3b82f6", str(map(out, "organization"), "brandColor"));
    }

    @Test
    void temaPadraoEClaroComCorEsmeralda() {
        Setup setup = new Setup();
        Map<String, Object> out = setup.services.get.execute(ownerId(setup.org), orgId(setup.org));
        assertEquals("light", str(map(out, "organization"), "theme"));
        assertEquals("#10b981", str(map(out, "organization"), "brandColor"));
    }

    @Test
    void agentNaoPodeAlterarAparencia() {
        Setup setup = new Setup();
        setup.services.inviteMember.execute(ownerId(setup.org), orgId(setup.org),
                "agente@example.com", "Agente", "AGENT");
        var agentUser = setup.services.base.users.findByEmail("agente@example.com");
        assertThrows(ForbiddenRoleError.class,
                () -> setup.services.update.execute(agentUser.getId(), orgId(setup.org), "dark", null));
    }

    @Test
    void naoPermiteAlterarOrganizacaoInexistente() {
        Setup setup = new Setup();
        assertThrows(MemberNotFoundError.class,
                () -> setup.services.update.execute(ownerId(setup.org), "org-inexistente", "dark", null));
    }

    @Test
    void retornaAparenciaParaMembroAtivo() {
        Setup setup = new Setup();
        Map<String, Object> out = setup.services.get.execute(ownerId(setup.org), orgId(setup.org));
        assertEquals(orgId(setup.org), str(map(out, "organization"), "id"));
        assertEquals("Empresa A", str(map(out, "organization"), "name"));
    }

    @Test
    void falhaParaOrganizacaoInexistente() {
        Setup setup = new Setup();
        assertThrows(MemberNotFoundError.class,
                () -> setup.services.get.execute(ownerId(setup.org), "org-inexistente"));
    }

    @Test
    void falhaQuandoMembroNaoPertence() {
        Setup setup = new Setup();
        Map<String, Object> other = setup.services.createOrganization.execute(
                "Empresa B", "Bia", "bia@example.com", "senha1234");
        assertThrows(MemberNotFoundError.class,
                () -> setup.services.get.execute(ownerId(other), orgId(setup.org)));
    }
}
