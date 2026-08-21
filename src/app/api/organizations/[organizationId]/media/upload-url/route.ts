import { NextRequest, NextResponse } from 'next/server';
import { mediaStorage, members } from '@/container';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
const DOCUMENT_MIMES = new Set([
  'application/pdf', 'text/plain', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const membership = await members.findByUserAndOrganization(session.userId, params.organizationId);
  if (!membership?.active) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  let input: { filename?: string; mimeType?: string; size?: number };
  try { input = await req.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const filename = String(input.filename ?? '').trim();
  const mimeType = String(input.mimeType ?? '').toLowerCase().split(';')[0].trim();
  const size = Number(input.size ?? 0);
  const allowed = mimeType.startsWith('image/') || mimeType.startsWith('audio/') || DOCUMENT_MIMES.has(mimeType);
  if (!filename || !allowed || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Arquivo inválido ou não suportado.' }, { status: 400 });
  }
  if (size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: 'Arquivo excede o limite de 16 MB.' }, { status: 413 });
  }
  if (!mediaStorage.createSignedUpload) return NextResponse.json({ mode: 'local' });
  try {
    const signed = await mediaStorage.createSignedUpload({ orgId: params.organizationId, filename, mimeType });
    return NextResponse.json({ mode: 'supabase', ...signed });
  } catch {
    return NextResponse.json({ error: 'Não foi possível autorizar o upload.' }, { status: 502 });
  }
}
