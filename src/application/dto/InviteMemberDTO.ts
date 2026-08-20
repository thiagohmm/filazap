export type InviteMemberInput = {
  actorUserId: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
};

export type InviteMemberOutput = {
  member: {
    id: string;
    organizationId: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    role: string;
    active: boolean;
    createdAt: Date;
  };
};
