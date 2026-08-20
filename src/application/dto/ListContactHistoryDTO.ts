export type ListContactHistoryInput = {
  actorUserId: string;
  organizationId: string;
  contactId: string;
};

export type ListContactHistoryOutput = {
  history: Array<{
    ticketId: string;
    sequenceNumber: number;
    status: string;
    queueEnteredAt: Date;
    finishedAt: Date | null;
    assignedUserName: string | null;
    durationSeconds: number | null;
  }>;
};
