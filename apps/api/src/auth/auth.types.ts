export type AuthenticatedUser = {
  id: string;
  username: string;
  roles: string[];
};

export type AccessTokenPayload = {
  sub: string;
  username: string;
  roles: string[];
};
