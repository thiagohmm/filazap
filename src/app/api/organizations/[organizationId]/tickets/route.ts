import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { listQueueSchema } from '@/presentation/validators/tickets';
import { toErrorResponse } from '@/presentation/api/helpers';
import { getSession } from '@/presentation/api/session';
import { TicketStatus } from '@/domain/value-objects/TicketStatus';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const organizationId = req.nextUrl.pathname.split('/')[3];
  try {
    const parsed = listQueueSchema.parse({
      status: req.nextUrl.searchParams.get('status') ?? undefined,
      assignedUserId: req.nextUrl.searchParams.get('assignedUserId') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined
    });
    const status = parsed.status ? TicketStatus.fromString(parsed.status) : undefined;
    const output = await useCases.listQueue.execute({
      actorUserId: session.userId,
      organizationId,
      status,
      assignedUserId: parsed.assignedUserId,
      limit: parsed.limit
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}