export type SearchContactsInput = {
  actorUserId: string;
  organizationId: string;
  query: string;
  limit?: number;
};

export type SearchContactsOutput = {
  contacts: Array<{
    id: string;
    channelId: string;
    phoneE164: string;
    name: string | null;
    firstContactAt: Date;
    lastContactAt: Date;
    totalTickets: number;
    lastMessageAt: Date | null;
  }>;
};
