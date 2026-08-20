export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

export interface TokenService {
  sign(payload: SessionPayload): Promise<string>;
  verify(token: string): Promise<SessionPayload>;
}
