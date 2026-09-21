'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Send, Users, X } from 'lucide-react';
import type { OrganizationInfo, Session } from '../lib/session';

type OnlineMember = {
  userId: string;
  name: string;
  role: string;
  isCurrentUser: boolean;
};

type TeamMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string };
  recipient: { id: string; name: string } | null;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Proprietário',
  ADMIN: 'Administrador',
  AGENT: 'Atendente'
};

export default function TeamChatPanel({
  session,
  selectedOrg
}: {
  session: Session;
  selectedOrg: OrganizationInfo;
}) {
  const [open, setOpen] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [recipientUserId, setRecipientUserId] = useState('ALL');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const canUseChat = ['OWNER', 'ADMIN', 'AGENT'].includes(selectedOrg.role);
  const headers = { Authorization: `Bearer ${session.token}` };

  useEffect(() => setMounted(true), []);

  const loadChat = useCallback(async () => {
    if (!canUseChat) return;
    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}/team-chat`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const data = await response.json();
      if (!response.ok) return;
      setOnlineMembers(data.onlineMembers ?? []);
      setMessages(data.messages ?? []);
    } catch {
      // O próximo ciclo de polling tenta novamente.
    }
  }, [canUseChat, selectedOrg.id, session.token]);

  useEffect(() => {
    if (!canUseChat) return;
    const heartbeat = () => void fetch(
      `/api/organizations/${selectedOrg.id}/team-chat/presence`,
      { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } }
    );
    heartbeat();
    const heartbeatTimer = setInterval(heartbeat, 20_000);
    void loadChat();
    const chatTimer = setInterval(loadChat, 3_000);
    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(chatTimer);
    };
  }, [canUseChat, loadChat, selectedOrg.id, session.token]);

  useEffect(() => {
    setOpen(false);
    setRecipientUserId('ALL');
    setMessages([]);
    setOnlineMembers([]);
  }, [selectedOrg.id]);

  useEffect(() => {
    if (
      recipientUserId !== 'ALL' &&
      !onlineMembers.some((member) => member.userId === recipientUserId)
    ) setRecipientUserId('ALL');
  }, [onlineMembers, recipientUserId]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/organizations/${selectedOrg.id}/team-chat`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: recipientUserId === 'ALL' ? null : recipientUserId,
          body: draft
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Não foi possível enviar a mensagem.');
        return;
      }
      setDraft('');
      await loadChat();
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSending(false);
    }
  }

  if (!canUseChat) return null;
  const otherOnlineMembers = onlineMembers.filter((member) => !member.isCurrentUser);

  return (
    <>
      <button
        type="button"
        className="btn btn-outline team-chat-trigger"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="team-chat-panel"
      >
        <MessageCircle size={16} />
        <span className="team-chat-trigger-label">Equipe</span>
        <small className="team-chat-trigger-count"><i />{onlineMembers.length}<span> online</span></small>
      </button>

      {mounted && createPortal(
        <>
          {open && <button type="button" className="team-chat-backdrop" onClick={() => setOpen(false)} aria-label="Fechar chat" />}
          <aside
            id="team-chat-panel"
            className={`team-chat-panel ${open ? 'open' : ''}`}
            aria-hidden={!open}
            aria-label="Mensagens da equipe"
          >
            <header className="team-chat-head">
              <div><span className="team-chat-icon"><Users size={18} /></span><span><strong>Chat da equipe</strong><small>{onlineMembers.length} pessoa(s) online</small></span></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar chat"><X size={19} /></button>
            </header>

            <section className="team-chat-presence" aria-label="Pessoas disponíveis">
              <div className="team-chat-section-title">
                <strong>Disponíveis agora</strong>
                <span>{onlineMembers.length} online</span>
              </div>
              <div className="team-chat-online">
                {onlineMembers.map((member) => (
                  <span key={member.userId} title={ROLE_LABEL[member.role] ?? member.role}>
                    <i />{member.name}{member.isCurrentUser ? ' (você)' : ''}
                  </span>
                ))}
              </div>
            </section>

            <div className="team-chat-messages">
              {messages.length === 0 && (
                <div className="team-chat-empty"><MessageCircle size={28} /><strong>Converse com a equipe</strong><span>Envie um aviso geral ou fale em particular com alguém online.</span></div>
              )}
              {messages.map((message) => {
                const own = message.sender.id === session.user.id;
                return (
                  <div key={message.id} className={`team-chat-message ${own ? 'own' : ''}`}>
                    <div className="team-chat-message-meta">
                      <strong>{own ? 'Você' : message.sender.name}</strong>
                      <span>{message.recipient ? (own ? `Para ${message.recipient.name}` : 'Privado') : 'Toda a equipe'}</span>
                    </div>
                    <p>{message.body}</p>
                    <time>{new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form className="team-chat-compose" onSubmit={handleSend}>
              <div className="team-chat-destination">
                <label htmlFor="team-chat-recipient">Enviar para</label>
                <select id="team-chat-recipient" value={recipientUserId} onChange={(event) => setRecipientUserId(event.target.value)}>
                  <option value="ALL">Toda a equipe</option>
                  {otherOnlineMembers.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {ROLE_LABEL[member.role] ?? member.role}</option>)}
                </select>
              </div>
              <div className="team-chat-input-row">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder={recipientUserId === 'ALL' ? 'Mensagem para toda a equipe...' : 'Mensagem privada...'} />
                <button type="submit" className="btn" disabled={sending || !draft.trim()} aria-label="Enviar mensagem"><Send size={16} /></button>
              </div>
              {error && <span className="form-error">{error}</span>}
            </form>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}
