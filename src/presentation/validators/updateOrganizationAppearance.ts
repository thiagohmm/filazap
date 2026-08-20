import { z } from 'zod';

export const updateOrganizationAppearanceSchema = z
  .object({
    theme: z.enum(['light', 'dark']).optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use o formato #RRGGBB.')
      .optional()
  })
  .refine((v) => v.theme !== undefined || v.brandColor !== undefined, {
    message: 'Informe ao menos uma opção de aparência para atualizar.'
  });
