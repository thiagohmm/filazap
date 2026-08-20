import { NextRequest } from 'next/server';
import { useCases } from '@/container';
import { createOrganizationSchema } from '@/presentation/validators/createOrganization';
import { toErrorResponse } from '@/presentation/api/helpers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = createOrganizationSchema.parse(body);
    const output = await useCases.createOrganization.execute(input);
    return Response.json(output, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
