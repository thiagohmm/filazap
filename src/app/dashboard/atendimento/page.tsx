'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCheck, Clock3, FileText, Image, MessageSquarePlus, Paperclip, RotateCcw, Search, Send, UserCheck, X } from 'lucide-react';
import { loadSession } from '../../lib/session';
import type { OrganizationInfo } from '../../lib/session';
import { useOrgTheme } from '../../lib/useOrgTheme';
import Topbar from '../components/Topbar';

type TicketStatus = 'WAITING' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RETURNING' | 'FINISHED';

type QueueItem = {
  ticketId: string;
  channelId: string;
  sequenceNumber: number;
  status: string;
  queueEnteredAt: string;
  waitSeconds: number;
  priority: number;
  assignedUserId: string | null;
  contact: { id: string; name: string | null; phoneE164: string };
  lastMessage: { body: string | null; createdAt: string | null } | null;
};

type Counters = {
  waiting: number;
  returning: number;
  inProgress: number;
  waitingCustomer: number;
  finishedToday: number;
  maxWaitSeconds: number | null;
  avgFirstResponseSeconds: number | null;
};

type Message = {
  id: string;
  ticketId: string;
  direction: string;
  type: string | null;
  body: string | null;
  mediaPath: string | null;
  createdAt: string;
};

type SearchResult = {
  id: string;
  channelId: string;
  phoneE164: string;
  name: string | null;
  firstContactAt: string;
  lastContactAt: string;
  totalTickets: number;
  lastMessageAt: string | null;
};

type ContactProfile = {
  contact: {
    id: string;
    channelId: string;
    phoneE164: string;
    name: string | null;
    firstContactAt: string;
    lastContactAt: string;
  };
  stats: {
    totalTickets: number;
    currentStatus: string | null;
    assignedUserName: string | null;
  };
  notes: Array<{
    id: string;
    body: string;
    authorUserId: string;
    createdAt: string;
  }>;
};

type HistoryItem = {
  ticketId: string;
  sequenceNumber: number;
  status: string;
  queueEnteredAt: string;
  finishedAt: string | null;
  assignedUserName: string | null;
  durationSeconds: number | null;
};

