import { TicketStatus } from '../../domain/value-objects/TicketStatus';

export type ListQueueInput = {
  actorUserId: string;
  organizationId: string;
  status?: TicketStatus;
  assignedUserId?: string;
  limit?: number;
};

export type ListQueueOutput = {
  queue: Array<{
    ticketId: string;
    channelId: string;
    sequenceNumber: number;
    status: string;
    queueEnteredAt: Date;
    waitSeconds: number;
    priority: number;
    assignedUserId: string | null;
    assignedUserName: string | null;
    contact: {
      id: string;
      name: string | null;
      phoneE164: string;
    };
    lastMessage: {
      body: string | null;
      createdAt: Date | null;
    } | null;
  }>;
};
