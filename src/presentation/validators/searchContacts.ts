import { z } from 'zod';

export const searchContactsSchema = z.object({
  query: z.string().min(1, 'query é obrigatória.'),
  limit: z.coerce.number().int().positive().max(100).optional()
});
