import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { sendMessageSchema } from '@/presentation/validators/sendMessage';
import { toErrorResponse } from '@/presentation/api/helpers';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const organizationId = req.nextUrl.pathname.split('/')[3];
  try {
    const body = await req.json();
    const input = sendMessageSchema.parse(body);
    const output = await useCases.sendMessage.execute({
      actorUserId: session.userId,
      organizationId,
      ...input
    });
    return Response.json(output, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
