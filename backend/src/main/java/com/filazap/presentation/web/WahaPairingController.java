package com.filazap.presentation.web;

import com.filazap.infrastructure.whatsapp.WahaPairingException;
import com.filazap.infrastructure.whatsapp.WahaPairingService;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.error.UnauthorizedException;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Proxies do pairing WAHA expostos ao frontend (mesma origem via nginx em {@code /api/}).
 *
 * <p>O frontend usa o token JWT (cabeçalho {@code Authorization}) em todas as chamadas —
 * inclusive o QR, que é buscado como <em>blob</em> e transformado em data URL — então
 * cada endpoint valida a sessão com {@link SessionHolder}.
 *
 * <p>Fluxo:
 * <ol>
 *   <li>{@code POST /api/whatsapp/waha/connect} → cria/inicia a sessão, devolve {@code sessionName}</li>
 *   <li>{@code GET  /api/whatsapp/waha/qr?session=..} → PNG do QR (buscado como blob)</li>
 *   <li>{@code GET  /api/whatsapp/waha/status?session=..} → estado (polling a cada ~3s)</li>
 *   <li>{@code POST /api/whatsapp/waha/logout?session=..} → desconecta</li>
 * </ol>
 */
@RestController
@RequestMapping("/api/whatsapp/waha")
public class WahaPairingController {

    private final WahaPairingService pairing;

    public WahaPairingController(WahaPairingService pairing) {
        this.pairing = pairing;
    }

    /**
     * Garante a sessão WAHA da organização atual.
     *
     * @param body {@code { orgId }} (usa {@code filazap-{orgId}} como nome da sessão) ou
     *             {@code { sessionName }} para forçar um nome. Sem ambos, usa o id do usuário.
     */
    @PostMapping("/connect")
    public Map<String, Object> connect(@RequestBody(required = false) Map<String, Object> body) {
        SessionHolder.require(); // valida a sessão (anyRequest permitAll, mas mantemos a exigência)
        String sessionName = deriveSessionName(body);
        pairing.ensureSession(sessionName);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sessionName", sessionName);
        out.put("apiKey", pairing.apiKeyForFrontend());
        return out;
    }

    /** QR code em PNG. O frontend busca como blob e monta um data URL (não usa <img src> direto). */
    @GetMapping("/qr")
    public ResponseEntity<byte[]> qr(@RequestParam("session") String session) {
        SessionHolder.require();
        if (session == null || session.isBlank()) {
            throw new BadRequestException("parâmetro 'session' é obrigatório.");
        }
        byte[] png = pairing.getQr(session);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(png);
    }

    /** Estado de pareamento. {@code connected=true} quando a sessão está CONNECTED/pairada. */
    @GetMapping("/status")
    public Map<String, Object> status(@RequestParam("session") String session) {
        SessionHolder.require();
        if (session == null || session.isBlank()) {
            throw new BadRequestException("parâmetro 'session' é obrigatório.");
        }
        try {
            return pairing.getStatus(session);
        } catch (WahaPairingException e) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("connected", false);
            err.put("error", e.getMessage());
            return err;
        }
    }

    /** Desconecta (despaira) a sessão. */
    @PostMapping("/logout")
    public Map<String, Object> logout(@RequestParam("session") String session) {
        SessionHolder.require();
        if (session == null || session.isBlank()) {
            throw new BadRequestException("parâmetro 'session' é obrigatório.");
        }
        pairing.logout(session);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("session", session);
        out.put("connected", false);
        return out;
    }

    private static String deriveSessionName(Map<String, Object> body) {
        String explicit = Req.str(body, "sessionName");
        if (explicit != null && !explicit.isBlank()) {
            return explicit.trim();
        }
        String orgId = Req.str(body, "orgId");
        if (orgId != null && !orgId.isBlank()) {
            return "filazap-" + orgId.trim();
        }
        throw new BadRequestException(
                "Informe 'orgId' ou 'sessionName' para criar a sessão do WAHA.");
    }
}
