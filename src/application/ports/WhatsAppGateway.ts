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

export type UploadMediaCommand = {
  channel: {
    phoneNumberId: string;
    accessToken: string;
  };
  data: Buffer;
  mimeType: string;
  filename: string;
};

export type UploadMediaResult = {
  fileId: string;
};

export type SendMediaCommand = {
  channel: {
    phoneNumberId: string;
    accessToken: string;
  };
  to: string;
  fileRef: {
    fileId: string;
    mimeType: string;
    filename: string;
  };
  caption?: string | null;
  isImage: boolean;
};

export interface WhatsAppGateway {
  sendText(command: SendMessageCommand): Promise<SendMessageResult>;
  uploadMedia(command: UploadMediaCommand): Promise<UploadMediaResult>;
  sendMedia(command: SendMediaCommand): Promise<SendMessageResult>;
}
