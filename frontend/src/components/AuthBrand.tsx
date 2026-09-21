import { CheckCircle2, MessageCircleMore, ShieldCheck, Sparkles } from 'lucide-react';

export default function AuthBrand() {
  return (
    <section className="auth-brand-panel">
      <div className="auth-brand-logo"><span><MessageCircleMore size={24} /></span><strong>FilaZap</strong></div>
      <div className="auth-brand-copy">
        <span className="auth-kicker"><Sparkles size={14} /> Atendimento que gera confiança</span>
        <h1>Conversas organizadas.<br />Clientes bem atendidos.</h1>
        <p>Centralize sua operação do WhatsApp, distribua a fila com justiça e acompanhe sua equipe em tempo real.</p>
        <ul>
          <li><CheckCircle2 size={18} /><span>Fila inteligente e transparente</span></li>
          <li><CheckCircle2 size={18} /><span>Histórico completo do cliente</span></li>
          <li><ShieldCheck size={18} /><span>Credenciais protegidas e acesso por perfil</span></li>
        </ul>
      </div>
      <div className="auth-quote"><p>“Mais clareza para quem atende, mais agilidade para quem precisa.”</p><span>Operação conectada · Equipe produtiva</span></div>
      <div className="auth-grid-decoration" />
    </section>
  );
}
