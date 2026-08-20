import { Organization } from '../../domain/entities/Organization';

export interface OrganizationRepository {
  save(organization: Organization): Promise<Organization>;
  findBySlug(slug: string): Promise<Organization | null>;
  findById(id: string): Promise<Organization | null>;
}
