package com.filazap.test;

import com.filazap.application.port.AuditLogger;
import com.filazap.application.port.ContactRepository;
import com.filazap.application.port.CredentialCipher;
import com.filazap.application.port.IdGenerator;
import com.filazap.application.port.InternalNoteRepository;
import com.filazap.application.port.MediaFileInput;
import com.filazap.application.port.MediaStorage;
import com.filazap.application.port.MessageRepository;
import com.filazap.application.port.OrganizationMemberRepository;
import com.filazap.application.port.OrganizationRepository;
import com.filazap.application.port.PasswordResetMailer;
import com.filazap.application.port.PasswordResetRepository;
import com.filazap.application.port.SessionPayload;
import com.filazap.application.port.SignedMediaUpload;
import com.filazap.application.port.StoredMedia;
import com.filazap.application.port.TeamChatRepository;
import com.filazap.application.port.TicketEventRepository;
import com.filazap.application.port.TicketRepository;
import com.filazap.application.port.TokenService;
import com.filazap.application.port.UserRepository;
import com.filazap.application.port.WebhookEventRepository;
import com.filazap.application.port.WhatsAppChannelRepository;
import com.filazap.application.port.WhatsAppGateway;
import com.filazap.application.port.WhatsAppWebhookParser;
import com.filazap.domain.entity.Contact;
import com.filazap.domain.entity.InternalNote;
import com.filazap.domain.entity.Message;
import com.filazap.domain.entity.Organization;
import com.filazap.domain.entity.OrganizationMember;
import com.filazap.domain.entity.Ticket;
import com.filazap.domain.entity.TicketEvent;
import com.filazap.domain.entity.User;
import com.filazap.domain.entity.WebhookEvent;
import com.filazap.domain.entity.WhatsAppChannel;
import com.filazap.domain.service.Clock;
import com.filazap.domain.service.PasswordHasher;
import com.filazap.domain.valueobject.MessageDirection;
import com.filazap.domain.valueobject.Role;
import com.filazap.domain.valueobject.TicketStatus;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

/** Fakes em memória para os testes de unidade (port do fakes.ts). */
public final class TestFakes {
    private TestFakes() {}

    // ------------------------------------------------------------------
    // Clock mutável (para testes de expiração/janela de tempo)
    // ------------------------------------------------------------------
    public static final class MutableClock implements Clock {
        private volatile Instant now;
        public MutableClock(Instant now) { this.now = now; }
        public void set(Instant now) { this.now = now; }
        @Override public Instant now() { return now; }
    }

    // ------------------------------------------------------------------
    // Repositórios em memória
    // ------------------------------------------------------------------
    public static class InMemoryOrganizationRepository implements OrganizationRepository {
        public final Map<String, Organization> store = new LinkedHashMap<>();
        @Override public Organization save(Organization o) { store.put(o.getId(), o); return o; }
        @Override public Organization findBySlug(String slug) {
            return store.values().stream().filter(o -> o.getSlug().equals(slug)).findFirst().orElse(null);
        }
        @Override public Organization findById(String id) { return store.get(id); }
    }

    public static class InMemoryUserRepository implements UserRepository {
        public final Map<String, User> store = new LinkedHashMap<>();
        @Override public User save(User u) { store.put(u.getId(), u); return u; }
        @Override public User findByEmail(String email) {
            return store.values().stream().filter(u -> u.getEmail().equals(email)).findFirst().orElse(null);
        }
        @Override public User findById(String id) { return store.get(id); }
    }

    public static class InMemoryMemberRepository implements OrganizationMemberRepository {
        public final Map<String, OrganizationMember> store = new LinkedHashMap<>();
        public final Map<String, Organization> organizations = new LinkedHashMap<>();

        public void registerOrganization(Organization org) { organizations.put(org.getId(), org); }

        private String key(String orgId, String userId) { return orgId + ":" + userId; }

