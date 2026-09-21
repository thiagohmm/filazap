package com.filazap.application.port;

import java.time.Instant;
import java.util.List;

public interface TeamChatRepository {

    record TeamChatRecord(String id, String organizationId, String senderUserId,
                          String recipientUserId, String body, Instant createdAt) {}

    void touchPresence(String organizationId, String userId, Instant now);

    List<String> listOnlineUserIds(String organizationId, Instant since);

    boolean isUserOnline(String organizationId, String userId, Instant since);

    TeamChatRecord save(TeamChatRecord message);

    List<TeamChatRecord> listVisibleMessages(String organizationId, String userId, int limit);
}
