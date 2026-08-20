import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { ticketActionSchema } from '@/presentation/validators/tickets';
import { toErrorResponse } from '@/presentation/api/helpers';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const parts = req.nextUrl.pathname.split('/');
  const organizationId = parts[3];
  const ticketId = parts[5];
  try {
    const input = ticketActionSchema.parse({ ticketId });
    const output = await useCases.reopenTicket.execute({
      actorUserId: session.userId,
      organizationId,
      ticketId: input.ticketId
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
