export type SendMessageInput = {
  actorUserId: string;
  organizationId: string;
  channelId: string;
  contactId: string;
  body: string;
};

export type SendMessageOutput = {
  message: {
    id: string;
    ticketId: string;
    direction: string;
    body: string | null;
    providerStatus: string | null;
    createdAt: Date;
  };
};
