import { MemberNotFoundError } from '../../domain/errors';
import type { ContactRepository } from '../ports/ContactRepository';
import type { OrganizationMemberRepository } from '../ports/OrganizationMemberRepository';
import { OrganizationPolicy, type Actor } from '../policies/OrganizationPolicy';
import type {
  SearchContactsInput,
  SearchContactsOutput
} from '../dto/SearchContactsDTO';

export class SearchContacts {
  constructor(
    private readonly deps: {
      contacts: ContactRepository;
      members: OrganizationMemberRepository;
    }
  ) {}

  async execute(input: SearchContactsInput): Promise<SearchContactsOutput> {
    const actor = await this.loadActor(input.actorUserId, input.organizationId);
    OrganizationPolicy.canViewTickets(actor);

    const results = await this.deps.contacts.search(
      input.organizationId,
      input.query,
      input.limit
    );

    return {
      contacts: results.map(({ contact, totalTickets, lastMessageAt }) => ({
        id: contact.id,
        channelId: contact.channelId,
        phoneE164: contact.phoneE164,
        name: contact.name,
        firstContactAt: contact.firstContactAt,
        lastContactAt: contact.lastContactAt,
        totalTickets,
        lastMessageAt
      }))
    };
  }

  private async loadActor(userId: string, organizationId: string): Promise<Actor> {
    const member = await this.deps.members.findByUserAndOrganization(
      userId,
      organizationId
    );
    if (!member) {
      throw new MemberNotFoundError(userId, organizationId);
    }
    return { userId, role: member.role, active: member.active };
  }
}
