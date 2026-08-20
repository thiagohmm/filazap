import { NextRequest, NextResponse } from 'next/server';
import { DomainError } from '../../domain/errors/DomainError';

const AUTH_COOKIE_NAME = 'filazap_session';
const MAX_LOG_TOKEN_BYTES = 1600;

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function getSessionToken(req: NextRequest): string | null {
  return getBearerToken(req) ?? req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 dias
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0
  });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return Response.json({ error: error.message }, { status: 400 });
  }
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`.slice(0, MAX_LOG_TOKEN_BYTES)
      : 'Erro inesperado';
  const sanitized = message.replace(/\r/g, '').replace(/\n/g, '');
  console.error('Unexpected error:', sanitized);
  return Response.json({ error: 'Erro interno.' }, { status: 500 });
}
