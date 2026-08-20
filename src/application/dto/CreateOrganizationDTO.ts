export type CreateOrganizationInput = {
  name: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

export type CreateOrganizationOutput = {
  organizationId: string;
  slug: string;
  name: string;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};
