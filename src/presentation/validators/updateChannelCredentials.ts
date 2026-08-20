import { z } from 'zod';

export const updateChannelCredentialsSchema = z
  .object({
    accessToken: z.string().optional(),
    appSecret: z.string().optional(),
    webhookVerifyToken: z.string().optional(),
    apiBaseUrl: z.string().optional()
  })
  .refine(
    (v) =>
      v.accessToken !== undefined ||
      v.appSecret !== undefined ||
      v.webhookVerifyToken !== undefined ||
      v.apiBaseUrl !== undefined,
    { message: 'Informe ao menos uma credencial para atualizar.' }
  );
