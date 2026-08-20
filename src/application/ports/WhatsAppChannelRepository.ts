import { WhatsAppChannel } from '../../domain/entities/WhatsAppChannel';

export interface WhatsAppChannelRepository {
  save(channel: WhatsAppChannel): Promise<WhatsAppChannel>;
  findById(id: string): Promise<WhatsAppChannel | null>;
  findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppChannel | null>;
  findByOrganizationId(organizationId: string): Promise<WhatsAppChannel[]>;
  findByBusinessAccountId(businessAccountId: string): Promise<WhatsAppChannel | null>;
  findByWebhookVerifyToken(verifyToken: string): Promise<WhatsAppChannel | null>;
}
