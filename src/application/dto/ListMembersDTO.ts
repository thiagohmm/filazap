export type ListMembersInput = {
  actorUserId: string;
  organizationId: string;
};

export type ListMembersOutput = {
  members: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
    role: string;
    active: boolean;
    createdAt: Date;
  }[];
};
