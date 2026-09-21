package com.filazap.test;

import com.filazap.domain.error.InvalidEmailError;
import com.filazap.domain.error.InvalidPhoneNumberError;
import com.filazap.domain.error.InvalidRoleError;
import com.filazap.domain.error.InvalidSlugError;
import com.filazap.domain.valueobject.ChannelStatus;
import com.filazap.domain.valueobject.Email;
import com.filazap.domain.valueobject.MessageDirection;
import com.filazap.domain.valueobject.PhoneNumberE164;
import com.filazap.domain.valueobject.Role;
import com.filazap.domain.valueobject.Slug;
import com.filazap.domain.valueobject.WebhookEventStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ValueObjectsTest {

    @Test
    void slugNormalizaEValida() {
        assertEquals("minha-empresa", Slug.create("minha-empresa").value());
        assertEquals("minha-empresa-ltda", Slug.createFromName("  Minha Empresa Ltda  ").value());
    }

    @Test
    void slugNormalizaAcentos() {
        assertEquals("cafe-bar", Slug.createFromName("Café & Bar").value());
    }

    @Test
    void slugRejeitaCaracteresInvalidos() {
        assertThrows(InvalidSlugError.class, () -> Slug.create("Empresa!"));
    }

    @Test
    void emailValidaENormaliza() {
        assertEquals("user@example.com", Email.create("  User@Example.COM ").value());
    }

    @Test
    void emailRejeitaInvalido() {
        assertThrows(InvalidEmailError.class, () -> Email.create("invalido"));
    }

    @Test
    void roleConverteString() {
        assertEquals(Role.AGENT, Role.fromString("agent"));
    }

    @Test
    void roleRejeitaPapelInvalido() {
        assertThrows(InvalidRoleError.class, () -> Role.fromString("SUPER"));
    }

    @Test
    void apenasOwnerAdminGerenciamMembros() {
        assertTrue(Role.canManageMembers(Role.OWNER));
        assertTrue(Role.canManageMembers(Role.ADMIN));
        assertFalse(Role.canManageMembers(Role.AGENT));
        assertFalse(Role.canManageMembers(Role.VIEWER));
    }

    @Test
    void apenasViewerNaoPodeEnviarMensagens() {
        assertTrue(Role.canSendMessages(Role.OWNER));
        assertTrue(Role.canSendMessages(Role.AGENT));
        assertFalse(Role.canSendMessages(Role.VIEWER));
    }

    @Test
    void phoneNormalizaParaE164() {
        assertEquals("+5511999990001", PhoneNumberE164.create("5511999990001").e164());
        assertEquals("+5511999990001", PhoneNumberE164.create("+55 11 99999-0001").e164());
    }

    @Test
    void phoneRejeitaNumeroInvalido() {
        assertThrows(InvalidPhoneNumberError.class, () -> PhoneNumberE164.create("abc"));
    }

    @Test
    void messageDirectionConverteString() {
        assertEquals(MessageDirection.INBOUND, MessageDirection.fromString("inbound"));
        assertEquals(MessageDirection.OUTBOUND, MessageDirection.fromString("OUTBOUND"));
    }

    @Test
    void channelStatusConverteString() {
        assertEquals(ChannelStatus.CONNECTED, ChannelStatus.fromString("connected"));
        assertEquals(ChannelStatus.FAILED, ChannelStatus.fromString("FAILED"));
    }

    @Test
    void webhookEventStatusConverteString() {
        assertEquals(WebhookEventStatus.PENDING, WebhookEventStatus.fromString("pending"));
        assertEquals(WebhookEventStatus.PROCESSED, WebhookEventStatus.fromString("PROCESSED"));
    }
}
