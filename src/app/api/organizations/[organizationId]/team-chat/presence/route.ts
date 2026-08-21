import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { toErrorResponse } from '@/presentation/api/helpers';
import { checkRateLimit, tooManyRequestsResponse } from '@/presentation/api/rateLimit';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const limit = checkRateLimit(`team-chat-presence:${session.userId}`, 120, 60_000);
  if (!limit.allowed) return tooManyRequestsResponse(limit.retryAfterSeconds);
  try {
    await useCases.heartbeatTeamChat.execute({
      actorUserId: session.userId,
      organizationId: params.organizationId
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
