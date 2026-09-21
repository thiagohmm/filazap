import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import AuthBrand from '../components/AuthBrand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Não foi possível enviar as instruções.');
        return;
      }
      setSuccess(data.message);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-layout">
      <AuthBrand />
      <section className="auth-form-panel">
        <div className="auth-box">
          <div className="auth-mobile-logo">FilaZap</div>
          {success ? (
            <div className="auth-success-state">
              <span className="auth-success-icon"><CheckCircle2 size={28} /></span>
              <span className="eyebrow">Confira sua caixa de entrada</span>
              <h1 className="auth-title">Instruções enviadas</h1>
              <p className="auth-sub">{success}</p>
              <Link to="/login" className="btn btn-block"><ArrowLeft size={17} /> Voltar para o login</Link>
            </div>
          ) : (
            <>
              <span className="eyebrow">Recuperação de acesso</span>
              <h1 className="auth-title">Esqueceu sua senha?</h1>
              <p className="auth-sub">Informe seu e-mail e enviaremos um link para você criar uma nova senha.</p>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="email">E-mail da conta</label>
                  <div className="input-icon"><Mail size={17} /><input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@empresa.com"
                    autoComplete="email"
                    autoFocus
                    required
                  /></div>
                </div>
                {error && <div className="alert alert-error auth-alert">{error}</div>}
                <button type="submit" className="btn btn-block" disabled={loading}>
                  {loading ? <><span className="button-spinner" />Enviando...</> : <>Enviar link de recuperação <ArrowRight size={17} /></>}
                </button>
              </form>
              <p className="auth-back-link"><Link to="/login"><ArrowLeft size={14} /> Voltar para o login</Link></p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
