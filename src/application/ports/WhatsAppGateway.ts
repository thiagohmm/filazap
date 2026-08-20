export type SendMessageCommand = {
  channel: {
    phoneNumberId: string;
    accessToken: string;
  };
  to: string;
  type: string;
  body: string;
};

export type SendMessageResult = {
  providerMessageId: string;
};

export interface WhatsAppGateway {
  sendText(command: SendMessageCommand): Promise<SendMessageResult>;
}
