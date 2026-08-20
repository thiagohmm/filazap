export type AuthenticateInput = {
  email: string;
  password: string;
};

export type AuthenticateOutput = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  organizations: {
    id: string;
    name: string;
    slug: string;
    role: string;
    theme: string;
    brandColor: string;
  }[];
};
