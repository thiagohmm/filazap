import { Message } from '../../domain/entities/Message';

export interface MessageRepository {
  save(message: Message): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  findByWhatsappMessageId(whatsappMessageId: string): Promise<Message | null>;
  findByProviderMessageId(providerMessageId: string): Promise<Message | null>;
  findByTicketId(
    organizationId: string,
    ticketId: string
  ): Promise<Message[]>;
}