type Metrics = {
  avgAttendanceSeconds: number | null;
  totalFinished: number;
  ticketsPerAgent: Array<{ userId: string; name: string; count: number }>;
  returnRate: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  WAITING: 'Aguardando',
  RETURNING: 'Retorno',
  IN_PROGRESS: 'Em atendimento',
  WAITING_CUSTOMER: 'Aguardando cliente',
  FINISHED: 'Finalizado'
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function AtendimentoPage() {
  const router = useRouter();
  const [session] = useState(loadSession);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationInfo | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [counters, setCounters] = useState<Counters | null>(null);
  const [filter, setFilter] = useState<TicketStatus | 'ALL'>('ALL');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(318);
  const [rightWidth, setRightWidth] = useState(292);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1200 : true
  );
  const [layout, setLayout] = useState({
    left: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 1200
  });
  const resizeDirRef = useRef<'left' | 'right' | null>(null);

  useEffect(() => {
    const measure = () => {
      setWide(window.innerWidth >= 1200);
      if (bodyRef.current) {
        setLayout({ left: bodyRef.current.offsetLeft, width: bodyRef.current.clientWidth });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useOrgTheme(selectedOrg);

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!selectedOrg && session.organizations.length > 0) {
      setSelectedOrg(session.organizations[0]);
    }
  }, [session, selectedOrg, router]);

  const loadAll = useCallback(async () => {
    if (!session || !selectedOrg) return;
    const headers = { Authorization: `Bearer ${session.token}` };
    try {
      const [q, c, m] = await Promise.all([
        fetch(`/api/organizations/${selectedOrg.id}/tickets`, { headers }).then((r) =>
          r.json()
        ),
        fetch(`/api/organizations/${selectedOrg.id}/tickets/counters`, { headers }).then(
          (r) => r.json()
        ),
        fetch(`/api/organizations/${selectedOrg.id}/metrics`, { headers }).then((r) =>
          r.json()
        )
      ]);
      if (q.queue) setQueue(q.queue);
      if (c.waiting !== undefined) setCounters(c);
      if (m.avgAttendanceSeconds !== undefined) setMetrics(m);
    } catch {
      // polling continua; sem erro fatal
    }
  }, [session, selectedOrg]);

  useEffect(() => {
    if (!session || !selectedOrg) return;
    loadAll();
    pollRef.current = setInterval(loadAll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session, selectedOrg, loadAll]);

  useEffect(() => {
    if (!selectedTicketId) {
      setMessages([]);
      return;
    }
    if (!session || !selectedOrg) return;
    fetch(
      `/api/organizations/${selectedOrg.id}/tickets/${selectedTicketId}/messages`,
      { headers: { Authorization: `Bearer ${session.token}` } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) setMessages(data.messages);
      })
      .catch(() => undefined);
  }, [selectedTicketId, session, selectedOrg]);

  useEffect(() => {
    if (!selectedContactId) {
      setProfile(null);
      setHistory([]);
      return;
    }
    if (!session || !selectedOrg) return;
    const headers = { Authorization: `Bearer ${session.token}` };
    Promise.all([
      fetch(`/api/organizations/${selectedOrg.id}/contacts/${selectedContactId}`, {
        headers
      }).then((r) => r.json()),
      fetch(`/api/organizations/${selectedOrg.id}/contacts/${selectedContactId}/history`, {
        headers
      }).then((r) => r.json())
    ])
      .then(([p, h]) => {
        if (p.contact) setProfile(p);
        if (h.history) setHistory(h.history);
      })
      .catch(() => undefined);
  }, [selectedContactId, session, selectedOrg]);

  const runSearch = useCallback(
    async (query: string) => {
      if (!session || !selectedOrg || !query.trim()) {
        setSearchResults([]);
        return;
      }
      const data = await fetch(
        `/api/organizations/${selectedOrg.id}/contacts?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${session.token}` } }
      ).then((r) => r.json());
      setSearchResults(data.contacts ?? []);
    },
    [session, selectedOrg]
  );

  useEffect(() => {
    const t = setTimeout(() => runSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  function selectOrg(orgId: string) {
    if (!session) return;
    const org = session.organizations.find((o) => o.id === orgId);
    if (org) setSelectedOrg(org);
  }

  async function api(url: string, method = 'POST', body?: unknown) {
    if (!session || !selectedOrg) return null;
    setError('');
    const res = await fetch(`/api/organizations/${selectedOrg.id}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Erro na operação.');
      return null;
    }
    return data;
  }

  function handleStartResize(dir: 'left' | 'right') {
    if (typeof window === 'undefined') return;
    resizeDirRef.current = dir;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    const bodyLeft = bodyRef.current?.offsetLeft ?? 0;
    const onMove = (e: MouseEvent) => {
      if (!resizeDirRef.current || !bodyRef.current) return;
      const viewport = window.innerWidth;
      const centerMin = 340;
      const minCol = 240;
      const maxCol = 480;
      if (resizeDirRef.current === 'left') {
        setLeftWidth(Math.min(maxCol, Math.max(minCol, e.clientX - bodyLeft)));
      } else {
        setRightWidth(Math.min(maxCol, Math.max(minCol, viewport - e.clientX)));
      }
    };
    const onUp = () => {
      resizeDirRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const handleNext = async () => {
    const out = await api('/tickets/assign-next');
    if (out?.assigned && out.ticket) {
      setSelectedTicketId(out.ticket.id);
      loadAll();
    }
  };

  const handleAssign = async () => {
    if (!selectedTicketId) return;
    await api(`/tickets/${selectedTicketId}/assign`);
    loadAll();
  };

  const handleWaitingCustomer = async () => {
    if (!selectedTicketId) return;
    await api(`/tickets/${selectedTicketId}/waiting-customer`);
    loadAll();
  };

  const handleFinish = async () => {
    if (!selectedTicketId) return;
    await api(`/tickets/${selectedTicketId}/finish`);
    setSelectedTicketId(null);
    loadAll();
  };

  const handleReopen = async () => {
    if (!selectedTicketId) return;
    await api(`/tickets/${selectedTicketId}/reopen`);
    loadAll();
  };

  const mediaUrl = useCallback(
    (mediaPath: string | null) => {
      if (!selectedOrg || !mediaPath) return '';
      return `/api/organizations/${selectedOrg.id}/media/${mediaPath}`;
    },
    [selectedOrg]
  );

  function pickAttachFile() {
    fileInputRef.current?.click();
  }

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPendingFile(file ?? null);
    if (e.target) e.target.value = '';
  }

  function clearPendingFile() {
    setPendingFile(null);
  }

  async function refreshMessages(ticketId: string) {
    if (!session || !selectedOrg) return;
    const m = await fetch(
      `/api/organizations/${selectedOrg.id}/tickets/${ticketId}/messages`,
      { headers: { Authorization: `Bearer ${session.token}` } }
    ).then((r) => r.json());
    if (m.messages) setMessages(m.messages);
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasFile = !!pendingFile;
    if (!selectedTicketId) return;
    if (!hasFile && !draft.trim()) return;
    const selected = queue.find((q) => q.ticketId === selectedTicketId);
    if (!selected) return;
    if (selected.status === 'FINISHED') {
      setError('Atendimento finalizado: não é possível enviar mensagens.');
      return;
    }
    setLoading(true);
    try {
      let out: unknown = null;
      if (hasFile) {
        const fd = new FormData();
        fd.append('channelId', selected.channelId);
        fd.append('contactId', selected.contact.id);
        fd.append('body', draft);
        fd.append('file', pendingFile!);
        const res = await fetch(
          `/api/organizations/${selectedOrg!.id}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session!.token}` },
            body: fd
          }
        );
        out = await res.json();
      } else {
        out = await api('/messages', 'POST', {
          channelId: selected.channelId,
          contactId: selected.contact.id,
          body: draft
        });
      }
      if ((out as { message?: unknown }) && (out as { message?: unknown }).message) {
        setDraft('');
        clearPendingFile();
        await refreshMessages(selectedTicketId);
        loadAll();
      }
    } finally {
      setLoading(false);
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !noteDraft.trim()) return;
    const selected = queue.find((q) => q.ticketId === selectedTicketId);
    if (!selected) return;
    await api('/notes', 'POST', {
      contactId: selected.contact.id,
      ticketId: selectedTicketId,
      body: noteDraft
    });
    setNoteDraft('');
    if (selectedContactId === selected.contact.id) {
      const p = await fetch(
        `/api/organizations/${selectedOrg!.id}/contacts/${selectedContactId}`,
        { headers: { Authorization: `Bearer ${session!.token}` } }
      ).then((r) => r.json());
      if (p.contact) setProfile(p);
    }
  };

  const openContactFromSearch = (contactId: string) => {
    setSelectedContactId(contactId);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const selectTicket = (id: string) => {
    setSelectedTicketId(id);
    const item = queue.find((q) => q.ticketId === id);
    if (item) setSelectedContactId(item.contact.id);
  };

  const selectedTicket = queue.find((q) => q.ticketId === selectedTicketId) ?? null;
  const isFinished = selectedTicket?.status === 'FINISHED';

  if (!session || !selectedOrg) {
    return <div className="loading-screen"><span className="spinner" />Carregando central...</div>;
  }

  const filteredQueue = filter === 'ALL' ? queue : queue.filter((q) => q.status === filter);

  return (
    <div className="atendimento">
      <Topbar session={session} selectedOrg={selectedOrg} onSelectOrg={selectOrg}>
        <div className="search-wrap">
          <Search className="search-icon" size={16} />
          <input
            className="search-input"
            placeholder="Buscar por nome ou telefone..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          />
          {showSearch && searchQuery.trim() && (
            <div className="search-results">
              {searchResults.length === 0 && (
                <div className="queue-empty">Nenhum cliente encontrado.</div>
              )}
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  className="search-result-item"
                  onMouseDown={() => openContactFromSearch(c.id)}
                >
                  <strong>{c.name || c.phoneE164}</strong>
                  <span>{c.phoneE164} · {c.totalTickets} atendimento(s)</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Topbar>

      <div className="atend-body" ref={bodyRef} style={{
        gridTemplateColumns: wide
          ? `${leftWidth}px minmax(340px, 1fr) ${rightWidth}px`
          : undefined,
      }}>
        <div
          className="resize-handle"
          data-handle="left"
          style={{ left: `${leftWidth}px` }}
          onMouseDown={() => handleStartResize('left')}
        />
        <div
          className="resize-handle"
          data-handle="right"
          style={{ left: `${layout.width - rightWidth}px` }}
          onMouseDown={() => handleStartResize('right')}
        />
        <aside className="atend-side">
          <div className="queue-title"><div><span className="eyebrow">Operação</span><h2>Fila de atendimento</h2></div><span className="queue-total">{queue.length}</span></div>
          <div className="counters">
            <div className="counter"><span className="dot waiting"></span>{counters?.waiting ?? 0} aguardando</div>
            <div className="counter"><span className="dot returning"></span>{counters?.returning ?? 0} retornos</div>
            <div className="counter"><span className="dot in-progress"></span>{counters?.inProgress ?? 0} em atendimento</div>
            <div className="counter"><span className="dot waiting-customer"></span>{counters?.waitingCustomer ?? 0} aguardando cliente</div>
            <div className="counter"><span className="dot finished"></span>{counters?.finishedToday ?? 0} finalizados hoje</div>
            {counters?.maxWaitSeconds != null && (
              <div className="counter">Maior espera: {formatDuration(counters.maxWaitSeconds)}</div>
            )}
            {counters?.avgFirstResponseSeconds != null && (
              <div className="counter">1ª resposta: {formatDuration(Math.round(counters.avgFirstResponseSeconds))}</div>
            )}
          </div>

          <div className="filters">
            {(['ALL', 'WAITING', 'RETURNING', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'FINISHED'] as const).map((f) => (
              <button
                key={f}
                className={`filter ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'ALL' ? 'Todos' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>

          <div className="queue-list">
            {filteredQueue.length === 0 && <div className="queue-empty">Nenhum atendimento.</div>}
            {filteredQueue.map((q) => (
              <button
                key={q.ticketId}
                className={`queue-item ${selectedTicketId === q.ticketId ? 'selected' : ''}`}
                onClick={() => selectTicket(q.ticketId)}
              >
                <div className="qi-top">
                  <span className="qi-name">{q.contact.name || q.contact.phoneE164}</span>
                  <span className={`status-badge ${q.status.toLowerCase()}`}>{STATUS_LABEL[q.status]}</span>
                </div>
                <div className="qi-msg">{q.lastMessage?.body ?? 'Sem mensagens'}</div>
                <div className="qi-meta">
                  <span>Espera: {formatDuration(q.waitSeconds)}</span>
                  {q.sequenceNumber ? <span>#{q.sequenceNumber}</span> : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="atend-main">
          <div className="next-bar">
            <div><span className="eyebrow">Atendimento atual</span><strong>Central de conversas</strong></div>
            <button className="btn" onClick={handleNext}><UserCheck size={17} /> Próximo cliente</button>
            {error && <span className="form-error">{error}</span>}
          </div>

          {!selectedTicket ? (
            <div className="empty-state"><span className="empty-icon"><MessageSquarePlus size={30} /></span><strong>Selecione uma conversa</strong><p>Escolha um atendimento na fila ou assuma o próximo cliente disponível.</p></div>
          ) : (
            <div className="conversation">
              <div className="conv-head">
                <div>
                  <strong>{selectedTicket.contact.name || selectedTicket.contact.phoneE164}</strong>
                  <div className="conv-sub">
                    {selectedTicket.contact.phoneE164} · {STATUS_LABEL[selectedTicket.status]} · espera {formatDuration(selectedTicket.waitSeconds)}
                  </div>
                </div>
                <div className="conv-actions">
                  {selectedTicket.status === 'WAITING' || selectedTicket.status === 'RETURNING' ? (
                    <button className="btn" onClick={handleAssign}><UserCheck size={16} /> Assumir</button>
                  ) : null}
                  {selectedTicket.status === 'IN_PROGRESS' ? (
                    <button className="btn btn-outline" onClick={handleWaitingCustomer}><Clock3 size={16} /> Aguardar cliente</button>
                  ) : null}
                  {(selectedTicket.status === 'IN_PROGRESS' || selectedTicket.status === 'WAITING_CUSTOMER') ? (
                    <button className="btn btn-danger" onClick={handleFinish}><CheckCheck size={16} /> Finalizar</button>
                  ) : null}
                  {selectedTicket.status === 'FINISHED' ? (
                    <button className="btn btn-outline" onClick={handleReopen}><RotateCcw size={16} /> Reabrir</button>
                  ) : null}
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 && <div className="queue-empty">Nenhuma mensagem.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.direction === 'OUTBOUND' ? 'out' : 'in'}`}>
                    {m.mediaPath && (
                      <a
                        className="attach-media"
                        href={mediaUrl(m.mediaPath)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {m.type === 'IMAGE' ? (
                          <img src={mediaUrl(m.mediaPath)} alt={m.body ?? 'imagem'} />
                        ) : (
                          <span className="attach-doc">
                            <FileText size={18} />
                            <span>{m.body || 'Arquivo'}</span>
                          </span>
                        )}
                      </a>
                    )}
                    {m.body && <span>{m.body}</span>}
                    <span className="bubble-time">{formatTime(m.createdAt)}</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} className="send-form">
                {isFinished && (
                  <div className="queue-empty" style={{ padding: '8px 0' }}>
                    Atendimento finalizado — mensagens desativadas.
                  </div>
                )}
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Digite a resposta..."
                  disabled={loading || isFinished}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handlePickFile}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-icon"
                  title={'Anexar foto ou documento'}
                  onClick={pickAttachFile}
                  disabled={loading || isFinished}
                >
                  <Paperclip size={17} />
                </button>
                {pendingFile && (
                  <div className="attach-preview">
                    {pendingFile.type.startsWith('image/') && (
                      <img src={URL.createObjectURL(pendingFile)} alt="anexo" />
                    )}
                    <span className="attach-name">
                      {pendingFile.type.startsWith('image/') ? <Image size={14} /> : <FileText size={14} />}
                      {pendingFile.name}
                    </span>
                    <button
                      type="button"
                      className="attach-remove"
                      title={'Remover anexo'}
                      onClick={clearPendingFile}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <button className="btn send-button" disabled={loading || isFinished}><Send size={17} /><span>Enviar</span></button>
              </form>

              <form onSubmit={handleAddNote} className="send-form note-form">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Nota interna (não vai ao cliente)..."
                />
                <button className="btn btn-info" disabled={loading}>Adicionar nota</button>
              </form>
            </div>
          )}
        </main>

        <aside className="atend-client-panel">
          {!selectedContactId ? (
            <div className="queue-empty">
              <p>Busque um cliente ou selecione um atendimento para ver o perfil.</p>
              {metrics && (
                <div className="metrics-summary">
                  <div className="metric">
                    <strong>{metrics.totalFinished}</strong>
                    <span>Finalizados</span>
                  </div>
                  <div className="metric">
                    <strong>{metrics.avgAttendanceSeconds != null ? formatDuration(Math.round(metrics.avgAttendanceSeconds)) : '—'}</strong>
                    <span>Tempo médio</span>
                  </div>
                  <div className="metric">
                    <strong>{metrics.returnRate != null ? `${metrics.returnRate}%` : '—'}</strong>
                    <span>Retorno</span>
                  </div>
                </div>
              )}
              {metrics && metrics.ticketsPerAgent.length > 0 && (
                <div className="agents-list">
                  <h4>Atendimentos por atendente</h4>
                  {metrics.ticketsPerAgent.map((a) => (
                    <div key={a.userId} className="agent-row">
                      <span>{a.name}</span>
                      <span>{a.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="client-panel">
              <div className="panel-head">
                <strong>{profile?.contact.name || 'Cliente'}</strong>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setSelectedContactId(null)}
                >
                  Fechar
                </button>
              </div>

              {profile && (
                <div className="profile-block">
                  <div className="profile-row"><span>Telefone</span><strong>{profile.contact.phoneE164}</strong></div>
                  <div className="profile-row"><span>Primeira interação</span><strong>{formatDate(profile.contact.firstContactAt)}</strong></div>
                  <div className="profile-row"><span>Último contato</span><strong>{formatDate(profile.contact.lastContactAt)}</strong></div>
                  <div className="profile-row"><span>Atendimentos</span><strong>{profile.stats.totalTickets}</strong></div>
                  <div className="profile-row"><span>Status atual</span>
                    <strong>{profile.stats.currentStatus ? STATUS_LABEL[profile.stats.currentStatus] : 'Sem atendimento ativo'}</strong>
                  </div>
                  {profile.stats.assignedUserName && (
                    <div className="profile-row"><span>Atendente</span><strong>{profile.stats.assignedUserName}</strong></div>
                  )}
                </div>
              )}

              <div className="panel-section">
                <h4>Notas internas</h4>
                {profile && profile.notes.length === 0 && <p className="muted">Sem notas.</p>}
                {profile?.notes.map((n) => (
                  <div key={n.id} className="note-item">
                    <p>{n.body}</p>
                    <span>{formatDate(n.createdAt)}</span>
                  </div>
                ))}
              </div>

              <div className="panel-section">
                <h4>Histórico de atendimentos</h4>
                {history.length === 0 && <p className="muted">Sem atendimentos.</p>}
                {history.map((h) => (
                  <button
                    key={h.ticketId}
                    className="history-item"
                    onClick={() => {
                      setSelectedTicketId(h.ticketId);
                      setSelectedContactId(profile?.contact.id ?? null);
                    }}
                  >
                    <div className="history-top">
                      <span>#{h.sequenceNumber}</span>
                      <span className={`status-badge ${h.status.toLowerCase()}`}>{STATUS_LABEL[h.status]}</span>
                    </div>
                    <div className="history-meta">
                      <span>{formatDate(h.queueEnteredAt)}</span>
                      {h.durationSeconds != null && <span>{formatDuration(h.durationSeconds)}</span>}
                      {h.assignedUserName && <span>{h.assignedUserName}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
