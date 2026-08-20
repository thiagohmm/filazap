import { z } from 'zod';

export const registerChannelSchema = z.object({
  phoneNumberId: z.string().min(1, 'phone_number_id é obrigatório.'),
  businessAccountId: z.string().min(1, 'business_account_id é obrigatório.'),
  displayPhoneNumber: z.string().min(1, 'Número de exibição é obrigatório.')
});
