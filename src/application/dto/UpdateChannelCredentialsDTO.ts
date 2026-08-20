export type UpdateChannelCredentialsInput = {
  actorUserId: string;
  organizationId: string;
  channelId: string;
  accessToken?: string;
  appSecret?: string;
  webhookVerifyToken?: string;
  apiBaseUrl?: string;
};

export type UpdateChannelCredentialsOutput = {
  channel: {
    id: string;
    organizationId: string;
    phoneNumberId: string;
    businessAccountId: string;
    displayPhoneNumber: string;
    status: string;
    configured: boolean;
    createdAt: Date;
  };
};
