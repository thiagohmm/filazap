export type GetMetricsInput = {
  actorUserId: string;
  organizationId: string;
};

export type GetMetricsOutput = {
  avgAttendanceSeconds: number | null;
  totalFinished: number;
  ticketsPerAgent: Array<{
    userId: string;
    name: string;
    count: number;
  }>;
  returnRate: number | null;
};
