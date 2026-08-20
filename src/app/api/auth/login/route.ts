import { NextRequest } from 'next/server';
import { useCases } from '@/container';
import { authenticateSchema } from '@/presentation/validators/authenticate';
import { toErrorResponse } from '@/presentation/api/helpers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = authenticateSchema.parse(body);
    const output = await useCases.authenticate.execute(input);
    return Response.json(output);
  } catch (error) {
    return toErrorResponse(error);
  }
}
