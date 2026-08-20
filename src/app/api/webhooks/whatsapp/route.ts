import { NextRequest } from 'next/server';
import { useCases, webhookParser, credentialCipher, channels } from '@/container';
import { MetaWebhookSignatureVerifier } from '@/infrastructure/whatsapp/MetaWebhookSignatureVerifier';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode') ?? '';
  const verifyToken = req.nextUrl.searchParams.get('hub.verify_token') ?? '';
  const challenge = req.nextUrl.searchParams.get('hub.challenge') ?? '';

  const result = await useCases.verifyWebhook.execute({
    mode,
    verifyToken,
    challenge
  });
  if (!result.valid) {
    return new Response('Verificação falhou', { status: 403 });
  }
  return new Response(challenge, { status: 200 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const parsed = webhookParser.parse(payload);
  if (!parsed.phoneNumberId) {
    return Response.json({ error: 'phone_number_id não encontrado.' }, { status: 400 });
  }

  const channel = await channels.findByPhoneNumberId(parsed.phoneNumberId);
  if (!channel || !channel.appSecretEncrypted) {
    return Response.json({ error: 'Canal não configurado.' }, { status: 401 });
  }

  const appSecret = credentialCipher.decrypt(channel.appSecretEncrypted);
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  const verifier = new MetaWebhookSignatureVerifier(() => appSecret);
  if (!verifier.verify(rawBody, signature)) {
    return Response.json({ error: 'Assinatura inválida.' }, { status: 401 });
  }

  try {
    const output = await useCases.receiveWhatsAppMessage.execute({ payload });
    return Response.json(output);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro interno.' },
      { status: 400 }
    );
  }
}
