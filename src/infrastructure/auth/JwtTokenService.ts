import { SignJWT, jwtVerify } from 'jose';
import type {
  SessionPayload,
  TokenService
} from '../../application/ports/TokenService';

const ALG = 'HS256';

export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string) {
    if (!secret || secret.length < 16) {
      throw new Error(
        'JWT_SECRET deve ter pelo menos 16 caracteres. Gere com: openssl rand -base64 32'
      );
    }
  }

  private get key(): Uint8Array {
    return new TextEncoder().encode(this.secret);
  }

  async sign(payload: SessionPayload): Promise<string> {
    return new SignJWT({ email: payload.email, name: payload.name })
      .setProtectedHeader({ alg: ALG })
      .setSubject(payload.userId)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.key);
  }

  async verify(token: string): Promise<SessionPayload> {
    const { payload } = await jwtVerify(token, this.key, { algorithms: [ALG] });
    if (!payload.sub) {
      throw new Error('Token sem subject.');
    }
    return {
      userId: payload.sub,
      email: (payload.email as string) ?? '',
      name: (payload.name as string) ?? ''
    };
  }
}
