export type ReceiveWhatsAppMessageInput = {
  payload: Record<string, unknown>;
};

export type ReceiveWhatsAppMessageOutput = {
  processed: boolean;
  duplicate: boolean;
  messagesCount: number;
  statusesCount: number;
};