        @Override public OrganizationMember save(OrganizationMember m) { store.put(key(m.getOrganizationId(), m.getUserId()), m); return m; }
        @Override public List<OrganizationMember> findByOrganizationId(String orgId) {
            return store.values().stream().filter(m -> m.getOrganizationId().equals(orgId)).toList();
        }
        @Override public OrganizationMember findById(String id) {
            return store.values().stream().filter(m -> m.getId().equals(id)).findFirst().orElse(null);
        }
        @Override public RemoveAgentResult deactivateAgentAndReleaseTickets(RemoveAgentInput input) {
            OrganizationMember member = findById(input.memberId());
            if (member == null || !member.getOrganizationId().equals(input.organizationId())
                    || !member.getUserId().equals(input.userId())
                    || member.getRole() != Role.AGENT || !member.isActive()) {
                return new RemoveAgentResult(false, 0);
            }
            member.deactivate(input.now());
            save(member);
            return new RemoveAgentResult(true, 0);
        }
        @Override public OrganizationMember findByUserAndOrganization(String userId, String orgId) { return store.get(key(orgId, userId)); }
        @Override public List<OrganizationMember> findUsersByOrganizationAndRoles(String orgId, List<Role> roles) {
            return store.values().stream().filter(m -> m.getOrganizationId().equals(orgId) && roles.contains(m.getRole())).toList();
        }
        @Override public long countByOrganization(String orgId) { return findByOrganizationId(orgId).size(); }
        @Override public List<MemberWithOrganization> findByUserIdActive(String userId) {
            return store.values().stream()
                    .filter(m -> m.getUserId().equals(userId) && m.isActive())
                    .map(m -> {
                        Organization org = organizations.get(m.getOrganizationId());
                        return new MemberWithOrganization(m,
                                m.getOrganizationId(),
                                org != null ? org.getName() : "",
                                org != null ? org.getSlug() : "",
                                org != null ? org.getTheme() : "light",
                                org != null ? org.getBrandColor() : "#10b981");
                    }).toList();
        }
    }

    public static class FakePasswordHasher implements PasswordHasher {
        @Override public String hash(String plain) { return "hash:" + plain; }
        @Override public boolean verify(String plain, String hash) { return hash.equals("hash:" + plain); }
    }

    public static class FakeTokenService implements TokenService {
        public final Map<String, SessionPayload> store = new HashMap<>();
        @Override public String sign(SessionPayload payload) {
            String token = "token:" + payload.userId();
            store.put(token, payload);
            return token;
        }
        @Override public SessionPayload verify(String token) {
            SessionPayload payload = store.get(token);
            if (payload == null) throw new IllegalStateException("invalid token");
            return payload;
        }
    }

