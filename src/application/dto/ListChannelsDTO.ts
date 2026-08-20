export type ListChannelsInput = {
  actorUserId: string;
  organizationId: string;
};

export type ListChannelsOutput = {
  channels: Array<{
    id: string;
    phoneNumberId: string;
    businessAccountId: string;
    displayPhoneNumber: string;
    status: string;
    configured: boolean;
    createdAt: Date;
  }>;
};
