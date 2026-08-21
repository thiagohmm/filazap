export type RemoveMemberInput = {
  actorUserId: string;
  organizationId: string;
  memberId: string;
};

export type RemoveMemberOutput = {
  member: {
    id: string;
    active: false;
  };
};
