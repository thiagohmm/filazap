import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { CredentialCipher } from '../../application/ports/CredentialCipher';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

export class Aes256GcmCredentialCipher implements CredentialCipher {
  private readonly key: Buffer;

  constructor(masterKey: string) {
    if (!masterKey) {
      throw new Error('Chave mestre de criptografia não configurada.');
    }
    this.key = createHash('sha256').update(masterKey).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return [
      'v1',
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64')
    ].join('.');
  }

  decrypt(cipher: string): string {
    const parts = cipher.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Cifra inválida.');
    }
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(ALGO, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }
}
