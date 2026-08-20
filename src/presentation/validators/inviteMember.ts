import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  name: z.string().min(2, 'Nome é obrigatório.'),
  role: z.enum(['OWNER', 'ADMIN', 'AGENT', 'VIEWER'])
});
