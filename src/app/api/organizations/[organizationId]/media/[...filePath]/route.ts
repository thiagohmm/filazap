import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { mediaStorage, members } from '@/container';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationId: string; filePath: string | string[] } }
) {
  const session = await getSession(req);
  if (!session) return new NextResponse('Não autenticado.', { status: 401 });
  const membership = await members.findByUserAndOrganization(session.userId, params.organizationId);
  if (!membership?.active) return new NextResponse('Acesso negado.', { status: 403 });

  const requested = Array.isArray(params.filePath)
    ? params.filePath.join('/')
    : params.filePath;
  const storedPath = requested.replace(/\\/g, '/');
  if (
    !storedPath.startsWith(`media/${params.organizationId}/`) ||
    storedPath.includes('..') ||
    storedPath.includes('\0')
  ) {
    return new NextResponse('Caminho inválido.', { status: 400 });
  }

  try {
    const download = req.nextUrl.searchParams.get('download') === '1';
    if (mediaStorage.createSignedReadUrl) {
      const signedUrl = await mediaStorage.createSignedReadUrl(storedPath, 300, download);
      return NextResponse.redirect(signedUrl, 307);
    }
    const data = await mediaStorage.read(storedPath);
    const ext = path.extname(storedPath).toLowerCase();
    const contentType = ({
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.ogg': 'audio/ogg',
      '.oga': 'audio/ogg',
      '.webm': 'audio/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    } as Record<string, string>)[ext] ?? 'application/octet-stream';
    const filename = path.basename(storedPath).replace(/["\r\n]/g, '');
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {})
      }
    });
  } catch {
    return new NextResponse('Arquivo não encontrado.', { status: 404 });
  }
}