    public static class FakeLogger implements AuditLogger {
        public final List<Map<String, Object>> logs = new ArrayList<>();
        @Override public void log(String level, String message, Map<String, Object> context) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("level", level);
            entry.put("message", message);
            if (context != null) entry.putAll(context);
            logs.add(entry);
        }
    }

    public static class InMemoryWhatsAppChannelRepository implements WhatsAppChannelRepository {
        public final Map<String, WhatsAppChannel> store = new LinkedHashMap<>();
        @Override public WhatsAppChannel save(WhatsAppChannel c) { store.put(c.getId(), c); return c; }
        @Override public WhatsAppChannel findById(String id) { return store.get(id); }
        @Override public WhatsAppChannel findByPhoneNumberId(String phoneNumberId) {
            return store.values().stream().filter(c -> c.getPhoneNumberId().equals(phoneNumberId)).findFirst().orElse(null);
        }
        @Override public List<WhatsAppChannel> findByOrganizationId(String orgId) {
            return store.values().stream().filter(c -> c.getOrganizationId().equals(orgId)).toList();
        }
        @Override public WhatsAppChannel findByBusinessAccountId(String businessAccountId) {
            return store.values().stream().filter(c -> c.getBusinessAccountId().equals(businessAccountId)).findFirst().orElse(null);
        }
        @Override public WhatsAppChannel findByWebhookVerifyToken(String token) {
            return store.values().stream().filter(c -> token.equals(c.getWebhookVerifyToken())).findFirst().orElse(null);
        }
    }

    public static class InMemoryContactRepository implements ContactRepository {
        public final Map<String, Contact> store = new LinkedHashMap<>();
        public Function<String, Integer> ticketsCountFn = id -> 0;

        @Override public Contact save(Contact c) { store.put(c.getId(), c); return c; }
        @Override public Contact findById(String id) { return store.get(id); }
        public Contact findByIdSync(String id) { return store.get(id); }
        @Override public Contact findByChannelAndPhone(String orgId, String channelId, String phoneE164) {
            return store.values().stream()
                    .filter(c -> c.getOrganizationId().equals(orgId) && c.getChannelId().equals(channelId) && c.getPhoneE164().equals(phoneE164))
                    .findFirst().orElse(null);
        }
        @Override public List<ContactSearchResult> search(String orgId, String query, int limit) {
            String q = query.trim().toLowerCase();
            if (q.isEmpty()) return List.of();
            return store.values().stream()
                    .filter(c -> c.getOrganizationId().equals(orgId)
                            && (((c.getName() == null ? "" : c.getName()).toLowerCase().contains(q)) || c.getPhoneE164().contains(q)))
                    .sorted(Comparator.comparing(Contact::getLastContactAt).reversed())
                    .limit(limit)
                    .map(c -> new ContactSearchResult(c, ticketsCountFn.apply(c.getId()), null))
                    .toList();
        }
    }

    public static class InMemoryTicketRepository implements TicketRepository {
        public final Map<String, Ticket> store = new LinkedHashMap<>();
        private final InMemoryContactRepository contacts;

        public InMemoryTicketRepository(InMemoryContactRepository contacts) { this.contacts = contacts; }

        @Override public Ticket save(Ticket t) { store.put(t.getId(), t); return t; }
        @Override public Ticket findById(String id) { return store.get(id); }
        @Override public Ticket findOpenByContact(String contactId) {
            return store.values().stream()
                    .filter(t -> t.getContactId().equals(contactId) && t.isOpen())
                    .sorted(Comparator.comparing(Ticket::getCreatedAt))
                    .findFirst().orElse(null);
        }
        @Override public Ticket findActiveByContact(String contactId) {
            return store.values().stream()
                    .filter(t -> t.getContactId().equals(contactId) && t.isActive())
                    .sorted(Comparator.comparing(Ticket::getCreatedAt))
                    .findFirst().orElse(null);
        }
        @Override public int nextSequenceNumber(String orgId) {
            return store.values().stream().filter(t -> t.getOrganizationId().equals(orgId))
                    .mapToInt(Ticket::getSequenceNumber).max().orElse(0) + 1;
        }
        @Override public List<QueueTicket> listQueue(TicketQueueFilter filter) {
            var stream = store.values().stream().filter(t -> t.getOrganizationId().equals(filter.organizationId()));
            if (filter.status() != null) stream = stream.filter(t -> t.getStatus() == filter.status());
            if (filter.assignedUserId() != null) stream = stream.filter(t -> filter.assignedUserId().equals(t.getAssignedUserId()));
            List<Ticket> matches = new ArrayList<>(stream.sorted(Comparator
                    .comparingInt(Ticket::getPriority).reversed()
                    .thenComparing(Ticket::getQueueEnteredAt)).toList());
            if (filter.limit() != null && matches.size() > filter.limit()) matches = matches.subList(0, filter.limit());
            return matches.stream().map(t -> {
                String name = null, phone = "";
                Contact c = contacts != null ? contacts.findByIdSync(t.getContactId()) : null;
                if (c != null) { name = c.getName(); phone = c.getPhoneE164(); }
                return new QueueTicket(t, name, phone, null, null, null);
            }).toList();
        }
        @Override public AssignResult assignNext(String orgId, String userId, Instant now) {
            Ticket candidate = store.values().stream()
                    .filter(t -> t.getOrganizationId().equals(orgId) && TicketStatus.isQueued(t.getStatus()) && t.getAssignedUserId() == null)
                    .sorted(Comparator.comparingInt(Ticket::getPriority).reversed().thenComparing(Ticket::getQueueEnteredAt))
                    .findFirst().orElse(null);
            if (candidate == null) return AssignResult.failure("NOT_AVAILABLE");
            Ticket assigned = Ticket.restore(candidate.getId(), candidate.getOrganizationId(),
                    candidate.getChannelId(), candidate.getContactId(), candidate.getSequenceNumber(),
                    TicketStatus.IN_PROGRESS, candidate.getPriority(), candidate.getQueueEnteredAt(),
                    userId, now, candidate.getFirstResponseAt(), candidate.getWaitingCustomerSince(),
                    candidate.getFinishedAt(), candidate.getLastMessageAt(), candidate.getCreatedAt(), now);
            store.put(assigned.getId(), assigned);
            return AssignResult.success(assigned);
        }
        @Override public AssignResult assignTicket(String ticketId, String userId, Instant now) {
            Ticket t = store.get(ticketId);
            if (t == null || !TicketStatus.isQueued(t.getStatus()) || t.getAssignedUserId() != null) {
                return AssignResult.failure("ALREADY_ASSIGNED");
            }
            Ticket assigned = Ticket.restore(t.getId(), t.getOrganizationId(), t.getChannelId(),
                    t.getContactId(), t.getSequenceNumber(), TicketStatus.IN_PROGRESS, t.getPriority(),
                    t.getQueueEnteredAt(), userId, now, t.getFirstResponseAt(), t.getWaitingCustomerSince(),
                    t.getFinishedAt(), t.getLastMessageAt(), t.getCreatedAt(), now);
            store.put(assigned.getId(), assigned);
            return AssignResult.success(assigned);
        }
        @Override public List<Ticket> findAssignedOpenByUser(String orgId, String userId) {
            return store.values().stream()
                    .filter(t -> t.getOrganizationId().equals(orgId) && userId.equals(t.getAssignedUserId())
                            && (t.getStatus() == TicketStatus.IN_PROGRESS || t.getStatus() == TicketStatus.WAITING_CUSTOMER))
                    .toList();
        }
        @Override public OperationalCounters getOperationalCounters(String orgId, Instant now) {
            List<Ticket> tickets = store.values().stream().filter(t -> t.getOrganizationId().equals(orgId)).toList();
            long waiting = countStatus(tickets, TicketStatus.WAITING);
            long returning = countStatus(tickets, TicketStatus.RETURNING);
            long inProgress = countStatus(tickets, TicketStatus.IN_PROGRESS);
            long waitingCustomer = countStatus(tickets, TicketStatus.WAITING_CUSTOMER);
            Instant dayStart = now.atZone(ZoneOffset.UTC).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
            long finishedToday = tickets.stream()
                    .filter(t -> t.getStatus() == TicketStatus.FINISHED && t.getFinishedAt() != null && !t.getFinishedAt().isBefore(dayStart))
                    .count();
            Ticket oldest = tickets.stream().filter(t -> TicketStatus.isQueued(t.getStatus()))
                    .sorted(Comparator.comparingInt(Ticket::getPriority).reversed().thenComparing(Ticket::getQueueEnteredAt))
                    .findFirst().orElse(null);
            Long maxWaitSeconds = oldest != null
                    ? Math.max(0, Duration.between(oldest.getQueueEnteredAt(), now).getSeconds()) : null;
            List<Ticket> withFirst = tickets.stream().filter(t -> t.getFirstResponseAt() != null).toList();
            Double avgFirst = withFirst.isEmpty() ? null
                    : withFirst.stream().mapToDouble(t -> Duration.between(t.getQueueEnteredAt(), t.getFirstResponseAt()).getSeconds())
                            .average().orElse(0);
            return new OperationalCounters(waiting, returning, inProgress, waitingCustomer,
                    finishedToday, maxWaitSeconds, avgFirst);
        }
        @Override public List<TicketHistoryItem> findByContact(String orgId, String contactId) {
            return store.values().stream()
                    .filter(t -> t.getOrganizationId().equals(orgId) && t.getContactId().equals(contactId))
                    .sorted(Comparator.comparing(Ticket::getQueueEnteredAt).reversed())
                    .map(t -> new TicketHistoryItem(t, null)).toList();
        }
        @Override public OrganizationMetrics getMetrics(String orgId, Instant now) {
            List<Ticket> tickets = store.values().stream().filter(t -> t.getOrganizationId().equals(orgId)).toList();
            List<Ticket> finished = tickets.stream().filter(t -> t.getStatus() == TicketStatus.FINISHED && t.getFinishedAt() != null).toList();
            Double avg = finished.isEmpty() ? null
                    : finished.stream().mapToDouble(t -> Duration.between(t.getQueueEnteredAt(), t.getFinishedAt()).getSeconds())
                            .average().orElse(0);
            Map<String, Integer> byAgent = new HashMap<>();
            for (Ticket t : tickets) if (t.getAssignedUserId() != null) byAgent.merge(t.getAssignedUserId(), 1, Integer::sum);
            List<TicketsPerAgent> perAgent = byAgent.entrySet().stream()
                    .map(e -> new TicketsPerAgent(e.getKey(), e.getKey(), e.getValue())).toList();
            Map<String, Integer> contactCounts = new HashMap<>();
            for (Ticket t : tickets) contactCounts.merge(t.getContactId(), 1, Integer::sum);
            int withTickets = contactCounts.size();
            long returning = contactCounts.values().stream().filter(c -> c >= 2).count();
            Double returnRate = withTickets > 0 ? Math.round((returning / (double) withTickets) * 1000) / 10.0 : null;
            return new OrganizationMetrics(avg, finished.size(), perAgent, returnRate);
        }

        private long countStatus(List<Ticket> tickets, TicketStatus status) {
            return tickets.stream().filter(t -> t.getStatus() == status).count();
        }
    }

    public static class InMemoryMessageRepository implements MessageRepository {
        public final Map<String, Message> store = new LinkedHashMap<>();
        @Override public Message save(Message m) { store.put(m.getId(), m); return m; }
        @Override public Message findById(String id) { return store.get(id); }
        @Override public Message findByWhatsappMessageId(String whatsappMessageId) {
            return store.values().stream().filter(m -> whatsappMessageId.equals(m.getWhatsappMessageId())).findFirst().orElse(null);
        }
        @Override public List<Message> findByTicketId(String orgId, String ticketId) {
            return store.values().stream()
                    .filter(m -> m.getOrganizationId().equals(orgId) && m.getTicketId().equals(ticketId))
                    .sorted(Comparator.comparing(m -> m.getProviderTimestamp() == null ? Instant.EPOCH : m.getProviderTimestamp()))
                    .toList();
        }
    }

    public static class InMemoryWebhookEventRepository implements WebhookEventRepository {
        public final Map<String, WebhookEvent> store = new LinkedHashMap<>();
        @Override public WebhookEvent save(WebhookEvent e) { store.put(e.getId(), e); return e; }
        @Override public WebhookEvent findById(String id) { return store.get(id); }
        @Override public WebhookEvent findByProviderEventId(String providerEventId) {
            return store.values().stream().filter(e -> providerEventId.equals(e.getProviderEventId())).findFirst().orElse(null);
        }
    }

    public static class InMemoryInternalNoteRepository implements InternalNoteRepository {
        public final Map<String, InternalNote> store = new LinkedHashMap<>();
        @Override public InternalNote save(InternalNote n) { store.put(n.getId(), n); return n; }
        @Override public InternalNote findById(String id) { return store.get(id); }
        @Override public List<InternalNote> findByContactId(String orgId, String contactId) {
            return store.values().stream().filter(n -> n.getOrganizationId().equals(orgId) && n.getContactId().equals(contactId)).toList();
        }
    }

    public static class InMemoryTicketEventRepository implements TicketEventRepository {
        public final Map<String, TicketEvent> store = new LinkedHashMap<>();
        @Override public TicketEvent save(TicketEvent e) { store.put(e.getId(), e); return e; }
        @Override public List<TicketEvent> findByTicketId(String orgId, String ticketId) {
            return store.values().stream().filter(e -> e.getOrganizationId().equals(orgId) && e.getTicketId().equals(ticketId)).toList();
        }
    }

    public static class FakeWhatsAppGateway implements WhatsAppGateway {
        public final List<SendMessageCommand> calls = new ArrayList<>();
        public final List<UploadMediaCommand> uploadCalls = new ArrayList<>();
        public final List<SendMediaCommand> sendMediaCalls = new ArrayList<>();
        public final List<FetchMediaCommand> fetchMediaCalls = new ArrayList<>();

        @Override public SendMessageResult sendText(SendMessageCommand command) {
            calls.add(command);
            return new SendMessageResult("wamid.MOCK." + calls.size());
        }
        @Override public UploadMediaResult uploadMedia(UploadMediaCommand command) {
            uploadCalls.add(command);
            return new UploadMediaResult("media.MOCK." + uploadCalls.size());
        }
        @Override public SendMessageResult sendMedia(SendMediaCommand command) {
            sendMediaCalls.add(command);
            return new SendMessageResult("wamid.MOCK.MEDIA." + sendMediaCalls.size());
        }
        @Override public FetchMediaResult fetchMedia(FetchMediaCommand command) {
            fetchMediaCalls.add(command);
            return new FetchMediaResult("conteudo-falso-da-midia".getBytes(), "image/png", null);
        }
    }

    public static class InMemoryMediaStorage implements MediaStorage {
        public final Map<String, byte[]> files = new HashMap<>();
        @Override public StoredMedia store(MediaFileInput input) {
            String storedPath = "media/" + input.orgId() + "/" + Long.toHexString(System.nanoTime());
            files.put(storedPath, input.data());
            return new StoredMedia(storedPath, "/api/organizations/" + input.orgId() + "/media/" + storedPath);
        }
        @Override public byte[] read(String storedPath) {
            byte[] data = files.get(storedPath);
            if (data == null) throw new IllegalStateException("arquivo não encontrado no armazenamento de teste");
            return data;
        }
    }

    public static class FakeWhatsAppWebhookParser implements WhatsAppWebhookParser {
        public ParsedWebhook result = new ParsedWebhook(null, null, List.of(), List.of());
        @Override public ParsedWebhook parse(Map<String, Object> payload) { return result; }
    }

    public static class FakeCredentialCipher implements CredentialCipher {
        @Override public String encrypt(String plain) { return "enc:" + plain; }
        @Override public String decrypt(String cipher) { return cipher.replaceFirst("^enc:", ""); }
    }

    public static class InMemoryPasswordResetRepository implements PasswordResetRepository {
        public NewPasswordResetToken token;
        public Instant usedAt;
        private final InMemoryUserRepository users;
        public InMemoryPasswordResetRepository(InMemoryUserRepository users) { this.users = users; }

        @Override public void replaceForUser(NewPasswordResetToken token) { this.token = token; this.usedAt = null; }
        @Override public boolean consumeAndUpdatePassword(String tokenHash, String passwordHash, Instant now) {
            if (token == null || !token.tokenHash().equals(tokenHash) || usedAt != null || !token.expiresAt().isAfter(now)) {
                return false;
            }
            usedAt = now;
            User user = users.findById(token.userId());
            if (user == null) return false;
            users.save(User.restore(user.getId(), user.getEmail(), user.getName(), passwordHash,
                    user.getCreatedAt(), user.getUpdatedAt()));
            return true;
        }
    }

    public static class FakeMailer implements PasswordResetMailer {
        public final List<Map<String, Object>> sent = new ArrayList<>();
        @Override public void send(String email, String name, String resetUrl) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("email", email); m.put("name", name); m.put("resetUrl", resetUrl);
            sent.add(m);
        }
    }

    public static class InMemoryTeamChatRepository implements TeamChatRepository {
        public final Map<String, Instant> presences = new HashMap<>();
        public final List<TeamChatRecord> messages = new ArrayList<>();

        @Override public void touchPresence(String orgId, String userId, Instant now) { presences.put(orgId + ":" + userId, now); }
        @Override public List<String> listOnlineUserIds(String orgId, Instant since) {
            return presences.entrySet().stream()
                    .filter(e -> e.getKey().startsWith(orgId + ":") && !e.getValue().isBefore(since))
                    .map(e -> e.getKey().substring(orgId.length() + 1)).toList();
        }
        @Override public boolean isUserOnline(String orgId, String userId, Instant since) {
            Instant seen = presences.get(orgId + ":" + userId);
            return seen != null && !seen.isBefore(since);
        }
        @Override public TeamChatRecord save(TeamChatRecord message) { messages.add(message); return message; }
        @Override public List<TeamChatRecord> listVisibleMessages(String orgId, String userId, int limit) {
            List<TeamChatRecord> visible = messages.stream()
                    .filter(m -> m.organizationId().equals(orgId)
                            && (m.recipientUserId() == null || m.senderUserId().equals(userId) || userId.equals(m.recipientUserId())))
                    .toList();
            int from = Math.max(0, visible.size() - limit);
            return visible.subList(from, visible.size());
        }
    }

    // ------------------------------------------------------------------
    // Fábricas de serviços de teste
    // ------------------------------------------------------------------
    public static final class TestServices {
        public final InMemoryOrganizationRepository organizations;
        public final InMemoryUserRepository users;
        public final InMemoryMemberRepository members;
        public final FakePasswordHasher passwordHasher;
        public final FakeTokenService tokenService;
        public final FakeLogger logger;
        public final IdGenerator idGenerator;
        public final Clock clock;

        TestServices(InMemoryOrganizationRepository organizations, InMemoryUserRepository users,
                     InMemoryMemberRepository members, FakePasswordHasher passwordHasher,
                     FakeTokenService tokenService, FakeLogger logger, IdGenerator idGenerator, Clock clock) {
            this.organizations = organizations;
            this.users = users;
            this.members = members;
            this.passwordHasher = passwordHasher;
            this.tokenService = tokenService;
            this.logger = logger;
            this.idGenerator = idGenerator;
            this.clock = clock;
        }
    }

    public static TestServices testServices() {
        InMemoryOrganizationRepository organizations = new InMemoryOrganizationRepository();
        InMemoryUserRepository users = new InMemoryUserRepository();
        InMemoryMemberRepository members = new InMemoryMemberRepository();
        FakePasswordHasher passwordHasher = new FakePasswordHasher();
        FakeTokenService tokenService = new FakeTokenService();
        FakeLogger logger = new FakeLogger();
        AtomicInteger counter = new AtomicInteger();
        IdGenerator idGenerator = () -> "id-" + counter.incrementAndGet();
        Clock clock = new MutableClock(Instant.parse("2026-08-19T12:00:00Z"));
        return new TestServices(organizations, users, members, passwordHasher, tokenService, logger, idGenerator, clock);
    }

    public static final class WhatsAppServices {
        public final InMemoryWhatsAppChannelRepository channels;
        public final InMemoryContactRepository contacts;
        public final InMemoryTicketRepository tickets;
        public final InMemoryMessageRepository messages;
        public final InMemoryWebhookEventRepository webhookEvents;
        public final InMemoryTicketEventRepository ticketEvents;
        public final InMemoryInternalNoteRepository notes;
        public final FakeWhatsAppGateway gateway;
        public final FakeWhatsAppWebhookParser parser;
        public final FakeCredentialCipher cipher;
        public final InMemoryMediaStorage mediaStorage;
        public final IdGenerator idGenerator;
        public final Clock clock;

        WhatsAppServices(InMemoryWhatsAppChannelRepository channels, InMemoryContactRepository contacts,
                         InMemoryTicketRepository tickets, InMemoryMessageRepository messages,
                         InMemoryWebhookEventRepository webhookEvents, InMemoryTicketEventRepository ticketEvents,
                         InMemoryInternalNoteRepository notes, FakeWhatsAppGateway gateway,
                         FakeWhatsAppWebhookParser parser, FakeCredentialCipher cipher,
                         InMemoryMediaStorage mediaStorage, IdGenerator idGenerator, Clock clock) {
            this.channels = channels;
            this.contacts = contacts;
            this.tickets = tickets;
            this.messages = messages;
            this.webhookEvents = webhookEvents;
            this.ticketEvents = ticketEvents;
            this.notes = notes;
            this.gateway = gateway;
            this.parser = parser;
            this.cipher = cipher;
            this.mediaStorage = mediaStorage;
            this.idGenerator = idGenerator;
            this.clock = clock;
        }
    }

    public static WhatsAppServices whatsappServices() {
        InMemoryWhatsAppChannelRepository channels = new InMemoryWhatsAppChannelRepository();
        InMemoryContactRepository contacts = new InMemoryContactRepository();
        InMemoryTicketRepository tickets = new InMemoryTicketRepository(contacts);
        InMemoryMessageRepository messages = new InMemoryMessageRepository();
        InMemoryWebhookEventRepository webhookEvents = new InMemoryWebhookEventRepository();
        InMemoryTicketEventRepository ticketEvents = new InMemoryTicketEventRepository();
        InMemoryInternalNoteRepository notes = new InMemoryInternalNoteRepository();
        FakeWhatsAppGateway gateway = new FakeWhatsAppGateway();
        FakeWhatsAppWebhookParser parser = new FakeWhatsAppWebhookParser();
        FakeCredentialCipher cipher = new FakeCredentialCipher();
        InMemoryMediaStorage mediaStorage = new InMemoryMediaStorage();
        AtomicInteger counter = new AtomicInteger();
        IdGenerator idGenerator = () -> "wa-" + counter.incrementAndGet();
        Clock clock = new MutableClock(Instant.parse("2026-08-19T12:00:00Z"));
        return new WhatsAppServices(channels, contacts, tickets, messages, webhookEvents, ticketEvents,
                notes, gateway, parser, cipher, mediaStorage, idGenerator, clock);
    }
}
