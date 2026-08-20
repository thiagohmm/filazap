export type RegisterChannelInput = {
  actorUserId: string;
  organizationId: string;
  phoneNumberId: string;
  businessAccountId: string;
  displayPhoneNumber: string;
};

export type RegisterChannelOutput = {
  channel: {
    id: string;
    organizationId: string;
    phoneNumberId: string;
    businessAccountId: string;
    displayPhoneNumber: string;
    status: string;
    createdAt: Date;
  };
};
