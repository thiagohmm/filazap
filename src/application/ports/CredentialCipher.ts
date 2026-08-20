export interface CredentialCipher {
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
}
