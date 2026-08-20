export type ListMessagesInput = {
  actorUserId: string;
  organizationId: string;
  ticketId: string;
};

export type ListMessagesOutput = {
  messages: Array<{
    id: string;
    ticketId: string;
    contactId: string;
    direction: string;
    type: string;
    body: string | null;
    senderUserId: string | null;
    providerStatus: string | null;
    createdAt: Date;
  }>;
};