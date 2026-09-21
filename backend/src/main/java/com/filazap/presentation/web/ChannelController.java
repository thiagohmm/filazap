package com.filazap.presentation.web;

import com.filazap.application.usecase.ListChannels;
import com.filazap.application.usecase.RegisterChannel;
import com.filazap.application.usecase.UpdateChannelCredentials;
import com.filazap.presentation.error.BadRequestException;
import com.filazap.presentation.security.SessionHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/organizations/{organizationId}/channels")
public class ChannelController {
    private final ListChannels listChannels;
    private final RegisterChannel registerChannel;
    private final UpdateChannelCredentials updateChannelCredentials;

    public ChannelController(ListChannels listChannels, RegisterChannel registerChannel,
                             UpdateChannelCredentials updateChannelCredentials) {
        this.listChannels = listChannels;
        this.registerChannel = registerChannel;
        this.updateChannelCredentials = updateChannelCredentials;
    }

    @GetMapping
    public Map<String, Object> list(@PathVariable String organizationId) {
        var session = SessionHolder.require();
        return listChannels.execute(session.userId(), organizationId);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> register(@PathVariable String organizationId,
                                                        @RequestBody Map<String, Object> body) {
        var session = SessionHolder.require();
        String phoneNumberId = Req.strReq(body, "phoneNumberId", "phone_number_id é obrigatório.");
        String businessAccountId = Req.strReq(body, "businessAccountId", "business_account_id é obrigatório.");
        String displayPhoneNumber = Req.strReq(body, "displayPhoneNumber", "Número de exibição é obrigatório.");
        Map<String, Object> result = registerChannel.execute(session.userId(), organizationId,
                phoneNumberId, businessAccountId, displayPhoneNumber);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PatchMapping("/{channelId}")
    public Map<String, Object> updateCredentials(@PathVariable String organizationId,
                                                 @PathVariable String channelId,
                                                 @RequestBody Map<String, Object> body) {
        var session = SessionHolder.require();
        String accessToken = Req.str(body, "accessToken");
        String appSecret = Req.str(body, "appSecret");
        String webhookVerifyToken = Req.str(body, "webhookVerifyToken");
        String apiBaseUrl = Req.str(body, "apiBaseUrl");

        if (accessToken == null && appSecret == null && webhookVerifyToken == null && apiBaseUrl == null) {
            throw new BadRequestException("Informe ao menos uma credencial para atualizar.");
        }
        return updateChannelCredentials.execute(session.userId(), organizationId, channelId,
                accessToken, appSecret, webhookVerifyToken, apiBaseUrl);
    }
}
