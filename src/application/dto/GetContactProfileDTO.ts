export type GetContactProfileInput = {
  actorUserId: string;
  organizationId: string;
  contactId: string;
};

export type GetContactProfileOutput = {
  contact: {
    id: string;
    channelId: string;
    phoneE164: string;
    name: string | null;
    firstContactAt: Date;
    lastContactAt: Date;
  };
  stats: {
    totalTickets: number;
    currentStatus: string | null;
    assignedUserName: string | null;
  };
  notes: Array<{
    id: string;
    body: string;
    authorUserId: string;
    createdAt: Date;
  }>;
};
