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
  const parts = req.nextUrl.pathname.split('/');
  const organizationId = parts[3];
  const contactId = parts[5];
  try {
    const output = await useCases.getContactProfile.execute({
      actorUserId: session.userId,
      organizationId,
      contactId
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
