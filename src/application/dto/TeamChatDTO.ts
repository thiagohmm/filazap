export type TeamChatMemberOutput = {
  userId: string;
  name: string;
  role: string;
  isCurrentUser: boolean;
};

export type TeamChatMessageOutput = {
  id: string;
  body: string;
  createdAt: Date;
  sender: { id: string; name: string };
  recipient: { id: string; name: string } | null;
};

export type ListTeamChatOutput = {
  onlineMembers: TeamChatMemberOutput[];
  messages: TeamChatMessageOutput[];
};
