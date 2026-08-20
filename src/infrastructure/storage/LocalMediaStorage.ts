import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MediaFileInput, MediaStorage, StoredMedia } from '../../application/ports/MediaStorage';

export function getMediaRoot(): string {
  return process.env.MEDIA_STORAGE_ROOT ?? path.join(process.cwd(), 'storage');
}

function resolveRoot(): string {
  return getMediaRoot();
}

function sanitizeExt(mimeType: string, filename: string): string {
  const ext = path.extname(filename || '').toLowerCase();
  const known = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
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
