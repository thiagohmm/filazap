export type SendMessageMediaInput = {
  filename: string;
  mimeType: string;
  storedPath: string;
  caption?: string | null;
};

export type SendMessageInput = {
  actorUserId: string;
  organizationId: string;
  channelId: string;
  contactId: string;
  body: string;
  media?: SendMessageMediaInput;
};

export type SendMessageOutput = {
  message: {
    id: string;
    ticketId: string;
    direction: string;
    type: string;
    body: string | null;
    mediaPath: string | null;
    providerStatus: string | null;
    createdAt: Date;
  };
};
