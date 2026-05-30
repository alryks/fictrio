export type AuthenticatedUser = {
  id: string;
  username: string;
  isActive: boolean;
  roles: string[];
};

export type AccessTokenPayload = {
  sub: string;
  username: string;
  roles: string[];
};
