'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import AuthBrand from '../components/AuthBrand';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Não foi possível alterar sua senha.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="auth-success-state">
        <span className="auth-success-icon"><CheckCircle2 size={28} /></span>
        <span className="eyebrow">Acesso recuperado</span>
        <h1 className="auth-title">Senha alterada</h1>
        <p className="auth-sub">Sua nova senha já está ativa. Agora você pode entrar normalmente.</p>
        <Link href="/login" className="btn btn-block">Ir para o login <ArrowRight size={17} /></Link>
      </div>
    );
  }

  return (
    <>
      <span className="eyebrow">Nova senha</span>
      <h1 className="auth-title">Crie uma senha segura</h1>
      <p className="auth-sub">Use 12 ou mais caracteres, com maiúscula, minúscula e número.</p>
      {!token ? (
        <div className="alert alert-error">Link de recuperação inválido. Solicite um novo link.</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="password">Nova senha</label>
            <div className="input-icon"><LockKeyhole size={17} /><input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua nova senha"
              autoComplete="new-password"
              minLength={12}
              autoFocus
              required
            /></div>
          </div>
          <div className="field">
            <label htmlFor="confirmation">Confirmar nova senha</label>
            <div className="input-icon"><LockKeyhole size={17} /><input
              id="confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Repita sua nova senha"
              autoComplete="new-password"
              minLength={12}
              required
            /></div>
          </div>
          {error && <div className="alert alert-error auth-alert">{error}</div>}
          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? <><span className="button-spinner" />Alterando...</> : <>Salvar nova senha <ArrowRight size={17} /></>}
          </button>
        </form>
      )}
      <p className="auth-back-link"><Link href="/esqueci-senha"><ArrowLeft size={14} /> Solicitar outro link</Link></p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="auth-layout">
      <AuthBrand />
      <section className="auth-form-panel">
        <div className="auth-box">
          <div className="auth-mobile-logo">FilaZap</div>
          <Suspense fallback={<div className="loading-screen"><span className="spinner" />Carregando...</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
