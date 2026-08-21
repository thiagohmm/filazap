import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaFileInput, MediaStorage, StoredMedia } from '../../application/ports/MediaStorage';

export function getMediaRoot(): string {
  return process.env.MEDIA_STORAGE_ROOT ?? path.join(process.cwd(), 'storage');
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'audio/ogg': '.ogg',
  'audio/opus': '.ogg',
  'audio/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt'
};

function sanitizeExt(mimeType: string, filename: string): string {
  const normalizedMime = mimeType.toLowerCase().split(';')[0].trim();
  if (normalizedMime && EXT_BY_MIME[normalizedMime]) {
    return EXT_BY_MIME[normalizedMime];
  }
  const ext = path.extname(filename || '').toLowerCase();
  const known = Object.values(EXT_BY_MIME);
  return known.includes(ext) ? ext : '';
}

export class LocalMediaStorage implements MediaStorage {
  private root: string;

  constructor(root?: string) {
    this.root = root ?? getMediaRoot();
  }

  async store(input: MediaFileInput): Promise<StoredMedia> {
    const ext = sanitizeExt(input.mimeType, input.filename);
    const safeOrg = input.orgId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${randomUUID()}${ext}`;
    const storedPath = path.join('media', safeOrg, fileName);
    const abs = path.join(this.root, storedPath);

    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, input.data);

    return {
      storedPath,
      url: `/api/organizations/${input.orgId}/media/${storedPath}`
    };
  }

  async read(storedPath: string): Promise<Buffer> {
    const abs = path.resolve(this.root, storedPath);
    if (!abs.startsWith(path.resolve(this.root))) {
      throw new Error('storage path invalida');
    }
    return fsp.readFile(abs);
  }
}
