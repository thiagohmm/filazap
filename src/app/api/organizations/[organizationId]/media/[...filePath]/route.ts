import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { getMediaRoot } from '@/infrastructure/storage/LocalMediaStorage';
import { getSessionToken, getBearerToken } from '@/presentation/api/helpers';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationId: string; filePath: string } }
) {
  const token = getBearerToken(req) ?? getSessionToken(req);
  if (!token) {
    return new NextResponse('Não autenticado.', { status: 401 });
  }

  const requested = params.filePath;
  const safeReq = requested.replace(/\/|\.\./g, '/');
  const storedPath = path.join('media', params.organizationId, safeReq);
  const abs = path.resolve(getMediaRoot(), storedPath);

  // prevenir traversal para fora do root de armazenamento
  if (!abs.startsWith(path.resolve(getMediaRoot()))) {
    return new NextResponse('Caminho inválido.', { status: 400 });
  }

  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new NextResponse('Arquivo não encontrado.', { status: 404 });
  }

  const data = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const contentType =
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain'
    }[ext] ?? 'application/octet-stream';

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
