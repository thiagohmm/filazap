import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Nome da empresa é obrigatório.'),
  adminName: z.string().min(2, 'Nome do administrador é obrigatório.'),
  adminEmail: z.string().email('E-mail do administrador inválido.'),
  adminPassword: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.')
});
