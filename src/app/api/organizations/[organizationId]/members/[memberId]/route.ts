import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { toErrorResponse } from '@/presentation/api/helpers';
import { getSession } from '@/presentation/api/session';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { organizationId: string; memberId: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  try {
    const output = await useCases.removeMember.execute({
      actorUserId: session.userId,
      organizationId: params.organizationId,
      memberId: params.memberId
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
