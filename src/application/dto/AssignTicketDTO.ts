export type AssignTicketInput = {
  actorUserId: string;
  organizationId: string;
  ticketId: string;
};

export type AssignTicketOutput = {
  ticket: {
    id: string;
    contactId: string;
    status: string;
    assignedUserId: string;
    assignedAt: Date;
  };
};