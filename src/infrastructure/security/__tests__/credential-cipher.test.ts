import { describe, it, expect } from 'vitest';
import { Aes256GcmCredentialCipher } from '../Aes256GcmCredentialCipher';

describe('Aes256GcmCredentialCipher', () => {
  it('faz round-trip de encrypt/decrypt', () => {
    const cipher = new Aes256GcmCredentialCipher('master-key');
    const encrypted = cipher.encrypt('super-secreto');
    expect(encrypted).not.toContain('super-secreto');
    expect(cipher.decrypt(encrypted)).toBe('super-secreto');
  });

  it('gera cifras diferentes para o mesmo texto (IV aleatório)', () => {
    const cipher = new Aes256GcmCredentialCipher('master-key');
    expect(cipher.encrypt('x')).not.toBe(cipher.encrypt('x'));
  });

  it('não decifra texto de outra chave', () => {
    const a = new Aes256GcmCredentialCipher('chave-a');
    const b = new Aes256GcmCredentialCipher('chave-b');
    const encrypted = a.encrypt('segredo');
    expect(() => b.decrypt(encrypted)).toThrow();
  });

  it('rejeita cifra malformada', () => {
    const cipher = new Aes256GcmCredentialCipher('master-key');
    expect(() => cipher.decrypt('invalido')).toThrow();
  });

  it('rejeita chave mestre vazia', () => {
    expect(() => new Aes256GcmCredentialCipher('')).toThrow();
  });
});
