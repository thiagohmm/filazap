package com.filazap.test;

import com.filazap.domain.entity.Organization;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrganizationTest {

    @Test
    void geraSlugAPartirDoNomeEDefineValoresPadrao() {
        Organization org = Organization.create("org-1", "Minha Empresa");
        assertEquals("minha-empresa", org.getSlug());
        assertEquals("America/Sao_Paulo", org.getTimezone());
        assertEquals("STARTER", org.getPlan());
        assertEquals("TRIAL", org.getSubscriptionStatus());
    }

    @Test
    void preservaValoresPassadosNaRestauracao() {
        Instant now = Instant.parse("2026-08-19T10:00:00Z");
        Organization org = Organization.restore("org-1", "X", "x", "UTC", "PRO", "ACTIVE",
                "light", "#10b981", now, now);
        assertEquals("UTC", org.getTimezone());
        assertEquals("PRO", org.getPlan());
        assertEquals("ACTIVE", org.getSubscriptionStatus());
    }
}
