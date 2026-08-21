import { NextRequest, NextResponse } from 'next/server';
import { useCases, mediaStorage } from '@/container';
import type { SendMessageMediaInput } from '@/application/dto/SendMessageDTO';
import { toErrorResponse } from '@/presentation/api/helpers';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // 16 MB

async function handleForm(req: NextRequest, organizationId: string) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Formato de corpo inválido.' }, { status: 400 });
  }

  const channelId = String(form.get('channelId') ?? '').trim();
  const contactId = String(form.get('contactId') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();

  if (!channelId || !contactId) {
    return NextResponse.json(
      { error: 'channel_id e contact_id são obrigatórios.' },
      { status: 400 }
    );
  }

  const file = form.get('file');
  let media;

  if (file && typeof file !== 'string' && file instanceof File) {
    const mimeType = file.type || '';
    const name = file.name || 'arquivo';
    const bytes = Buffer.from(await file.arrayBuffer());

    if (bytes.length > MAX_MEDIA_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo excede o tamanho máximo permitido (16 MB).' },
        { status: 413 }
      );
    }

    const stored = await mediaStorage.store({
      orgId: organizationId,
      filename: name,
      mimeType,
      data: bytes
    });

    media = {
      filename: name,
      mimeType,
      storedPath: stored.storedPath,
      caption: body || null
    };
  }

  const input = {
    actorUserId: session.userId,
    organizationId,
    channelId,
    contactId,
    body,
    ...(media ? { media } : {})
  };

  const output = await useCases.sendMessage.execute(input);
  return Response.json(output, { status: 201 });
}

export async function POST(req: NextRequest) {
  const organizationId = req.nextUrl.pathname.split('/')[3];

  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    try {
      return await handleForm(req, organizationId);
    } catch (error) {
      return toErrorResponse(error);
    }
  }

  // Fallback: corpo JSON (mantido para compatibilidade com clientes existentes)
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const body = await req.json();
    const raw = body as {
      channelId?: string;
      contactId?: string;
      body?: string;
      message?: string;
      media?: SendMessageMediaInput;
    };
    const channelId = raw.channelId;
    const contactId = raw.contactId;
    const msgBody = raw.body ?? raw.message;
    const { media } = raw;

    if (!channelId || !contactId) {
      return NextResponse.json(
        { error: 'channel_id e contact_id são obrigatórios.' },
        { status: 400 }
      );
    }
    if (
      media &&
      (!media.storedPath.startsWith(`media/${organizationId}/`) ||
        media.storedPath.includes('..') ||
        media.storedPath.includes('\\'))
    ) {
      return NextResponse.json({ error: 'Caminho de mídia inválido.' }, { status: 400 });
    }

    const output = await useCases.sendMessage.execute({
      actorUserId: session.userId,
      organizationId,
      channelId,
      contactId,
      body: msgBody ?? '',
      ...(media ? { media } : {})
    });
    return Response.json(output, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
