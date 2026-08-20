import { z } from 'zod';

const ADMIN_PASSWORD_MIN_CHARS = 8;

function strongPassword(value: string): boolean {
  return (
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
}

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Nome da empresa é obrigatório.'),
  adminName: z.string().min(2, 'Nome do administrador é obrigatório.'),
  adminEmail: z.string().email('E-mail do administrador inválido.'),
  adminPassword: z
    .string()
    .min(ADMIN_PASSWORD_MIN_CHARS, 'A senha deve ter pelo menos 8 caracteres.')
    .refine(strongPassword, {
      message:
        'A senha deve ter pelo menos 12 caracteres, com maiúscula, minúscula e número.'
    })
});
