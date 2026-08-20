import { z } from 'zod';

export const assignTicketSchema = z.object({
  ticketId: z.string().min(1, 'ticket_id é obrigatório.')
});

export const assignNextTicketSchema = z.object({
  channelId: z.string().optional()
});

export const ticketActionSchema = z.object({
  ticketId: z.string().min(1, 'ticket_id é obrigatório.')
});

export const addInternalNoteSchema = z.object({
  contactId: z.string().min(1, 'contact_id é obrigatório.'),
  ticketId: z.string().nullable().optional(),
  body: z.string().min(1, 'Nota vazia não pode ser adicionada.')
});

export const listQueueSchema = z.object({
  status: z.string().optional(),
  assignedUserId: z.string().optional(),
  limit: z.coerce.number().int().positive().optional()
});