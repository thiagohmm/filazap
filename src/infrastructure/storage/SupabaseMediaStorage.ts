import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  MediaFileInput,
  MediaStorage,
  SignedMediaUpload,
  StoredMedia
} from '../../application/ports/MediaStorage';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/ogg': '.ogg',
  'audio/opus': '.ogg',
  'audio/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt'
};

function extensionFor(mimeType: string, filename: string): string {
  const byMime = EXT_BY_MIME[mimeType.toLowerCase().split(';')[0].trim()];
  if (byMime) return byMime;
  const ext = path.extname(filename).toLowerCase();
  return Object.values(EXT_BY_MIME).includes(ext) ? ext : '';
}

export class SupabaseMediaStorage implements MediaStorage {
  private readonly client: SupabaseClient;

  constructor(
    private readonly bucket: string,
    url: string,
    serviceRoleKey: string
  ) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  private objectPath(orgId: string, filename: string, mimeType: string): string {
    const safeOrg = orgId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `media/${safeOrg}/${randomUUID()}${extensionFor(mimeType, filename)}`;
  }

  async store(input: MediaFileInput): Promise<StoredMedia> {
    const storedPath = this.objectPath(input.orgId, input.filename, input.mimeType);
    const { error } = await this.client.storage.from(this.bucket).upload(
      storedPath,
      input.data,
      { contentType: input.mimeType || 'application/octet-stream', upsert: false }
    );
    if (error) throw new Error(`Falha ao armazenar mídia no Supabase: ${error.message}`);
    return {
      storedPath,
      url: `/api/organizations/${input.orgId}/media/${storedPath}`
    };
  }

  async read(storedPath: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(storedPath);
    if (error || !data) {
      throw new Error(`Falha ao ler mídia no Supabase: ${error?.message ?? 'arquivo ausente'}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedUpload(
    input: Omit<MediaFileInput, 'data'>
  ): Promise<SignedMediaUpload> {
    const storedPath = this.objectPath(input.orgId, input.filename, input.mimeType);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(storedPath);
    if (error || !data?.token) {
      throw new Error(`Falha ao autorizar upload no Supabase: ${error?.message ?? 'sem token'}`);
    }
    return { storedPath, token: data.token };
  }

  async createSignedReadUrl(
    storedPath: string,
    expiresInSeconds: number,
    download = false
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storedPath, expiresInSeconds, download ? { download: true } : undefined);
    if (error || !data?.signedUrl) {
      throw new Error(`Falha ao autorizar leitura no Supabase: ${error?.message ?? 'sem URL'}`);
    }
    return data.signedUrl;
  }

  async remove(storedPath: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([storedPath]);
    if (error) throw new Error(`Falha ao remover mídia no Supabase: ${error.message}`);
  }
}
