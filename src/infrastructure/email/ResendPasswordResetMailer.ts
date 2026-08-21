import type { PasswordResetMailer } from '../../application/ports/PasswordResetMailer';

export class ResendPasswordResetMailer implements PasswordResetMailer {
  constructor(
    private readonly apiKey = process.env.RESEND_API_KEY ?? '',
    private readonly from = process.env.EMAIL_FROM ?? ''
  ) {}

  async send(input: { email: string; name: string; resetUrl: string }): Promise<void> {
    if (!this.apiKey || !this.from) {
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[password-reset] ${input.email}: ${input.resetUrl}`);
        return;
      }
      throw new Error('RESEND_API_KEY e EMAIL_FROM não configurados.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.email],
        subject: 'Recupere sua senha do FilaZap',
        html: this.buildHtml(input.name, input.resetUrl)
      })
    });
    if (!response.ok) {
      throw new Error(`Resend respondeu com status ${response.status}.`);
    }
  }

  private buildHtml(name: string, resetUrl: string): string {
    const safeName = escapeHtml(name);
    const safeUrl = escapeHtml(resetUrl);
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
        <h1 style="font-size:24px">Recupere sua senha</h1>
        <p>Olá, ${safeName}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha do FilaZap.</p>
        <p style="margin:28px 0"><a href="${safeUrl}" style="background:#10b981;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
        <p>Este link expira em 30 minutos e só pode ser usado uma vez.</p>
        <p style="color:#6c788d;font-size:12px">Se você não solicitou a alteração, ignore este e-mail.</p>
      </div>`;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char] ?? char);
}
