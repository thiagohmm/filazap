import { TicketEvent } from '../../domain/entities/TicketEvent';

export interface TicketEventRepository {
  save(event: TicketEvent): Promise<TicketEvent>;
  findByTicketId(
    organizationId: string,
    ticketId: string
  ): Promise<TicketEvent[]>;
}