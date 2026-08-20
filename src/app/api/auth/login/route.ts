import { NextResponse, type NextRequest } from 'next/server';
import { useCases } from '@/container';
import { authenticateSchema } from '@/presentation/validators/authenticate';
import { toErrorResponse } from '@/presentation/api/helpers';
import { checkRateLimit, clientIp, tooManyRequestsResponse } from '@/presentation/api/rateLimit';
import { setSessionCookie } from '@/presentation/api/helpers';

export const runtime = 'nodejs';

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
    const input = authenticateSchema.parse(parsedBody);
    const key = `login:${input.email.toLowerCase()}:${clientIp(req)}`;
    const limit = checkRateLimit(key, 5, 60_000);
    if (!limit.allowed) {
      return tooManyRequestsResponse(limit.retryAfterSeconds);
    }
    const output = await useCases.authenticate.execute(input);
    const response = NextResponse.json(output);
    setSessionCookie(response, output.token);
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
