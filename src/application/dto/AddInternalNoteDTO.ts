export type AddInternalNoteInput = {
  actorUserId: string;
  organizationId: string;
  contactId: string;
  ticketId?: string | null;
  body: string;
};

export type AddInternalNoteOutput = {
  note: {
    id: string;
    contactId: string;
    ticketId: string | null;
    body: string;
    createdAt: Date;
  };
};