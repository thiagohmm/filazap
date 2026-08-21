import { type NextRequest } from 'next/server';
import { useCases } from '@/container';
import { requestPasswordResetSchema } from '@/presentation/validators/passwordReset';
import { toErrorResponse } from '@/presentation/api/helpers';
import { checkRateLimit, clientIp, tooManyRequestsResponse } from '@/presentation/api/rateLimit';

export const runtime = 'nodejs';

const SUCCESS_MESSAGE =
  'Se existir uma conta com esse e-mail, você receberá as instruções em alguns minutos.';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (rawBody.length > 5_120) {
      return Response.json({ error: 'Payload muito grande.' }, { status: 413 });
    }
    const input = requestPasswordResetSchema.parse(JSON.parse(rawBody));
    const limit = checkRateLimit(`password-reset-request:${clientIp(req)}`, 5, 15 * 60_000);
    if (!limit.allowed) return tooManyRequestsResponse(limit.retryAfterSeconds);

    await useCases.requestPasswordReset.execute(input);
    return Response.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: 'JSON inválido.' }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
