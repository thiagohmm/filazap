export type TeamChatRecord = {
  id: string;
  organizationId: string;
  senderUserId: string;
  recipientUserId: string | null;
  body: string;
  createdAt: Date;
};

export interface TeamChatRepository {
  touchPresence(organizationId: string, userId: string, now: Date): Promise<void>;
  listOnlineUserIds(organizationId: string, since: Date): Promise<string[]>;
  isUserOnline(organizationId: string, userId: string, since: Date): Promise<boolean>;
  save(message: TeamChatRecord): Promise<TeamChatRecord>;
  listVisibleMessages(
    organizationId: string,
    userId: string,
    limit: number
  ): Promise<TeamChatRecord[]>;
}
