export type MoveTicketToWaitingCustomerInput = {
  actorUserId: string;
  organizationId: string;
  ticketId: string;
};

export type MoveTicketToWaitingCustomerOutput = {
  ticket: {
    id: string;
    status: string;
    waitingCustomerSince: Date;
  };
};