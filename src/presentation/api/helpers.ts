import { NextRequest } from 'next/server';
import { DomainError } from '../../domain/errors/DomainError';

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error('Unexpected error:', error);
  return Response.json({ error: 'Erro interno.' }, { status: 500 });
}
