import { Contact } from '../../domain/entities/Contact';

export type ContactSearchResult = {
  contact: Contact;
  totalTickets: number;
  lastMessageAt: Date | null;
};

export interface ContactRepository {
  save(contact: Contact): Promise<Contact>;
  findById(id: string): Promise<Contact | null>;
  findByChannelAndPhone(
    organizationId: string,
    channelId: string,
    phoneE164: string
  ): Promise<Contact | null>;
  search(
    organizationId: string,
    query: string,
    limit?: number
  ): Promise<ContactSearchResult[]>;
}
