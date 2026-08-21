import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { toErrorResponse } from '@/presentation/api/helpers';
import { checkRateLimit, tooManyRequestsResponse } from '@/presentation/api/rateLimit';
import { getSession } from '@/presentation/api/session';
import { sendTeamChatMessageSchema } from '@/presentation/validators/teamChat';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  try {
    const output = await useCases.listTeamChat.execute({
      actorUserId: session.userId,
      organizationId: params.organizationId
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const limit = checkRateLimit(`team-chat-send:${session.userId}`, 60, 60_000);
  if (!limit.allowed) return tooManyRequestsResponse(limit.retryAfterSeconds);
  try {
    const input = sendTeamChatMessageSchema.parse(await req.json());
    const output = await useCases.sendTeamChatMessage.execute({
      actorUserId: session.userId,
      organizationId: params.organizationId,
      ...input
    });
    return Response.json(output, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
