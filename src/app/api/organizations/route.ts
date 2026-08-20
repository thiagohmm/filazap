import { NextResponse, type NextRequest } from 'next/server';
import { useCases } from '@/container';
import { createOrganizationSchema } from '@/presentation/validators/createOrganization';
import { setSessionCookie, toErrorResponse } from '@/presentation/api/helpers';
import { checkRateLimit, clientIp, tooManyRequestsResponse } from '@/presentation/api/rateLimit';

export const runtime = 'nodejs';

function normalizeAllowedDomains(): string[] {
  const value = process.env.ORGANIZATION_SIGNUP_ALLOWED_DOMAINS?.trim();
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (rawBody.length > 5_120) {
      return Response.json({ error: 'Payload muito grande.' }, { status: 413 });
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'JSON inválido.' }, { status: 400 });
    }
    const input = createOrganizationSchema.parse(parsedBody);
    const allowedDomains = normalizeAllowedDomains();
    if (allowedDomains.length > 0) {
      const emailDomain = input.adminEmail.split('@')[1]?.toLowerCase();
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        return Response.json({ error: 'Domínio de e-mail não autorizado para cadastro.' }, { status: 403 });
      }
    }
    const key = `org-signup:${clientIp(req)}`;
    const limit = checkRateLimit(key, 3, 60_000);
    if (!limit.allowed) {
      return tooManyRequestsResponse(limit.retryAfterSeconds);
    }
    const output = await useCases.createOrganization.execute(input);
    const response = NextResponse.json(output, { status: 201 });
    setSessionCookie(response, output.token);
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
