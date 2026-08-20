export type UpdateOrganizationAppearanceInput = {
  actorUserId: string;
  organizationId: string;
  theme?: string;
  brandColor?: string;
};

export type UpdateOrganizationAppearanceOutput = {
  organization: {
    id: string;
    name: string;
    slug: string;
    theme: string;
    brandColor: string;
  };
};
