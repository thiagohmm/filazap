import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { toErrorResponse } from '@/presentation/api/helpers';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  const organizationId = req.nextUrl.pathname.split('/')[3];
  try {
    const output = await useCases.getMetrics.execute({
      actorUserId: session.userId,
      organizationId
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
