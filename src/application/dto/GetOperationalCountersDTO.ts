export type GetOperationalCountersInput = {
  actorUserId: string;
  organizationId: string;
};

export type GetOperationalCountersOutput = {
  waiting: number;
  returning: number;
  inProgress: number;
  waitingCustomer: number;
  finishedToday: number;
  maxWaitSeconds: number | null;
  avgFirstResponseSeconds: number | null;
};