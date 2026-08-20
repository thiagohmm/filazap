export type AssignNextTicketInput = {
  actorUserId: string;
  organizationId: string;
  channelId?: string;
};

export type AssignNextTicketOutput = {
  assigned: boolean;
  ticket: {
    id: string;
    contactId: string;
    status: string;
    queueEnteredAt: Date;
    waitSeconds: number;
  } | null;
};