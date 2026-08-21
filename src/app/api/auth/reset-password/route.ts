import { type NextRequest } from 'next/server';
import { useCases } from '@/container';
import { resetPasswordSchema } from '@/presentation/validators/passwordReset';
import { toErrorResponse } from '@/presentation/api/helpers';
import { checkRateLimit, clientIp, tooManyRequestsResponse } from '@/presentation/api/rateLimit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (rawBody.length > 5_120) {
      return Response.json({ error: 'Payload muito grande.' }, { status: 413 });
    }
    const input = resetPasswordSchema.parse(JSON.parse(rawBody));
    const limit = checkRateLimit(`password-reset:${clientIp(req)}`, 10, 15 * 60_000);
    if (!limit.allowed) return tooManyRequestsResponse(limit.retryAfterSeconds);

    await useCases.resetPassword.execute(input);
    return Response.json({ message: 'Senha alterada com sucesso.' });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: 'JSON inválido.' }, { status: 400 });
    }
    return toErrorResponse(error);
  }
}
