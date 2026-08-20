import { NextRequest, NextResponse } from 'next/server';
import { useCases } from '@/container';
import { searchContactsSchema } from '@/presentation/validators/searchContacts';
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
    const parsed = searchContactsSchema.parse({
      query: req.nextUrl.searchParams.get('query') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined
    });
    const output = await useCases.searchContacts.execute({
      actorUserId: session.userId,
      organizationId,
      ...parsed
    });
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
