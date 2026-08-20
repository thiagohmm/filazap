export type ReopenTicketInput = {
  actorUserId: string;
  organizationId: string;
  ticketId: string;
};

export type ReopenTicketOutput = {
  ticket: {
    id: string;
    status: string;
  };
};
