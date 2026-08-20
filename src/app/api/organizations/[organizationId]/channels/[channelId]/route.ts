import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { updateChannelCredentialsSchema } from '@/presentation/validators/updateChannelCredentials';
import { toErrorResponse } from '@/presentation/api/helpers';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const parts = req.nextUrl.pathname.split('/');
  const organizationId = parts[3];
  const channelId = parts[5];
  try {
    const body = await req.json();
    const input = updateChannelCredentialsSchema.parse(body);
    const output = await useCases.updateChannelCredentials.execute({
      actorUserId: session.userId,
      organizationId,
      channelId,
      ...input
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
