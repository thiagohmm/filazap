import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Headphones, MessageSquareText, RotateCcw, TrendingUp, Users } from 'lucide-react';
import { loadSession } from '../lib/session';
import type { OrganizationInfo } from '../lib/session';
import { useOrgTheme } from '../lib/useOrgTheme';
import Topbar from '../components/Topbar';

type Counters = { waiting: number; returning: number; inProgress: number; waitingCustomer: number; finishedToday: number; maxWaitSeconds: number | null; avgFirstResponseSeconds: number | null };
type Metrics = { avgAttendanceSeconds: number | null; totalFinished: number; ticketsPerAgent: Array<{ userId: string; name: string; count: number }>; returnRate: number | null };
type QueueItem = { ticketId: string; status: string; waitSeconds: number; sequenceNumber: number; contact: { name: string | null; phoneE164: string }; lastMessage: { body: string | null } | null };

const EMPTY_COUNTERS: Counters = { waiting: 0, returning: 0, inProgress: 0, waitingCustomer: 0, finishedToday: 0, maxWaitSeconds: null, avgFirstResponseSeconds: null };
const STATUS_LABEL: Record<string, string> = { WAITING: 'Aguardando', RETURNING: 'Retorno', IN_PROGRESS: 'Em atendimento', WAITING_CUSTOMER: 'Aguardando cliente', FINISHED: 'Finalizado' };

function duration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [session] = useState(loadSession);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationInfo | null>(null);
  const [counters, setCounters] = useState<Counters>(EMPTY_COUNTERS);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useOrgTheme(selectedOrg);

  useEffect(() => {
    if (!session) { navigate('/login', { replace: true }); return; }
    if (!selectedOrg && session.organizations.length) setSelectedOrg(session.organizations[0]);
  }, [session, selectedOrg, navigate]);

  const loadOverview = useCallback(async () => {
    if (!session || !selectedOrg) return;
    setLoading(true); setError('');
    const headers = { Authorization: `Bearer ${session.token}` };
    try {
      const [counterResponse, metricsResponse, queueResponse] = await Promise.all([
        fetch(`/api/organizations/${selectedOrg.id}/tickets/counters`, { headers }),
        fetch(`/api/organizations/${selectedOrg.id}/metrics`, { headers }),
        fetch(`/api/organizations/${selectedOrg.id}/tickets`, { headers })
      ]);
      const [counterData, metricsData, queueData] = await Promise.all([counterResponse.json(), metricsResponse.json(), queueResponse.json()]);
      if (!counterResponse.ok || !metricsResponse.ok || !queueResponse.ok) throw new Error('Não foi possível carregar os indicadores.');
      setCounters(counterData); setMetrics(metricsData); setQueue((queueData.queue ?? []).slice(0, 5));
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro de conexão.'); } finally { setLoading(false); }
  }, [session, selectedOrg]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  function selectOrg(orgId: string) { const org = session?.organizations.find((item) => item.id === orgId); if (org) setSelectedOrg(org); }

  if (!session || !selectedOrg) return <div className="loading-screen"><span className="spinner" />Carregando workspace...</div>;

  const firstName = session.user.name.split(' ')[0];
  const cards = [
    { label: 'Aguardando na fila', value: counters.waiting, note: `Maior espera: ${duration(counters.maxWaitSeconds)}`, icon: Clock3, tone: 'orange' },
    { label: 'Em atendimento', value: counters.inProgress, note: `${counters.waitingCustomer} aguardando cliente`, icon: Headphones, tone: 'blue' },
    { label: 'Finalizados hoje', value: counters.finishedToday, note: `Tempo médio: ${duration(metrics?.avgAttendanceSeconds ?? null)}`, icon: CheckCircle2, tone: 'green' },
    { label: 'Taxa de retorno', value: metrics?.returnRate != null ? `${metrics.returnRate}%` : '—', note: `${counters.returning} retornos na fila`, icon: RotateCcw, tone: 'violet' }
  ];

  return (
    <div>
      <Topbar session={session} selectedOrg={selectedOrg} onSelectOrg={selectOrg} />
      <main className="dash page-content dashboard-overview">
        <div className="page-head page-head-row">
          <div><span className="eyebrow">Visão operacional</span><h1>Olá, {firstName}. 👋</h1><p>Acompanhe o ritmo do atendimento da sua equipe em tempo real.</p></div>
          <Link className="btn" to="/dashboard/atendimento">Abrir central <ArrowRight size={17} /></Link>
        </div>
        {error && <div className="alert alert-error">{error} <button onClick={() => void loadOverview()}>Tentar novamente</button></div>}

        <section className="stats-grid" aria-busy={loading}>
          {cards.map((card) => { const Icon = card.icon; return <article className="stat-card" key={card.label}><span className={`stat-icon ${card.tone}`}><Icon size={21} /></span><div className="stat-label">{card.label}</div><strong className="stat-value">{loading ? '···' : card.value}</strong><div className="stat-note"><TrendingUp size={13} />{card.note}</div></article>; })}
        </section>

        <div className="overview-grid">
          <section className="card overview-queue">
            <div className="section-heading section-heading-inline"><div><h2>Fila agora</h2><p>Atendimentos que precisam de atenção.</p></div><Link to="/dashboard/atendimento">Ver central <ArrowRight size={15} /></Link></div>
            <div className="queue-preview">
              {!loading && queue.length === 0 && <div className="polished-empty"><MessageSquareText size={28} /><strong>Nenhum atendimento na fila</strong><span>Novas conversas aparecerão aqui.</span></div>}
              {queue.map((item) => <Link to="/dashboard/atendimento" className="queue-preview-row" key={item.ticketId}><span className="contact-avatar">{(item.contact.name ?? item.contact.phoneE164).slice(0, 2).toUpperCase()}</span><span className="preview-copy"><strong>{item.contact.name ?? item.contact.phoneE164}</strong><small>{item.lastMessage?.body ?? 'Sem mensagens'}</small></span><span className={`status-badge ${item.status.toLowerCase()}`}>{STATUS_LABEL[item.status] ?? item.status}</span><span className="preview-wait">{duration(item.waitSeconds)}</span></Link>)}
            </div>
          </section>

          <aside className="card team-performance">
            <div className="section-heading"><span className="section-icon"><Users size={20} /></span><div><h2>Desempenho da equipe</h2><p>Atendimentos concluídos.</p></div></div>
            <div className="performance-total"><span>Total finalizado</span><strong>{metrics?.totalFinished ?? 0}</strong></div>
            <div className="performance-list">
              {metrics?.ticketsPerAgent.length ? metrics.ticketsPerAgent.map((agent, index) => <div className="performance-row" key={agent.userId}><span className="rank">{index + 1}</span><span className="agent-avatar">{agent.name.slice(0, 2).toUpperCase()}</span><strong>{agent.name}</strong><span>{agent.count}</span></div>) : <p className="muted">Ainda não há atendimentos finalizados.</p>}
            </div>
            <Link className="text-link" to="/dashboard/equipe">Gerenciar equipe <ArrowRight size={15} /></Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
