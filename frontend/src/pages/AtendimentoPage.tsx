import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCheck,
  Clock3,
  Download,
  FileText,
  Image as ImageIcon,
  MapPin,
  Mic,
  MessageSquarePlus,
  Paperclip,
  RotateCcw,
  Search,
  Send,
  Square,
  Trash2,
  UserCheck,
  X
} from 'lucide-react';
import { loadSession } from '../lib/session';
import type { OrganizationInfo } from '../lib/session';
import { useOrgTheme } from '../lib/useOrgTheme';
import Topbar from '../components/Topbar';
import TeamChatPanel from './TeamChatPanel';

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
  assignedUserName: string | null;
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

/** Evita re-render/scroll a cada poll quando a lista de mensagens não mudou. */
function sameMessages(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  return a[a.length - 1]?.id === b[b.length - 1]?.id;
}

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

function formatRecordingTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remaining = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function AtendimentoPage() {
  const navigate = useNavigate();
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRecordingRef = useRef(false);
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
  const [mobileView, setMobileView] = useState<'queue' | 'chat'>('queue');
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
      navigate('/login', { replace: true });
      return;
    }
    if (!selectedOrg && session.organizations.length > 0) {
      setSelectedOrg(session.organizations[0]);
    }
  }, [session, selectedOrg, navigate]);

  const loadAll = useCallback(async () => {
    if (!session || !selectedOrg) return;
    const headers = { Authorization: `Bearer ${session.token}` };
    const base = `/api/organizations/${selectedOrg.id}`;
    try {
      const [q, c, m] = await Promise.all([
        fetch(`${base}/tickets`, { headers }).then((r) => r.json()),
        fetch(`${base}/tickets/counters`, { headers }).then((r) => r.json()),
        fetch(`${base}/metrics`, { headers }).then((r) => r.json())
      ]);
      if (q.queue) setQueue(q.queue);
      if (c.waiting !== undefined) setCounters(c);
      if (m.avgAttendanceSeconds !== undefined) setMetrics(m);
    } catch {
      // polling continua; sem erro fatal
    }
    // A conversa aberta também precisa do polling: sem isso, mensagens novas só aparecem
    // ao trocar de ticket ou recarregar a página.
    if (selectedTicketId) {
      try {
        const msgs = await fetch(`${base}/tickets/${selectedTicketId}/messages`, {
          headers
        }).then((r) => r.json());
        if (msgs.messages) {
          setMessages((prev) => (sameMessages(prev, msgs.messages) ? prev : msgs.messages));
        }
      } catch {
        // ignora falha transitória; o próximo ciclo tenta novamente
      }
    }
  }, [session, selectedOrg, selectedTicketId]);

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
      setSelectedContactId(out.ticket.contactId);
      setMobileView('chat');
      await loadAll();
      return;
    }
    if (out && !out.assigned) setError('Nenhum cliente livre para assumir no momento.');
  };

  const handleAssign = async () => {
    if (!selectedTicketId) return;
    const out = await api(`/tickets/${selectedTicketId}/assign`);
    if (!out?.ticket) return;
    setQueue((current) => current.map((ticket) => ticket.ticketId === selectedTicketId
      ? {
          ...ticket,
          status: out.ticket.status,
          assignedUserId: out.ticket.assignedUserId,
          assignedUserName: session?.user.name ?? null
        }
      : ticket));
    await loadAll();
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
    setMobileView('queue');
    loadAll();
  };

  const handleReopen = async () => {
    if (!selectedTicketId) return;
    await api(`/tickets/${selectedTicketId}/reopen`);
    loadAll();
  };

  const mediaUrl = useCallback(
    (mediaPath: string | null, download = false) => {
      if (!selectedOrg || !mediaPath || !session) return '';
      const base = `/api/organizations/${selectedOrg.id}/media/${mediaPath}`;
      // <img>/<audio>/<a> não enviam Authorization; o backend aceita o JWT via ?token= em /media/.
      const params = new URLSearchParams({ token: session.token });
      if (download) params.set('download', '1');
      return `${base}?${params.toString()}`;
    },
    [selectedOrg, session]
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
    setRecordedBlob(null);
  }

  const mimeTypes = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav'
  ];

  function pickMime(): string {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
      return mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    }
    return '';
  }

  async function startRecording() {
    if (
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        window?.isSecureContext === false
          ? 'Gravação de áudio requer contexto seguro: acesse via https ou localhost.'
          : 'Seu navegador não suporta gravação de áudio.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const RecorderClass = (window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder;
      const mimeType = pickMime();
      const recorder = mimeType
        ? new RecorderClass(stream, { mimeType })
        : new RecorderClass(stream);
      recorder.onerror = () => {
        setError('Falha na gravação de áudio. Verifique o microfone.');
        stopRecording();
      };

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          recordedChunksRef.current = [];
          setRecordingSeconds(0);
          return;
        }
        const blob = new Blob(recordedChunksRef.current, {
          type: (mimeType || 'audio/webm').split(';')[0]
        });
        setRecordedBlob(blob);
        setRecordingSeconds(0);
        recordedChunksRef.current = [];
      };

      mediaRecorderRef.current = recorder;
      discardRecordingRef.current = false;
      recordedChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecording(true);
      setError('');
      recorder.start(1000);
      recordingTimerRef.current = setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Permissão de microfone negada. Libere o acesso nas configurações do navegador.');
      } else {
        setError('Não foi possível acessar o microfone.');
      }
    }
  }

  const recordedUrl = useMemo(
    () => (recordedBlob ? URL.createObjectURL(recordedBlob) : null),
    [recordedBlob]
  );

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  function cancelRecording() {
    discardRecordingRef.current = true;
    stopRecording();
    setRecordedBlob(null);
    setRecordingSeconds(0);
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
    if (!hasFile && !recordedBlob && !draft.trim()) return;
    const selected = queue.find((q) => q.ticketId === selectedTicketId);
    if (!selected) return;
    if (selected.status === 'FINISHED') {
      setError('Atendimento finalizado: não é possível enviar mensagens.');
      return;
    }
    setLoading(true);
    try {
      let out: unknown = null;
      let fileToSend: File | null = pendingFile;
      if (!fileToSend && recordedBlob) {
        const ext = recordedBlob.type === 'audio/mp4'
          ? 'm4a'
          : recordedBlob.type.split('/')[1] || 'webm';
        fileToSend = new File(
          [recordedBlob],
          `audio_${Date.now()}.${ext ?? 'webm'}`,
          { type: recordedBlob.type || 'audio/webm' }
        );
        setRecordedBlob(null);
      }
      if (fileToSend) {
        const authorization = await fetch(
          `/api/organizations/${selectedOrg!.id}/media/upload-url`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session!.token}`
            },
            body: JSON.stringify({
              filename: fileToSend.name,
              mimeType: fileToSend.type,
              size: fileToSend.size
            })
          }
        );
        const upload = await authorization.json();
        if (!authorization.ok) throw new Error(upload.error ?? 'Falha ao autorizar anexo.');

        if (upload.mode === 'supabase') {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
          if (!supabaseUrl || !supabaseKey) throw new Error('Supabase não configurado no navegador.');
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false }
          });
          const { error: uploadError } = await supabase.storage
            .from(import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? 'filazap-media')
            .uploadToSignedUrl(upload.storedPath, upload.token, fileToSend, {
              contentType: fileToSend.type
            });
          if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);
          out = await api('/messages', 'POST', {
            channelId: selected.channelId,
            contactId: selected.contact.id,
            body: draft,
            media: {
              filename: fileToSend.name,
              mimeType: fileToSend.type,
              storedPath: upload.storedPath,
              caption: draft || null
            }
          });
        } else {
          const fd = new FormData();
          fd.append('channelId', selected.channelId);
          fd.append('contactId', selected.contact.id);
          fd.append('body', draft);
          fd.append('file', fileToSend);
          const res = await fetch(`/api/organizations/${selectedOrg!.id}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session!.token}` },
            body: fd
          });
          out = await res.json();
        }
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
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Falha ao enviar mensagem.');
    } finally {
      setLoading(false);
    }
  };

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
    setMobileView('chat');
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const selectTicket = (id: string) => {
    setSelectedTicketId(id);
    setMobileView('chat');
    const item = queue.find((q) => q.ticketId === id);
    if (item) setSelectedContactId(item.contact.id);
  };

  const selectedTicket = queue.find((q) => q.ticketId === selectedTicketId) ?? null;
  const isFinished = selectedTicket?.status === 'FINISHED';
  const canReplyToAny = selectedOrg?.role === 'OWNER' || selectedOrg?.role === 'ADMIN';
  const isReplyLocked = !!selectedTicket && !canReplyToAny && selectedTicket.assignedUserId !== session?.user.id;
  const isSelectedAvailable = !!selectedTicket &&
    (selectedTicket.status === 'WAITING' || selectedTicket.status === 'RETURNING') &&
    !selectedTicket.assignedUserId;
  const canManageSelected = !!selectedTicket && selectedTicket.assignedUserId === session?.user.id;
  const ownActiveTicket = queue.find((ticket) =>
    ticket.assignedUserId === session?.user.id && ticket.status !== 'FINISHED'
  ) ?? null;
  const hasAvailableTicket = queue.some((ticket) =>
    !ticket.assignedUserId && (ticket.status === 'WAITING' || ticket.status === 'RETURNING')
  );

  if (!session || !selectedOrg) {
    return <div className="loading-screen"><span className="spinner" />Carregando central...</div>;
  }

  const filteredQueue = filter === 'ALL' ? queue : queue.filter((q) => q.status === filter);

  return (
    <div className="atendimento">
      <Topbar session={session} selectedOrg={selectedOrg} onSelectOrg={selectOrg}>
        <TeamChatPanel session={session} selectedOrg={selectedOrg} />
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

      <div className={`atend-body mobile-view-${mobileView}`} ref={bodyRef} style={{
        gridTemplateColumns: wide
          ? `${leftWidth}px minmax(340px, 1fr) ${rightWidth}px`
          : undefined,
      }}>
        <nav className="mobile-view-tabs" aria-label="Alternar entre fila e conversa">
          <button type="button" className={mobileView === 'queue' ? 'active' : ''} onClick={() => setMobileView('queue')}>
            Fila{queue.length > 0 ? <span className="tab-count">{queue.length}</span> : null}
          </button>
          <button type="button" className={mobileView === 'chat' ? 'active' : ''} onClick={() => setMobileView('chat')}>
            {selectedTicket ? `Conversa${selectedTicket.contact?.name ? ` · ${selectedTicket.contact.name}` : ''}` : 'Conversa'}
          </button>
        </nav>
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
                  {isSelectedAvailable ? (
                    <button className="btn" onClick={handleAssign}><UserCheck size={16} /> Assumir</button>
                  ) : null}
                  {selectedTicket.status === 'IN_PROGRESS' && canManageSelected ? (
                    <button className="btn btn-outline" onClick={handleWaitingCustomer}><Clock3 size={16} /> Aguardar cliente</button>
                  ) : null}
                  {(selectedTicket.status === 'IN_PROGRESS' || selectedTicket.status === 'WAITING_CUSTOMER') && canManageSelected ? (
                    <button className="btn btn-danger" onClick={handleFinish}><CheckCheck size={16} /> Finalizar</button>
                  ) : null}
                  {selectedTicket.status === 'FINISHED' && (canManageSelected || canReplyToAny) ? (
                    <button className="btn btn-outline" onClick={handleReopen}><RotateCcw size={16} /> Reabrir</button>
                  ) : null}
                </div>
              </div>

              <div className="messages">
                {messages.length === 0 && <div className="queue-empty">Nenhuma mensagem.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.direction === 'OUTBOUND' ? 'out' : 'in'}`}>
                    {m.mediaPath && m.type === 'IMAGE' && (
                      <div className="media-card media-card-image">
                        <a className="media-preview" href={mediaUrl(m.mediaPath)} target="_blank" rel="noopener noreferrer">
                          <img src={mediaUrl(m.mediaPath)} alt={m.body ?? 'Imagem enviada'} />
                        </a>
                        <a className="media-download" href={mediaUrl(m.mediaPath, true)} download title="Baixar imagem" aria-label="Baixar imagem">
                          <Download size={16} />
                        </a>
                      </div>
                    )}
                    {m.mediaPath && m.type === 'AUDIO' && (
                      <div className="media-card media-card-audio">
                        <span className="media-kind"><Mic size={16} /></span>
                        <audio controls preload="metadata" src={mediaUrl(m.mediaPath)} />
                        <a className="media-download" href={mediaUrl(m.mediaPath, true)} download title="Baixar áudio" aria-label="Baixar áudio">
                          <Download size={16} />
                        </a>
                      </div>
                    )}
                    {m.mediaPath && m.type === 'VIDEO' && (
                      <div className="media-card media-card-video">
                        <video controls preload="metadata" src={mediaUrl(m.mediaPath)} />
                        <a className="media-download" href={mediaUrl(m.mediaPath, true)} download title="Baixar vídeo" aria-label="Baixar vídeo">
                          <Download size={16} />
                        </a>
                      </div>
                    )}
                    {m.type === 'LOCATION' && m.body && (
                      <div className="media-card media-card-location">
                        <a className="document-preview" href={m.body} target="_blank" rel="noopener noreferrer">
                          <span className="document-icon"><MapPin size={30} /></span>
                          <span className="document-copy"><strong>Localização</strong><small>Abrir no mapa</small></span>
                        </a>
                      </div>
                    )}
                    {m.mediaPath && m.type !== 'IMAGE' && m.type !== 'AUDIO' && m.type !== 'VIDEO' && (
                      <div className="media-card media-card-document">
                        <a className="document-preview" href={mediaUrl(m.mediaPath)} target="_blank" rel="noopener noreferrer">
                          <span className="document-icon"><FileText size={30} /></span>
                          <span className="document-copy"><strong>{m.body || 'Documento'}</strong><small>Abrir documento</small></span>
                        </a>
                        <a className="media-download" href={mediaUrl(m.mediaPath, true)} download title="Baixar documento" aria-label="Baixar documento">
                          <Download size={16} />
                        </a>
                      </div>
                    )}
                    {m.body && m.type !== 'DOCUMENT' && m.type !== 'LOCATION' && <span className="media-caption">{m.body}</span>}
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
                {!isFinished && isReplyLocked && (
                  <div className="reply-lock-notice">
                    <span className="reply-lock-copy">
                      <strong>{isSelectedAvailable ? 'Cliente disponível' : 'Cliente em atendimento'}</strong>
                      {isSelectedAvailable
                        ? 'Assuma este cliente para liberar o envio de mensagens.'
                        : `Responsável: ${selectedTicket.assignedUserName ?? 'outro atendente'}.`}
                    </span>
                    <span className="reply-lock-actions">
                      {isSelectedAvailable && (
                        <button type="button" className="btn btn-sm" onClick={handleAssign}>
                          <UserCheck size={14} /> Assumir cliente
                        </button>
                      )}
                      {!isSelectedAvailable && ownActiveTicket && ownActiveTicket.ticketId !== selectedTicket.ticketId && (
                        <button type="button" className="btn btn-sm" onClick={() => selectTicket(ownActiveTicket.ticketId)}>
                          Abrir meu atendimento
                        </button>
                      )}
                      {!isSelectedAvailable && !ownActiveTicket && hasAvailableTicket && (
                        <button type="button" className="btn btn-sm" onClick={handleNext}>
                          <UserCheck size={14} /> Assumir próximo
                        </button>
                      )}
                    </span>
                  </div>
                )}
                {!isRecording && (
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Digite a resposta..."
                    disabled={loading || isFinished || isReplyLocked}
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handlePickFile}
                  style={{ display: 'none' }}
                />
                {!isRecording && (
                  <button
                    type="button"
                    className="btn btn-icon"
                    title={'Anexar foto ou documento'}
                    onClick={pickAttachFile}
                    disabled={loading || isFinished || isReplyLocked || !!recordedBlob}
                  >
                    <Paperclip size={17} />
                  </button>
                )}
                {pendingFile && (
                  <div className="attach-preview">
                    {pendingFile.type.startsWith('image/') && (
                      <img src={URL.createObjectURL(pendingFile)} alt="anexo" />
                    )}
                    <span className="attach-name">
                      {pendingFile.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
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
                {!isFinished && !isReplyLocked && (
                  <>
                    {isRecording ? (
                      <div className="voice-recorder" title="Gravando áudio">
                        <button type="button" className="voice-action voice-cancel" title="Cancelar gravação" onClick={cancelRecording}>
                          <Trash2 size={17} />
                        </button>
                        <span className="record-dot" />
                        <span className="record-label">Gravando</span>
                        <span className="record-time">{formatRecordingTime(recordingSeconds)}</span>
                        <button
                          type="button"
                          className="voice-action voice-stop"
                          title="Concluir gravação"
                          onClick={stopRecording}
                        >
                          <Square size={14} fill="currentColor" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {recordedBlob && (
                          <div className="voice-preview">
                            <span className="voice-preview-icon"><Mic size={16} /></span>
                            <div className="voice-preview-copy">
                              <strong>Áudio pronto</strong>
                              <small>Ouça antes de enviar</small>
                            </div>
                            {recordedUrl && (
                              <audio controls preload="metadata" src={recordedUrl} />
                            )}
                            <button
                              type="button"
                              className="voice-action voice-cancel"
                              title="Descartar áudio"
                              onClick={cancelRecording}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                        {!recordedBlob && (
                          <button type="button" className="btn btn-icon" title="Gravar áudio" onClick={startRecording} disabled={loading || !!pendingFile}>
                            <Mic size={17} />
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
                <button className="btn send-button" disabled={loading || isFinished || isReplyLocked || isRecording}><Send size={17} /><span>Enviar</span></button>
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
