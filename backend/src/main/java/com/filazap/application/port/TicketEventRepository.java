package com.filazap.application.port;

import com.filazap.domain.entity.TicketEvent;

import java.util.List;

public interface TicketEventRepository {
    TicketEvent save(TicketEvent event);

    List<TicketEvent> findByTicketId(String organizationId, String ticketId);
}
