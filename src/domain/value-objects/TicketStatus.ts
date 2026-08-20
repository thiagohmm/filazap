import { InvalidTicketStatusError } from '../errors/InvalidTicketStatusError';

export enum TicketStatus {
  WAITING = 'WAITING',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  RETURNING = 'RETURNING',
  FINISHED = 'FINISHED'
}

export namespace TicketStatus {
  export const ALL: readonly TicketStatus[] = [
    TicketStatus.WAITING,
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_CUSTOMER,
    TicketStatus.RETURNING,
    TicketStatus.FINISHED
  ] as const;

  export function fromString(raw: string): TicketStatus {
    switch (raw.toUpperCase()) {
      case 'WAITING':
        return TicketStatus.WAITING;
      case 'IN_PROGRESS':
        return TicketStatus.IN_PROGRESS;
      case 'WAITING_CUSTOMER':
        return TicketStatus.WAITING_CUSTOMER;
      case 'RETURNING':
        return TicketStatus.RETURNING;
      case 'FINISHED':
        return TicketStatus.FINISHED;
      default:
        throw new InvalidTicketStatusError(raw);
    }
  }

  export function isQueued(status: TicketStatus): boolean {
    return status === TicketStatus.WAITING || status === TicketStatus.RETURNING;
  }

  export function isActive(status: TicketStatus): boolean {
    return status !== TicketStatus.FINISHED;
  }
}