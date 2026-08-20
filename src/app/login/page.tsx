'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { saveSession } from '../lib/session';
import AuthBrand from '../components/AuthBrand';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao entrar.');
        return;
      }
      saveSession({ token: data.token, user: data.user, organizations: data.organizations });
      router.push('/dashboard');
    } catch {
      setError('Erro de conexão.');
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
          <span className="eyebrow">Bem-vindo de volta</span>
          <h1 className="auth-title">Acesse sua conta</h1>
          <p className="auth-sub">Entre para acompanhar sua operação de atendimento.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <div className="input-icon"><Mail size={17} /><input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              autoComplete="email"
              required
            /></div>
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <div className="input-icon"><LockKeyhole size={17} /><input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            /></div>
          </div>
          {error && <div className="alert alert-error auth-alert">{error}</div>}
          <button type="submit" className="btn btn-block" disabled={loading}>
            {loading ? <><span className="button-spinner" />Entrando...</> : <>Entrar na plataforma <ArrowRight size={17} /></>}
          </button>
        </form>
          <div className="auth-divider"><span>Primeiro acesso?</span></div>
          <p className="auth-switch">Ainda não tem uma empresa? <Link href="/onboarding">Criar workspace</Link></p>
          <p className="auth-legal">Ao continuar, você concorda com os termos de uso e privacidade.</p>
        </div>
      </section>
    </main>
  );
}
