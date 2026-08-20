import { NextRequest } from 'next/server';
import { JwtTokenService } from '@/infrastructure/auth/JwtTokenService';
import { getBearerToken } from './helpers';
import type { SessionPayload } from '@/application/ports/TokenService';

const secret = process.env.JWT_SECRET ?? '';
const tokenService = new JwtTokenService(secret);

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return await tokenService.verify(token);
  } catch {
    return null;
  }
}
