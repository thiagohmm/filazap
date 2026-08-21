export type StoredMedia = {
  /** Camino relativo ao root de armazenamento, ex: media/{orgId}/{uuid}.{ext} */
  storedPath: string;
  /** URL pública relativa para servir o arquivo, ex: /api/organizations/{orgId}/media/{storedPath} */
  url: string;
};

export type MediaFileInput = {
  orgId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
};

export type SignedMediaUpload = {
  storedPath: string;
  token: string;
};

export interface MediaStorage {
  store(input: MediaFileInput): Promise<StoredMedia>;
  read(storedPath: string): Promise<Buffer>;
  createSignedUpload?(input: Omit<MediaFileInput, 'data'>): Promise<SignedMediaUpload>;
  createSignedReadUrl?(
    storedPath: string,
    expiresInSeconds: number,
    download?: boolean
  ): Promise<string>;
  remove?(storedPath: string): Promise<void>;
}
