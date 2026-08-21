import { z } from 'zod';

export const sendTeamChatMessageSchema = z.object({
  recipientUserId: z.string().min(1).nullable().optional(),
  body: z.string().trim().min(1, 'Digite uma mensagem.').max(1000, 'A mensagem deve ter no máximo 1000 caracteres.')
});
