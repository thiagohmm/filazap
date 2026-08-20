export type FinishTicketInput = {
  actorUserId: string;
  organizationId: string;
  ticketId: string;
};

export type FinishTicketOutput = {
  ticket: {
    id: string;
    status: string;
    finishedAt: Date;
  };
};