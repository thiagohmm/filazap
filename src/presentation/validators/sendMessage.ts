import { z } from 'zod';

export const sendMessageSchema = z.object({
  channelId: z.string().min(1, 'channel_id é obrigatório.'),
  contactId: z.string().min(1, 'contact_id é obrigatório.'),
  body: z.string().min(1, 'Mensagem vazia não pode ser enviada.')
});
