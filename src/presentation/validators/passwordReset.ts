import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(12, 'A senha deve ter pelo menos 12 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.')
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
    message: 'Use pelo menos uma letra maiúscula, uma minúscula e um número.'
  });

export const requestPasswordResetSchema = z.object({
  email: z.string().email('Informe um e-mail válido.')
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32, 'Link de recuperação inválido.'),
  password: passwordSchema
});
